# KVP Command Protocol and Native Communications Profile v0.1

## Status

Version `0.1` is a local, transport-independent protocol contract. The only implemented transport is the process-local `InMemoryTransport`. Unknown fields, unsupported values, ambiguous routes, and missing configuration are rejected.

## Explicit Profiles

Every request contains a mandatory top-level `profile` field. Its value is exactly one of:

- `command` — command bridge request without native communication fields;
- `native` — command bridge request with the complete native communication field group.

The profile is never inferred. A missing profile produces `PROFILE_REQUIRED`. A partially present native field group produces `PARTIAL_NATIVE_ENVELOPE`. Supplying the complete native group with `profile: command` produces `NATIVE_FIELDS_NOT_ALLOWED`.

## Command Profile

Required fields:

- `protocol`: exactly `kvp`;
- `version`: exactly `0.1`;
- `profile`: exactly `command`;
- `message_id`: canonical UUID;
- `timestamp`, `expires_at`: RFC3339 UTC timestamps;
- `nonce`: bounded unique string;
- `actor`: configured `id` and role;
- `target`: explicit `type` and `id`;
- `intent`: namespace/action string;
- `payload`: text `content` and `sensitivity`;
- `trace`: UUID `trace_id` and nullable UUID `parent_id`;
- `metadata`: bounded JSON object.

Example:

```json
{
  "protocol": "kvp",
  "version": "0.1",
  "profile": "command",
  "message_id": "00000000-0000-0000-0000-000000000101",
  "timestamp": "2026-07-27T12:00:00Z",
  "expires_at": "2026-07-27T12:01:00Z",
  "nonce": "nonce-000000000101",
  "actor": {"id": "local-architect", "role": "architect"},
  "target": {"type": "model", "id": "mock/local-echo"},
  "intent": "model.prompt",
  "payload": {"content": "Explain the local protocol", "sensitivity": "internal"},
  "trace": {"trace_id": "00000000-0000-0000-0000-000000000102", "parent_id": null},
  "metadata": {}
}
```

## Native Communications Profile

The native profile requires every command-profile field plus all six native fields:

- `conversation_id`: canonical UUID;
- `sender`: configured `id` and role;
- `recipients`: non-empty bounded list of typed recipient addresses;
- `kind`: native message kind;
- `delivery`: mode and initial lifecycle status;
- `security`: classification object.

Recipient types are `actor`, `room`, `model`, and `service`. Normalized recipient IDs use `type:id`, for example `actor:local-builder`.

The normalized sender is the authenticated actor. `sender` and `actor` must match. The normalized classification is `payload.sensitivity`; `security.classification` must match it. Conflicting values are rejected before replay reservation or routing.

Example:

```json
{
  "protocol": "kvp",
  "version": "0.1",
  "profile": "native",
  "message_id": "00000000-0000-0000-0000-000000000201",
  "timestamp": "2026-07-27T12:00:00Z",
  "expires_at": "2026-07-27T12:01:00Z",
  "nonce": "nonce-000000000201",
  "actor": {"id": "local-architect", "role": "architect"},
  "target": {"type": "service", "id": "command-bus"},
  "intent": "message.deliver",
  "payload": {"content": "Please review the build", "sensitivity": "internal"},
  "trace": {"trace_id": "00000000-0000-0000-0000-000000000202", "parent_id": null},
  "metadata": {},
  "conversation_id": "00000000-0000-0000-0000-000000000203",
  "sender": {"id": "local-architect", "role": "architect"},
  "recipients": [{"type": "actor", "id": "local-builder"}],
  "kind": "message.text",
  "delivery": {"mode": "direct", "status": "accepted"},
  "security": {"classification": "internal"}
}
```

## Native Kinds

Supported values are:

- `message.text` with `message.deliver`;
- `command.request` with an allowlisted command intent;
- `command.response` with `command.respond`;
- `task.created` with `task.create`;
- `task.progress` with `task.progress`;
- `task.completed` with `task.complete`;
- `model.request` with `model.prompt` or `model.compare`;
- `model.response` with `model.respond`;
- `health.check` with `health.check`.

Mismatched kind and intent values produce `KIND_INTENT_MISMATCH`.

## Delivery Lifecycle

Valid transitions are:

```text
unaccepted -> accepted -> delivered
unaccepted -> accepted -> failed
unaccepted -> rejected
```

- `accepted`: validation, authentication, replay reservation, base policy, recipient policy, and bounded conversation reservation succeeded;
- `delivered`: the message was handed to every selected local recipient or the selected local model port;
- `rejected`: processing stopped before acceptance;
- `failed`: an internal error occurred after acceptance.

Terminal states cannot transition again. Invalid transitions produce `INVALID_DELIVERY_TRANSITION`.

## Policy Matrix

| Role | Main permitted operations |
| --- | --- |
| architect | all allowlisted command, model, review, message, task, status, and health operations |
| builder | model prompt, code explanation, messages, command responses, task progress/completion, status, health |
| reviewer | code/architecture review, explanations, messages, command responses, status, health |
| security | security/code review, messages, command responses, status, health |
| observer | status and health only |

Explicitly forbidden intents include shell execution, destructive filesystem actions, repository publication, credential extraction, policy disablement, and audit deletion. Unknown intents and unknown targets are denied. Provider selection is exact; there is no fallback.

`confidential` and `restricted` payloads require local providers and local recipients. The default external provider entry is disabled.

## Replay Rules

`message_id` and `nonce` are reserved atomically in one critical section before routing. A concurrent duplicate can never reach the gateway or local delivery path. Reservations expire with `expires_at`. Capacity exhaustion fails closed rather than evicting live reservations.

## Room Broadcast

Broadcast accepts exactly one room address. The service obtains an atomic member snapshot, verifies sender membership, resolves every member, evaluates policy separately for every recipient, and delivers only if every decision is unambiguous and allowed. No partial delivery occurs. Results contain normalized recipient IDs and statuses but never message content.

## Response Envelope

All responses contain a new UUID `message_id`, the original request UUID as `correlation_id`, a UTC timestamp, status, result or safe error, and trace data. Native responses also carry the complete native field group and a delivery status.

Error messages never include stack traces, filesystem paths, configuration internals, or provider exception text.

## Audit Contract

Audit records contain identifiers, role, target, intent, classification, policy result, reason code, provider, duration, result status, payload hash, optional conversation ID, optional kind, normalized recipient IDs, and hash-chain fields. Payload content is never written to audit or conversation history.
