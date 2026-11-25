# Recovery StateMachine::advance() — Concept v0.3

**Статус:** APPROVED CONCEPT / ARCHITECTURE PROPOSAL  
**Дата:** 2026-11-25  
**Ветка:** `work/spatial-planner`  
**Код:** не реализован; псевдокод не является компилируемым Rust.

## 1. Назначение и границы доверия

Документ описывает модульную State Machine для Recovery Ceremony. Coordinator оркестрирует; State Machine проверяет допустимость переходов; Evidence Engine проверяет доказательства; KVP Authorization Gate — единственный источник полномочий; Anchor фиксирует доверенное состояние, но не авторизует; Audit сохраняет происхождение и результат.

Ни Architect, Planner, Agent Swarm, Coordinator, Evidence Engine или Anchor не могут самостоятельно выдавать полномочия Root Authority.

## 2. Принятые архитектурные принципы

- Fail-closed: неизвестное состояние → INDETERMINATE, а не ALLOW.
- KVP — единственный источник полномочий.
- Anchor — источник доказательства собственной зафиксированной версии/состояния, но не владелец policy/authority.
- Evidence validation, authorization, reservation, anchor commit и audit completion — разные контракты.
- Не удерживать Mutex во время сетевых/внешних вызовов. Использовать durable reservation, fencing и optimistic concurrency/CAS.
- `state_version`, `anchor_counter` и `audit_sequence` независимы и не обязаны совпадать.
- `ROOT_CONTROL_FROZEN` и `OWNER_RECOVERY_LOCK` независимы; один lock не снимает другой.
- `RecoveryBlocked` — защитная остановка, не обычный переход и не способ очистить lock.
- Anchor Commit и Audit Completion не являются одной атомарной операцией; после Anchor Commit rollback не выполняется, используется reconciliation.
- Повторный transition ID с тем же digest идемпотентен; тот же ID с другим digest — конфликт.

## 3. Модульная архитектура

1. Coordinator — оркестрация без полномочий.
2. State Machine — состояния, допустимые переходы, guards и invariants.
3. Evidence Engine — валидация EvidenceBundle, independence, Council quorum, FROST session, IV Panel и R4.
4. Quorum Verifier — проверка порога, уникальности, статусов и независимости.
5. Time Validator — TrustedTime, freshness, expiry и uncertainty.
6. Canonical Engine — строгая канонизация/проверка подписываемого представления и digest.
7. Audit Engine — durable Audit Intent / Completion и provenance.
8. KVP Authorization Gate — Grant, revocation epoch, scoped reservations, Prepare/Complete.
9. Hybrid Anchor — monotonic state/counter, fencing, durable prepare, atomic commit, receipt, abort/closure, reconciliation.

## 4. Типизированные контракты

### TransitionRequest
Концептуально связывает:
- `recovery_id`, `transition_id`;
- `from_state`, `to_state`;
- `expected_state_version`, `expected_anchor_counter`;
- `package_digest`, `evidence_digest`, `manifest_digest`;
- `policy_version`, `requested_by`;
- `requested_at: TrustedTimeEvidence`;
- `challenge_id`.

### ReservationProof
Должен связывать recovery/transition ID, request digest, expected state version, fencing generation/token, reservation identity, scope, validity context и подпись/доказательство KVP. Reservation — durable, scoped, с fencing; конкурентные critical transitions одной ceremony запрещены, если policy явно не разрешает безопасное разбиение.

### KvpTransitionGrant
Позитивный Grant, создаваемый только при `AuthorizationOutcome::Allowed`. DENY и INDETERMINATE не являются токенами.
Связи: grant ID, transition request digest, recovery/transition ID, permitted transition, scope, package/manifest/policy digest/version, audience, expiry, one-time nonce, revocation epoch, issuer key ID и подпись KVP.
Для критических Root Authority переходов `GrantEpoch == CurrentEpoch`. Epoch равенство необходимо, но не заменяет остальные проверки.

