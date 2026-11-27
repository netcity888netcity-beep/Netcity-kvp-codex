# NETCITY PROJECT STATE — 2026-11-27

> Durable handoff record for independent sessions and agents. This file records confirmed decisions, research, user-reported facts, and open work. It does not imply implementation, tests, hardware procurement, publication, or funding approval.

## 1. Operating rule: repository as project memory

- This repository is the canonical durable memory for NetCity/KVP across ChatGPT, Endcode and other agent sessions.
- Every agent must read `RODNOY_MEMORY_CORE.md`, `COUNSELOR_MEMORY_CORE.md`, this state file, and the relevant specification before continuing.
- After a meaningful completed stage, write a dated, append-only memory entry: decisions, artifacts/paths, exact commit SHA, checks actually run, blockers and next action.
- Never equate architecture proposal, source code, added tests, tests actually run, integration, hardware proof or production readiness.
- Never claim a commit/push, test, build, deployment, payment or external action unless the corresponding result is available.
- User explicitly authorizes repository-memory and project-illustration updates in this task. This does not authorize changes to application code, tests, `IntentRouter.js`, `main` product behavior, `gh-pages`, deployments, purchases, supplier contact, posts, financial transfers or wallet operations.
- Preserve existing branches and history. Do not merge `work/spatial-planner` into `main` without a separate instruction.

## 2. Product and architecture identity

NetCity is a personal intelligent environment / spatial operating system, not a chatbot and not a collection of widgets. KVP is its central interpreter and authorization boundary. The intended flow is:

`ARCHITECTOR → KVP CORE → AGENT RUNTIME / SPATIAL ENGINE / MOBILE RUNTIME → LOCAL COMPUTE NODE`

Conceptual layers:
- System: KERNEL / ADMIN / AGENT / BRIDGES / TRAFFIC / MOBILE / CROWN.
- Cognitive domains: BIO / TECH / ENERGY / INFO / CIVIC / IDENT.
- Runtime modes: CALM / DRIFT / HOT.
- Spatial intent flow: ARCHITECTOR interprets intention → AGENT SWARM proposes/executes only within granted authority → SPATIAL ENGINE materializes authorized state.

Visual language: dark high-tech spatial environment, volumetric overlays rather than flat AR cards, fine technical lines, unobstructed real-world view; dark `#050505` / `#0A0F1A`, KVP turquoise `#7DF6D1`, amber `#FFB45E`, white typography. Russian technical diagrams should remain clean, engineering-oriented and explicitly label target/proposed versus implemented.

## 3. Current code and branch status (historical facts; re-verify before relying)

- Repository: `https://github.com/netcity888netcity-beep/Netcity-kvp-codex.git`; default branch `main`.
- `Spatial Interpreter`: contract types/validators in `dashboard/src/architect/SpatialContracts.js`; non-executing bridge `processIntentContract()` in `dashboard/src/architect/ArchitectCore.js`; spec `docs/SPATIAL_INTERPRETER_SPEC.md`. It is not an execution or authorization engine.
- `DeterministicSpatialPlanner` is in separate branch `work/spatial-planner`, including `dashboard/src/architect/SpatialPlanner.js` and `SpatialPlanner.test.js`. It proposes plans for exact predeclared routes and does not invoke KVP authorization or execute adapters.
- Planner capability snapshots are fixed at construction time. A registry revocation does not mutate an existing planner snapshot; any future execution must re-check KVP immediately before execution. This remains an open design risk.
- Five Planner regression tests were added; their actual execution and the build are not confirmed.
- Existing historic test counts (35 KVP Core + 22 Spatial Engine = 57) are project-history claims, not a fresh CI result. Do not advertise them as a current unified verified test run.
- Do not edit application code, run deployment, change Pages, or merge branches as part of a memory-only update.

## 4. Authorization, Trust Core and Identity Root

Status: user-approved architectural decisions and design work; not confirmed as implemented code or production controls.

### KVP Authorization
- Architect/agents can delegate only within pre-granted authority. Each agent and delegation is independently checked; permissions are not inherited or elevated by delegation.
- KVP independently determines all affected domains: `core`, `bio`, `tech`, `energy`, `info`, `civic`, `ident`.
- Human approval is scoped to a specific plan and conditions and does not replace a fresh KVP check before execution.
- Emergency levels: E1 Protective (pre-authorized protective actions), E2 Critical (limited critical actions with stronger control/notification), E3 Human Authority (wait for human decision unless pre-authorized). Emergency mode never bypasses Authorization.
- After connectivity returns, automatic continuation pauses; show completed, blocked and incomplete actions; revalidate old approvals.
- Threat triggers may automatically place an agent in `QUARANTINED`; quarantine blocks privileged actions and preserves evidence; removal requires a new check.
- Authorization/Trust boundary is independent of Architect, Planner, Agent Swarm and Digital Self. Critical root changes use Dual Control. Agents cannot rewrite their own trust root.

