# Authorization model

Status: partially implemented

## Principal model

A principal is a registered human, automation client, or workload identity. The
canonical principal identifier comes from the verified certificate mapping, not
from a protobuf field. A registry entry contains status, trust domain, allowed
certificate identities, assigned roles, and optional adapter or environment
scope.

Sessions capture an authorization snapshot for performance, but every command is
also subject to immediate principal revocation and policy-version checks. A role
is necessary but may not be sufficient: target environment, adapter, model,
operation payload, time window, and approval context can further restrict access.

## Built-in roles

| Operation | Observer | Operator | Administrator |
| --- | :---: | :---: | :---: |
| Open own session | Yes | Yes | Yes |
| Read adapter status | Yes | Yes | Yes |
| Read own command result | Yes | Yes | Yes |
| Update allowlisted runtime parameters | No | Yes | Yes |
| Trigger supported compaction | No | Yes | Yes |
| Switch model | No | No | Yes |
| Invalidate cache scope | No | No | Yes |
| Revoke another principal/session | No | No | Yes |
| Change policy or adapter trust | No | No | Yes |

This matrix matches the initial `kvp-core` role rules for engine operations.
Administrative identity and policy operations are specified for later services.

## Policy evaluation inputs

- authenticated principal, trust domain, certificate identity, and session;
- assigned role and current policy version;
- operation, target adapter, model/environment scope, and canonical payload facts;
- command risk class, deadline, and optional approval reference;
- adapter capability and current health state.

The policy output is `allow` or `deny` plus stable reason code, policy version,
and obligations such as mandatory audit durability or two-person approval. An
evaluation error is a denial.

## High-risk operations

Model switching, broad cache invalidation, trust changes, and policy changes are
high risk. Production policy may require short-lived elevation and a second
independent approval. KVP v0 does not implement approval workflows, so these
operations remain disabled in production until that obligation can be enforced.

## Tenant and environment isolation

KVP v0 targets one enterprise trust domain, but every state key includes an
environment namespace from the beginning. Cross-environment commands are denied
unless a policy explicitly grants them. A future multi-tenant service requires a
separate isolation review; adding a tenant string to messages is not sufficient.
