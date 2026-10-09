# Implementation Plan: Accounts and Cloud Progress Foundation

**Branch**: `develop` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Feature directory**: `specs/029-backend-foundation/`

**Input**: The owner's Node.js/npm/TypeScript choice, login/password accounts, and cloud persistence
with gameplay remaining on the client. This is a design delivery; no backend implementation exists yet.

## Summary

Build one independently deployable TypeScript service under backend/. Use Fastify for HTTP,
PostgreSQL for accounts/sessions/progress, and small application ports for their implementations.
The browser remains native JavaScript. It keeps synchronous local persistence; a separate asynchronous
coordinator performs account-bound cloud synchronization outside the game loop.

Implement in three reviewable slices: server foundation, accounts and durable progress API, then browser
account/sync integration. The feature is complete only after the last slice and its acceptance checks.

Related release, legacy-save and DEV-isolation direction is recorded in
[follow-up-decisions.md](follow-up-decisions.md).

## Technical Context

**Language/Version**: Node.js 24 LTS, latest supported patched release at implementation; TypeScript
stable supported release; npm 11. Exact dependencies and runtime patch are pinned when installed.

**Primary Dependencies**: Fastify 5; compatible @fastify/cookie, @fastify/cors, and @fastify/rate-limit;
pg; argon2. Schema-derived HTTP types use the compatible
@fastify/type-provider-json-schema-to-ts integration. Development dependencies include TypeScript,
Node/pg types, tsx, and type-aware linting. No framework types enter domain or application.

**Storage**: PostgreSQL on a supported major version. Explicit SQL migrations and pg adapters;
parameterized queries and atomic revision comparison. No Redis or ORM is required for this scope.

**Testing**: node:test, node:assert/strict, Fastify injection, disposable PostgreSQL integration tests,
AST-based backend architecture checks, and browser integration smoke checks.

**Target Platform**: Windows development; separate Linux/Node server behind HTTPS. Production browser
and API use the same site through explicit domains or the same origin through a reverse proxy.

**Project Type**: One backend package plus the existing independently runnable browser client.

**Performance Goals**: No network I/O or snapshot serialization in frame update/render.
One bounded client save queue per active account; bounded request sizes and database/hash concurrency.
No throughput/SLA claim is made before measurement on the deployment hardware.

**Constraints**: Preserve current gameplay, formulas, local save semantics, and anonymous startup.
Strict compile checks and runtime validation are independent gates. Shutdown deadline is 10 seconds.

**Scale/Scope**: Initially one service process, multiple player accounts and sessions, one current cloud
progress record per account. Server-authoritative gameplay and competitive/economic features are excluded.

## Constitution Check

Pre-research and post-design review against constitution 1.1.0:

| Gate | Design result | Implementation evidence required |
| --- | --- | --- |
| Responsibilities and necessary complexity | Pass: per-use-case classes, small real ports, one service | Review constructors, ownership and dependency graph |
| Layer direction and composition | Pass: concrete adapters composed only in bootstrap | Backend AST guard; existing client guard unchanged |
| State ownership | Pass: account/session/progress rows; client gameplay owners retained | Account isolation, save CAS and account-switch tests |
| Behavior preservation | Pass: no gameplay or save redesign in this design | Existing suites, byte-identical game-cycle output, save round trip |
| Evidence and performance | Pass: repository facts inspected; no speculative load claims | Focused tests, real PostgreSQL/process tests, browser smoke |
| Owner-selected server stack | Pass: Node.js/npm/TypeScript with runtime validation | Strict tsc/lint, malformed input tests, reproducible npm build |

These are design findings, not claims that implementation acceptance has passed.

## Project Structure

### Documentation (this feature)

```text
specs/029-backend-foundation/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  follow-up-decisions.md
  contracts/
    http-api.md
    progress-format.md
    client-sync.md
  checklists/requirements.md
```

### Source Code (repository root)

Planned paths, not generated application files:

