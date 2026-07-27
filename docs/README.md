# NetCityOS documentation

This directory is the architectural source of truth for NetCityOS and KVP. If an
implementation and these documents disagree, the discrepancy must be resolved
explicitly; the documentation is not permission to silently weaken a security
invariant.

## Start here

1. [NetCityOS platform scope](platform-scope.md) — product outcome and non-goals.
2. [KVP product scope](product-scope.md) — protocol MVP and non-goals.
3. [Naming and product map](naming-and-product-map.md) — canonical names and boundaries.
4. [NetCityOS platform architecture](architecture.md) — complete Enterprise system.
5. [Appliance platform](appliance-platform.md) — clean-machine installation and updates.
6. [Enterprise Workspace](enterprise-workspace.md) — operator interface and scenarios.
7. [Architect OS](architect-os.md) — architecture graph and plan compilation.
8. [Model/tool fabric](model-tool-fabric.md) — local/cloud models and tool connectors.
   - [KVP Model Gateway MVP](model-gateway-mvp.md) — implemented provider contract, registry, and local-only policy.
9. [Fleet management](fleet-management.md) — lifecycle and large-scale operations.
10. [KVP system architecture](kvp-architecture.md) — protected protocol control plane.
11. [Protocol lifecycle](protocol-lifecycle.md) — sessions, commands, retries, and errors.
12. [Wire contract](wire-contract.md) — validation, typed commands, and compatibility.
13. [Adapter contract](adapter-contract.md) — engine integration and capability model.
14. [Authorization model](authorization-model.md) — principals, roles, and policy inputs.
15. [Platform security model](platform-security-model.md) — appliance, browser, cloud, and recovery threats.
16. [KVP security model](security-model.md) — protocol assets, threats, and invariants.
17. [Workstation incident report](security-incident-2026-07-24.md) — local containment and administrator cleanup gate.
18. [Attestation model](attestation-model.md) — precise claim and evidence levels.
19. [Persistence model](persistence-model.md) — transactions, idempotency, and outbox.
20. [Configuration](configuration.md) — production-safe startup and rotation.
21. [Open-source compliance](open-source-compliance.md) — proprietary/OSS boundary.
22. [Platform defensibility](platform-defensibility.md) — ecosystem and IP control points.
23. [Audit and observability](audit-and-observability.md) — evidence without secret leakage.
24. [NetCityOS platform roadmap](platform-roadmap.md) — appliance-to-Enterprise milestones.
25. [KVP delivery roadmap](roadmap.md) — protocol milestones and exit criteria.
26. [Architecture decision backlog](open-questions.md) — unresolved choices and gates.
27. [IP protection package](ip/README.md) — patent, software, trademark, and know-how drafts for ООО «НетСити».

## Vision and project culture

- [The KVP Codex](vision/kvp-codex.md) — the non-normative creative manifesto.

Vision documents express project culture. They do not override architecture,
security policy, human authorization, or the status labels below.

## Architecture decisions

- [ADR-0001](adr/0001-standard-transport-crypto.md): use standard transport cryptography.
- [ADR-0002](adr/0002-separate-control-and-data-planes.md): keep prompts out of KVP v0.
- [ADR-0003](adr/0003-capability-driven-adapters.md): adapters declare their capabilities.
- [ADR-0004](adr/0004-command-idempotency.md): commands are idempotent by identity.
- [ADR-0005](adr/0005-postgresql-command-store.md): durable state uses PostgreSQL.
- [ADR-0006](adr/0006-kvp-is-platform-foundation.md): KVP is a NetCityOS foundation.
- [ADR-0007](adr/0007-debian-first-appliance.md): ship an immutable Debian-first appliance.
- [ADR-0008](adr/0008-closed-core-open-base.md): closed core over a compliant open base.

## Status labels

- **Implemented** — exists in code and is covered by tests.
- **Specified** — design is accepted but implementation is incomplete.
- **Proposed** — requires an ADR or prototype before acceptance.
- **Deferred** — intentionally outside the current milestone.
