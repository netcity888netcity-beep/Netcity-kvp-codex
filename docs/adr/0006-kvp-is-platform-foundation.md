# ADR-0006: KVP is the platform foundation, not the complete product

Status: accepted

## Context

The original scope described KVP as a standalone LLM control plane. The product
vision now includes an Enterprise operator environment, architecture compiler,
model/tool runtime, cloud connectors, and model-fleet management.

## Decision

NetCityOS is the product boundary. KVP remains a separately specified protected
protocol and reference implementation underneath Architect OS, Runtime/Fleet
Fabric, Governance, and the Enterprise Workspace.

## Consequences

- KVP can be patented/licensed/versioned independently from the full platform.
- Interface and architecture objects do not leak provider-specific wire details.
- Platform guarantees and KVP guarantees must be stated separately.
- KVP adoption can extend to certified third-party components without exposing
  the proprietary NetCityOS implementation.
