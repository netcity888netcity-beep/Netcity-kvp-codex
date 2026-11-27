# KVP Runtime Contract v0.1 — рабочий проект спецификации

**Статус:** DRAFT / ARCHITECTURE PROPOSAL.  
**Дата:** 2026-11-27.  
**Назначение:** единый контракт событий, состояния сцен, синхронизации устройств и границ доверия для NetCity Runtime.

> Этот документ фиксирует проектный baseline для дальнейшего согласования. Он не означает, что протокол реализован, протестирован, криптографически проверен или подключён к работающему серверу.

## 1. Архитектурная позиция

KVP Runtime Contract — общий язык обмена между:
- KVP Core — проверка политики и авторизация конкретной операции;
- Mobile Runtime — клиентские устройства;
- Spatial Engine — локальное представление и материализация сцен;
- Agent Runtime — выполнение только выданных и проверяемых задач;
- World Memory — авторитетное состояние, версии и журнал происхождения;
- Device Identity / Trust Core — идентичность устройства, доказательства доверия, отзыв и downgrade.

**Авторитетное состояние:** сервер NetCity Compute Node является источником истины для подтверждённого состояния сцен и журнала событий. Устройства хранят ограниченный локальный кэш и локальные черновики. Локальная визуальная операция не становится подтверждённым изменением сцены до серверной проверки и подтверждения.

## 2. Базовый Event Envelope

Каждое событие, которое покидает устройство или агентский runtime, должно иметь единый конверт.

| Поле | Требование | Назначение |
|---|---|---|
| `protocol_version` | MUST | Версия контракта, например `kvp.runtime/0.1` |
| `event_id` | MUST | Глобально уникальный идентификатор события |
| `event_type` | MUST | Тип события из версионируемого каталога |
| `device_id` | MUST для device-origin | Идентификатор зарегистрированного устройства |
| `session_id` | MUST | Контекст текущей сессии |
| `scene_id` | Conditional | Идентификатор сцены, если событие относится к сцене |
| `actor` | MUST | Тип и ID субъекта: human / agent / system |
| `occurred_at` | MUST | Время, заявленное источником; не считается доверенным временем сервера |
| `device_sequence` | MUST для device-origin | Монотонный номер события в пределах device/session epoch |
| `base_scene_version` | Conditional | Версия сцены, на которой основано изменение |
| `idempotency_key` | MUST для mutation | Защита от повторного применения |
| `correlation_id` | SHOULD | Связь с исходным намерением, задачей или цепочкой событий |
| `trust_evidence_ref` | MUST для privileged request | Ссылка на серверно проверяемое evidence; не самооценка устройства |
| `authorization_request` | MUST для mutation | Контекст запроса на KVP authorization |
| `payload` | MUST | Данные события, валидируемые по схеме event_type |
| `integrity` | MUST для удалённого источника | Ссылка на key ID и подпись/доказательство целостности |

Пример формы (иллюстративный, не окончательная JSON Schema):

```json
{
  "protocol_version": "kvp.runtime/0.1",
  "event_id": "01J...unique",
  "event_type": "scene.object.transform.requested",
  "device_id": "device:...",
  "session_id": "session:...",
  "scene_id": "scene:...",
  "actor": { "type": "human", "id": "identity:..." },
  "occurred_at": "2026-11-27T12:00:00Z",
  "device_sequence": 1042,
  "base_scene_version": 17,
  "idempotency_key": "device:.../session:.../1042",
  "correlation_id": "intent:...",
  "trust_evidence_ref": "attestation:...",
  "authorization_request": {
    "request_id": "authz:...",
    "capability": "scene.object.transform",
    "policy_version": "kvp-policy:..."
  },
  "payload": {
    "object_id": "object:...",
    "transform": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0, 1],
      "scale": [1, 1, 1]
    }
  },
  "integrity": {
    "key_id": "device-key:...",
    "signature": "..."
  }
}
```

Ключевые правила:
- Клиентское поле trust level не является доказательством доверия. Сервер разрешает ссылку `trust_evidence_ref` и самостоятельно определяет актуальный статус устройства.
- `occurred_at` не используется как единственная защита от replay; применяются sequence/epoch, уникальность event_id, idempotency и проверка подписи.
- Секреты, приватные ключи, seed-фразы, токены и полные credential blobs в payload запрещены.
- Для системных событий, созданных сервером, `device_id` может быть заменён на server/runtime identity по отдельной схеме.

## 3. Каталог событий