### Hybrid Trust and Hybrid Identity
- Hybrid Trust combines hardware-backed evidence (TPM / Secure Element / HSM where available) with software evidence (OS-protected keys, signatures, integrity checks and environment checks).
- A device without a hardware trust module is not excluded, but software trust is not silently upgraded to hardware trust.
- Human Identity and each Device Identity are separate. Each device has its own key pair, enrollment state, trust evidence, restrictions and revocation.
- D1 Software / D2 Hardware-backed / D3 Attested are trust levels, not roles or automatic permissions.
- Device Registry decisions: multiple devices may be owned; revocation is immediate; device sharing is not allowed.
- Hybrid Enrollment: a new device generates new keys and is enrolled using an existing trusted device plus human confirmation; loss of all trusted devices requires a separate recovery ceremony.
- Device Trust Attestation: initial, periodic, event-based and pre-critical checks; independent trust sources; if attestation is unavailable, device enters restricted mode; outcomes VERIFIED / INSUFFICIENT / REJECTED; downgrade and revocation are auditable.
- Restricted Offline Mode permits only safe restricted operations. Reconnection does not automatically restore privilege.

### Recovery
- Owner Recovery Ceremony v0.1: independent owner confirmation + C4 technical verification + quorum 3-of-4 from C2–C5; create new C1 share, revoke old share and restore Root Authority.
- Root custody: strict / freeze / independent.
- Independent Recovery Council: independent, freeze on recovery, quorum 3-of-5; cannot rewrite itself without a separate ceremony; independent technical role R4 plus owner confirmation; revoke old keys and generate new ones.
- Root Recovery: RC-04 = 3-of-5; RC-05 mandatory; RC-06 dual control; RC-07 independent; RC-08 freeze; RC-09 3-of-5.
- Selected Hybrid Anchor: HSM (e.g. YubiHSM 2 or TPM 2.0) plus offline Shamir-style recovery shares; HSM monotonic counter/version plus offline recovery material.
- Identity recovery is not privilege recovery. Re-enrollment does not restore old sessions, keys, delegations or approvals automatically.
- All of the above is architecture/specification, not proof of cryptographic implementation.

## 5. Compute Node v0.1 — target hardware, not acquired

Target: one physical local server node at the user's home, for local inference, local confidential storage and local agent execution only. Cloud GPU, rented GPU, external inference API and external cloud compute are excluded.

Target configuration:
- Chassis/platform: GIGABYTE G893-ZD1-AAX3, 8U.
- GPUs: 8 × NVIDIA H200 SXM.
- CPUs: 2 × AMD EPYC 9755 (128 cores each; 500 W TDP each).
- RAM target: 8 TB, not yet confirmed compatible/QVL.
- Storage/network: platform listing includes 8 × 2.5-inch Gen5 NVMe, 2 × M.2 and 2 × 10GbE.
- Cooling: direct-to-chip liquid cooling is desired but not confirmed as a standard supported configuration for the exact platform.
- Official platform dimensions: 447 × 351 × 923 mm; 24 DIMM slots; dual SP5; 4+4 3000 W 80 PLUS Titanium PSUs; AC 200–240 V, C19. Confirm exact power topology and circuit requirements with the integrator.
- H200 SXM maximum TDP up to 700 W; EPYC 9755 TDP 500 W. Component-only upper reference: 8×700 W + 2×500 W = 6.6 kW, excluding RAM, drives, fans, PSU losses and other components. Approximate heat at that component load: 22,500 BTU/h. This is not measured whole-system draw.
- 8 TB RAM is unverified. Platform has 24 DIMM slots; retailer catalog data mentions up to 6 TB while AMD platform overview indicates up to 9 TB system capacity in certain 2DPC configurations. Neither proves 8 TB QVL support in this exact chassis. Require exact DIMM SKU, rank/3DS type, BIOS and OEM validation.
- Weight and acoustic level are not available in the reviewed official specification.
- Home deployment requires electrical, thermal, ventilation, noise, structural-floor, fire-safety, service-access and physical-security assessment. Do not assume an ordinary apartment can safely host it.
- Supplier catalog prices previously observed ranged widely and were not comparable written quotes. No supplier has been contacted; no order or quote is confirmed.

