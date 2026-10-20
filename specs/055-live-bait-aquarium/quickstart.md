# Quickstart Validation: Live Bait and Aquarium

This guide records implementation checks for the local live-bait feature and the owner's revised five-level house.

## Starting evidence (2026-10-11, before code changes)

- `node utils/checks/gameplay/game-cycle-check.js`: passed; victory peak line stress 1.3%, line-break peak 262.5%, and the existing report matched its baseline.
- `node utils/checks/inventory/inventory-save-round-trip-check.js`: passed; 15 items, 3 assemblies, 1 loadout, with schema 3/2 byte-identical after upgrade.
- Preserved the owner's untracked `fisherman-house.html`, `src/entrypoints/house.entry.js`, and `src/game/presentation/house/{house_presenter.js,house_labels.js}`. The page's current image references were unresolved and the entry's startup import did not exist.

## Prerequisites

1. Keep the supplied room art under `assets/house/room-1/`; see [local-save-and-assets.md](contracts/local-save-and-assets.md).
2. Use a clean browser test profile; retain existing `player_inventory_v2` bytes for compatibility comparison.
3. Use deterministic fish/care clock and RNG fixtures in focused checks; do not create a production dependency on DEV fixed-catch code.

## Checks

```powershell
node utils/checks/gameplay/live-bait-check.js
node utils/checks/gameplay/house-check.js
npm run check:architecture
npm run check:quick
npm run check
npm run dev
```

Record the game-cycle output before this gameplay change and rebaseline only deliberate differences with the established repository command, documenting why. Old non-live-bait cases must remain identical. Run page/release checks after registering house entry and assets.

## Implementation evidence (2026-10-11)

- `node utils/checks/gameplay/live-bait-check.js`: passed eligibility, exactly-once outcomes, individual hook identity, local save conflicts and corruption, clock-driven death, feed priority, all 10 capacities, automatic feeder, third victory action, and source `swim` at configured 50% speed.
- `npm run check:architecture`, `npm run check:quick`, and `npm run check`: passed; the full suite reported 40 checks. `git diff --check` passed.
- `node utils/checks/gameplay/game-cycle-check.js`: unchanged baseline. `node utils/checks/inventory/inventory-save-round-trip-check.js`: unchanged inventory bytes (15 items, 3 assemblies, 1 loadout; schema 3/2 byte-identical).
- Browser smoke on `dev.html`, `index.html`, and `fisherman-house.html`: both game pages loaded; Keepnet and Inventory opened separately and switched without overlapping; the DevTools house button navigated; two room buttons worked; the transparent aquarium aligned with the table; aquarium installation, one-step upgrade, free feed acquisition, feeder installation, and reload persistence worked. A DEV-only startup crash exposed a missing `ConfigProvider.liveBait` getter and was fixed before this record.
- `utils/checks/tooling/pages-release-check.js` passed for the last committed release. Its new house-page path can only be exercised by this check after this work is committed; the working-tree house page and both supplied PNGs were verified in the browser.
- Manual catch-to-victory and live-bait cast feel remain for the owner's play check before release. The deterministic acceptance paths are covered by `utils/checks/gameplay/live-bait-check.js`.

## House revision evidence (2026-10-12)

- `node utils/checks/gameplay/house-check.js`: passed shared persisted game time, live time-scale edits, the exact location blend curve, all fifteen level/phase backgrounds, both transparent overlays, room upgrade durations, reload continuity, automatic elapsed completion, free finish, maximum level and corrupt-save recovery.
- `npm run check`: passed 41 checks, including unchanged game-cycle and inventory round-trip checks. Architecture and CSS checks passed.
- Browser smoke: `index.html` and `dev.html` loaded with the shared time display and the DEV house button; the house loaded all three light layers for level 1. The bottom sheet opened, renovation showed a countdown over the undimmed supplied art, reload preserved the timer, free finish selected level 2 art, aquarium installation worked, and the header appeared on downward scroll and hid on upward scroll.
- The immutable Pages release checker still tests committed HEAD; its updated room-asset assertions will run against the new house only after these uncommitted files are committed. Working-tree art presence is checked by `utils/checks/gameplay/house-check.js`.

