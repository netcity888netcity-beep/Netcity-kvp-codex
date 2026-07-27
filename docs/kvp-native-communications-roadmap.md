# KVP Native Communications Roadmap

## v0.1: Local Foundation

- explicit command and native profiles;
- local identities and role policy;
- direct actor, service, and model recipients;
- bounded local rooms and conversation metadata;
- atomic replay protection;
- local-only sensitive delivery;
- in-memory transport;
- model gateway port with offline mock;
- payload-free tamper-evident audit.

## v0.2: Durable Local Appliance

- durable command, replay, inbox, conversation, and audit stores;
- transactional delivery reservation and acknowledgement;
- crash recovery and bounded retention policies;
- signed release configuration and operator-visible health diagnostics;
- migration tooling for protocol-compatible schema changes.

## v0.3: Authenticated Network Transport

- standard TLS 1.3 transport security;
- mutual TLS for service and appliance identity;
- certificate lifecycle, rotation, revocation, and trust-domain policy;
- explicit network allowlists and destination pinning;
- asynchronous delivery with bounded queues and backpressure;
- no automatic public tunnels.

## v0.4: Standard End-to-End Encryption

- adopt a reviewed standard E2EE protocol suitable for group and direct communication;
- evaluate Messaging Layer Security for room key agreement and membership changes;
- hardware-backed key protection where available;
- authenticated device enrollment and recovery procedures;
- metadata minimization and privacy threat modeling;
- no proprietary cryptographic primitives or home-grown protocols.

## v0.5: Federated Native Communications

- explicit federation trust agreements;
- capability negotiation by protocol version;
- cross-domain recipient policy and classification controls;
- auditable routing decisions without payload disclosure;
- organization-level room governance and retention policy;
- deterministic failure without hidden provider or transport fallback.

## Non-Goals

- third-party messenger services as the primary control plane;
- embedded credential distribution;
- shell command transport;
- automatic exposure of local services to the public network;
- unbounded room, replay, queue, or conversation storage;
- custom cryptographic algorithms.
