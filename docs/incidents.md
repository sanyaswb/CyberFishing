# Incidents: resolved problems and the rules they taught

One entry per significant defect: what the owner saw, the real cause (with the place in the code), the fix, the rule
that keeps it from coming back, and the check that catches it. Read the entries of an area before changing it.
Newest first. Rendering incidents of 2026-10-17…21 are in [rendering.md](rendering.md#incidents) (blurred canvas,
`imageSmoothingQuality = "high"` on portrait phones, Pixi crop textures).

How to add an entry (rule in [AGENTS.md](../AGENTS.md) and [DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md)): when a
defect breaks the game, loses progress, wastes a test round of the owner, or took more than one attempt to find, add it
here in the same commit as the fix. Write the cause as a mechanism ("X assumes Y, but Z"), not as the symptom, and the
rule as something the next change can follow.

## Rules at a glance

| # | Rule | From |
| --- | --- | --- |
| R1 | A test double has the real contract: same method shapes, same out-parameters, same invalidation. Prefer the real class; fake only what needs a browser. | I-6, rendering.md TK-024 |
| R2 | Checks feed production-shaped data: catalog items as the composition projects them (`{ ...definition, effectiveStats }`), not hand-flattened configs. | I-5 |
| R3 | In the ground-plane scope (`BaitBoatGroundPlaneScope`, `GroundPlaneScope`) distances are anisotropic far away: never derive a lateral threshold from the scope's `cellSize` (a vertical scale); use fixed ground-plane values. | I-4 |
| R4 | Values that come from an asset (clip lengths, slot names) have one source in code and a check that compares it with the asset. | I-3 |
| R5 | Per-frame damping is per time: `Math.pow(k, dt * 60)` or `exp(-c * dt)`, never `v *= k` per update. Check 30/60/144 Hz alike. | I-2 |
| R6 | A moving agent plans on the map as it is (passability from the same water test as its physics, rebuilt on map revision) and watches its progress; reactive sensors only as a fallback. | I-1 |
| R7 | When proving a check against old code, keep the backup until `cmp` confirms the restore; never delete it in the same command. | I-7 |
| R8 | An effect added to an existing signal (a displacement map, a sound, a light) is sized against that signal and its grid: the check asserts its magnitude as a share of the signal's full range and that the smallest real input still reaches a cell. A check that only asserts "changed" passes an invisible effect. | I-8 |
| R9 | Page-level styles never set a background on `html`/`:root`: the body's background must keep moving to the canvas, below the WebGL scene at `z-index: -1`. A browser check of a page change looks at the pixels of the scene, not only at what an element hit test returns. | I-9 |
| R10 | Project text files are read and written as UTF-8 explicitly: Node (`fs` with `"utf8"`) or the editor tools, never Windows PowerShell 5.1 `Get-Content` / `Set-Content` without `-Encoding UTF8` (they read UTF-8 without a BOM as the ANSI code page). A bulk rewrite of a page or module is followed by the `text-encoding` check. | I-10 |
| R11 | Dynamic DOM reconciliation (`#patchChildren`) must never patch the outer container element with attributes of an ephemeral wrapper. Containers preserve their CSS classes, flex constraints and scroll contexts across update ticks. | I-11 |
| R12 | UI responsive and bounds checks must test layout geometry (`getBoundingClientRect()`, viewport boundaries, scroll overflow) after real update intervals, not just DOM node presence (`querySelector`) at mount time (T=0). | I-11 |
| R13 | Responsive layout testing must assert the worst-case payload (all sections active/expanded, maximum metrics) at minimum screen width (320px–400px). | I-11 |
| R14 | A check passes only by exit code 0 and a last stdout line that says it passed: Node exits with 0 when an awaited promise never settles, so the exit code alone cannot tell a finished check from a hung one. | I-13 |
| R15 | A view model that reads a port's state draws every combination of that state, not only the steady ones: listeners redraw synchronously from inside a command, between its steps. The check lists the combinations, and a double of a call that redraws in production redraws too. | I-14 |
| R16 | A pick mode (a consumable or slot pick that narrows the list) ends with the choice it was opened for. A command that fills the picked target leaves the pick explicitly; a check selects «Усе» after the choice and expects items outside the picked kind. | I-15 |
| R17 | A DEV tool that reads live game data asks for it itself (a port such as `isLiveDataRequested`); it never depends on another tool's switch (Overlay, console modules) being on. Changing a debug default is checked against every reader of the events that switch gates. | I-16 |

<a id="i-16"></a>

## I-16 · 2026-11-07 · DevTools lost ACTIVE FISH in the fight; Fixed Catch hasAnomaly did nothing (TK-252)

