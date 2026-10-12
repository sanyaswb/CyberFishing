# Gameplay backlog

The single list of gameplay bugs, mechanics and balance work. Process: the "Gameplay changes" rules in
[DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md). Structural cleanup stays in
[refactoring_remaining.md](refactoring_remaining.md).

Priority: **P1** breaks a session or loses progress · **P2** wrong gameplay result · **P3** polish, feel, noise.
Status: open → in progress → done (commit) or rejected (reason).

## Entry template

```text
### G-NNN Title (P?, status)
Found: date, by whom, where (index/dev, version).
Reproduce: steps or deterministic scenario.
Expected: …
Actual: …
Notes: suspected owner module, related checks.
```

## Open

### G-008 Live bait and aquarium care are not implemented (P2, in progress)
Found: 2026-10-11, owner request, index/dev v0.32.1.
Reproduce: land a 0.100 kg `crucian_stalker`, open the catch outcome, then inspect Inventory and the house page.
Expected: a third action converts the exact catch into live bait; the keepnet or fed aquarium owns its survival timer, and one selected survivor can be cast once. See [spec 055](../specs/055-live-bait-aquarium/spec.md).
Actual: Claim/Release only return to scouting; no caught-fish storage, survival, house runtime, or live-bait cast path exists.
Notes: use a fake clock and seeded RNG to check eligibility, single disposition, death/feeding, reload, and one-hook consumption.

### G-001 Fish developer diagnostics in the production console (P3, open)
Found: 2026-10-10, Claude, reading the fight composition (v0.32.0).
Reproduce: `index.html`, fight a fish until it is exhausted in phase 2, or until it breaks out of the centre while
mastery is applied.
Expected: the production console stays empty during a fight (the rule from spec 020).
Actual: production composition injects `ConsoleLogger` as the fight logger
(`bootstrap/production/fishing_services_composition.js`, `fightLogger`). `Fish` logs `[DEBUFF] …` and `[MASTERY] …`
lines through it.
Notes: confirmed by reading the code; not yet reproduced in the browser. Likely fix: production composes no fight
logger (or an inactive one) and DEV composes the console logger.

### G-003 Item cards show raw values instead of the display map (P3, open)
Found: 2026-10-11, Claude, browser check of spec 050 (dev.html).
Reproduce: open the inventory and hover the day float.
Expected: "Огрузка: Легка", "Кріплення: Глухий" (the `displayStats` maps in the item catalog).
Actual: "Огрузка light", "Кріплення fixed".
Notes: `InventoryItemParametersResolver` first adds rows from the raw effective stats. The mapped `displayStats` row
with the same parameter id is then skipped as already rendered.

### G-007 Bait boat ignores the water metric (P2, open)
Found: 2026-10-11, owner request after spec 053; verified by reading the code (develop b2aa5b1e).
Reproduce: test location (30 m profile), send a bait boat to the far edge of the castable water.
Expected: the boat keeps its speed in metres everywhere, so far away it covers fewer map pixels per second, like the
tackle since 053.
Actual: `BaitBoat.update` integrates speed, braking, arrival radii, sensors and drift in map pixels; far away it is up
to ≈ 6.4× faster in metres.
Notes: task in [054](../specs/054-bait-boat-water-metric/spec.md) (ground plane scope around `boat.update`, like
`GroundPlaneScope`).

## Owner play notes

## Fixed in v0.33.1

### G-009 Retained catches lose rarity and live-bait art (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: retain a catch with numeric rarity 3/12, convert it and reload.
Expected: both catch and live bait show the same image and rating.
Actual: the save accepted strings only and discarded numeric rarity; live-bait views omitted art.
Fix/evidence: validated snapshot v2 and v1 migration; `keepnet_lifecycle_scenarios.js` failed on the missing rating before the fix and passes after it. Lost historical ratings remain unknown.

### G-010 Live-bait display and candidates disagree with elapsed care (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: advance a fake clock past life expiry before the 10-second care tick, or keep the same species in a fed aquarium and an unfed keepnet.
Expected: expired fish are unavailable; aquarium feed protects only aquarium residents.
Actual: selected bait remained an attraction candidate; keepnet countdown incorrectly reused aquarium protection; auto-feed projection was absent.
Fix/evidence: detached event-time read projection, exact hook expiry check and persisted elapsed care even when a command is rejected; deterministic clock checks pass.

