# ADR-0003: Use capability-driven adapters

Status: accepted

## Context

LLM engines expose different administrative surfaces and change independently.
A fixed list of operations can imply support that an engine does not actually
provide, especially for internal KV-cache manipulation.

## Decision

Each authenticated adapter registers versioned capability descriptors. The KVP
coordinator validates operation, schema, engine version, support level, limits,
and idempotency behavior before dispatch. Undeclared capabilities are denied.

## Consequences

- Clients can discover supported behavior without engine-specific branching.
- Adapter conformance becomes a release gate.
- Native and emulated operations are distinguishable.
- Capability registration and change events require authentication and audit.