### PreparedCommitRecord / PrepareAck
Долговечная KVP reservation и Anchor prepared record связываются через prepare ID, transition ID, Grant/package/manifest digests, epoch, scope, fencing, expected anchor counter/state hash, expiry и Audit Intent digest.
PrepareAck выдаётся только после долговечной KVP-записи. Anchor сохраняет собственную prepared-запись до физического Commit.

### AnchorCommitOutcome / VerifiedAnchorReceipt
Typed outcomes: Committed, AlreadyCommitted, NotCommitted (только с closure proof), Rejected, Indeterminate, Conflict. Положительный VerifiedAnchorReceipt создаётся только после проверки подписи, state/hash/counter, transition/request/grant/package/manifest digests, prepare binding и linearization evidence.

### AuthorizationOutcome
`Allowed(KvpTransitionGrant)`, `Denied(error)`, `Indeterminate(uncertainty)`. Никакой bool/nullable token не заменяет типизированный исход.

## 5. TransitionPhase

Внутренний lifecycle одной транзакции, не публичное RecoveryState:

- Received
- Reserved
- Validated
- AuditIntentRecorded
- PreparePending
- Prepared
- AnchorCommitPending
- AnchorCommitted
- CompletionPending
- Completed
- AbortPending
- Aborted
- ReconciliationRequired
- Rejected
- Blocked

## 6. AdvanceOutcome

Концептуальные исходы:
- `Anchored(VerifiedAnchorReceipt)`;
- `AlreadyCommitted(VerifiedAnchorReceipt)`;
- `Aborted(VerifiedAbortProof)`;
- `Denied(TransitionDenial)`;
- `Indeterminate(ReconciliationRequired)`;
- `Blocked(RecoveryBlockReason)`.

Completed/AlreadyCommitted нельзя выдавать только на основании локального StateMachine snapshot.

## 7. Порядок advance()

1. Проверить canonical request, версию схемы, digest и типизированные идентификаторы.
2. Проверить idempotency по transition ID + request digest. Same ID/different digest → Blocked conflict; completed same request → AlreadyCommitted; unresolved → Indeterminate/reconciliation.
3. Получить durable reservation и fencing proof (CAS/unique key); внешние вызовы выполнять вне Mutex.
4. Получить authoritative Anchor state proof или reconciliation result; локальный snapshot не является доказательством Anchor.
5. Проверить Manifest, монотонность, допустимый transition и policy version.
6. Валидировать EvidenceBundle; Valid → opaque ValidatedEvidence; Invalid → Denied; Indeterminate → Indeterminate.
7. Проверить independence, Council quorum, FROST session, IV Panel, R4/ITVR и freshness/revocation status.
8. Запросить KVP authorization; только Allowed возвращает положительный KvpTransitionGrant.
9. Долговечно записать Audit Intent. Если Audit Intent не записан, Anchor Commit не начинать.
10. KVP выполняет PREPARE: проверяет Grant/epoch/scope и долговечно записывает PreparedCommitRecord; выдаёт PrepareAck.
11. Anchor проверяет PrepareAck, reservation/fencing, expected state/counter и долговечно сохраняет свой PreparedCommitRecord.
12. Anchor выполняет атомарный Commit. Commit и ForceAbort сериализуются внутри Anchor; точка линеаризации должна быть однозначной.
13. Проверить AnchorCommitReceipt; невалидный/непривязанный receipt → Indeterminate, не ALLOW.
14. KVP получает CommitComplete, фиксирует Anchor-Committed и разрешает связанные pending операции по протоколу Revocation Commit.
15. Audit Engine фиксирует Completion с проверенным receipt. Если Completion не удался после Commit — не rollback, статус CompletionPending и reconciliation.
16. Применить локальную state transition с CAS/fencing. Ошибка после Anchor Commit → StateApplyPending/Indeterminate и reconciliation, не отмена Anchor.

## 8. Reconciliation

Reconciliation — детерминированный технический процесс сверки, не AI-агент и не источник полномочий.

