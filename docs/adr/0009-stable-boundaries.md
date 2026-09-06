# ADR-0009: Preserve stable KVP trust boundaries

Status: accepted

## Context

KVP is a protected control plane. Its implementations will evolve: in-memory
registries will move to durable stores, local rate limiters may become
distributed, and caches may be replaced. Those substitutions must not silently
change protocol contracts or weaken the trust boundary.

## Decision

Public interfaces and security invariants are stable. Implementations may be
strengthened or replaced only when the replacement preserves:

- the public API and protobuf contract;
- the order and outcome of authorization and safety checks;
- the boundary between authenticated transport identity and untrusted request
  fields;
- the behaviour covered by security regression tests.

Every replacement must explicitly answer: does it preserve the contract and
trust boundary?

## Application

Before merge, the author and reviewer must confirm that the change conforms to
this ADR. The answer to “does it violate a stable public contract or trust
boundary?” must be “no”; otherwise an explicit, reviewed ADR is required.

## Consequences

- Behavioural tests remain valid when in-memory storage is replaced with a
  durable implementation.
- A local rate limiter can be replaced by a distributed limiter without moving
  authorization checks or trusting protobuf identity fields.
- New implementations require compatibility and security-regression evidence;
  an infrastructure migration is not permission to relax an invariant.
