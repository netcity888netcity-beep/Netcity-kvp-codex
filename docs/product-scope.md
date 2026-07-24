# KVP v0 product scope

## Problem

Enterprise operators need one auditable control plane for heterogeneous LLM
engines. Existing engine APIs expose different controls and generally do not
provide a uniform identity, authorization, replay-protection, or attestation
model.

## First demonstrable outcome

An authorized operator can submit a parameter-update command to a mock engine
adapter through KVP. The adapter accepts it exactly once, records an audit event,
and returns a result bound to the request and session. An unauthorized role, an
expired session, or a repeated/out-of-order sequence number is rejected.

## MVP components

1. Versioned protobuf contract.
2. Rust control-plane service with mTLS client authentication.
3. Client identity registry and role-based policy engine.
4. Durable command idempotency and outcome reconciliation.
5. Mock adapter, followed by a vLLM adapter limited to capabilities that vLLM
   actually exposes.
6. Append-only structured audit trail without prompt or key material.
7. Integration and negative-path tests.

## Deferred work

- direct KV-cache block mutation or export;
- hardware-backed keys and remote attestation;
- cache integrity proofs across engine restarts;
- licensing, obfuscation, patent strategy, and multi-region operation;
- adapters for llama.cpp, TensorRT-LLM, and SGLang.

## Success criteria for v0

- no plaintext production transport mode;
- unknown identities cannot open sessions;
- all privileged commands are authorized and replay-protected;
- secrets and prompt bodies never enter logs;
- a mock-adapter end-to-end test is deterministic;
- the security claims in documentation match implemented behavior.
