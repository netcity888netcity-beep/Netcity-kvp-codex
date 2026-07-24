# ADR-0001: Use standard transport cryptography

Status: accepted

## Context

The concept document proposes X25519, Ed25519, and application payload
encryption over gRPC. Its sample handshake returns Diffie-Hellman output as an
"encrypted session key" and does not bind commands to a negotiated session.
Implementing a new secure-channel construction would add risk without creating
the product's core value.

## Decision

KVP v0 uses gRPC over TLS 1.3 with mutual certificate authentication. The
application layer adds short-lived opaque session identifiers, role-based
authorization, sequence numbers, deadlines, and audit correlation. Payload-level
encryption may be added only for a documented end-to-end boundary that TLS does
not cover, using a reviewed standard construction.

## Consequences

- PKI provisioning and certificate rotation become required operations.
- Transport security can use mature, audited implementations.
- Protocol engineering focuses on identity binding, policy, replay protection,
  adapter capability negotiation, and state attestation.
