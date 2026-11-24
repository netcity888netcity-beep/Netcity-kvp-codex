# Deterministic Spatial Planner — reproducibility contract

**Status:** IN DEVELOPMENT · implementation contract for `work/spatial-planner`.

## Capability snapshot boundary

A `DeterministicSpatialPlanner` instance captures every capability referenced by its configured routes exactly once during construction. Each present descriptor is detached with `structuredClone` and recursively frozen. A missing descriptor is captured as missing.

Consequences:

- registry mutation after construction cannot change the result of that Planner instance;
- later registration does not make a previously missing capability appear;
- later removal or replacement does not alter an already captured descriptor;
- a new Planner instance must be constructed to observe registry changes.

The registry is still metadata-only. Snapshotting does not authorize or execute a capability. KVP authorization remains a separate mandatory gate.

## Exact route key semantics

Route selection uses the literal tuple `[goal, requested_outcome.kind, domain]`.

- `domain` is an ordered sequence; element order is significant.
- No sorting, trimming, case folding, Unicode normalization, aliases, or fuzzy matching occurs in Planner.
- Producers of Spatial Intent are responsible for supplying the canonical literal values agreed by their upstream contract.

This intentionally favors explicit route declarations over implicit interpretation.

## Verification boundary

Regression tests are added in `dashboard/src/architect/SpatialPlanner.test.js` for registry snapshot stability, one-time capability reads, ordered domain matching, and literal string matching. Their existence does not imply execution. Test and build status must be reported only after running the corresponding project commands.
