# Revocation Commit Protocol v0.1

**Статус:** APPROVED ARCHITECTURAL DESIGN INPUT  
**Дата согласования:** 2026-11-25  
**Ветка:** `work/spatial-planner`  
**Область:** критические Recovery / Root Authority transitions  
**Реализация:** не создана; документ фиксирует архитектурный контракт, а не production-ready протокол.

## 1. Назначение

Установить однозначный тотальный порядок между отзывом полномочий (изменением `revocation_epoch`) и физической фиксацией перехода в Hybrid Anchor.

Подписанная EpochAttestation подтверждает авторство и целостность сообщения, но сама по себе не доказывает актуальность epoch в момент Anchor Commit. Асинхронный push не закрывает TOCTOU: Anchor может ещё не получить обновление после отзыва в KVP.

Для критических переходов используется синхронная проверка KVP с долговечной reservation и двухфазной фиксацией KVP ↔ Anchor. Push остаётся оптимизацией распространения состояния, но не источником окончательной гарантии.

## 2. Авторитет и epoch

- Единственный авторитетный владелец и управляющий `revocation_epoch` — KVP Authorization Gate.
- Anchor хранит последнее подтверждённое состояние и долговечные доказательства переходов, но не является владельцем полномочий или источником истины о Grant.
- Для критических Root Authority переходов требуется строгое равенство `GrantEpoch == CurrentEpoch`.
- `GrantEpoch < CurrentEpoch` → DENY (устаревший Grant).
- `GrantEpoch > CurrentEpoch` → INDETERMINATE (противоречивое состояние).
- Равенство epoch — необходимое, но не достаточное условие: отдельно проверяются Grant, scope, audience, expiry, nonce, policy, reservation, fencing и evidence.
- Естественное истечение срока Grant проверяется отдельно и не обязано увеличивать глобальный epoch.
- Область действия epoch (глобальная, Principal/Authority, revocation domain) остаётся отдельным вопросом проектирования. Для Root Authority применяется строгий согласованный критический контур; глобальный epoch не следует автоматически распространять на все обычные операции Agent Swarm.

## 3. Линеаризация и 2PC

### Phase 1 — PREPARE

1. Anchor запрашивает у KVP `PrepareCommit(transition_id, grant_digest, grant_epoch, package_digest, manifest_digest, reservation/fencing context)`.
2. KVP проверяет актуальность Grant и epoch, policy, scope, reservation, отсутствие конфликтующего отзыва и допустимость перехода.
3. KVP долговечно записывает `PreparedCommitRecord` до выдачи подтверждения.
4. KVP устанавливает scoped reservation для данного transition/scope и выдаёт подписанный `PrepareAck`.
5. Anchor проверяет PrepareAck и долговечно сохраняет собственную Prepared-запись до физического Commit.

### Phase 2 — COMMIT

Anchor непосредственно перед фиксацией проверяет:
- подпись и контекст PrepareAck;
- `transition_id`, `prepare_id`, все соответствующие digests;
- scope, Grant binding и epoch;
- reservation и fencing token;
- отсутствие durable abort/close marker;
- ожидаемую Anchor state/hash/counter;
- допустимость атомарного перехода.

**ANCHOR_COMMIT_LINEARIZATION_POINT** — атомарное долговечное событие Anchor, при котором проверенный переход состояния и соответствующий monotonic counter фиксируются как одно неделимое изменение. До этой точки Commit не считается совершённым; после неё его нельзя объявить несуществовавшим или отменить задним числом.

### Phase 3 — COMPLETE

1. Anchor отправляет KVP подписанное подтверждение Commit с receipt и доказательствами привязки к Prepare.
2. KVP проверяет receipt и отмечает транзакцию как Anchor-Committed.
3. KVP завершает reservation/обрабатывает ожидающий отзыв согласно порядку линеаризации.
4. Audit Completion фиксируется отдельно от Anchor Commit.
5. State Machine завершает публичный переход только после проверки всех обязательных подтверждений.

`COMMITTED` на Anchor не тождественно `COMPLETED` всей распределённой транзакции.

## 4. PreparedCommitRecord

Концептуальные поля:
- `prepare_id`;
- `recovery_id`;
- `transition_id`;
- `grant_id` / `grant_digest`;
- `package_digest`;
- `manifest_digest`;
- `revocation_epoch`;
- `scope`;
- `fencing_token`;
- `expected_anchor_counter`;
- `expected_previous_state_hash`;
- `expires_at`;
- `prepare_status`;
- `audit_intent_digest`;
- `kvp_signature`.