```text
backend/
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.test.json
  eslint.config.js
  .env.example
  .gitignore
  README.md
  migrations/
    001_accounts.sql
    002_sessions.sql
    003_player_progress.sql
  src/
    entrypoints/server.entry.ts
    bootstrap/
      server_composition_root.ts
      server_startup.ts
    domain/
      accounts/account.ts
      accounts/login_policy.ts
      progress/progress_revision.ts
    application/
      accounts/register_account.ts
      accounts/sign_in_account.ts
      accounts/resolve_session.ts
      accounts/sign_out_account.ts
      progress/read_player_progress.ts
      progress/write_player_progress.ts
      ports/
        account_repository.ts
        session_repository.ts
        progress_repository.ts
        password_hasher.ts
        session_token_codec.ts
        progress_validator.ts
        clock.ts
        id_factory.ts
    presentation/http/
      account_response.ts
      api_error_response.ts
      schemas/
    platform/
      config/server_config_parser.ts
      node/node_environment.ts
      node/node_shutdown_signals.ts
      http/fastify_http_server.ts
      http/routes/
      postgres/
        postgres_account_repository.ts
        postgres_session_repository.ts
        postgres_progress_repository.ts
        postgres_migration_runner.ts
      security/argon2_password_hasher.ts
      security/crypto_session_token_codec.ts
      validation/json_schema_progress_validator.ts
  tests/
    architecture/
    unit/
    http/
    postgres/
    process/
    fixtures/

src/game/application/accounts/
src/game/application/persistence/
src/platform/browser/accounts/
src/platform/browser/persistence/
src/game/presentation/accounts/
src/bootstrap/production/
```

The final client filenames follow its existing naming/ownership conventions. Add only concrete modules
required by the use cases; do not generate empty engine layers, catch-all services, or abstract base classes.
The existing root package is not converted to an npm workspace or given type:module merely for the server.
backend/ has its own dependency lock, scripts, build output and environment.

**Structure Decision**: Keep client and server independently installable/runnable. Runtime backend code
must not import ../src client code or assets. Shared protocol facts live in versioned schemas/fixtures;
they do not become a shared mutable GameState. The server does not copy fishing formulas.

## Dependency and Ownership Rules

- Domain: pure account/login and revision policies; no Node process, HTTP, database or hashing-library imports.
- Application: domain and application-owned ports; one use case per file.
- Presentation: pure response mapping and trusted route schemas; no persistence or lifecycle ownership.
- Platform: Node, Fastify, PostgreSQL, Argon2 and validation implementations. HTTP route adapters translate
  inputs, resolve the session and call application use cases.
- Bootstrap: create concrete adapters, inject configuration/clock/token/id collaborators, wire close hooks.
- Entrypoint: import its startup function; no composition, route or business logic.
- Tokens and account identifiers are authoritative server data. The client never chooses a save owner.
- PostgreSQL owns committed cloud snapshots and revisions; current gameplay stays owned by existing client
  domain/application objects. Local account caches are recoverable persistence copies, not another game engine.
- The client sync coordinator owns pending/in-flight synchronization and the last acknowledged revision.
  It does not mutate inventory/chum facts or let a response for an old session update the new account.

## Compile and Runtime Validation Policy

Use NodeNext ESM, explicit .js local import specifiers, strict, noUncheckedIndexedAccess,
exactOptionalPropertyTypes and noEmitOnError. Server tsconfig uses Node types without DOM libraries.
Use unknown at external boundaries; runtime narrowing/schema validation precedes use.
Type-aware linting rejects unsafe any flow and floating promises; justified exceptions are narrow.

Trusted JSON Schemas define HTTP DTO shapes and their inferred types. Configure Ajv to reject unexpected
properties instead of silently removing them; avoid implicit body coercion and added defaults.
Configuration parsing is explicit before readiness. Snapshot compatibility and references have a separate
validation step; structural validation does not prove legitimate gameplay.

## Accounts and Sessions

Use normalized ASCII logins of 3-32 letters, digits or underscore, case-insensitive uniqueness.
Passwords are 15-128 Unicode code points and at most 512 UTF-8 bytes, without trimming/normalization
or composition rules. These are initial engineering defaults, not restrictions on an eventual display name.

