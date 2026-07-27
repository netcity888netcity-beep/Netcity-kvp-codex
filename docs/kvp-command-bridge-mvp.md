# KVP Command Bridge v0.1 MVP

## Architecture

The MVP implements one synchronous offline flow:

```text
CLI or local caller
  -> InMemoryTransport
  -> strict envelope parser
  -> temporal validation
  -> atomic replay reservation
  -> local identity binding
  -> base policy
  -> native recipient resolution and per-recipient policy
  -> reserved pre-dispatch audit evidence for critical intents
  -> explicit router
  -> ModelGatewayPort mock or local communication delivery
  -> bounded conversation metadata
  -> tamper-evident audit
  -> normalized response
```

The protocol core does not depend on the transport. `CommandTransport` defines lifecycle, receive, response, and health methods. Only `InMemoryTransport` is implemented.

## Components

- `envelope.py`: strict command/native schemas, timestamps, limits, canonical hashing;
- `identity.py`: local actor-to-role binding;
- `policy.py`: role, intent, target, provider, classification, replay, audit, and recipient decisions;
- `replay.py`: bounded thread-safe in-memory reservation store;
- `conversations.py`: recipient directory, rooms, delivery plans, state machine, bounded safe history;
- `gateway.py`: provider-neutral model gateway port, published gateway adapter, and deterministic mock;
- `router.py`: exact service/model routing without fallback;
- `audit.py`: bounded in-memory and JSONL append-only hash-chain sinks;
- `service.py`: synchronous orchestration and safe error normalization;
- `bootstrap.py`: strict fail-closed configuration assembly;
- `transports/`: transport interface and in-memory implementation.

## Configuration

`config/command_bus.example.json` contains no credentials. It defines:

- protocol and metadata limits;
- replay capacity;
- bounded in-memory transport queues and message sizes;
- enabled local identities;
- local mock and command-bus providers;
- a disabled external provider entry;
- exact routes;
- bounded conversation and room limits;
- local room membership;
- JSONL audit location, event count, and event size under ignored `.local/` runtime storage.

Missing, malformed, incomplete, or internally inconsistent configuration prevents startup.

## Model Gateway Boundary

The branch defines `ModelGatewayPort` and `GatewayRequest`/`GatewayResponse` contracts. The default implementation is `MockModelGateway`; it performs no network access. `PublishedModelGatewayAdapter` maps bridge requests into the published `ModelRegistry.complete(ModelRequest)` contract when that package is present and validates the exact policy-selected provider. No gateway implementation is copied from another worktree.

Provider selection is decided once by policy. Disabled, unknown, mismatched, or failed providers do not trigger a hidden fallback.

## Conversations and Rooms

Rooms are loaded from local configuration. Their member lists are validated for known recipients, duplicate members, nesting, and configured limits. Broadcast works from an atomic member snapshot and requires sender membership.

Conversation history stores only message ID, kind, sender ID, normalized recipient IDs, delivery status, and payload hash. It has strict conversation and per-conversation message limits; capacity exhaustion rejects new work before acceptance.

## CLI

Health:

```powershell
python clients/kvp_command_cli.py health --json
```

Command profile dry run:

```powershell
python clients/kvp_command_cli.py send --profile command --intent model.prompt --content "Explain the bridge" --dry-run --json
```

Native direct message:

```powershell
python clients/kvp_command_cli.py send --profile native --intent message.deliver --kind message.text --recipient actor:local-builder --target-type service --target-id command-bus --content "Review the build" --json
```

Native room broadcast:

```powershell
python clients/kvp_command_cli.py send --profile native --intent message.deliver --kind message.text --recipient room:temple-build --delivery-mode broadcast --target-type service --target-id command-bus --content "Build status" --json
```

Audit read:

```powershell
python clients/kvp_command_cli.py audit --limit 10 --json
```

Exit codes are stable: `0` for accepted/completed, `2` for rejected, and `3` for failed/startup errors. The CLI has no credential arguments and does not execute shell commands.

## Security Properties

- strict explicit schemas and profiles;
- UTC timestamps, bounded TTL, expiry, and future-skew checks;
- recursive rejection of binary data and credential-like field names;
- bounded payload, metadata, recipients, replay entries, transport queues, audit events, rooms, conversations, and histories;
- atomic replay reservation before routing;
- local identity role binding;
- deny-by-default policy and recipient evaluation;
- local-only confidential/restricted delivery;
- safe normalized errors;
- payload-free audit and history, with reserved pre-dispatch evidence for critical intents;
- append-only chained audit hashes;
- no network calls or external dependencies.

## MVP Limits

- process-local only;
- in-memory replay, identities, rooms, conversations, and delivery queues;
- JSONL audit locking is process-local;
- synchronous single-command processing;
- no durable inboxes, acknowledgements from independent processes, federation, service discovery, or distributed consensus;
- mock model provider only;
- no custom cryptography.