Начальный namespace:
- `intent.*` — принятое намерение и результат интерпретации;
- `scene.*` — запросы и подтверждённые изменения сцены;
- `device.*` — enrollment, heartbeat, trust update, revoke;
- `agent.*` — dispatch, progress, result, quarantine;
- `authorization.*` — decision, approval, denial, revocation;
- `sync.*` — cursor, snapshot, delta, conflict, reconnect;
- `audit.*` — provenance и контрольные события.

Названия и payload-схемы должны быть версионируемыми. Неизвестный mutation event не исполняется «по догадке»: он отклоняется как unsupported либо направляется в безопасное состояние совместимости.

## 4. Жизненный цикл события

Предлагаемый lifecycle:

1. `LOCAL_DRAFT` — локальный черновик; ещё не принят сервером.
2. `QUEUED_OFFLINE` — ожидает синхронизации; не меняет авторитетное состояние.
3. `RECEIVED` — сервер получил конверт.
4. `VALIDATED` — прошли schema, identity, signature, sequence и replay checks.
5. `AUTHORIZATION_PENDING` — KVP проверяет scope, capability, policy и актуальные trust evidence.
6. `AUTHORIZED` — разрешение выдано для конкретной операции и контекста.
7. `APPLIED` — изменение применено к авторитетному состоянию.
8. `ACKNOWLEDGED` — клиент получил подтверждение и серверную версию.
9. Альтернативные исходы: `REJECTED`, `DEFERRED`, `CONFLICT`, `QUARANTINED`.

Переход к `APPLIED` требует свежей KVP-проверки непосредственно перед исполнением. Состояние `AUTHORIZED` не является бессрочным grant. Любая смена policy, capability, device trust, scene version или approval context может потребовать повторной проверки.

## 5. Authorization boundary

Перед применением mutation сервер последовательно проверяет:
1. субъект и его Human/Agent Identity;
2. зарегистрированное устройство и актуальный device status;
3. подпись, key status, sequence, replay и idempotency;
4. актуальные Trust evidence и допустимость режима устройства;
5. scope операции и все затрагиваемые KVP domains;
6. capability и полномочия конкретного агента/исполнителя;
7. policy version и необходимые human approvals;
8. контекст сцены, базовую версию и допустимость перехода состояния.

Trust level не равен permission. Human approval не отменяет KVP. Делегирование не повышает полномочия. Отзыв capability должен блокировать дальнейшее исполнение до следующего шага.

## 6. Scene Manifest и версии

Начальный Scene Manifest:
- `scene_id`
- `scene_version`
- `manifest_schema_version`
- `objects[]`
- `layers[]`
- `anchors[]`
- `permissions`
- `event_log_cursor`

Каждая подтверждённая mutation:
- указывает `base_scene_version`;
- валидируется относительно актуального состояния;
- получает новую серверную `scene_version`;
- записывается в audit/provenance;
- подтверждается клиенту вместе с новым version/cursor.

**Default conflict policy:** no silent last-write-wins. Если базовая версия устарела, сервер возвращает `CONFLICT` с актуальной версией и минимальными данными для повторного построения намерения. Автоматическое слияние допускается только для явно объявленных коммутативных операций с тестируемыми правилами. CRDT не выбирается по умолчанию и остаётся отдельным design decision.

## 7. Offline и reconnect

В offline режиме:
- разрешено чтение локально кэшированных данных с явной отметкой freshness;
- разрешено редактирование локального черновика/preview;
- privileged operations, root changes, enrollment/recovery и внешнее управление физическими устройствами блокируются;
- локальная очередь хранит события как неподтверждённые запросы, а не как committed scene state;
- пользователь видит pending / blocked / conflict status.

При reconnect:
1. устройство повторно аутентифицируется и подтверждает актуальный Device Identity;
2. KVP проверяет текущий trust state и revocation;
3. сервер выдаёт snapshot/delta от последнего подтверждённого cursor;
4. локальные pending events отправляются с прежними event_id и idempotency keys;
5. каждое событие проходит новую schema/identity/trust/authorization проверку;
6. конфликтующие события не перезаписывают серверное состояние автоматически;
7. старые human approvals и grants проверяются заново;
8. клиент получает подтверждённые, отклонённые, отложенные и конфликтующие результаты.

## 8. Sync и acknowledgements

Предлагаемые API/transport-neutral операции:
- `HELLO` — protocol negotiation, device/session identity, last acknowledged cursor;
- `SYNC_PULL` — получить snapshot или delta;
- `EVENT_PUSH` — отправить одно или пакет pending events;
- `EVENT_ACK` — результат обработки каждого event_id;
- `SYNC_CONFLICT` — сообщить конфликт и актуальную версию;
- `TRUST_REFRESH` — запросить новую attestation / trust evaluation;
- `SESSION_REVOKED` — немедленно остановить дальнейшие привилегированные запросы.