## Manual browser scenarios

1. On `dev.html`, land a 100 g `crucian_stalker` and a 101 g fish. The third action appears only for the first. Claim, Release, and Use as live bait each resolve once. Ordinary-bait fishing remains playable on `index.html`.
2. Open Inventory and Keepnet with adjacent buttons. Keepnet has left visual/parameters and right fish/filters. Live countdown advances, feed controls are absent, and switching dialogs leaves focus coherent.
3. Use the DEV house button. `fisherman-house.html` has no missing module/CSS requests; the current room fills the viewport, the three time layers use the shared game clock, and the aquarium stays on a separate layer above the table. Room navigation is ready for future rooms.
4. Install aquarium, add fish, acquire feed, exercise different slot percentages/counts, and check priority. Step levels 1–10 and verify capacities 5/6/7/8/16/18/20/22/24/48.
5. Enable feeder with finite stock, leave, advance fake time, and reopen. Stock falls only for fills; fed fish survive, unfed fish die in saved order, and reload does not kill or reroll again.
6. Select surviving bait and cast with one compatible free hook. Verify source `swim` movement only at configured half speed, attraction, one-time loss or safe return, and expired bait rejection.
7. Present corrupt/unknown-version snapshot and verify visible recoverable error with original bytes intact. Compare inventory v4 bytes before/after unrelated house actions.
8. Check immutable release output includes house HTML, dependencies, and all seventeen room art files; navigate from packaged page without 404.

The owner should play-check motion and feeding feel before release, as `DEVELOPMENT_RULES.md` requires.

## Implementation audit (2026-10-12)

- `tasks.md` has 45 tasks marked complete and 7 open after convergence. The remaining work is T039–T040 and T048–T052. T040 is partially done: `CHANGELOG.md`, the project version (`0.33.0`), and the spec-029 cloud-contract note are present; the owner's movement/care play check is still pending.
- Current working-tree checks passed: `node utils/checks/gameplay/live-bait-check.js`, `node utils/checks/gameplay/house-check.js`, `npm run check:architecture`, `npm run check:quick`, `npm run check` (42 checks), and `git diff --check`. The Full suite's Pages check exercises committed `0.32.1-b974601`; it has not validated the uncommitted house page and art in a `0.33.0` release.
- The house page currently contains one `data-house-room` viewport. Navigation controls are hidden when fewer than two rooms exist, so T048 and the multi-room part of FR-014 remain open.
- `deathOrder` is sampled and saved but is not read by care settlement. A persisted random tie order for simultaneous starvation deaths remains open (T050).
- A full aquarium falls back to the keepnet as specified, but the successful victory action closes without showing that reason (T051).
- Prior browser smoke is recorded above. This audit did not repeat the full catch-to-cast, ordinary-bait, offline-care, or packaged-release browser scenarios in T039/T052. T049's repeated deterministic acceptance runs are also outstanding.

## Keepnet follow-up (2026-10-12, v0.33.1)

This supersedes the preceding audit for T049/T051 and Keepnet behavior. 53 tasks are complete and five remain open: T039, T040, T048, T050, T052.

