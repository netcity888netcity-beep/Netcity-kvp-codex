# Wire contract rules

Status: specified

The public protobuf contract is `proto/netcity/kvp/v1/control.proto`. This document adds
semantic rules that protobuf syntax alone cannot express.

## Validation profile

Before state lookup or allocation-heavy work, the server enforces configured hard
limits. Initial design limits are:

| Field | Rule |
| --- | --- |
| Session token | Exactly 32 bytes |
| Client, adapter, request, command IDs | Valid canonical identifier, at most 128 bytes |
| Nonce | 16–64 bytes; used once within its acceptance window |
| Parameter updates | 1–64 entries, unique normalized names |
| Parameter name/string value | At most 128/1024 UTF-8 bytes |
| Cache namespace/scope reference | Canonical allowlisted reference, at most 256 bytes |
| Model reference | Immutable registry reference or digest, at most 512 bytes |
| Total decoded request | Deployment limit no larger than the transport limit |
| Deadline | Present, in the future, and within the operation's maximum horizon |

These values are starting bounds, not a compatibility promise. The server may
advertise tighter limits; clients must not infer permission from message shape.

## Typed commands

`CommandPayload` is a `oneof`; exactly one command must be present. Operation is
derived from that command variant, eliminating disagreement between an enum and
opaque payload. Parameter names are normalized and allowlisted by adapter
capability and policy. Unknown names are rejected rather than forwarded.

Cache and model scopes are opaque registry references, not filesystem paths,
shell fragments, URLs, or arbitrary engine arguments. The adapter resolves them
through its trusted configuration.

## Canonical request hash

Idempotency uses a deterministic canonical representation of:

- protocol major version;
- authenticated principal and environment namespace;
- command ID and target adapter ID;
- typed command payload with parameter entries sorted by normalized name;
- effective deadline when deadline changes can affect behavior.

The session token, sequence number, trace metadata, and transport certificate are
not part of command behavior and are excluded. The hash algorithm and canonical
encoding version are stored with each reservation; changing either requires
compatibility tests and an ADR.

## Response rules

`error_code` is always `ERROR_CODE_UNSPECIFIED` for successful terminal results.
For rejected or indeterminate results it is a defined non-zero value. `result`
is empty unless its schema is defined for the command variant; opaque adapter
errors are not copied into it. Human diagnostic text will be carried in standard
gRPC status details with redaction and length limits.

## Compatibility

- Never reuse a published field number or enum value.
- Reserve removed fields and names.
- Clients ignore unknown response fields and enum values safely.
- Servers reject unknown command variants; they do not reinterpret them.
- New optional fields may be added in `v1` only when absence preserves old
  behavior. Breaking semantics require `v2`.
- Generated-code compatibility tests run against the oldest supported v1 client.

## Attestation evidence

An `AttestationEvidence` message is optional. Presence means only that evidence
is attached; verification depends on a recognized evidence type, format version,
trusted signing key, freshness, nonce binding, and claim policy. Unknown evidence
types are treated as unverified, never as a successful attestation.
