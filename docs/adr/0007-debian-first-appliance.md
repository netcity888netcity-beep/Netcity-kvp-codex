# ADR-0007: Ship a Debian-first immutable appliance

Status: accepted for pilot and v1 planning

## Context

NetCityOS must install on a clean server as a complete managed environment. A
general-purpose user-maintained distribution produces configuration drift, while
a custom Yocto distribution from day one would significantly increase BSP,
driver, and build-system work before the supported hardware matrix is known.

## Decision

Use pinned Debian 13 stable packages to build a branded, minimal, immutable
NetCityOS appliance with signed A/B updates and encrypted persistent state. Do
not expose unrestricted package management in production. Re-evaluate a Yocto
distribution after hardware profiles and release engineering stabilize.

## Consequences

- Initial server/GPU compatibility and prototyping are faster.
- Debian and component license obligations remain mandatory.
- NetCityOS owns image construction, security updates, compatibility, and support.
- Migration to Yocto is an image/build concern, not permission to couple product
  services to Debian-specific APIs.