## 6. Mobile Spatial Workstation v0.1 — target client family

- Samsung Galaxy S25 Ultra.
- Samsung Galaxy Tab S11 Ultra.
- Compact Samsung ultrabook target: NPU, 128 GB RAM, approximately 11–12-inch display; exact model not selected.
- AR glasses: model not selected.
- All are clients of one NetCity environment, not isolated applications.
- Proposed topology: ARCHITECTOR → KVP Core → Agent Runtime + Spatial Engine + Mobile Runtime + World Memory → local Compute Node.
- Server owns authoritative scene state; devices keep bounded local copies and reconcile versions/permissions after reconnect. Offline mode is restricted.
- Secure remote access: private tunnel, device identity, trust attestation, key revocation and audit trail; do not expose the server directly to the public internet.
- Spatial Workspace target: create scenes; add/move/rotate/scale/group objects; layer information; save/restore across devices; dispatch tasks to local agents; receive results; limited offline mode.
- Proposed acceptance goals only (not measured): 60 FPS, local UI response ≤50 ms, LAN synchronization ≤200 ms, no loss of confirmed changes.
- Measure KVP latency, rendering, network synchronization and model inference separately.
- ARCore/Depth API support on the Samsung phones/tablet is only a compatibility baseline; it does not prove NetCity AR functionality.

## 7. KVP Runtime Contract v0.1 — next engineering design priority

Proposed common event envelope:
`device_id`, `session_id`, `scene_id`, `event_id`, `event_type`, `timestamp`, `trust_level`, `payload`.

Proposed Scene Manifest:
`scene_id`, `scene_version`, `objects[]`, `layers[]`, `anchors[]`, `permissions`, `event_log`.

Next design work should define:
1. canonical IDs, timestamps, schema/version negotiation and event envelope validation;
2. idempotency, ordering, causal/version rules and duplicate handling;
3. authoritative server state versus device-local cache;
4. offline queue, conflict detection and deterministic reconciliation;
5. trust/authorization binding for each event and each action;
6. replay protection, signatures, audit/provenance and key rotation;
7. scene manifest lifecycle and compatibility;
8. error states, retries, quarantine and safe reconnect;
9. measurable acceptance tests separated from architecture goals.

This is the next design task, not an implemented protocol.

## 8. Endcode and ChatGPT agent workflow

- User has an agent on the phone in Endcode that can write/execute code and assist with repository work; user reports ChatGPT is also available there.
- Endcode may be used as a second execution environment when a task needs local files, dashboards, shell/code execution or repository operations unavailable in the current ChatGPT connector.
- Before Endcode executes: read repository memory and relevant spec; report target branch and planned file paths; do not change code or push beyond explicit scope.
- ChatGPT and Endcode should use the repository as shared durable project state, not rely on chat-only context. After work, write exact commit SHA, changed paths, tests actually run and unresolved issues.
- No assumption that this ChatGPT cloud session itself migrates to the user's local server. The local Compute Node remains a future deployment target.

## 9. Funding and public project status — as of 2026-11-27

- Sponsr project: `https://sponsr.ru/netcity/`; identity verification was completed by the user. Public description positions NetCity as an engineering journal, with two releases per month, and explicitly says the product is in development, not a finished OS.
- Public Sponsr page did not expose verified subscriber count or revenue in the reviewed session. No new receipts can be inferred from public visibility.
- Metricool connection returned that no social network is connected; analytics/scheduling are not operational through that connector yet.
- WalletTG read-only integration has not been verified. Never request seed phrases, private keys or OTPs. No wallet payment flow or incoming transaction has been confirmed.
- Separate personal fundraising from company fundraising for ООО «НЕТСИТИ». Do not change campaign recipient/author status without written Sponsr confirmation and appropriate tax/legal review.
- No campaign post was published by the assistant; one draft social post was prepared in chat only.
- No supplier contact, quote request, purchase, payment, transfer, repo code change or deployment was performed.
- Corporate funding channels previously researched (guarantee support, leasing, grants, strategic investor) are leads, not approved financing. Verify company SME status, registration region, age, OKVED, tax status, arrears, financials, ownership and use of funds before asserting eligibility.
- For Russia, do not suggest cryptocurrency as payment for goods/services; do not suggest evading FSSP restrictions or routing funds through third-party accounts.

