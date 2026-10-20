# Mobile inventory overlap and resize work

Owner report: equipment slots for net, hand groundbait, gas mask and boat overlap inventory items on mobile; the browser stalls when resizing with Inventory open. Investigation and corrective work: 2026-10-14. Existing uncommitted catalog/scale work is preserved.

## Layout finding

`InventoryUI` already mounts equipment under `inventory-main__left` and items under its sibling `inventory-main__right`. The problem is their mobile CSS sizing: the loadout shell inherited desktop `height:100%`, its panel remained a shrinking Flex child, and mobile Grid rows were auto tracks allowed to shrink despite overflowing equipment. The item panel also inherited the desktop full-height mix. This left the auxiliary equipment row able to extend outside its allocated region while the next region began above its visual bottom.

Mobile overrides now reserve separate `max-content` rows, size both shells independently with `height:auto`, and prevent the equipment panel from shrinking by using content-sized Grid rows. The item grid owns bounded scrolling; the entire mobile modal retains vertical scrolling. Inventory remains four equal columns and the rod keeps 9:16. Below320 uses the existing single surface scale.

The item panel's categories, filters, sorting and items have explicit row placement. Hiding a filter/sort control no longer moves the item grid into an auto row and leaves its allocated scrolling track empty.

Evidence: `utils/checks/ui/inventory-ui-check.js` checks mobile ownership/height contracts and real renderer DOM ancestry for all four auxiliary slots versus the item grid. The new mobile contract failed before the fix. Browser geometry/visual acceptance is pending; these checks do not claim to measure a real rendered rectangle.

## Resize findings and deterministic measurements

| Scenario | Before | After |
| --- | --- | --- |
| 100 resize events between game frames | 100 Canvas resize calls and 100 viewport/map refreshes | 0 during the burst; 1 at the next update before world/input; no extra draw loop |
| 100 calls with unchanged Canvas dimensions | 200 dimension assignments, each able to clear/reset its bitmap/context | 0 assignments; a changed width writes only width |
| 120 observer deliveries with unchanged UI metrics | 960 CSS-property writes | 0 writes, no extra metrics notifications |
| Observer + window resize burst | Coalesced measurements but repeated style writes | One queued measurement; changed fields only |

`GameApplication` now owns one pending-resize flag, consumed at the start of the ordinary update. It reads the latest Canvas viewport through the existing injected provider; game formulas, clocks, world coordinates and save format are unchanged. `CanvasMetricsProvider` avoids redundant bitmap resets. `UiSurfaceAdapter` observes only the frame for fixed viewport surfaces; flow previews still observe content for scroll footprint. It writes inherited dimensions/safe-area/scale only when readings change and writes flow footprint once when it changes, rather than setting/resetting it around a synchronous layout read.

The assertion that Inventory is fully rebuilt hundreds of times each second is **not established**. The actual normal path updates dynamic Inventory readings every250ms. `GameLoop` draws once per supplied animation frame and refuses a second active loop. Its existing deterministic120-frame check still verifies120 updates/120 draws, one continuation and stop/disposal. DOM/CSS/bitmap resize work was excessive independently of the Canvas draw frequency.

Reproductions failed before the corresponding fixes in `utils/checks/ui/ui-surface-check.js`, `utils/checks/platform/platform-runtime-check.js` and `utils/testing/runtime/game_application_test_composition.js`; they pass afterwards. Counts are deterministic test measurements, not browser profiler data or measured FPS. User-device frame time, browser hang severity and visual hit areas have not been measured here: the existing owner contract leaves browser/visual verification to the owner.

## Validation

Release closure: the implementation described by this audit is included in v0.35.0. Final integration across specs 057–062 passes Architecture 4/4, Quick 25/25 and Full 51/51; earlier counts below record the original corrective iteration. Owner visual/profile acceptance remains separate.

The follow-up owner request is now recorded in `DESIGN_RULES.md` sections10/13,
`DEVELOPMENT_RULES.md` and `docs/styles.md`: resize bursts are bounded, unchanged measurements
perform no layout writes, observers settle and owners dispose listeners/scheduled work.
Hover/press decoration now requires the single `ui-surface--desktop-hover` policy: UI and viewport
wider than1024px, landscape, fine hover-capable pointer, no coarse pointer and known zero touch
points. Mobile/tablet/portrait/touch/hybrid devices have no hover decoration or browser tap highlight.
Keyboard focus and actual selected states remain visible. Inventory hints dismiss on policy changes;
DEV mouse hover help uses the same gate. CSS guard rejects ungated hover/active selectors with18
negative fixtures. Focused checks include1024/1025px, touch laptops, portrait, capability changes,
listener disposal and120 unchanged hidden-surface measurements without CSS/class writes.

Focused Inventory, UI surface, platform, real GameApplication composition and catalog contracts pass. Final integration: Architecture4/4, Quick21/21, Full47/47 PASS; existing game-cycle baseline and inventory-save byte checks PASS without rebaseline. `git diff --check` passes. No version bump, commit or publication is part of this corrective iteration. Browser/profile/visual acceptance remains owner-owned.