Транспорт выбирается после определения реальной мобильной сети и deployment topology. Базовое требование — защищённый канал поверх частной сети/туннеля; публичный прямой доступ к Compute Node не допускается. Конкретный транспорт (например, HTTPS request/response, WebSocket или иной канал) пока не зафиксирован.

## 9. Agent Runtime

- Agent dispatch создаётся через KVP-authorized request.
- Делегация содержит actor, task ID, allowed capability set, scope, expiry, policy version и correlation ID.
- Каждый агент имеет собственную identity и проверяется отдельно.
- Agent result — это событие/предложение; изменение состояния проходит отдельную KVP authorization.
- Отзыв capability или переход в `QUARANTINED` блокирует дальнейшие privileged actions.
- Агент не получает ключи Human Identity или приватные ключи других устройств.

## 10. Audit / Provenance

Для каждого изменения сохраняются:
- event_id, actor, device_id/agent_id, session_id;
- occurred_at и server received/applied timestamps;
- payload hash или безопасное представление операции;
- base/new scene version;
- trust evidence reference и key ID;
- KVP policy version и authorization decision;
- human approval reference (если применимо);
- execution result, error/conflict code и связь с correlation_id.

Audit log не должен содержать секреты или ненужные персональные данные. Изменение root trust, identity enrollment, revocation, recovery и quarantine должно иметь отдельный high-integrity audit path.

## 11. Ошибки и безопасные исходы

Минимальные коды:
- `UNSUPPORTED_PROTOCOL`
- `UNSUPPORTED_EVENT_TYPE`
- `SCHEMA_INVALID`
- `IDENTITY_UNKNOWN`
- `DEVICE_REVOKED`
- `SIGNATURE_INVALID`
- `REPLAY_DETECTED`
- `DUPLICATE_EVENT`
- `TRUST_INSUFFICIENT`
- `TRUST_REJECTED`
- `AUTHORIZATION_DENIED`
- `HUMAN_APPROVAL_REQUIRED`
- `CAPABILITY_REVOKED`
- `AGENT_QUARANTINED`
- `SCENE_VERSION_CONFLICT`
- `POLICY_VERSION_STALE`
- `OFFLINE_RESTRICTED`
- `INTERNAL_SAFE_FAILURE`

При неопределённости privileged action не выполняется. Ошибка не должна приводить к автоматическому расширению прав или молчаливому применению изменения.

## 12. Performance и acceptance criteria

Ранее обсуждавшиеся цели — **не измеренные результаты**:
- 60 FPS на подходящем мобильном клиенте;
- локальная UI реакция ≤50 ms;
- LAN sync ≤200 ms;
- отсутствие потери подтверждённых изменений.

Тест-план должен отдельно измерять:
- parse/validation latency;
- KVP authorization latency;
- event round-trip / LAN sync latency;
- scene reconciliation latency;
- rendering frame time;
- model inference latency;
- offline queue replay correctness;
- duplicate/replay rejection;
- revoke-before-execute behavior;
- conflict determinism;
- reconnect under changed trust/policy.

Никакие числовые показатели не считаются достигнутыми без воспроизводимого тестового отчёта с устройством, сборкой, нагрузкой, топологией сети и timestamp.

## 13. Открытые решения перед фиксацией v0.1

1. Точная схема actor identity и server/runtime identity.
2. Формат UUID/ULID и границы sequence epoch.
3. Полная JSON Schema / protobuf / иной IDL — формат пока не выбран.
4. Алгоритмы подписей, key rotation и защищённое хранение ключей — отдельный security review.
5. Транспорт и reconnect strategy для мобильного клиента.
6. Политика конфликтов по классам spatial operations; CRDT не выбран.
7. Event retention, snapshot cadence и backup/restore.
8. Модель серверного clock и доверенного времени.
9. Точная структура authorization request/decision и жизненный цикл grant.
10. Набор threat-model scenarios и тестовые фикстуры.

## 14. Следующий этап

- Уточнить открытые решения, не подменяя их догадками.
- Подготовить machine-readable schema и reference examples только после фиксации IDL.
- Разработать conformance test matrix.
- Затем отдельно спроектировать Mobile Runtime v0.1 и Spatial Workspace v0.1.
- Реализация в Rust/JS, тесты, интеграция и hardware proof — отдельные этапы с отдельной проверкой и записью результатов.
