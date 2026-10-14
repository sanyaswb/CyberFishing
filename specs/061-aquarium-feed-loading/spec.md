# Aquarium feed loading

Owner request: 2026-10-14. Supersedes the feed quantity-dialog/replacement contract in spec 055 and the below-meter aquarium counts in spec 060. Scope is the House aquarium section, its care budget and the production UI catalog. Other House navigation, sheets, installation and upgrade actions retain their current contracts.

## UI contract

- Level label and current/max-level count share a header row above the segmented scale; capacity label and count/max-capacity share another header row above the existing continuous occupancy meter.
- The status card replaces reserve text with a primary `Прикормити` button and the first available or chosen feed thumbnail/name on its right. During protection, show the loaded feed even if its inventory stack was exhausted.
- `Прикормити` expands available inventory rows. Each complete row is a semantic button; one row can be selected. Selection is a transient UI draft and consumes nothing. The main button becomes `Завантажити`; rows stay available to change the draft until confirmation. Escape cancels the draft/list.
- `Завантажити` consumes exactly one pack through the existing transactional service. Successful loading closes the list, clears the draft, shows the loaded feed and disables manual choice/loading until the half-time gate opens. The visible gate explanation receives focus after confirmation because the action button is disabled.
- Changing inventory, invalid saves or a newly locked cycle invalidates an unavailable draft. Failed loads retain a still-valid draft for retry. Background/handle sheet dismissal remains available while the inline feed list is open.
- House and `ui-catalog.html` reuse production markup, picker, buttons, meters and the injected domain time calculator. Catalog fixtures never write inventory/storage or run care timers. The percentage control demonstrates the exact half-time gate.
- Nominal initial fish size is 60px, retaining the configured size spread and boundary fit. The visual zone width is 0.80 of its bounds; its origin and height are unchanged.

## Feeding contract and assumptions

One UI confirmation loads one pack. The existing service quantity argument remains supported for prior consumers; it has the same lock and additive-time rules.

`feedReloadRemainingFraction = 0.5` is the configured threshold. After event-time settlement, manual loading and automatic-feed preference changes reject with `feed_locked` while remaining protection is greater than half the current cycle duration. Exactly half is eligible. Rejection does not consume inventory or change the preference; normal elapsed care can still be persisted.

At loading, copy the previous remaining protection into `carriedMs`. New cycle duration and remaining time become `carriedMs + newPackDuration`. The new pack becomes the active displayed quality/preferred feed. The gate restarts against this new total. Example: 15 minutes remain, a 60-minute pack is loaded, then protection is 75 minutes and the next load unlocks after 37.5 minutes.

New-pack duration preserves the current population penalty/minimum formula. Population changes recalculate the latest pack contribution while preserving both carried time and elapsed time. Carried protection is the fixed remainder captured at the previous load; it is never re-priced using the replacement pack's quality. Once protection expires, the latest loaded quality owns the existing starvation horizon. Loading clears only living fish's starvation deadlines and cannot revive fish.

Automatic care retains its existing configured refill trigger, capped by the load gate. It also adds the prior remainder when firing before exhaustion. Online, read-only and offline settlement must agree. Inventory remains the sole pack-stock owner and the existing write-ahead transaction coordinates consumption and activation.

## Explicit save migration decision

The feature snapshot advances from v4 to v5 on the same storage key. Active feed adds one nonnegative finite `carriedMs` smaller than its cycle duration. Existing v4 feed migrates with `carriedMs = 0`, preserving its duration, remaining time, quantity, seed and elapsed care. Earlier versions continue through their existing migrations before v5. Persist the migrated facts with the next care/command save; there is no protection refill at migration. Inventory stays v4. Corrupt, unknown or invalid snapshots are rejected without overwriting recoverable bytes.

## Evidence

`feed_loading_scenarios` first failed against the old behavior: a second fresh load succeeded instead of returning `feed_locked`. It now covers exact 50% eligibility, one-millisecond rejection, additive cross-quality time, restarted gate, second-page stale input, reload/offline parity, population changes, starvation rescue and v4 migration/invalid carry. Existing inventory tests retain multi-pack API/transaction recovery coverage. Picker tests cover single selection, deferred consumption, failed retry, changed stock, locking, Escape, focus, node identity and disposal/remount. House markup and catalog checks verify shared layout/component contracts.

Validation: focused checks, Architecture 4/4, Quick 25/25 and Full 51/51 pass; the fishing game-cycle baseline is unchanged. Console-only startup checks are clear on index, DEV, House, DEV House and UI catalog. Owner performs visual and browser-input acceptance personally.
