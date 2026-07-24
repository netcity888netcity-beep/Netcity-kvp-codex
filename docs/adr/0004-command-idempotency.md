# ADR-0004: Make commands idempotent by identity

Status: accepted

## Context

Sequence numbers reject replay inside a session but do not safely handle a lost
response, reconnect, or retry across sessions. Blindly issuing a new command can
repeat a destructive engine action.

## Decision

Every command has a client-generated unique `command_id`. KVP atomically stores
the canonical request hash and lifecycle state before dispatch. Repeating the
same identity and request returns the stored state; reusing the identity for a
different request is rejected. Records are retained according to operation risk
and maximum retry window.

## Consequences

- Command reservation requires strongly consistent durable state.
- Canonical request serialization is a versioned protocol concern.
- An explicit indeterminate outcome and status lookup are necessary.
- Sequence numbers remain useful for session ordering but are not the retry key.
