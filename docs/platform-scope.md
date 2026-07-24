# NetCityOS platform scope

Status: product baseline

## Product promise

NetCityOS gives an Enterprise customer one installable, governed environment for
building and operating multi-layer systems made of local/cloud models, agents,
tools, data boundaries, human approvals, policies, and evidence.

## First platform outcome

On a clean supported server, an administrator installs a signed NetCityOS image,
initializes organizational trust, opens the Enterprise Workspace, composes a
small architecture in Architect OS, connects one mock/local endpoint and one
cloud-model profile, validates policy/capabilities, and executes an auditable
scenario whose control operations are delivered through KVP.

## Included product domains

1. Appliance installer, recovery, signed update, and hardware profiles.
2. Enterprise identity, governance, approvals, budget, and audit.
3. Enterprise Workspace with architecture/fleet/scenario/incident surfaces.
4. Architect OS graph registry, validation, compilation, simulation, and drift.
5. Runtime & Tool Fabric for governed model/tool sessions.
6. Fleet Control Plane for local and cloud endpoints.
7. KVP protected control/evidence protocol and reference implementation.
8. Adapter/connector SDK, registry, conformance, and commercial extensions.

## Explicit non-goals for the first release

- a general-purpose desktop or unrestricted Linux distribution;
- replacing customer IAM, PKI, SIEM, database, or enterprise secret systems;
- claiming low-level cloud-provider control that its API does not expose;
- autonomous privileged execution from free-form model output;
- supporting arbitrary hardware, drivers, models, and providers without a tested
  profile;
- immediate multi-region SaaS; the initial product is customer-controlled
  appliance/cell deployment.

## Enterprise success criteria

- reproducible installation on clean supported hardware;
- production cannot start with unsigned system/product artifacts;
- local and cloud endpoints share a catalog but retain different trust evidence;
- every architecture change and runtime side effect has policy and evidence;
- closed product code is distributed without violating third-party OSS terms;
- a customer can export its own architecture/configuration/evidence in a
  documented format without receiving proprietary implementation details;
- claims in sales, patent, security, and UI materials match actual guarantees.