KVP и Anchor сохраняют собственные долговечные записи. Записи должны быть связаны одними и теми же идентификаторами и digest. PrepareAck — не просто подписанный снимок epoch, а подтверждение конкретной зарезервированной транзакции.

## 5. Revocation semantics

Отзыв — активная процедура с scoped блокировкой.

1. KVP принимает достоверное основание отзыва и устанавливает `REVOCATION_PENDING` для соответствующего scope.
2. Новые Grant и новые Prepare в этом scope блокируются.
3. KVP перечисляет все конфликтующие PreparedCommitRecord.
4. Каждая транзакция должна завершиться Commit либо доказанным Abort.
5. Epoch нельзя окончательно увеличить, пока существует конфликтующий Prepare с неизвестным исходом.
6. После разрешения всех конфликтов KVP фиксирует новый epoch и завершает отзыв.
7. Если Anchor недоступен или результат не доказан — отзыв остаётся pending; система работает fail-closed.

Для конкурентного Commit и отзыва допустимы только порядки:
- `PREPARE ≺ COMMIT ≺ REVOCATION`;
- `PREPARE ≺ ABORT ≺ REVOCATION`.

Нельзя допускать `REVOCATION ≺ COMMIT` по старому Prepare/Grant.

### ForceAbortPrepare

При достоверном сигнале компрометации KVP может запросить `ForceAbortPrepare(transition_id, prepare_id, scope, reason)`.

- ForceAbort и Commit сериализуются внутри Anchor.
- Если ForceAbort линеаризовался первым, Anchor долговечно закрывает Prepare и отвергает все будущие Commit по нему.
- Если Commit линеаризовался первым, он остаётся совершённым; ForceAbort не может отменить его задним числом.
- Если порядок установить невозможно, результат INDETERMINATE; epoch не продвигается вслепую.
- Abort сохраняет tombstone/closure evidence; Prepared-запись нельзя просто удалить.

## 6. TTL и закрытие Prepare

- TTL — ограничение времени действия, но не доказательство отсутствия Commit.
- Истечение TTL само по себе не снимает reservation и не разрешает epoch advance.
- Reservation снимается только после проверенного `NOT_COMMITTED` с доказательством окончательного закрытия Prepare либо после подтверждённого Commit и завершения согласованной процедуры.
- При недоступности Anchor/KVP или противоречивых данных — `RECONCILIATION_REQUIRED`.
- Anchor обязан отвергать старые Prepare после durable closure, даже если Coordinator проснулся позднее.
- Если Anchor Journal утрачен, старый Prepare не может быть принят по одному старому PrepareAck. Требуется достоверное восстановление/проверка KVP и Audit; до восстановления контекста Anchor находится в AMNESIA и Commit запрещены.

## 7. Идемпотентность и результаты

Один `transition_id` связан с одним request/package/manifest/grant digest.

- тот же ID + тот же digest + подтверждённый Commit → возвращается исходный результат (AlreadyCommitted);
- тот же ID + другой digest → Blocked conflict;
- незавершённая или неопределённая транзакция → Indeterminate / ReconciliationRequired;
- `NOT_COMMITTED` допустим только с проверенным доказательством закрытия Prepare;
- дублирующие сообщения не создают повторный физический Commit.

## 8. Четыре аварийных сценария — согласованная логика

### 8.1 KVP упал после PREPARE, до COMMIT

KVP восстанавливает собственный durable log и запрашивает Anchor `CheckCommitStatus(transition_id)`.
- Anchor доказывает COMMITTED → KVP восстанавливает как Anchor-Committed и продолжает completion.
- Anchor доказывает NOT_COMMITTED и окончательное закрытие Prepare → ABORTED, reservation может быть снята.
- Anchor молчит / состояние не доказано → RECONCILIATION_REQUIRED; новые критические переходы блокируются.

### 8.2 Anchor упал во время атомарного Commit

Требование к выбранному HSM/Anchor backend — проверяемое All-or-Nothing поведение при power loss.
- подтверждено старое состояние, отсутствие Commit и закрытие Prepare → NOT_COMMITTED / ABORTED;
- подтверждено новое состояние и соответствующий receipt → COMMITTED, далее KVP/Audit completion;
- журнал/состояние противоречивы или неразличимы → INDETERMINATE.
Атомарность не считается доказанной только потому, что она заявлена абстрактным API HSM; нужна проверка конкретной платформы.

### 8.3 Отзыв Grant одновременно с Commit

