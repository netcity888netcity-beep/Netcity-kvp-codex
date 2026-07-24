# ADR-0008: Keep a closed product core over a compliant open base

Status: accepted

## Context

The company intends to distribute NetCityOS as proprietary software while using
an open-source operating-system and runtime foundation. Open-source components
carry different copyright, source, notice, patent, and redistribution terms.

## Decision

Keep proprietary NetCityOS services in private repositories and separately
versioned artifacts. Track every third-party component in an SBOM and license
inventory, prefer permissive dependencies, review conditional/copyleft
components, fulfill source/notice duties, and block unknown or incompatible code.

## Consequences

- Closed source is a product boundary, not a claim that the entire appliance is
  owned exclusively by ООО «НетСити».
- Release engineering includes legal-compliance artifacts and source fulfillment.
- Container/process separation supports architecture but is not treated as an
  automatic copyright-law safe harbor.
- A specialist reviews the final dependency graph and commercial EULA.