## 10. Growth Sprint automation

- Existing automation: `NetCity Growth Sprint`, ID `Automation_835ecdb754fc8191b65e615ad4cc1b10`, daily 7-day sprint, timezone Europe/Amsterdam.
- Latest known scheduled run on 27 Nov 2026 failed with a generic task error. Do not claim it completed or is a 24/7 agent.
- A daily scheduled run is not continuous background execution. Continuous operation requires a separate worker on the user's own local infrastructure.
- Automation constraints: budget 0; no purchases, supplier contact, posts/messages, paid actions, wallet/bank/payment page changes or repository code modifications without explicit approval. Local-only compute restrictions apply.

## 11. Illustration and visual asset register

The following project illustrations were located in the ChatGPT Library. They are project-relevant source assets; binary transfer into this Git repository is a separate operation and must not be claimed until the files are actually present in GitHub. User-supplied personal/equipment photographs and unidentified numeric image files are intentionally excluded from this public asset list pending explicit selection.

### NetCity spatial vision / interface
- `Неоновый техногик и робот-помощник.png`
- `Футуристический интерфейс NetCity OS с голографическим городом.webp`
- `Голографический центр NetCity: цифровое сознание.webp`
- `Нетсити: пространственное ядро будущего.webp`
- `Голографическая панель управления городом.webp`
- `Футуристический интерфейс NETCITY над городом.webp`
- `Небесный мегаполис в дополненной реальности.webp`
- `Иммерсивная панель NETCITY над городом.webp`
- `Футуристический интерьер с голографическим городом.webp`
- `Голографический центр NetCity в будущем.webp`
- `Архитектура NetCity: персональная ИИ-среда.webp`
- `NetCity: Архитектура будущего.webp`
- `NetCity: Умная среда будущего.webp`

### Identity / Trust / Recovery
- `Архитектура идентичности NetCity.webp`
- `Архитектура доверия NetCity.webp`
- `Церемония восстановления Root Authority NetCity.webp`
- `owner-recovery-ceremony-v0.1.png`

### Brand / presentation assets
- `1000017664.gif` — user-identified approved logo/brand asset; preserve as-is.
- `1000017662.jpg` — related user-supplied brand image; verify exact role before using.
- Pitch-deck chart exports `chart-*.png` are present in the library; identify their parent deck/slide and avoid committing duplicate exports blindly.

**Transfer status at this snapshot:** Four editable Mermaid engineering diagrams and `docs/illustrations/README.md` have been committed to `main`. A ZIP transfer bundle with 22 selected original project illustration/brand assets has been assembled at `NetCity_Illustrations_Transfer_2026-11-27.zip` for import through a local Git-capable workflow. The original raster/GIF binaries are not yet confirmed present in the Git repository. Do not mark them uploaded. Next safe action is to import the bundle through Endcode/working clone into `docs/illustrations/` (concepts / engineering / brand), preserve originals and filenames, verify every file in GitHub, then record the resulting commit SHA. Do not include private photos or unrelated screenshots.

## 12. Next priorities

**Project scope rule:** keep unrelated parallel workstreams outside NetCity memory, architecture, diagrams and asset bundles unless the user explicitly connects them.

- A first **DRAFT** of KVP Runtime Contract v0.1 is now stored at `docs/KVP_RUNTIME_CONTRACT_v0.1_DRAFT.md` (commit `07fd0bf9e1c933884352ddc2867c4ffa5afe469d`). It defines the event envelope, lifecycle, authorization boundary, scene versions, offline/reconnect, sync, agent dispatch, audit and acceptance test plan. It is an architecture proposal with open decisions; it is not implemented or tested.
1. Review and finalize KVP Runtime Contract v0.1, resolving the open decisions listed in the draft.
2. Finalize Mobile Runtime v0.1 and Spatial Workspace v0.1 against that contract.
3. Resolve Planner snapshot/revocation semantics before any execution integration.
4. Continue the Compute Node engineering dossier: verified RAM QVL, power/cooling/room engineering and comparable written configurations; no vendor contact without approval.
5. Transfer selected illustration binaries into `docs/illustrations/` using Endcode or another binary-capable Git workflow; verify each file in GitHub.
6. Keep Sponsr/growth work factual and distinguish drafts, public reach, pledges, confirmed receipts and company funding.
