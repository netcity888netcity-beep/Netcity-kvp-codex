# NetCityOS

NetCityOS is a closed-source Enterprise operating environment for designing,
governing, and operating local and cloud model fleets, agents, tools, and
multi-layer architectures. It is delivered as a complete Linux-based appliance
for clean hardware or a dedicated virtual machine.

KVP (Kernel Validation Protocol) is the protected control and evidence fabric at
the foundation of NetCityOS. Architect OS compiles versioned architecture graphs,
and the Enterprise Workspace provides the operator environment.

## Product boundaries

NetCityOS includes:

- a signed, hardened appliance with controlled installation and updates;
- the Enterprise Workspace for architecture, fleet, scenario, and incident work;
- Architect OS for graph validation, planning, simulation, and drift;
- Runtime, Tool, Fleet, and Governance fabrics for local and cloud models;
- KVP for authenticated, replay-resistant control and evidence operations;
- local engine adapters and governed cloud/provider connectors.

KVP specifically does:

- authenticate control-plane peers through a standard mTLS transport;
- authorize operations by role and policy;
- bind every command to a short-lived session and a monotonically increasing
  sequence number;
- expose verifiable engine status and, where an engine supports it, signed
  state evidence with an explicit claim level.

KVP does not claim to make an inference engine "unhackable", inspect arbitrary
KV-cache memory through a public vLLM API, or replace TLS with proprietary
cryptography. NetCityOS does not claim that KVP controls the internal state of a
third-party cloud provider.

## Repository layout

- `docs/architecture.md` — NetCityOS platform architecture;
- `docs/appliance-platform.md` — clean-machine installation and system image;
- `docs/enterprise-workspace.md` — operator environment and scenarios;
- `docs/architect-os.md` — architecture graph and plan compiler;
- `docs/model-tool-fabric.md` — local/cloud model and tool connectors;
- `docs/ip/README.md` — confidential IP protection working package;
- `proto/netcity/kvp/v1/control.proto` — versioned KVP wire contract;
- `crates/kvp-core` — transport-independent session and authorization logic;
- `docs/README.md` — documentation map and architecture decision index;
- `docs/kvp-architecture.md` — KVP components and trust boundaries;
- `docs/protocol-lifecycle.md` — session and command semantics;
- `docs/adapter-contract.md` — normalized engine integration contract;
- `docs/persistence-model.md` — durable command and audit state;
- `docs/security-model.md` — security invariants and explicit claim limits.

## Local development

Prerequisites: stable Rust. The current milestone tests the domain layer and does
not compile protobuf yet; protocol code generation is added with the gRPC server
in the next milestone.

```text
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
npx --yes @bufbuild/buf lint
npx --yes markdownlint-cli2 "README.md" "docs/**/*.md"
```

`buf lint` uses the checked-in `buf.yaml` and validates the public protobuf API
against Buf's `STANDARD` rules. CI will pin the Buf CLI version before the first
shared build pipeline is introduced.

The current executable milestone is intentionally a library, not a network
daemon. A server must not accept traffic until certificate identity is bound to
the KVP client registry and the negative-path tests are in place.