- **Seen:** the hooked fish's sections no longer appeared at the end of DevTools during a fight; Fixed Catch with
  hasAnomaly on gave an ordinary perch_radioactive (and a crucian only on its listed locations).
- **Cause:** DevTools build «ACTIVE FISH» from `debug-live-update`, but `DebugService.update` and `BrowserDebugAdapter.emit`
  sent it only while `CONFIG.debug.overlay` or a console module was on; v0.42.1 (G-075) turned the Overlay off by default,
  so DevTools never got the hooked fish. `FixedCatchFishFactory` took the anomaly from `FishAnomalyVariantResolver` (location
  list, enabled switch), and perch_radioactive had no `anomalyVariant` at all.
- **Fix:** v0.50.40: the open DevTools panel asks for the live update (`DevTools.isOpen` -> `isLiveDataRequested` in
  `BrowserDebugAdapter` and `DebugService`, only that event); Fixed Catch `forceAnomaly` uses the species' anomaly id on any
  location, a species without one warns once; the perch got the crucian's variant (owner).
- **Rule:** R17.
- **Check:** platform-runtime (live update with debug off), config-runtime (composition passes the port and the logger),
  fish-rarity (every species with unique art becomes anomalous under Fixed Catch; one warning for a species without an
  anomaly id); each fails on the old code.

<a id="i-15"></a>

## I-15 · 2026-11-07 · «Усе» listed only baits after a bait was chosen (spec 165 B5)

- **Seen:** the owner tapped an empty bait cell, chose a bait and then pressed «Усе»: the backpack still showed baits
  only.
- **Cause:** `InventoryCommandService.#pickConsumable` (the repeated tap with a candidate) and `#activateConsumable`
  called `InventoryUiState.pickForConsumable(kind)` after filling the cell, so `consumableKind` stayed set; with it
  `InventoryViewModelFactory.create` filters the list to the items that fit the tackle's bait cells in every category,
  «Усе» included.
- **Fix:** a filled bait cell ends the pick: `showChosenConsumableEditor` opens the bait's editor and selects «Усе»
  without subfilters (also as the editor's return context); a chosen live bait stack the same through
  `showChosenLiveBaitStack`.
- **Rule R16.** Check: `inventory-integration` (spec 165 stage 2: «Усе» after the choice lists a spare hook; «Назад»
  returns to the whole backpack).

<a id="i-14"></a>

## I-14 · 2026-11-06 · v0.50.14: «Замінити» crashed the inventory, then every frame (TK-233)

- **Seen:** the owner chose a live bait over a hook with a regular bait (green card) and pressed «Замінити»: the console
  showed `TypeError: Cannot read properties of null (reading 'fishId')` in `InventoryViewModelFactory.#liveBaitSlot`,
  then the same error from the game loop (`InventoryUI.updateDynamicProgression`) every frame and from the next «На
  живця». The bait was off the hook, the live bait not chosen, the card still green.
- **Cause:** `#liveBaitSlot` (spec 162 stage 2) assumed that a waiting live bait (`pendingFishId`) on an empty hook
  always has a chosen live bait (`preview()`), and built the cell's item from `preview.fishId`. But
  `LiveBaitHookController.confirm()` works in two steps: it removes the bait (`removeHookBait` →
  `PlayerInventory.dispatchInventoryAction` → `InventoryFacade.notify`, which rebuilds the view model at once), then
  chooses the live bait. Between the steps the state is "waiting, hook empty, nothing chosen", and the synchronous
  redraw read `null.fishId`. The exception left `confirm()` before it cleared `pendingFishId`, so the broken state
  stayed and every later view model (each frame, each click) threw again.
- **Why the checks passed:** `inventory-integration` set the hook port's fields to the steady states only (waiting over a
  bait; chosen on an empty hook; neither), not the transient one. The controller check's double of `removeHookBait`
  changed the equipment but did not redraw, so nothing read the state from inside `confirm()`: the double did not
  keep the real contract (R1).
- **Fix:** v0.50.15: every combination is drawn; waiting over an empty hook with nothing chosen is an empty green cell. The
  double of `removeHookBait` records what a redraw sees from inside `confirm()` (waiting, nothing chosen). «Залишити» on
  the waiting card is «Скасувати».