Argon2id is behind PasswordHasher; use explicit reviewed cost settings at least as strong as current
OWASP guidance, benchmark on deployment hardware, and limit concurrent hashes. Unknown-user login performs
a dummy verification so the outward failure path remains generic. No password/email recovery endpoint is
claimed in this login-only stage.

Generate opaque 32-byte random session tokens; only their SHA-256 digest is stored. Persist sessions in
PostgreSQL, with server-enforced expiration and revocation. Default absolute lifetime is 24 hours,
configurable within reviewed limits. A new successful login creates a new token; logout revokes it.

Production cookies are host-only, HttpOnly, Secure, SameSite=Lax, Path=/ with a __Host- name.
Local HTTP mode is an explicit development setting with a different cookie name.
JSON mutation requests require an exact trusted Origin and X-CyberFishing-Client: browser.
Credentialed CORS allows only explicitly configured origins; no wildcard/subdomain regex fallback.
This API-only CSRF approach is documented in research.md; form endpoints would require a new review.

Begin with bounded process-local rate limiting for the single-process deployment, including registration,
login by IP/normalized login, and progress writes. Multi-process deployment requires shared enforcement
before scaling. Explicit trusted-proxy configuration is required before forwarding IPs is trusted.

## Durable Progress and Conflicts

See contracts/progress-format.md and data-model.md. Inventory schema 4 remains distinct from cloud
formatVersion 1 and API v1. Older local formats use existing client conversion before upload.
Do not silently accept unknown versions, reinterpret old facts, or change freshness/chum timestamps.

Writes use a database compare-and-set on account ID plus expected revision. Revision 0 means absent;
first create is unique per account. No separate read-then-unconditional-write sequence is acceptable.
Only after commit is the new revision acknowledged. A stale write returns 412; the client retains its
pending snapshot and fetches current metadata before an explicit conflict resolution. No silent merge,
rebase, overwrite or blind retry of a stale precondition.

A pg transaction uses one checked-out client; rollback/release is mandatory on failure. Migrations run
as an explicit deployment step with a dedicated role, never automatically on every HTTP startup.
Normal startup verifies required schema/storage. Operational backup and restore are documented and
tested for the deployment; a JSONB row is not itself a backup strategy.

## Implementation Slices and Required Evidence

1. Server package, strict build/lint, explicit config, health/readiness and bounded shutdown.
   Verify independently from backend/, including startup failure and resource cleanup.
2. Accounts/sessions/progress, schemas and PostgreSQL migrations/adapters. Prove ownership,
   revocation/expiry, secret redaction, invalid body rejection, persistence after restart and atomic conflicts.
3. Browser account UI and account-bound local persistence/sync. Use existing snapshot sources,
   preserve anonymous behavior, explicit first upload, session generation checks and safe restart/restore.
   Never replace synchronous local cache methods with Promise-returning HTTP methods.

Build tests against the real supported PostgreSQL engine for unique registration, session durability,
failed writes and simultaneous save/create attempts. Fastify injection handles protocol cases; actual
process/socket tests prove readiness/shutdown. In-memory doubles are limited to unit isolation.
Architecture checks cover the backend explicitly because the current client guard scans src/, not backend/.

Run focused server/client checks, Architecture + Quick + Full and index/dev browser smoke when integration
is implemented. Record the actual game-cycle SHA256 and save compatibility evidence; do not update baselines
to conceal changes. Generating tasks is the next Spec Kit phase.

## Complexity Tracking

No constitution violations are proposed. Ports exist for actual substitution, host isolation, ownership
and tests. PostgreSQL transactions solve durability/concurrency; cookie sessions solve revocation;
a separate client queue preserves synchronous gameplay. There is no microservice split, generic repository,
event bus, Redis, or speculative abstraction in this initial design.

## Design Validation

On 2026-10-09, Spec Kit's prerequisite check found the specification, plan, research, data model,
contracts and quickstart in this feature directory. All nine Markdown artifacts passed checks for
balanced code fences and unresolved template placeholders; four local links resolved and three
JSON examples parsed. Extension hooks are absent. The actual Git checkout remains develop.

This verifies the design artifacts only. No backend build, database test or account/sync browser
test has run because those implementations do not exist yet.