- Пока конфликтующий Prepare активен, KVP ставит REVOCATION_PENDING и блокирует новые Grant/Prepare в scope.
- Commit и ForceAbort сериализуются внутри Anchor.
- Commit первым → COMMIT предшествует окончательному epoch advance; исторический Commit сохраняется, следующие операции по Grant блокируются.
- ForceAbort первым → Prepare закрыт, Commit запрещён, затем KVP может завершить epoch advance.
- Неизвестный порядок → INDETERMINATE; epoch не увеличивается вслепую.

### 8.4 Anchor восстановился после Prepare TTL

- Anchor проверяет собственный durable journal и closure marker.
- EXPIRED/CLOSED Prepare не может быть повторно использован.
- При потере Anchor Journal Anchor переходит в AMNESIA: знает только подтверждённый HSM state/hash/counter, но не контекст транзакций.
- В AMNESIA любые Commit запрещены; reconciliation сверяет KVP и Audit Sink.
- Если источники не дают доказать конкретный transition/closure, результат INDETERMINATE, а не NOT_COMMITTED.

## 9. Потеря журналов и сетевой partition

### KVP Journal Recovery
KVP не угадывает статус по локальному состоянию. Источники восстановления — Anchor и Audit Sink.
- Anchor COMMITTED + проверенный Audit Intent → восстановить как COMPLETION_PENDING / Anchor-Committed.
- Anchor COMMITTED + подтверждённый Audit Completion → COMPLETED.
- Anchor NOT_COMMITTED + closure proof → ABORTED.
- противоречие или недоступность → RECONCILIATION_REQUIRED.
Потеря KVP Journal не отменяет физически совершённый Commit.

### Anchor Journal AMNESIA
Если HSM сохраняет hash/counter, но Anchor Journal повреждён/откачен:
- Anchor не выводит transition_id и контекст из одного hash/counter;
- Complete/Reconcile без доказуемой привязки → INDETERMINATE;
- любые новые Commit запрещены до восстановления журнала;
- восстановление требует полной сверки с KVP и Audit Sink и подтверждения непрерывности истории.

### Network partition
Для критических операций выбран CP-подход: при недоступности любого обязательного участника (KVP, Anchor, Audit) успешное завершение не разрешается. Это не означает автоматической гарантии согласованности: согласованность обеспечивается протоколом, долговечными журналами, сериализацией и reconciliation.
Уже линеаризованный Anchor Commit не отменяется последующей недоступностью Audit. Reconciliation может сопоставлять доказательства, но не выдаёт полномочий и не изменяет Root Authority самостоятельно.

## 10. Инварианты RCP-REV

- RCP-REV-01: Только KVP управляет Revocation Epoch.
- RCP-REV-02: PrepareAck выдаётся только после durable reservation в KVP.
- RCP-REV-03: Anchor проверяет Prepare и fencing непосредственно перед Commit.
- RCP-REV-04: TTL не является доказательством отсутствия Commit; требуется явный NOT_COMMITTED и closure proof.
- RCP-REV-05: Неизвестный результат блокирует последующие критические переходы.
- RCP-REV-06: Отзыв и Commit имеют однозначный порядок через Anchor linearization point.
- RCP-REV-07: Повторный Commit идемпотентен только при совпадающих ID и digest.
- RCP-REV-08: Отзыв не переписывает уже линеаризованный Commit.
- RCP-REV-09: Reconciliation не получает полномочий изменять Root Authority.
- RCP-REV-10: Потеря связи не превращается в ALLOW.

## 11. Открытые вопросы до реализации

- Epoch scope: global vs Principal/Authority vs revocation domain.
- Конкретная модель durable reservation и storage consistency KVP.
- Anchor/HSM API для atomic commit, closure tombstone, status proof и recovery.
- Подписанный формат PrepareAck, CommitReceipt, NotCommittedProof и ForceAbort.
- Политика сроков, ручного вмешательства и безопасного восстановления зависших reservation.
- Audit Sink durability, append-only guarantees и reconciliation protocol.
- Криптографические алгоритмы, canonical encoding и digest length.

## 12. Граница доказанности

Документ фиксирует согласованную архитектурную модель и аварийные исходы. Он не доказывает линейризуемость формально и не подтверждает реализацию. Не созданы Rust-код, тесты, HSM/TPM integration или production deployment. Нужны формальная модель конкурентных interleavings (например, TLA+/PlusCal), property-based tests, fault injection и независимый криптографический аудит.
