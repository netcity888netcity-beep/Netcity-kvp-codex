# NetCityOS platform roadmap

The platform roadmap runs alongside the detailed KVP roadmap. Milestones exit on
reproducible evidence, not presentation readiness.

## P0 — Product and IP baseline (current)

- product naming and bounded contexts;
- KVP/NetCityOS/Architect OS separation;
- Enterprise Workspace and fleet/runtime concepts;
- Debian-first immutable appliance decision;
- OSS compliance and closed-core boundary;
- confidential technical IP disclosure and rights-chain templates.

Exit evidence: architecture and legal working documents are internally reviewed,
names/requisites are confirmed, and external disclosure is controlled.

## P1 — Bootable appliance foundation

- automated minimal Debian image build from locked manifests;
- UEFI x86-64 installation in VM and reference server;
- read-only A/B system slots and encrypted persistent state prototype;
- signed release bundle verification and recovery boot;
- local administrator/bootstrap PKI flow;
- SBOM, notices, license inventory, and reproducible build evidence.

Exit evidence: a clean machine reaches a locked readiness screen only from a
verified image and can roll back a deliberately broken update.

## P2 — Trusted single-node platform

- KVP M1/M2 services;
- local PostgreSQL development profile and durable audit outbox;
- identity/governance skeleton;
- mock endpoint and one governed cloud connector;
- minimal Workspace shell and Architect OS graph registry;
- installer acceptance and diagnostic evidence bundle.

Exit evidence: one architecture version executes an idempotent scenario against
mock/local and cloud profiles with policy and complete evidence.

## P3 — Architect OS and Enterprise Workspace

- typed graph schema, constraints, plan compiler, simulation, and drift;
- architecture, fleet, scenario, governance, evaluation, and incident surfaces;
- approvals, budgets, environment inheritance, and artifact registry;
- large-topology interaction and accessibility testing.

Exit evidence: an operator can review impact, approve, execute, reconcile, and
audit a multi-layer architecture change without direct provider/engine access.

## P4 — Fleet and connector ecosystem

- adapter/connector SDK and signed registry;
- local engine integration and version-pinned vLLM report;
- provider connector profiles, routing, quotas, residency, and cost evidence;
- conformance suite and controlled `KVP Ready` pilot;
- hardware/GPU profiles and offline bundle pipeline.

Exit evidence: unsupported claims are rejected automatically and a fleet change
has per-target states, stop conditions, and reconciliation.

## P5 — Enterprise cells and hardening

- multi-node control/runtime cells with external durable state;
- enterprise SSO/PKI/SIEM/secret integrations;
- secure update waves, backup/recovery, HA and disaster exercises;
- threat-model validation, performance, supply-chain and independent security
  review;
- production EULA, third-party notices, patent/trademark filing decisions.

Exit evidence: pilot customer acceptance in a controlled Enterprise environment
with documented SLOs, incident procedures, recovery objectives, and IP clearance.

## P6 — Custom distribution decision

Evaluate continued Debian-image maintenance versus a Yocto-based NetCityOS Linux
distribution using actual hardware matrix, reproducibility, driver, security
patch, compliance, and staffing evidence. Migration is accepted only if benefits
outweigh the additional BSP and release-engineering ownership.