- **Rule:** R15 (and R1 for the double).
- **Check:** `inventory-integration` (waiting over an empty hook: green, empty, no throw; it fails on v0.50.14 with the
  owner's error), `live-bait` (the redraw inside `confirm()`).

## I-13 · 2026-11-05 · A hung check exited with code 0 and counted as passed (TK-215)

- **Seen:** while writing TK-214, `node utils/checks/tooling/asset-load-plan-check.js` printed nothing and exited with 0: its
  pass line was missing, and every assertion after the hang had not run.
- **Cause:** the runner (`CheckRunner` in `utils/run-checks.js`) assumed exit code 0 means the check finished, but a check's
  `(async () => { ... })()` is not awaited by anything: when its `await` waits on a promise nobody can settle, the event
  loop empties and Node exits with 0. The trigger was a new fixture of that check: its fake `preload` returned a pending
  promise for every path not starting with `low/`, while the plan's copies live under `assets/low-copies/`, so
  `await upgrading.start("first")` never returned. Full would have reported it as passed, with the rest of the check
  silently skipped. The same could happen to any async check, and a real regression (a load that stops settling) would
  look like a pass in exactly this way.
- **Fix:** v0.49.94: a check with exit code 0 fails unless the last line of its stdout says it passed (`reportsCompletion`);
  the two checks that ended differently now print a pass line; the fixture holds back only the one full file. All 83
  checks end with a pass line; no earlier hidden hang was found.
- **Rule:** R14.
- **Check:** `check-runner` (a never-settling fixture fails, exit codes are kept, stderr after the pass line does not hide it).

## I-12 · 2026-11-04 · The DEV overlay ignored its own zoom and swallowed metric clicks (TK-202)

- **Seen:** found while reviewing the overlay: a click on a metric never explained it, and dragging, screen limits and the
  saved position were off at any scale except 1. The owner had not reported it.
- **Cause:** `OverlayWindowDragController` assumed its CSS lengths equal what is seen, but CSS `zoom` on `.debug-overlay`
  multiplies the element's own `left`, `top` and `max-*` (at zoom 0.5 `left: 100px` lands at 50 px). And
  `setPointerCapture` in `#handlePointerDown` makes the browser send the release's `click` to the capturing window, so
  `OverlayMetricInfoBridge` never saw a click on a label once TK-191 allowed presses on labels.
- **Fix:** every length the controller writes is divided by the zoom; the saved position stays the position on the surface;
  capture starts with the drag, and the window object hears a release outside it before that.
- **Rule:** an element with `zoom` works in its own units, so convert what is measured before writing it back. Capture a
  pointer only once the gesture is yours: capture also moves `click`. Probe such browser facts on a plain page.
- **Check:** `ui-surface` (zoom in saved position, drag and limits; no capture before the drag).

## I-11 · 2026-11-02 · v0.49.63–66: Dev overlay pushed scale buttons off-screen and broke scrolling (TK-186)

- **Seen:** on mobile screen (400px portrait) and desktop when both «Завантаження» and «Продуктивність» were active:
  scale buttons `[ - ]` and `[ + ]` disappeared completely from the overlay, content grew beyond the screen height
  instead of scrolling inside the window, and scaling only shrunk the buttons' font without reducing the window width.
- **Cause:** in `src/dev/overlay/dom/overlay_dom_adapter.js`, `updateHtml()` called `this.#patchNode(this.#content, temp)`.
  The ephemeral `temp` wrapper was an unstyled `<div>`. On mount, `this.#content` had `class="debug-overlay__content"`.
  On the very first periodic update tick (150 ms later), `#patchNode` compared `this.#content` against the unstyled
  `temp` and stripped the `debug-overlay__content` class (`current.removeAttribute("class")`). Without this class, CSS
  rules `overflow-y: auto`, `min-height: 0` and flex shrinkage were lost; the element expanded to 1182 px, pushing the
  footer buttons down to y=1202 px (off-screen).
- **Why it slipped through:**
  1. Synthetic DOM checks checked at T=0 (mount time), before the 150 ms timer fired the first update tick.
  2. Test assertions checked `querySelector('.debug-overlay__scale-btn') !== null` (DOM element existence), which
     succeeds even when the element is rendered hundreds of pixels outside the visible viewport.
  3. Tests only checked single-module configurations rather than the worst-case payload (both heavy modules active).
  4. On Android phones, Chrome in Incognito mode / secure tabs enables `FLAG_SECURE`, causing hardware screenshot
     blanking (solid black images of 3542 bytes), which prevented visual feedback during mobile checks.
- **Fix (v0.49.67):** `OverlayDomAdapter.updateHtml` calls `this.#patchChildren(this.#content, temp)` instead of
  `#patchNode`, ensuring `this.#content` retains its classes, styles, and scrollable container invariants indefinitely.
- **Rules:** R11, R12, R13.
- **Check:** `npm run check` and Playwright headless check asserting footer scale button visibility (`rect.bottom <= viewportHeight`),
  content scroll height constraints (`scrollHeight > clientHeight` when content overflows), and retention of
  `debug-overlay__content` after multiple update ticks (> 300 ms).


## I-10 · 2026-10-31 · v0.48.45–0.49.35: the version badge's label was unreadable (TK-167)

- **Seen:** the `aria-label` of `#gameVersionBadge` in `index.html` and `dev.html` read «ÐŸÐ¾Ñ‚Ð¾Ñ‡Ð½Ð°…» instead of
  «Поточна версія гри» — what a screen reader announced for the badge; found while reading the pages for spec 157.
- **Cause:** commit 6363e51c (v0.48.45) rewrote both pages whole (every line changed, CRLF) while bumping the `?v=`
  links. The text went through a read that took the UTF-8 bytes as Windows-1252 characters (Windows PowerShell 5.1
  `Get-Content` without `-Encoding` reads a BOM-less UTF-8 file in the ANSI code page) and a write that encoded those
  characters as UTF-8 again, so every Cyrillic letter became two Latin-1 characters (Ð/Ñ plus a continuation). The pages'
  other text was ASCII, so nothing else showed it, and no check read the pages' text.
- **Fix:** v0.49.36 restores «Поточна версія гри» in both pages (Node, explicit UTF-8).
- **Rule:** R10.
- **Check:** `text-encoding` (Quick, Architecture): every shipped text file (pages, `src/**/*.{js,css,json}`,
  `assets/**/*.{svg,json,atlas}`) is valid UTF-8 without double-encoded Cyrillic; fails on the 6363e51c..v0.49.35 pages.

## I-9 · 2026-10-31 · v0.49.26–29: grey screen instead of the water after the startup screen (TK-171)

- **Seen:** owner's phone, Pages 0.49.29 (`dev.html?scene=webgl`): the game started (toolbar, clock), but where the
  water should be the page stayed plain grey.
- **Cause:** the inline style of the static startup screen (spec 157 D0, `index.html`/`dev.html`) set
  `html { background: #000; }`. CSS moves the body's background to the canvas (the whole viewport, under every layer)
  only while the root element has none; with a root background the body paints its `#1a1a1a` (`.game-shell`) on its
  own box, and that box is painted above negative z-index layers. The WebGL scene (`.game-shell__scene`, `position:
  fixed; z-index: -1`, `game-shell.css`) is exactly such a layer, so the body's grey covered it on every page.
- **Why it slipped through:** the D0 browser check (Playwright) asserted the screen's visibility before and after ready
  and that the centre of the screen hits the 2D game canvas — a hit test, which ignores painting order.
- **Fix:** v0.49.31 removes the root background (the startup screen is a full-viewport black layer of its own until ready).
- **Rule:** R9.
- **Check:** `startup-load-report` (the startup screen's inline style sets no `html`/`body`/`:root` background; fails on
  the 0.49.26–30 pages); a Playwright pixel check of the scene after ready on both pages and orientations: 0.49.30 —
  every water sample `26,26,26` (page grey), the fix — the same water colours as before D0 (c17bfe59).

## I-8 · 2026-10-30 · v0.49.19: the boat's water ripples were invisible (spec 156)

- **Seen:** owner's phone, Pages 0.49.19: no change in the water behind the boat.
- **Cause:** `WaterWaveField.addRipples` scaled each ripple by the foam puff's alpha (mostly 0.02–0.3) and its
  profile peaks at 0.42, so at strength 0.6 the crest moved the art 1–2 art px while the water's own waves move it
  20 px; the radius came from the puff's size (4–13 px on screen) while a map texel is ~7×8 px, so most puffs covered
  0–1 texels. The check asserted only the direction of the push on a 60 px puff at alpha 1.
- **Measured** (dev.html, a hook on the map): the ripple ran (~30 steps/s, up to 33 puffs) but changed the map by
  ~13 of 127 at the default settings.
- **Fix (v0.49.20):** crest normalised (strength 1 = the water's full amplitude), fade over the puff's life (`life` on the wake
  record) instead of its foam alpha, radius at least 2.5 texels; defaults strength 1, radiusScale 2.5 (6–16 art px over 16–59 texels for the real puff sizes).
- **Rule R8.** Check: `scene-layer` (crest ≥ 100/127 at strength 1, a 4 px puff at alpha 0.02 still bends the map,
  nothing at the end of life), `boat-wake` (records carry `life`).

## I-7 · 2026-10-30 · A restore after the old-code proof failed and its backup was already deleted

- **Seen:** while proving the spec 151 check against old code, `cp` back to `src/game/application/world/game_world.js`
  failed with "Permission denied" (a transient lock), and the same command then removed the backup folder.
- **Cause:** the proof loop restored and deleted in one command without checking the restore.
- **Fix:** the edits were reapplied and verified by checks.
- **Rule R7:** restore, `cmp` each file, delete the backup only when every file matched
  (`ok=1; ... cmp -s ... || ok=0; [ $ok = 1 ] && rm -rf backup`).

## I-6 · 2026-10-30 · v0.49.16: the game crashed right after launching the bait boat (TK-163)

- **Seen:** owner's phone, Pages 0.49.16: the game stopped after the boat started.
- **Cause:** `ViewportProjector.virtualToScreen(x, y, out)` writes with `out.set(x, y)` (it expects a `Vector2`);
  `BoatWakeEmitter.buildInto` passed a plain `{ x, y }`, so the first wake puff threw `out.set is not a function`
  in every frame. The `boat-wake` check used a projector double that assigned fields, so it could not fail.
- **Fix:** the emitter keeps a `Vector2`; the double writes with `out.set` like the real projector.
- **Rule R1.** Check: `boat-wake` (fails on the old emitter with the same error). Found by reproducing in the
  browser (`dev.html`, boat equipped through a prepared inventory save, console).

## I-5 · 2026-10-30 · Chum zones never affected bites and never expired in production (spec 152 B4)

- **Seen:** found while fixing zone lifetimes; production chum had no bite bonus.
- **Cause:** `ChumZone` read `radius`, `maxBonus`, `rampUpTimeMs`… from the chum config's top level, but
  `GameCompositionRoot.#composeChumConfig` projects catalog items as `{ ...definition, effectiveStats }` (the values
  live in `gameplayStats` / `effectiveStats`). Bonus `undefined`, expiry `NaN`. Every check fed a flat config.
- **Fix:** `ChumService` takes spot parameters from `effectiveStats`; checks use the projected shape.
- **Rule R2.** Check: `chum-spot` builds the chum exactly as the composition does (catalog + `EffectiveItemStatsResolver`).

## I-4 · 2026-10-30 · After a drop the boat went straight for home into an obstacle (TK-161)

- **Seen:** owner test v0.49.13: the route to the drop worked; on the way back the boat rammed the obstacle, waited
  and only then went around.
- **Cause:** a route point counted as reached within `0.75 × cellSize` of the ground plane, but
  `BaitBoatGroundPlaneScope` hands out a cell size scaled by the vertical metric only; on far water (farScale 0.3)
  it is ~3× larger than a map cell horizontally, so a point 75 px beside the boat was "reached" and skipped.
- **Fix:** a fixed reach of 25 ground-plane px (0.5 m); turn on the spot when the aim is behind; routes keep off land
  (distance field); a boat in a fine-mask notch starts at free water.
- **Rule R3.** Check: `bait-boat-navigation` (far side point not skipped; drops 1–2 px above the test obstacle come
  home without ramming).

## I-3 · 2026-10-30 · Bunkers 2–3 dropped before their doors had opened (TK-160)

- **Cause:** clip lengths were written twice as literals (`BaitBoat` and `BOAT_ANIMATION_DURATIONS`) and both said
  1.167 s, while the export's `boat3--open-section-2/3` last 1.583 s.
- **Fix:** one source (`BOAT_ANIMATION_DURATIONS`), the boat waits for it.
- **Rule R4.** Check: `bait-boat-spine-animation` compares every duration with `boat-lvl--3.json`.

## I-2 · 2026-10-30 · The boat was 28% slower at 144 Hz (G-127)

- **Cause:** `velocity *= 0.97` and side-slip `*= 0.05` per update: at 144 Hz the boat lost more speed per second
  (top speed 180 instead of 250 px/s).
- **Fix:** `Math.pow(k, dt × 60)` (identical at 60 Hz).
- **Rule R5.** Check: `bait-boat-navigation` (30/60/144 Hz trips alike).

## I-1 · 2026-10-30 · The bait boat got stuck, circled at walls and rammed land (G-127, spec 154)

- **Cause:** purely reactive steering: three rays checked only collision cells (land was invisible to them), avoidance
  turned 90° the same way regardless of the target, and it was off on the way back; no plan and no progress watch.
  A U-shaped obstacle was never left (46 evades), a land peninsula blocked the return until the battery died.
- **Fix:** `BoatRoutePlanner` (passability from the physics' water test, rebuilt on map revision; A* + string
  pulling), route following, progress watch with replanning and a safe give-up.
- **Rule R6.** Check: `bait-boat-navigation` (U trap, peninsula, long wall, unreachable lake, map edits).
