# KVP delivery roadmap

The roadmap is organized around demonstrable security properties, not calendar
claims. A milestone exits only when its evidence is automated and reproducible.

## M0 — Domain foundation (implemented)

- workspace and documentation source of truth;
- opaque session token generation;
- role-based authorization;
- expiry, revocation, and increasing sequence checks;
- unit tests, formatting, and lint gates.

Exit evidence: all workspace tests and strict Clippy pass.

## M1 — Authenticated control-plane skeleton

- generated protobuf crate;
- gRPC server restricted to TLS 1.3 with mandatory client certificates;
- certificate-to-principal registry;
- session binding to authenticated principal and certificate expiry;
- bounded messages, timeouts, and negative-path integration tests.

Exit evidence: unknown, mismatched, expired, and revoked identities cannot open or
use a session; plaintext production startup is impossible.

## M2 — Reliable command coordinator

- durable command reservation and idempotency store;
- canonical request hashing;
- explicit stable error codes and command status lookup;
- policy versioning and audit precondition;
- deterministic mock adapter.

Exit evidence: retries never double-dispatch, conflicting command IDs fail, and
unknown outcomes can be reconciled without blind replay.

## M3 — Adapter platform

- separate internal adapter protocol;
- registration, heartbeat, and capability negotiation;
- adapter SDK and conformance suite;
- mock adapter chaos tests;
- version-pinned vLLM feasibility report.

Exit evidence: unsupported operations are rejected before dispatch and capability
changes are observable and audited.

## M4 — First real engine integration

- vLLM adapter limited to proven engine surfaces;
- deployment manifests and least-privilege runtime identity;
- load, fault, upgrade, and rollback tests;
- administrator runbook and incident procedures.

Exit evidence: one end-to-end administrative operation is authorized, delivered
exactly once or reconciled, audited, and verified against a supported vLLM version.

## M5 — Attestation research track

- define the exact state being attested and its verifier;
- prototype engine-side evidence collection;
- measure overhead and failure behavior;
- external cryptographic and systems review before product claims.

Exit evidence: a written claim-to-evidence matrix demonstrates what is and is not
proven. This milestone does not block the useful control-plane product.
