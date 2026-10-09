# Feature Specification: Accounts and Cloud Progress Foundation

**Feature Branch**: `develop` (existing checkout; no feature branch created)

**Created**: 2026-10-09

**Status**: Specification and design complete; implementation not started

**Input**: Begin a separately deployable CyberFishing backend. The owner selected Node.js,
npm libraries, and TypeScript because server reliability matters. Follow-up answers confirmed
accounts with login/password and server storage/synchronization of progress; gameplay rules
remain on the client for this first stage. Technology decisions are detailed in plan.md.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access an Individual Account (Priority: P1)

A player creates an account with a login and password, signs in on another device, checks the
current account, and signs out. Another player's progress is never accessible through that account.

**Why this priority**: Cloud progress needs a verified owner before any data can be stored.

**Independent Test**: Two accounts can sign in independently; invalid credentials and a signed-out
session cannot access protected progress. Credentials and session secrets never appear in responses.

**Acceptance Scenarios**:

1. **Given** an unused valid login, **When** a player registers and signs in, **Then** subsequent
   requests identify the same account across service restarts until the session expires or is revoked.
2. **Given** incorrect credentials, **When** sign-in is attempted, **Then** access is denied using a
   consistent response without revealing whether the account exists.
3. **Given** an authenticated session, **When** the player signs out, **Then** the old session can
   no longer read or change progress.
4. **Given** accounts A and B, **When** A supplies B's identity or manipulates a request, **Then**
   A cannot read or modify B's progress.

### User Story 2 - Save and Restore Progress without Silent Loss (Priority: P1)

A player stores existing development progress in their account and restores it on another device.
When two devices edit the same saved revision, a conflict preserves the latest acknowledged save.

**Why this priority**: Persistence is useful only if ownership, durability, and conflicts are reliable.

**Independent Test**: Two authenticated clients save and restore a current game-generated snapshot;
after a restart it is unchanged. Two concurrent writes based on one revision yield exactly one success.

**Acceptance Scenarios**:

1. **Given** no cloud progress for an account, **When** the player explicitly uploads compatible
   local progress, **Then** the server creates its first revision and acknowledges it only after storage.
2. **Given** an existing save, **When** another device restores it, **Then** inventory and the
   currently persisted location chum data retain their saved facts and timestamp semantics.
3. **Given** two writes based on the same revision, **When** both arrive, **Then** one succeeds;
   the other reports a conflict without overwriting the first.
4. **Given** failed connectivity or storage, **When** a save is attempted, **Then** it is not reported
   as acknowledged, the last acknowledged cloud revision remains recoverable, and local data is retained.
5. **Given** cloud progress already exists, **When** a device has different local progress, **Then**
   neither side is silently replaced. Initial import requires an explicit choice and cannot overwrite
   an existing cloud revision as a first-save operation.

### User Story 3 - Operate and Extend the Service Safely (Priority: P2)

A developer runs and validates the server independently of the browser game. An operator can
distinguish a running process from a service ready to store progress and can stop it predictably.

**Why this priority**: Clear operational behavior is part of the foundation for later game services.

**Independent Test**: Start from the backend directory, verify service availability, introduce invalid
configuration or unavailable storage, and exercise bounded startup and shutdown behavior.

**Acceptance Scenarios**:

1. **Given** valid configuration and storage, **When** the service starts independently, **Then**
   it becomes available without browser assets or frontend development tooling.
2. **Given** invalid configuration or unavailable required storage, **When** startup is attempted,
   **Then** it reports the failure and does not announce readiness.
3. **Given** a running service, **When** shutdown is requested, **Then** accepted work is handled
   within a documented deadline and resources close; subsequent writes cannot be acknowledged.
4. **Given** an anonymous player, **When** the backend is unavailable, **Then** existing local
   development gameplay and local saves remain available.

### Edge Cases

- Concurrent registration of the same normalized login; incorrect, expired, and revoked sessions.
- Oversized or malformed input, unexpected fields, unsupported save versions, and broken references.
- Lost acknowledgement after a committed save; stale writes and concurrent first-save creation.
- A database interruption during a write, process restart, or shutdown during an accepted request.
- A client on an incompatible version; old local saves still requiring existing client migration.
- A switch between accounts with different local caches; unsynchronized data belonging to the old account.
- A browser deployment whose client and server domains do not support the selected session transport.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Players MUST be able to register, sign in with login/password, inspect their current
  account, and sign out. External identity providers and email delivery are outside this first stage.
