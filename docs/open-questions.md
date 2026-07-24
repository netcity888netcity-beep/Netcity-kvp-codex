# Architecture decision backlog

This file tracks consequential choices that are not yet accepted. Each item needs
an ADR, prototype evidence, or an explicit deferral before its milestone begins.

## Required before M1

### Certificate identity convention

Recommended starting point: one enterprise trust domain using SPIFFE-compatible
URI SANs for workload identities and a documented URI namespace for human/tool
clients. Exact mapping, CA constraints, and revocation source need an ADR.

### TLS implementation and proxy boundary

Recommended starting point: terminate mTLS in the Rust service so the verified
peer certificate is directly available to identity mapping. If an enterprise
proxy terminates TLS, it becomes a trusted component and must pass authenticated,
integrity-protected identity context; ordinary headers are insufficient.

### Session TTL and revocation target

Recommended development defaults: 15-minute sessions, immediate store-backed
principal revocation, and no authorization cache longer than 30 seconds. Values
require workload and incident-response validation.

## Required before M2

### Policy representation

Recommended starting point: typed embedded policy over a small fixed input model,
stored as immutable versioned records. Evaluate an external policy engine only
when policies exceed the built-in model; network policy calls must not become an
unbounded availability dependency.

### Canonical command encoding

Choose and test deterministic protobuf serialization rules or a separate
canonical facts encoding. The selection must remain stable across Rust versions
and supported client languages.

### Audit sink

Select the enterprise target (for example, a Kafka-compatible immutable stream or
SIEM ingestion endpoint), acknowledgement contract, retention, access ownership,
and independent anchoring. Local files are development-only.

## Required before M3

### Adapter connection direction

The current architecture shows KVP dialing a registered adapter endpoint. For
restricted engine networks, an adapter-initiated persistent stream may be safer.
Prototype both through firewalls and load balancers before fixing the internal
protocol.

### Capability descriptor schema

Define normalized limit types, engine version constraints, evidence types, and
capability epoch behavior. Registry changes must not race already reserved
commands without a stated policy.

## Required before M4

### Supported vLLM version and operations

Pin one vLLM version, inventory only documented control surfaces, and publish a
feasibility report. Internal Python APIs are acceptable for a prototype only if
their upgrade and containment risks are explicit.

### Multi-node deployment orchestrator

The single-node appliance uses systemd-supervised services/OCI artifacts without
embedding Kubernetes. Before Enterprise cells, decide whether NetCityOS owns a
cluster orchestrator, integrates with customer Kubernetes, or supports both
through separate profiles. Installer/update authority must remain distinct from
workload scheduling.

### Production image mechanism

The immutable A/B and encrypted-state invariants are accepted, but the exact
image/partition/update implementation requires a recovery prototype, power-loss
tests, Secure Boot key-lifecycle design, and hardware compatibility evidence.