- Anchor COMMITTED + valid receipt → AnchorCommitted; завершить KVP/Audit Completion.
- Anchor NOT_COMMITTED + доказанное durable closure Prepare → ABORTED.
- Anchor journal lost / AMNESIA → новые Commit запрещены; сверить KVP и Audit, восстановить контекст только при достаточных независимых доказательствах.
- KVP journal lost → восстановить из Anchor и Audit; Anchor Commit не стирать и не объявлять несуществующим.
- Источники противоречат или недоступны → RECONCILIATION_REQUIRED / INDETERMINATE.
- NOT_COMMITTED требует не только отсутствия записи, но и доказательства, что старый Prepare окончательно закрыт и не сможет исполниться позднее.

## 9. Revocation ordering

Для критических операций действует Revocation Commit Protocol v0.1 (см. `docs/REVOCATION_COMMIT_PROTOCOL_SPEC.md`).

- Revocation устанавливает scoped REVOCATION_PENDING и блокирует новые Grant/Prepare.
- Epoch нельзя продвинуть, пока все конфликтующие Prepared transactions не завершены Commit или доказанным Abort.
- Допустимые порядки: PREPARE ≺ COMMIT ≺ REVOCATION либо PREPARE ≺ ABORT ≺ REVOCATION.
- ForceAbort и Commit сериализуются внутри Anchor.
- TTL не доказывает отсутствие Commit.
- Неопределённый исход блокирует дальнейшие критические переходы.

## 10. 11 этапов Recovery Ceremony

1. EVENT DETECTED.
2. RECOVERY DECLARED.
3. ROOT CONTROL FROZEN.
4. MANIFEST VALIDATION.
5. INDEPENDENT ASSESSMENT.
6. RECOVERY PACKAGE PREPARED.
7. EVIDENCE & QUORUM.
8. TECHNICAL & AUTHORITY APPROVAL.
9. ROOT RECONSTITUTION.
10. INDEPENDENT VALIDATION.
11. ROOT CONTROL RESTORED.

Freeze и Owner Recovery Lock независимы. Снятие ROOT_CONTROL_FROZEN — отдельное KVP-authorized решение после независимой валидации; Anchor Commit на этапе 9 не снимает Freeze автоматически.

## 11. Adversarial audit — согласованные исходы

### Parallel Coordinators
Durable unique reservation/CAS: один процесс получает reservation. Второй с тем же ID+digest видит ExistingTransaction; с другим digest — Blocked conflict. Он не создаёт вторую транзакцию.

### Stale Fencing Token
Anchor отвергает token ниже последнего **активированного в Anchor** fencing generation. Простая выдача нового token в KVP недостаточна: нужна Fencing Activation Protocol (см. раздел 12).

### Replay
Same completed transition + same digest → исходный receipt / AlreadyCommitted. Same ID + different digest → Blocked. In-flight → Indeterminate/ExistingTransaction. Старые Prepare закрываются durable tombstone.

### Stuck Prepare / Journal loss
TTL не снимает блокировку. Anchor должен доказать COMMITTED или NOT_COMMITTED + closure. Потеря журнала → AMNESIA/Indeterminate, критические Commit запрещены до восстановления.

## 12. Дополнительные уточнения, предложенные для утверждения (не заморожены)

Следующие уточнения выявлены при финальном аудите, но на момент записи ещё не были отдельно утверждены пользователем. Они не должны трактоваться как окончательно принятые интерфейсы.

### 12.1 Fencing Activation Protocol
Риск: KVP выдал token N+1, но Anchor ещё не узнал о нём и принимает старый token N.
Предложение:
1. KVP создаёт новую generation.
2. Anchor получает ActivateFencingGeneration.
3. Anchor долговечно сохраняет generation.
4. Anchor возвращает подписанный FencingActivationReceipt.
5. Только после этого KVP считает новую generation активной.
6. Anchor отвергает все старые tokens.
Для уже PREPARED транзакции нужен отдельный однозначный recovery/transfer/abort путь; нельзя просто переназначить владельца Commit.

### 12.2 AnchorCommitted != Completed
Если Anchor Commit доказан, но KVP/Audit Completion отсутствует, восстановленный статус — COMPLETION_PENDING / AnchorCommitted, а не COMPLETED.
COMPLETED требует валидного receipt, KVP completion и обязательной Audit Completion. Потеря KVP Journal не отменяет физический Commit.

