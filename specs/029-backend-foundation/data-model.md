# Data Model: Accounts, Sessions and Cloud Progress

This is the target model, not an implemented migration. Database migration version, HTTP API version,
cloud formatVersion and inventory schemaVersion are independent.

## Account

| Field | Type / constraint | Responsibility |
| --- | --- | --- |
| account_id | UUID primary key, server generated | Stable identity |
| login | Normalized ASCII string, unique, 3-32 characters | Lookup/uniqueness |
| password_hash | Encoded Argon2id hash, never exposed | Credential verification |
| created_at | Server timestamp with timezone | Creation metadata |

Unique login is a database constraint as well as a domain policy. Concurrent duplicate registration
fails without a partial account. Login is normalized to lowercase; passwords are not normalized.

## Session

| Field | Type / constraint | Responsibility |
| --- | --- | --- |
| token_digest | SHA-256 digest primary key | Lookup without storing bearer token |
| account_id | Foreign key to account | Authorization owner |
| created_at | Server timestamp | Lifetime start |
| expires_at | Server timestamp after created_at | Absolute expiry |

The raw random token is issued only as a cookie and is excluded from JSON responses/logs.
Expiration is checked on every protected operation. Logout removes/revokes the current session;
expired-row cleanup is maintenance, not the authorization check. Restarts preserve unexpired sessions.
A database outage never falls back to anonymous authorization for protected requests.

## Player Progress

| Field | Type / constraint | Responsibility |
| --- | --- | --- |
| account_id | Primary/foreign key | One current record for one account |
| revision | Positive integer, server generated | Optimistic concurrency |
| format_version | Supported cloud version, initially 1 | Envelope compatibility |
| client_game_version | Bounded descriptive string | Diagnostics, not authority |
| snapshot | Bounded validated JSONB | Inventory and location chum persistence |
| updated_at | Server timestamp | Acknowledged write metadata |

Revision 0 is an API precondition meaning no row exists; it is never a persisted valid revision.
First create is atomic and unique. Update checks account_id and revision in the write itself and
increments exactly once. JSONB can change key ordering; saved fact equality, not wire byte ordering,
is the round-trip requirement.

Client account IDs, revisions and acknowledged timestamps inside snapshots have no authority.
There is no server-controlled currency, experience or catch table in this stage: no such persisted
model was found in the current client and gameplay authority remains client-side.

## Snapshot Sections and Existing Owners

| Section | Existing source | Cloud role |
| --- | --- | --- |
| inventory | InventorySnapshotFactory / InventoryStateStore schema 4 | Canonical item/assembly/equipment/loadout/settings facts |
| locationChum | ChumService saved zones and memory per location | Existing saved facts with epoch timestamps |
| account/session/revision | New backend records | Storage authorization and concurrency |
| UI positions and DEV state | Local presentation/DEV storage | Excluded |
| In-flight fishing/boat simulation | Live gameplay owners | Excluded; restore only at safe lifecycle boundary |

Do not flatten these owners into one mutable object. A captured ProgressSnapshot is immutable
transport and exposes no gameplay mutation methods.

## Transitions

- Account: absent -> registered. Credential verification never modifies progress.
- Session: absent -> issued -> expired or revoked. Repeated logout does not recreate a session.
- Progress: absent -> revision 1; revision N -> N+1 only with a matching precondition.
- Failed/stale writes leave the current cloud row/revision unchanged.
- Unsupported versions are rejected without migration or deletion.
- Legacy local conversion stays in the client before upload.

## Validation and Versioning

HTTP schemas check DTO shape/limits. ProgressValidator checks canonical sections and structural
references independently of HTTP; it does not calculate fishing rules or certify item origins.

Limits are in contracts/progress-format.md and must be tested with game-generated fixtures.
Stored data is validated again before return/hydration. A corrupt row yields a controlled server
error and is preserved for investigation; it is not returned as an empty/new save.

Database migrations run explicitly with a version/checksum ledger and transactional execution where
supported. Startup checks compatibility. Data backups and a restore drill are required before real
player deployment. No automatic destructive downgrade is permitted.
