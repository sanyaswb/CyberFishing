# Research: Accounts and Cloud Progress Foundation

**Date**: 2026-10-09. Decisions distinguish owner choices from engineering recommendations.

## Confirmed Owner Choices

Node.js, npm and TypeScript; separate backend/ deployment; login/password without external identity
services; server storage/synchronization while gameplay remains on the client. Uploaded development
progress is therefore not an anti-cheat or economic authority.

## Repository Evidence

- backend/ is empty and has no tracked runtime. The previous Express telemetry prototype was removed;
  docs/stats_and_balance_spec.md describes it as historical, not a reusable live backend.
- The client is native JavaScript ESM and Canvas. Root npm tooling is independently runnable.
  Installed tooling is Node 24.13.0 / npm 11.6.2; that is not a production patch recommendation.
- inventory_state_store.js defines schema 4 under player_inventory_v2; LocalStorageCache prefixes it
  with fishing_game_. Previous versions 3 and 2 have a live client migration path.
- InventorySnapshotFactory and InventoryItemSnapshotMapper define persisted facts. EquipmentState,
  AssemblyState and EquipmentLoadout own their facts; the snapshot remains transport.
- ChumService persists chum_active_<locationId> and chum_memory_<locationId> separately.
  deployRealTimeMs uses GameClock.realNow, an epoch-based timestamp. Preserve that meaning.
- Local storage is synchronous. Network I/O cannot be substituted into its get/set contract.
- UI drag positions and DEV section state are local presentation/diagnostic data, not cloud progress.

## Runtime and Compilation

**Decision**: Node 24 LTS with the latest supported patch at implementation, strict TypeScript compiled
to NodeNext ESM; npm lockfile plus npm ci.

**Rationale**: Node 24 is the current LTS choice on this date; Node 26 is still Current. A compiler
build is a verifiable gate. Native type stripping is not a replacement for type checking.
Strict indexed-access and optional-property checks are deliberate additions to strict.

**Alternatives**: Node 26 after LTS adoption and dependency validation. Running stripped TypeScript
without a compile gate is rejected. The browser is not migrated to TypeScript by server work.

Sources: [Node releases](https://nodejs.org/en/about/previous-releases),
[Node TypeScript execution](https://nodejs.org/docs/latest-v24.x/api/typescript.html),
[TypeScript strict](https://www.typescriptlang.org/tsconfig/strict),
[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## HTTP and Validation

**Decision**: Fastify 5, trusted JSON Schemas/Ajv, schema-derived HTTP types, injection protocol tests.

**Rationale**: Validation, serialization, lifecycle hooks and injection are available without forcing
domain/application to use framework classes. Disable unexpected body mutation/coercion where it would
conceal invalid input. Domain semantics and ownership remain separate checks.

**Alternatives**: Express with explicitly assembled validation/lifecycle is viable. NestJS adds
conventions and DI machinery not yet needed by these use cases. This is a scope judgment,
not a reliability ranking.

Sources: [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/),
[validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/),
[type providers](https://fastify.dev/docs/latest/Reference/Type-Providers/),
[testing](https://fastify.dev/docs/latest/Guides/Testing/),
[shutdown](https://fastify.dev/docs/latest/Reference/Server/#close).

## Persistence

**Decision**: PostgreSQL with pg behind repositories; explicit versioned SQL migrations.

**Rationale**: Unique identities, persisted sessions and atomic revision updates have real relational
requirements. Parameterized SQL keeps those operations explicit. A transaction uses one checked-out
client. Application ports hide driver rows/types.

**Alternatives**: Kysely or Prisma can be adopted for demonstrated needs without leaking their types
into domain. JSON files and process memory are not durable concurrent account storage.
A supported PostgreSQL major and exact npm versions are pinned during implementation.

Sources: [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html),
[pg queries](https://node-postgres.com/features/queries),
[pg transactions](https://node-postgres.com/features/transactions).

## Passwords and Sessions

**Decision**: Argon2id via argon2 and opaque server-side sessions persisted in PostgreSQL.

**Rationale**: Use a maintained password-hashing implementation and encoded hashes rather than own
crypto. Native binaries/build support must be verified on Windows and deployment Linux.
Token digests, expiration and revocation are server-owned; cookies carry the opaque token.

**Alternatives**: Async node:crypto scrypt with explicitly reviewed costs if Argon2 cannot be deployed.
JWT and Redis have no first-stage requirement. Recovery needs a later identity/recovery design.

Sources: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[node-argon2](https://github.com/ranisalt/node-argon2),
[OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Browser Session Topology and CSRF

**Decision**: Same-site client/API domains or same-origin proxy, host-only secure cookie, exact Origin
allowlist and a mandatory custom header for JSON mutations. Credentialed CORS allows only owned
origins; reject simple content types, missing headers and untrusted origins.

**Rationale**: The github.io demo and an unrelated API domain do not automatically support
SameSite=Lax cookie fetches. Do not rely on third-party-cookie exceptions. OWASP describes a custom
header approach for AJAX APIs; it relies on correctly restricted CORS. The header is not a secret
or authentication mechanism; the server session still authorizes access.

**Alternatives**: A synchronizer CSRF token if form endpoints or a different transport are introduced.
SameSite=None as an automatic workaround is rejected. Production domains are configuration,
not an invented purchased hostname.

Source: [OWASP CSRF API guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Synchronization

**Decision**: A versioned envelope, one current record per account, atomic expected-revision writes,
explicit first upload, account-bound local caches and a bounded asynchronous save queue.

**Rationale**: Two devices/tabs must not silently replace each other. Retry after uncertain
acknowledgement begins with a read; no stale precondition is automatically rebased.
Inventory and location chum remain separate snapshot sections. Only persistence metadata is new;
fishing formulas and timestamp semantics stay client-owned.

**Alternatives**: Last-write-wins loses data; per-frame writes disrupt gameplay; merging arbitrary
item graphs lacks a domain conflict policy. These are rejected for this stage.

## Resolution Status

No architecture-critical clarification remains for this design. Domain names, hardware and credentials
are supplied at deployment. Exact package versions, Argon2 binary support and tested resource limits
are implementation gates, not checks claimed to have already passed.
