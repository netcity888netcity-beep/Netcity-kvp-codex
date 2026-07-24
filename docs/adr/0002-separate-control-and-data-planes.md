# ADR-0002: Separate control and inference data planes

Status: accepted

## Context

Inference prompts and generated tokens are high-volume, highly sensitive data.
Administrative commands have different identity, availability, audit, and
latency requirements. Routing both through KVP would increase blast radius and
turn a control service into an inference proxy.

## Decision

KVP v0 carries administrative operations, adapter capabilities, status, policy
decisions, and evidence. Applications send prompts directly to the inference
engine or through the separately governed NetCityOS Runtime Fabric. KVP does not
inspect or transform prompt bodies. Runtime data-plane processing has its own
classification, routing, connector, privacy, and evidence controls.

## Consequences

- KVP can be scaled and secured independently of inference throughput.
- Prompt injection is not claimed to be solved by the transport protocol.
- Cross-plane correlation uses opaque request references when explicitly needed,
  never copied prompt contents.
- Future data-plane features require a separate ADR and privacy analysis.
