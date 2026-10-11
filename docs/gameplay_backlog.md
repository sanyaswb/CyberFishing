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

## Owner play notes

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
