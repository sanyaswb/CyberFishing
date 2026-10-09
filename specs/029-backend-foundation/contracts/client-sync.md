# Client Account and Synchronization Contract

This is a required later implementation slice of this feature, not an existing client capability.
The independently deployable API alone does not complete in-game account/save functionality.

## Boundaries

- Application ports describe account access, remote progress, local persistence and snapshot capture.
- Browser adapters implement fetch with cookies, localStorage and scheduling.
- Presentation owns forms and sync/conflict messages; it does not own gameplay facts.
- Bootstrap injects the API URL and concrete adapters using existing production composition.

Anonymous startup and existing synchronous local get/set contracts remain valid. A separate
asynchronous coordinator owns synchronization; it cannot replace LocalStorageCache methods with
Promise-returning HTTP methods. No fetch, JSON serialization or repeated DOM lookup runs in frame
update/render. Do not migrate the client to TypeScript as part of adding the server.

## Capture and Queue

Capture immutable transport snapshots from existing inventory and chum owners. Observe persisted
mutations through explicit application/lifecycle hooks. The coordinator owns only pending/in-flight
work and the last acknowledged cloud revision, not a second mutable gameplay state.

Keep at most one in-flight request and one latest pending snapshot for the active account. Initial
debounce is one second, subject to meaningful browser checks. Replacing the pending queue entry
never mutates an acknowledged cloud snapshot. Expose local-only, pending, saving, acknowledged,
conflict and unavailable outcomes accurately. A localStorage error is not local success.

After a failed or uncertain request, retain local pending data. Fetch current cloud metadata before
deciding on a retry; never blindly adopt a new revision and overwrite. Acknowledged status requires
the actual committed server response.

## Account Isolation and Lifecycle

Local account copies use a separate namespace from existing guest keys. An account/session generation
identifies each coordinator lifecycle. Capture it with every asynchronous operation; stale responses
from a previous account cannot affect the current UI, revision or game state.

Switching A -> B -> A must preserve each account's pending data separately. Logout disposes/cancels
the active coordinator and retains unsaved data in the correct namespace. It never clears all local
storage. Expiration pauses protected synchronization and requests sign-in without losing progress.
Cancellation alone is insufficient: an already accepted server request can still finish.

The account-cache port reports explicit success/failure. The existing guest LocalStorageCache.set
catches write errors and returns no success result; its return value cannot prove that a pending
account snapshot was saved. Implement the account adapter in platform without changing guest semantics.

## First Import and Restore

1. Sign in and read the authenticated account's cloud progress.
2. If no cloud record exists, offer explicit guest import with expected revision 0; preserve guest data.
3. If cloud and local progress differ, require a visible restore/keep-local choice. Login itself
   does not automatically overwrite either copy.
4. A conflict preserves both the pending local snapshot and latest server record. Explicit resolution
   can restore cloud or deliberately replace it using the reviewed current revision.
5. Validate restored snapshots before hydration. Perform restoration at a safe lifecycle boundary,
   outside casting, combat or in-flight boats; dispose old state and compose the selected snapshot.

Network callbacks must not directly mutate live inventory/chum owners. Use existing bootstrap and
application paths. Legacy inventory conversion remains local. Unknown/corrupt data is retained with
a controlled error; it must not be interpreted as permission to start a fresh save.

## Required Browser Evidence

Verify real account forms and current game-generated inventory/chum round trips, anonymous behavior,
explicit first import, two-tab conflicts, backend outage, local write failure, expired session and
A -> B -> A with delayed requests. Verify disposal of handlers/schedulers and absence of frame-loop
serialization/network calls. Run both production index and DEV browser smoke.

Cookie/CORS checks require the actual same-site or same-origin production arrangement. The current
github.io page plus an unrelated API hostname is not assumed to pass that check.
