# Security model

## Protected assets

- control authority over inference engines;
- model parameters and policy configuration;
- session credentials and long-term private keys;
- prompt, response, and cache-derived data;
- integrity and ordering of audit events.

## Trust boundaries

The operator client, KVP control plane, engine adapter, inference engine, PKI,
and audit sink are separate principals. Network reachability is not trust.
Possession of a certificate authenticates a principal but does not authorize an
operation.

## Attacker capabilities

The v0 design assumes an attacker may observe or control network paths, send
arbitrary protobuf inputs, replay captured application messages, hold a valid
low-privilege certificate, compromise an operator client, exploit an adapter, or
obtain read access to the state database or logs. The design does not assume that
a compromised host kernel, hypervisor, GPU firmware, enterprise CA, or KVP server
process can be contained without additional platform controls.

## v0 invariants

1. Production connections use TLS 1.3 with mutually authenticated certificates.
2. Certificate identity is mapped to one registered KVP client identifier.
3. Sessions are random, short-lived, revocable, and never written to logs.
4. Each command carries a strictly increasing session sequence number. Reuse or
   reordering is rejected before command dispatch.
5. Authorization is deny-by-default and is evaluated for every command.
6. Payload size and deadlines are bounded before allocation or adapter work.
7. Audit records contain identifiers, decision, operation, and hashes where
   useful, but never raw prompt/cache contents or secrets.
8. Cryptographic verification uses maintained libraries and constant-time
   primitives. No XOR encryption or custom cipher construction is permitted.
9. The authenticated transport principal is bound to the session on every RPC;
   possession of a session token alone is insufficient from another identity.
10. Command identity, target, and typed payload are reserved durably before
    adapter dispatch.
11. Adapter endpoints come only from an authenticated administrative registry;
    protobuf requests never control network destinations.
12. Production startup fails when mandatory identity, policy, state, or audit
    dependencies are unsafe or unavailable.

## Threat and control matrix

| Threat | Primary controls | Residual risk / detection |
| --- | --- | --- |
| Peer impersonation | mTLS, enterprise trust roots, certificate-to-principal mapping | CA or host compromise; monitor identity and rotation failures |
| Stolen session token | 256-bit token, no logs, stored verifier, short TTL, certificate binding | Compromised authorized client until revocation |
| Command replay/reordering | Strict session sequence, durable command ID and request hash | Client state bugs surface as stable rejection codes |
| Lost response causing double execution | Command reservation, status lookup, adapter/engine idempotency classification | Some engines leave outcome indeterminate; no blind retry |
| Privilege escalation | Deny-by-default current policy, target scope, high-risk obligations | Policy-author compromise; immutable versions and approval audit |
| Type confusion or command smuggling | Protobuf `oneof`, normalized typed fields, allowlists, bounded parsing | Generated-code/library defects; fuzz and compatibility tests |
| SSRF through adapter target | Administrative endpoint registry; request contains only adapter ID | Compromised registry administrator; audit endpoint changes |
| Malicious or compromised adapter | Separate workload identity, capability limits, least-privilege engine access | Adapter can falsify unverified status; evidence levels remain explicit |
| Resource exhaustion | Connection/message limits, bounded fields, deadlines, queues, rate limits | Distributed load; capacity alerts and upstream network controls |
| Audit suppression or tampering | Transactional outbox, fail-closed risk classes, independent append-only sink | Sink administrator compromise; external anchors and access separation |
| Secret leakage through telemetry | Prohibited-field schema, redaction, low-cardinality metrics, tests | Novel library error strings; sampling and review |
| State rollback after restore | Database recovery controls, audit reconciliation, monotonic policy versions | Full control of DB and sink; independent anchors required |
| Supply-chain compromise | Locked dependencies, signed artifacts, isolated CI, provenance/SBOM plan | Trusted compiler or maintainer compromise; reproducibility and review |

## Explicitly unproven claims

KVP v0 does not prove that GPU memory was not modified outside the adapter, that
an inference engine is free of vulnerabilities, or that prompt injection cannot
influence model output. Those require separate isolation, engine hardening, and
application-level controls.

## Initial abuse cases

- stolen but revoked client certificate;
- replayed privileged command;
- operator attempting an administrator-only command;
- oversized payload causing resource exhaustion;
- compromised adapter returning fabricated status;
- malicious prompt disguised as a control command.

## Security verification plan

- unit and integration tests for every invariant and rejection path;
- protobuf parser fuzzing and property tests for canonical request hashing;
- certificate mapping, expiry, rotation, and revocation integration tests;
- concurrency tests for sequence and command reservation races;
- adapter conformance and uncertain-outcome fault injection;
- log/audit prohibited-field tests;
- dependency and container scanning in CI;
- independent design review before claims beyond authenticated control delivery.

## Incident containment

Operators can revoke a certificate binding, principal, session, adapter epoch, or
policy version. Revocation propagates through the consistent store and readiness
checks; long caches are forbidden on authorization paths. Incident runbooks must
cover CA compromise, stolen operator identity, malicious adapter, database
rollback, audit outage, and accidental destructive command.
