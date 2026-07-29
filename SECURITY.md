# Security policy

## Current scope

KVP and NetCityOS are under active development. Repository components include
libraries, contracts, and prototypes; they are not yet a production security
boundary unless a document explicitly states otherwise and provides evidence.

## Reporting a vulnerability

Do not open a public issue containing an exploit, credential, private key,
personal information, machine-specific audit report, or unredacted log.

Send a minimal private report to `netcity888netcity@gmail.com` with:

- affected component and revision;
- impact and required attacker capabilities;
- reproducible steps using synthetic data;
- suggested mitigation, if known;
- whether disclosure is time-sensitive.

Do not send real credentials or proprietary third-party data. Maintainers will
acknowledge receipt when available, validate the report, coordinate remediation,
and agree on disclosure timing. No bounty or payment is promised unless a
separate written program explicitly says so.

## Authorized research

Security research must be limited to infrastructure you own or have explicit
permission to test. Do not scan, exploit, disrupt, or access third-party systems
in the project's name. Avoid persistence, destructive payloads, data extraction,
social engineering, denial of service, and tests against real user information.

## Secrets

If a secret is committed, treat it as compromised:

1. revoke or rotate it at the provider;
2. remove it from the reachable history using a reviewed procedure;
3. verify all remote refs and artifacts;
4. document the incident without repeating the secret;
5. add a regression control that detects the secret class.

Deleting a string only from the newest commit is not sufficient.
