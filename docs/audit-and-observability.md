# Audit and observability

Status: specified

## Two different outputs

Audit evidence and operational telemetry serve different consumers and have
different retention rules. Audit events explain who attempted what, which policy
decision was made, and what outcome is known. Metrics and traces explain system
health and performance. Neither channel contains secrets or raw inference data.

## Audit event envelope

Every event has:

- schema version and globally unique `audit_id`;
- UTC event time and monotonic process offset where available;
- event type and deployment instance;
- principal, role/policy version, session hash reference, and certificate
  fingerprint reference;
- command ID, operation, adapter/engine identity, and canonical request hash;
- decision or outcome with stable reason code;
- correlation and trace identifiers;
- previous-event hash when local hash chaining is enabled.

The raw session token, certificate private material, prompt, generated text, raw
payload, and KV-cache data are prohibited fields. A hash is included only when it
has a defined verification purpose; hashing low-entropy secrets does not make
them safe to log.

## Event sequence

For an accepted command the minimum event set is:

1. `command.authorized` after atomic reservation and before dispatch;
2. `command.dispatched` with adapter identity;
3. exactly one of `command.completed`, `command.rejected_by_adapter`, or
   `command.outcome_indeterminate`.

Authentication failures are rate-limited but auditable. Read-only status calls
may use a lower-volume policy, documented by operation and environment.

## Durability policy

- Destructive or high-privilege commands fail closed if the mandatory audit sink
  cannot accept the pre-dispatch event.
- Low-risk read operations may continue with a bounded local spool if policy
  permits it.
- Local hash chaining detects accidental gaps but does not prevent an attacker
  from rewriting an entire local log. Tamper evidence requires periodic anchors
  in an independently controlled system.
- Backpressure is bounded; audit failure must not cause unbounded memory growth.

## Metrics

Initial low-cardinality metrics include:

- RPC latency and result count by operation and stable code;
- active, expired, and revoked session counts;
- authorization denials and replay rejections;
- command queue depth and outcome-indeterminate count;
- adapter health, capability changes, and dispatch latency;
- audit delivery lag and spool size.

Principal IDs, command IDs, session references, and payload hashes are not metric
labels. They belong in access-controlled audit events or traces.

## Health endpoints

- **Liveness** reports whether the process can make progress.
- **Readiness** requires identity registry, policy, consistent state, and any
  mandatory audit dependency. Adapter availability is reported separately so one
  failed engine does not necessarily remove the whole control plane from service.
