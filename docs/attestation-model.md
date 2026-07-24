# Attestation and integrity claims

Status: proposed research track

## Principle

An attestation is useful only when it names a precise claim, trustworthy evidence
producer, freshness mechanism, and verifier. Signing arbitrary status bytes does
not prove that GPU memory or an LLM KV cache is correct.

## Claim levels

| Level | Candidate claim | Evidence source | v0 status |
| --- | --- | --- | --- |
| A | Response came from a registered adapter identity | mTLS workload certificate | Specified |
| B | Adapter reports a particular engine/version/configuration | Signed adapter statement | Proposed |
| C | Engine process loaded an approved artifact digest | Measured launch / platform attestation | Deferred |
| D | Named cache metadata matches an engine-produced digest at time T | Engine instrumentation | Research |
| E | All GPU KV-cache bytes remained untampered throughout execution | Hardware/engine proof not currently defined | No claim |

Marketing and API descriptions must state the level actually verified. Level A
must never be presented as Level D or E.

## Evidence envelope requirements

Recognized evidence binds:

- evidence type and schema version;
- adapter and engine instance identity;
- measured artifact/configuration references;
- request nonce and observation timestamp;
- claim-specific statement;
- signature and signing-key identifier.

The verifier checks schema, signature chain, key purpose, revocation, nonce,
freshness, expected instance, and policy claims. Verification failure is explicit
and auditable. Evidence bytes are size-bounded before parsing.

## Research gate

Before implementing cache integrity claims, produce:

1. exact cache object and lifecycle definition for one pinned engine version;
2. attacker and trusted-computing-base definition;
3. evidence generation point and key custody design;
4. replay and rollback analysis;
5. performance measurements;
6. independent review of claim wording and verifier behavior.