- **FR-002**: Account uniqueness MUST be enforced under concurrent registration; credentials MUST
  be stored as password hashes, never plaintext. Login attempts MUST have bounded abuse controls.
- **FR-003**: Sessions MUST expire and be revocable. Protected operations MUST derive account
  ownership from the authenticated session, not a client-supplied account identifier.
- **FR-004**: Authentication, authorization, and mutation-origin checks MUST occur before changes
  to account progress. Responses and logs MUST exclude passwords and session secrets.
- **FR-005**: External input and stored progress MUST be checked for supported structure, version,
  size, and structural consistency before use. Invalid input MUST leave stored progress unchanged.
- **FR-006**: Each account MUST own one current progress record with a server-assigned revision.
  Writes MUST atomically compare the expected revision and reject stale or competing writes.
- **FR-007**: Acknowledged accounts, sessions, and progress MUST survive normal process restarts.
  A save acknowledgement MUST represent a successful durable write, not a pending queue.
- **FR-008**: The first progress format MUST cover the existing inventory snapshot and persisted
  per-location chum zones/memory. UI positions, DEV configuration, and in-flight combat are excluded.
- **FR-009**: This stage MUST treat uploaded progress as client-produced development data. Stored
  progress MUST NOT be represented as server-verified gameplay, economy, or competitive results.
- **FR-010**: Local progress MUST remain recoverable during upload failures and incompatible-version
  errors. Old save migration behavior MUST remain intact; no automatic reset or format redesign.
- **FR-011**: Network synchronization MUST operate outside frame update/render loops. Existing
  synchronous local persistence MUST NOT be replaced by asynchronous network calls.
- **FR-012**: Account switching and cloud restoration MUST take place at a safe game lifecycle
  boundary. A response for an old account/session MUST NOT modify a newly active account.
- **FR-013**: The service MUST run independently, validate configuration before readiness, expose
  running/ready status, report bounded failures, and perform bounded resource shutdown.
- **FR-014**: Server rules and use cases MUST be isolated from HTTP, database, password-library,
  process, and browser implementations. Each mutable fact MUST have a named authoritative owner.
- **FR-015**: Authentication, account isolation, save compatibility, restart durability, and concurrent
  writes MUST have meaningful automated acceptance coverage before the implementation is accepted.

### Key Entities *(include if feature involves data)*

- **Account**: An identity with a unique normalized login and protected credential record.
- **Session**: A revocable, expiring authorization grant associated with one account.
- **Progress Record**: One account's acknowledged snapshot, format version, and server revision.
- **Progress Snapshot**: Existing inventory facts plus persisted location chum facts; no gameplay
  session or presentation state is owned by this transport record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All account access tests pass, including two-account isolation and denial after logout.
- **SC-002**: Compatible game-generated progress restores with equal saved facts after a restart;
  every tested unsupported or invalid format leaves the previous save unchanged.
- **SC-003**: For two competing writes from one revision, exactly one is acknowledged and the
  winning data is recoverable; no tested stale write silently replaces it.
- **SC-004**: Every tested write failure is reported without claiming success or deleting local data.
- **SC-005**: Independent startup and shutdown scenarios succeed on the supported development
  and deployment platforms; shutdown completes or explicitly fails within 10 seconds.
- **SC-006**: Anonymous gameplay regression output remains unchanged; synchronization introduces
  zero network operations into frame update/render execution.

## Assumptions

- Login/password and client-owned gameplay are explicit owner decisions recorded on 2026-10-09.
- The first service is a single deployable process backed by persistent storage; scaling to multiple
  processes requires reviewed shared abuse controls and connection/session capacity.
- The separately hosted server is placed behind HTTPS for real account use. The domain topology
  must support browser sessions; an unrelated third-party-cookie dependency is not assumed.
- Initial local-to-cloud import is explicit. Future ranked gameplay, trading, server simulation,
  email recovery, and account deletion are separate bounded features.
- Browser account UI and synchronization are a later implementation slice of this same design,
  after backend contracts are proven. They are required before claiming in-game cloud progress works.
- This delivery is specification and design only. Acceptance scenarios describe required future
  behavior, not checks claimed to have passed against a server implementation.
