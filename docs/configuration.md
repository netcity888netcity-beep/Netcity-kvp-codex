# Configuration and safe startup

Status: specified

## Configuration principles

Configuration is validated once at startup into a typed immutable snapshot.
Unknown keys, duplicate identities, unsafe limits, missing trust roots, and
production-incompatible features are fatal. Reloadable policy and identity data
uses versioned store records, not ad-hoc file mutation.

## Configuration groups

| Group | Examples | Secret? |
| --- | --- | :---: |
| Deployment identity | environment namespace, instance ID, advertised API version | No |
| Listener | bind address, port, connection and message limits | No |
| TLS | trust bundle, certificate chain, private-key provider reference | Private key reference only |
| State | PostgreSQL endpoint, pool limits, credential provider reference | Credential reference only |
| Policy | active policy source and refresh rules | No |
| Audit | sink endpoint, trust material, spool limits, fail-closed classes | Credential reference only |
| Adapters | approved endpoint registry and health thresholds | No secrets in endpoints |
| Telemetry | exporter endpoint, sampling, redaction profile | Credential reference only |

Secrets are supplied through restricted files, OS secret facilities, Vault/HSM,
or a workload identity provider. They are not committed, printed in diagnostics,
passed as command-line arguments, or embedded in container images.

## Production profile invariants

- TLS 1.3 and client certificate verification are mandatory.
- Listener wildcard binding requires an explicitly configured network boundary.
- Development certificates and loopback plaintext features are unavailable.
- At least one trust root, durable state store, policy version, and audit sink are
  valid before readiness becomes true.
- Debug logging cannot enable payload or token logging.
- Limits have safe upper bounds compiled into the binary.
- Adapter endpoints are selected from the authenticated registry; request data
  can never supply a URL or socket address.

## Rotation

Server and adapter certificates support overlap: load a new identity, begin using
it, verify health, then revoke the old identity. Trust-root rotation uses a
two-bundle transition. Session effective expiry never exceeds the certificate
binding lifetime. Private-key reload failures preserve the last valid identity
for a bounded period and make rotation health visible.

## Configuration provenance

At startup KVP emits the application version, configuration schema version,
non-secret configuration digest, policy version, and trust-bundle digest. It does
not dump configuration. These references allow an audit event to be tied to the
effective deployment state.
