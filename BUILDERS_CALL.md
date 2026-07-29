# KVP / NetCityOS — open call for builders

**Opened:** 29 July 2026
**Repository:** https://github.com/netcity888netcity-beep/Netcity-kvp-codex

We are inviting engineers, reviewers, technical writers, security researchers,
and product contributors to help turn KVP and NetCityOS from an architecture and
local MVP into a reproducible, secure platform.

## What exists today

- a Rust domain library for session lifecycle, RBAC, expiry, revocation, and
  replay-sequence checks;
- a local-first Model Gateway with deterministic mock contracts;
- protobuf and architecture specifications;
- early Android, admin, agent, and command-bridge prototypes;
- evidence-first roadmaps and offline test procedures.

This is not yet a production daemon, certified security product, finished
operating system, or investment offering. Current limitations are documented
openly so that contributions can be reviewed against evidence rather than
claims.

## Priority building tracks

1. **KVP control plane** — mTLS identity binding, negative-path tests, durable
   command reservation, reconciliation, and audit evidence.
2. **Command Bridge security** — trusted principals, real recipient delivery,
   replay ordering, redacted audit access, and bounded state.
3. **Testing and CI** — offline Rust/Python gates, pinned protobuf linting,
   Markdown checks, and reproducible evidence artifacts.
4. **Adapters** — deterministic mocks first; governed local engine adapters only
   after contracts and failure semantics are proven.
5. **Documentation** — threat models, runbooks, claim-to-evidence matrices, and
   clear separation of implemented, prototype, planned, blocked, and research.

## Good first contributions

- improve tests for an existing behavior without adding network access;
- review protocol error semantics and negative paths;
- fix documentation inconsistencies with a source citation;
- propose a small CI gate with pinned versions and no secret requirements;
- reproduce an existing offline test run and report exact evidence.

Before writing code, open or choose a narrowly scoped issue. Avoid broad rewrites
and generated-code dumps. One pull request should solve one reviewable problem.

## Safety rules

- Never commit credentials, tokens, private keys, personal data, machine audit
  reports, databases, or local configuration backups.
- Do not add telemetry, external providers, downloads, or network listeners
  without explicit review and a documented threat boundary.
- Do not weaken authentication, authorization, replay protection, audit, or
  resource limits to make a demo pass.
- Security testing must target systems you own or are explicitly authorized to
  test. Submit vulnerabilities privately as described in `SECURITY.md`.
- AI-assisted contributions are welcome, but a human contributor remains
  responsible for understanding, testing, and describing the change.

## How to join

1. Read `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and the roadmaps under
   `docs/`.
2. Fork the repository and create a focused branch.
3. Reproduce the applicable offline checks.
4. Submit a pull request describing scope, tests, risks, and limitations.
5. Participate respectfully in review and revise the change when evidence shows
   a problem.

Builders earn attribution for accepted work through Git history and the project
contributors list. No equity, token allocation, employment, or financial return
is promised by participation.

The beacon is live. Build carefully, show evidence, and leave the system safer
than you found it.