- Added species cards and count badges, same-dialog individual details, exact caught artwork/weight/rarity, existing fish actions with release confirmation, keyboard navigation and stable timer refresh. UI grouping never creates a second writable fish collection.
- Reproduced rarity loss with a failing assertion before the fix. Snapshot v2 captures the numeric rating, validates v1 migration, retains unknown old rarity as null, and protects corrupt bytes. Live bait now includes its exact image and rating in the read model.
- Regression checks cover expired candidates between care ticks, mixed aquarium/keepnet fish of one species, read-only auto-feed projection, nonzero feeder threshold, elapsed care on rejected commands, hook capacity reservations, and recovery of surviving interrupted casts without reviving expired fish.
- `utils/checks/gameplay/live-bait-check.js` includes 100 eligible/ineligible outcomes and exactly-once hook loss/reload cycles; a 24-hour absence produces the same full read model before and after reload. `utils/checks/inventory/keepnet-check.js` exercises production Keepnet composition with a DOM test double, including distinct individual images/ratings, missing images, filters, countdown focus/scroll retention, command actions, release confirmation, expiry, Back/Escape/Tab and victory failure/fallback notifications.
- Architecture and Quick passed; Full passed 43 checks. The unchanged game-cycle baseline and existing inventory save checks pass. Full's release check before commit tested the prior committed release; publication must use the new commit.
- Browser visual checks were not run at the owner's explicit request. Owner acceptance: open `dev.html`, retain two fish of one species with different weights/ratings, verify card count and thumbnails, inspect details, use filters/Back, select a live bait and test the mobile layout.
- Remaining care gap: `deathOrder` is persisted but simultaneous starvation deaths still have no per-episode random tie ordering (T050). This update preserves the existing lifetime/death balance; it does not claim that requirement complete. Multi-room work (T048) and owner visual/feel acceptance remain separate.

## Shared aquarium feed revision (2026-10-12, v0.34.0)

- T059–T065 implemented. T050 is superseded by independent episode deadlines within quality windows.
- All eleven packs, population penalties, shared protection, independent deadlines, reload/view identity, feeding rescue, re-depletion, finite feeder stock, corrupt/legacy migration, safe stacks and visual bounds pass deterministic checks in shared_feed_scenarios.js, plus existing keepnet/hook checks.
- Architecture passed; Quick passed 17; Full passed 43. Existing game-cycle baseline and inventory-save checks pass without rebaselining. Full's Pages test covers the prior committed release, not this uncommitted v0.34.0.
- Browser smoke on isolated localhost port 4187: index/dev startup without warnings/errors; house displays all eleven choices; three fish + Premium 500 g show 54 minutes; reload retains feed; depleted Premium shows the six-hour starvation window and next individual deadline; Good 500 g refeeding rescues all three and shows 32 minutes. DEV edits fish size and opens an embedded house with the green bounded grid and moving skins. Keepnet shows a two-fish rarest representative stack plus separate anomalous/unique cards and exact-ID details. The card clipping found in smoke was corrected.
- 12 thumbnail derivatives at max 128 px generated; original files retained. Config: CONFIG.liveBait.visual (size, spread, speed, direction intervals, normalized zone, grid).
- Legacy migration converts old portions to Simple 500 g and per-species protection to the smallest occupied fraction. Unknown prior special status stays separate. Owner movement/care feel acceptance and unrelated open tasks remain as listed in tasks.md.

## Inventory feed revision (2026-10-12, v0.34.1)

- All eleven packs are inventory catalog items in the grouped DEV free shop. Repeated grants stack; Groundbait includes the For aquarium checkbox filter. Touch dragging uses native browser panning and momentum while desktop mouse dragging remains supported.
- Inventory v4 owns stock. Feature v4 persists active quantity and removes stock; legacy stock migrates once. Deterministic checks cover exact quantity consumption, rejected quantities, unrelated inventory preservation, stale writes, corrupt journals and roll-forward recovery after an interrupted write.
- The aquarium list renders only positive stock, one pack feeds immediately, and larger stock opens a centered bounded slider with step buttons, confirmation and cancellation. DOM checks cover changing stock, focus restoration and Escape.
- Architecture passed 2/2; Quick passed 17/17; Full passed 43/43. Existing game-cycle and inventory compatibility checks remain green. The immutable release check runs against the committed v0.34.1 before publication.
- Limited local browser checks completed before the owner's stop instruction: grouped shop, stacked grants, filter, available-only list, immediate feeding, slider/cancellation and exact depletion. A 390×844 desktop viewport checked dialog placement; this was not physical-phone touch validation. Further browser checks are performed by the owner; no further agent browser testing is required for this pack.