### G-011 Hook return can overflow the keepnet (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: use a one-slot keepnet, cast its live fish, claim another catch, retrieve the bait.
Expected: capacity reserves the returning individual.
Actual: a hook freed its slot and retrieval could exceed capacity.
Fix/evidence: hook reservation and aquarium-cast capacity check; capacity regression passes.

### G-012 Automatic feeder ignores a nonzero configured trigger (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: configure 50% trigger and ten-second feed duration, advance six seconds with one spare portion.
Expected: refill at five seconds, then display 90%.
Actual: settlement only scheduled feed exhaustion, leaving 40% at six seconds.
Fix/evidence: schedule the configured threshold as a care event; online/read/offline projections agree at 90%.

### G-013 Reload strands a living bait on an interrupted hook (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: reload a fishing session after moving a selected fish to hook.
Expected: the surviving individual returns to the keepnet with remaining life.
Actual: new session has no cast ID but saved fish stays on hook and blocks selection.
Fix/evidence: fishing bootstrap explicitly recovers interrupted casts; house startup preserves active casts; reload checks verify life and identity, with no resurrection.

### G-014 Keepnet cannot inspect same-species catches clearly (P3, done)
Found: 2026-10-12, owner request.
Reproduce: retain several fish of one species with different weights and images.
Expected: one species thumbnail/count and a same-dialog list of individuals with weight and rarity.
Actual: flat text-only cards, no details and a full DOM rebuild every countdown tick.
Fix/evidence: species projection, card renderer and stable dialog refresh; `keepnet-check.js` covers navigation, exact IDs, images, ratings, actions, filters and focus.

### G-015 Full aquarium/keepnet outcomes lack a visible explanation (P2, done)
Found: 2026-10-12, spec 055 T051 and Keepnet review.
Reproduce: convert at victory with a full aquarium, or claim into a full keepnet.
Expected: show fallback destination or rejection and allow retry after freeing capacity.
Actual: fallback closed silently; rejected claims gave no feedback.
Fix/evidence: committed outcome metadata and injected presentation callback open Keepnet with the reason; victory retry/duplicate-input checks pass.

Add observations here in any form; Claude turns them into numbered entries.

## Done / verified

- Stage 6 defect: Fixed Catch with a spinner/wobbler/jig bite read the nonexistent `CONFIG.float.biteSequence`.
  Verified fixed 2026-10-10 by reading the code: `FixedCatchHook` takes the sequence from
  `BiteRules.selectBiteSequence` and creates no fish when there is none.
- Stage 6 defect: `DepthSelectorUI` requested an animation frame after `dispose()`. Verified fixed 2026-10-10 by
  reading the code: `DepthSelector` tracks pending frames, cancels them in `dispose()` and refuses new ones once
  disposed.
- G-002 Sliding float: done in [050](../specs/050-sliding-float/spec.md). A new catalog item; with it the selected
  depth costs no cast distance. Max depth stays line − rod, and the fixed float keeps line − depth.
- G-004 DEV item grant: done in [051](../specs/051-dev-item-grant/spec.md). DevTools → "🎁 ВИДАТИ ПРЕДМЕТ" adds any
  catalog item to the inventory, including the sliding float.
- G-005 Depth selection UX: done in [052](../specs/052-depth-selector-ux/spec.md). A float button with a slide-down
  depth track; while the track is open, a dashed cast limit line dims the unreachable water. The cast bar is removed.
  The owner checks the visuals.
- G-006 Perspective metres on the water: done in [053](../specs/053-water-metric/spec.md). One water metric per location
  (`MAP_DB.<id>.distanceProfile`, live in DevTools); casting, the fight and the tackle run in ground metres. The test
  location reaches 30 m at its far edge. Accuracy stays in map pixels (owner). Owner play check pending: hand chum reach (13.6 m).

### Shared aquarium feeding and safe fish stacks (2026-10-12, P2)

Reproduction: retain several species, add feed and let it expire; current care allocates separate species slots and uses keepnet lifetimes, while equal-death random order is unused. Keepnet groups special catches with ordinary catches. Expected: one shared three-quality pack bar, population penalties, saved independent starvation deadlines within 1/3/6 hours, and separate special-fish cards with rarity/weight stack representatives. Spec: specs/055-live-bait-aquarium/spec.md, T059–T065. Focused deterministic coverage is recorded in quickstart after validation.