### 12.3 ForceAbort vs Commit serialization
ForceAbortPrepare и Anchor.commit должны сериализоваться внутри Anchor:
- ForceAbort первым → durable closure, будущий Commit запрещён;
- Commit первым → Commit остаётся, abort не может переписать историю;
- неизвестный порядок → INDETERMINATE.
Abort сохраняет closure/tombstone evidence.

## 13. Предварительная модульная структура Rust crate

```text
kvp-recovery/
└── src/
    ├── lib.rs
    ├── types/
    │   ├── mod.rs
    │   ├── identifiers.rs
    │   ├── digests.rs
    │   ├── versions.rs
    │   ├── outcomes.rs
    │   └── errors.rs
    ├── canonical/
    │   ├── mod.rs
    │   ├── encoding.rs
    │   ├── digest.rs
    │   └── domain_separation.rs
    ├── time/
    │   ├── mod.rs
    │   ├── trusted_time.rs
    │   ├── freshness.rs
    │   └── validation.rs
    ├── evidence/
    │   ├── mod.rs
    │   ├── validated.rs
    │   ├── validator.rs
    │   ├── bundle.rs
    │   ├── independence.rs
    │   ├── quorum.rs
    │   ├── frost.rs
    │   ├── iv_panel.rs
    │   └── r4.rs
    ├── authorization/
    │   ├── mod.rs
    │   ├── grant.rs
    │   ├── policy.rs
    │   ├── revocation.rs
    │   ├── epoch.rs
    │   └── prepare.rs
    ├── reservation/
    │   ├── mod.rs
    │   ├── reservation.rs
    │   ├── fencing.rs
    │   └── activation.rs
    ├── anchor/
    │   ├── mod.rs
    │   ├── contract.rs
    │   ├── prepared_record.rs
    │   ├── commit.rs
    │   ├── abort.rs
    │   ├── receipt.rs
    │   └── reconciliation.rs
    ├── audit/
    │   ├── mod.rs
    │   ├── intent.rs
    │   ├── completion.rs
    │   ├── provenance.rs
    │   └── recovery.rs
    ├── state_machine/
    │   ├── mod.rs
    │   ├── state.rs
    │   ├── phase.rs
    │   ├── transition.rs
    │   ├── advance.rs
    │   ├── guards.rs
    │   └── invariants.rs
    ├── coordinator/
    │   ├── mod.rs
    │   ├── recovery.rs
    │   └── orchestration.rs
    └── recovery/
        ├── mod.rs
        ├── package.rs
        ├── manifest.rs
        ├── triggers.rs
        └── reconciliation.rs
```

Это предварительная архитектурная декомпозиция. До компиляции требуется проверить Rust module privacy, публичность типов, зависимости и отсутствие циклов. Не следует одновременно объявлять один модуль `pub mod` и `mod`; публичный API лучше собирать через контролируемые `pub use` из `lib.rs`.

Предварительный минимальный публичный фасад:

```rust
pub mod types;
pub mod recovery;

mod canonical;
mod time;
mod evidence;
mod authorization;
mod reservation;
mod anchor;
mod audit;
mod coordinator;
mod state_machine;

pub use state_machine::{
    AdvanceOutcome,
    RecoveryState,
    TransitionContext,
};
```

## 14. Что не замораживается

- digest algorithm/length и crypto libraries;
- конкретные FROST/DKG implementation details;
- HSM/TPM vendor/API и атомарность выбранного backend;
- database backend и durable transaction store;
- транспорт KVP ↔ Anchor;
- Audit Sink storage/append-only guarantees;
- окончательная область действия revocation epoch;
- Fencing Activation protocol до отдельного утверждения;
- точная структура публичных Rust traits и module visibility.

## 15. Доказанность и следующий этап

Это согласованный Concept v0.3 и предварительная структура, а не реализация и не формальное доказательство безопасности. Тесты не запускались; Rust Skeleton не создан; FROST/DKG, HSM/TPM, storage и network integration не реализованы.

До Interface Baseline v0.1 необходимо отдельно утвердить три уточнения раздела 12 и проверить конкурентные interleavings формальной моделью (например, TLA+/PlusCal), затем подготовить property-based и fault-injection tests.
