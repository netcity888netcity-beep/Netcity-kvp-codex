# ADR-0005: Use PostgreSQL for durable command state

Status: accepted

## Context

Sessions, revocation, command idempotency, state transitions, and the audit outbox
must change consistently. A process-local map loses state on restart, while a
cache-first design can acknowledge commands without durable reconciliation data.

## Decision

PostgreSQL is the v0 source of truth. Command reservation and the pre-dispatch
audit event share one transaction. Session sequence advancement uses a guarded
update. A transactional outbox delivers audit events at least once to the
independent sink.

## Consequences

- KVP fails closed for new state-changing work when PostgreSQL is unavailable.
- Schema design and migrations become security-relevant code.
- Horizontal replicas share consistent idempotency and revocation state.
- PostgreSQL credentials, backups, recovery, and capacity require production
  runbooks.
