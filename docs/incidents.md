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
| R18 | A DEV edit of a value reaches every result derived from it at the start (limits, pools, caches), not only the object that holds it. The check edits through the same path and asserts the effect on the running system (the fight's limit), not the stored value. | I-17 |
| R19 | The window is only the camera: gameplay positions, bounds and shares come from the map (world units, `CONFIG.locations.baseResolution` for a reference screen), never from the canvas size, the camera or a screen-anchored point. A check runs the same scene at several window sizes and compares world values. This holds for scene effects too (rain, particles): their places are world points placed on screen each frame, and their amount follows the visible world area, not the screen. | I-18, I-19 |
| R20 | Every `data-devtools-path` / `devtoolsPath` emitted by an overlay or UI link must be validated by automated checks against the live `CONFIG` object or mounted `DevTools` control index so it resolves to an exact leaf control (never a missing path or ancestor section fallback). | I-20 |
| R21 | Layout overrides in container or media queries (phone, adaptive) come after every base rule of the same selector in the file; a base rule added later must go above them. A check parses the stylesheet and fails when a base rule of an overridden selector follows the query. | I-21 |
| R22 | Each switch of a manual control holds only its own process; never one shared freeze or a switch that sets another process. A check flips every switch in every order and asserts the others keep their course. | I-22 |
| R23 | A DevTools section that redraws its container while a child drill-in (`depth >= MAX_INLINE_SECTION_DEPTH`) may be open must wrap the rebuild in `DevToolsUI.preserveDrill`, and UI tests of nested modules must mount at the real production section depth (e.g. `СЦЕНА WebGL` -> `ПОГОДА`). | I-23 |
| R24 | A double of `DevToolsUI` that records what a section shows keeps its placement contract (`#insertTreeNode`: rows before nested sections and slots, whatever order they were made in) and asserts the order the user reads. A mark derived from session edits («· змінено», a reset button) follows `config-updated` in place, not only the next redraw. Found by looking at the live panel, which the fake hid. | I-24 |
| R28 | A DEV override lifts exactly the limit it is named for. A flag that removes a distance limit does not also remove the water test; when a flag joins a condition with `||`, check what else that condition guarded. When reproducing an owner's report, ask which DEV switches were on (God mode, its sub-flags default on). | I-28 |
| R27 | Movement on a masked area is tested at the point it ends on, not only per axis: a diagonal step can pass both axis tests and cross a corner of the mask. An entity that is already outside its area must still be able to come back. A check of such an area runs the real mask of a location (its stairs), not a rectangle. | I-27 |
| R26 | A DevTools control that shows a live state (an on/off switch of a process that also starts and ends by itself) follows that state while the panel is open, not only the redraw caused by another control: a cheap comparison on each live update, a redraw only on change. A check changes the state without touching a control and asserts the switch at once. | I-26 |
| R25 | A check that compares a filtered list with the list it came from keeps each item's own index (map to [value, index] before filtering); comparing by the filtered position mixes items up and can pass or fail by luck. | I-25 |
| R30 | A background write (a device's charge, a wear, a timer's state) touches only what reads it: an announcement builds no view model nobody reads, and a closed window renders nothing. A check counts the view-model builds of a background write. A guard that wraps actions in a transaction leaves out the ones that only change what is shown (a commit saves the whole inventory). | I-30 |
| R29 | A module that takes a narrowed port is checked with that port, built by the same function production uses — never with the whole object behind it. A new call in the module then fails its check when the port lacks it. One DevTools section that throws never empties the panel: each module draws in isolation and shows its error in its page. | I-29 |

<a id="i-25"></a>

## I-30 · 2026-11-23 · spec 143 … v0.52.46: every background inventory write rebuilt the whole inventory (TK-386)

- **Seen:** the review of spec 185 (owner: «зверни увагу на оптимізацію»), measured in Node on the real inventory
  composition (DEV start): one write of the gas mask's wear took ~7–8 ms on a PC, of it the save 0.05 ms; under
  radiation with the mask ~23 such writes a minute (the filter's time and the mask's wear every 5 s), plus the
  radiation's general wear and the radio's battery — a frame hitch every 1.5–2.5 s, several times longer on a phone.
- **Cause:** `InventoryFacade.notify` (`inventory_facade.js`) built the full inventory view model (every card's
  parameters) for every change and handed it to its listeners; `InventoryUI.#handleFacadeNotification` rendered it
  into the DOM even with the window closed. Background writers (`drainBattery`, `applyRadiationWear`, `wearItem`) go
  through that notify. Pre-existing since the battery (spec 143) and the wear (TK-370); spec 185 doubled the writers.
  Separately, TK-385's guard wrapped every inventory action under radiation in a transaction, whose commit saves the
  whole inventory — opening it or choosing a section wrote the save (the boat-on-water guard did the same).
- **Fix (v0.52.47, v0.52.48):** `notify` hands a payload whose view model is built only when a listener reads it
  (once); a closed inventory skips the render (it renders on open, as TK-213 already did at the start). The guards do
  not wrap view-only actions. A write now takes ~1.6 ms (the transaction's snapshot, the save's mapping and the
  equipment model), with no DOM work while closed.
- **Rule R30:** a background write touches only what reads it; view-only actions skip guarding transactions.
- **Check:** `player-inventory` (a background write builds no view model without a reader, one build with one;
  under radiation and with the boat on the water opening, sections, filters and back save nothing), `inventory-ui`
  (a notification to the closed inventory reads no view model and renders nothing) — fail on the old code.

## I-29 · 2026-11-21 · v0.52.37–0.52.39: after a bottle of vodka DevTools stayed empty (TK-378.1)

- **Seen:** the owner on a phone (dev.html, God mode on): after one bottle of vodka every DevTools page but «Гра» was
  empty, and «Гра» showed only «СТАТУСИ» with nothing in it; until the page was reloaded. Systematic, from v0.52.37 on.
  On the phone there was no console to show.
- **Cause:** TK-378 made `StatusEffectsModule.#describe` (`src/dev/tools/modules/status_effects_module.js:65`) read the
  level with `statuses.stacks(id)`. DevTools gets a narrowed DEV port built in `GameCompositionRoot.#playerStatusesPort`
  (list, definition, remainingSec, apply, remove, clear — no `stacks`), so with any active status (the vodka, a gas mask
  in its slot, the location's radiation) `mount` threw `TypeError: stacks is not a function`. `DevTools.#populatePanel`
  mounted the modules in one loop without isolation, so the throw stopped the redraw of every module after it. The check
  (`devtools-controls-check`) gave the module the whole `PlayerStatusEffects`, which has `stacks`, and passed.
- **Fix (v0.52.40):** one function builds the port (`createPlayerStatusesDevPort`,
  `src/game/application/world/player_statuses_dev_port.js`, with `stacks`) for the game and for the check; `DevTools`
  mounts each module in isolation — a throw goes to the console and shows as an alert in its page, the rest draws.
- **Rule R29:** check a module with the port production gives it, built by the same code; isolate DevTools sections.
- **Check:** `utils/checks/tooling/devtools-controls-check.js` (the module on the real port; the whole panel with an active
  vodka; a section that throws shows its alert while «Конфіг» still draws) — fails with the old port and the old panel.

## I-28 · 2026-11-17 · up to v0.52.4: in God mode a cast landed outside the castable mask (TK-362.2)

- **Seen:** the owner on a phone: a full-power cast released at the edge of the castable mask — the float appeared outside
  the green zone right after landing, not after drift.
- **Cause:** `CastPowerAim.resolveTarget` (`src/game/application/casting/cast_power_aim.js`) accepted a random sample of
  the accuracy circle with `cell || canCastAnywhere`, and the centre fallback did the same. `canCastAnywhere` is God mode
  `infiniteCasting`, on by default inside God mode since TK-268, whose purpose was only to lift the distance limit. So
  with God mode on, any point of the circle — land included — became the landing point. The legacy click cast in
  `ScoutingState` invented a depth-2 cell on land the same way. Node, real mask and water metric, power 1 near the stairs:
  without God mode 0 of 11 504 casts outside (landing and the first 30 frames); with it 4086 of 12 000.
- **Fix (v0.52.5):** the landing sample must be on the castable water in every mode; `canCastAnywhere` only sets the
  distance to the whole water. Same in the legacy click cast. The dead «land depth 2 m» fallback is removed.
- **Rule R28:** a DEV override lifts only what it is named for; read every `|| flag` for what else it bypasses. Ask which
  DEV switches were on when a report cannot be reproduced without them.
- **Check:** `utils/checks/gameplay/water-metric-check.js` (`checkCastLandsInCastableZone`, the God mode pass: full-power
  casts toward the masked stairs); fails on v0.52.4.

## I-27 · 2026-11-17 · up to v0.52.3: the tackle stood on land above a stair of the castable mask (TK-362.1)

- **Seen:** the owner on a phone (screenshot): after a successful cast into the top-left corner of the test map the float
  stood above a stair of the castable zone's mask, outside the green zone, and could not be reeled back. Earlier the same
  day (TK-362) the agent had checked only the landing point (20 000 casts, none outside) and answered that the tackle
  cannot get outside — a wasted round for the owner.
- **Cause:** `WaterEntity` (`src/game/domain/tackle/water_entity.js`: `_applyPhysics`, `applyHookedFightMovement`,
  `updateBite`) tested the water at `(nextX, y)` and `(x, nextY)`, never at `(nextX, nextY)`. Every stair of a mask has a
  corner of land pointing into the water; a diagonal step past it passed both tests and ended on land, and from there both
  tests failed for every step, so the tackle never moved again. Node, real mask, real `FloatEntity`: 2000 drifting floats
  near the stairs — 4 on land, 2 still there after 3 s of retrieval.
- **Fix (v0.52.4):** `WaterEntity._resolveWaterStep` — one step for the three movements: axes as before (sliding along a
  shore), a diagonal step past a corner keeps only its X move, and a tackle already off the water moves freely (retrieval
  brings it back). After: 0 of 2000.
- **Rule R27:** test the end point of a move on a masked area, keep a way back for an entity outside it, and check with a
  real location mask. When answering «can X get outside», follow the object through every system that moves it, not only
  the one that places it.
- **Check:** `utils/checks/gameplay/tackle-line-limit-check.js` (TK-362.1 block: the stair corner, 400 drifting floats,
  a fight move, a stranded tackle reeled back); fails on v0.52.3.

## I-26 · 2026-11-17 · up to v0.52.0: «after the starfall goes off the fog comes on» (TK-360)

- **Seen:** the owner in DevTools «ПОГОДА» → «Стан і керування»: switching «Зорепад (ніч)» off turned «Туман» on.
- **Cause:** no link in the game: `StarfallNight` and `WeatherModel` share nothing (reproduced in Node on the real
  `weather/test.js`). `WeatherDevSection.#renderControls` (`src/dev/tools/weather_dev_section.js`) drew each switch from the
  snapshot of the moment it redrew and never again (a «↻ Оновити» button stood for that). «Зорепад (ніч)» on jumps the game
  clock to 23:00 — the fog's ×3 hour window (19–24); at 23:00 a fog starts by itself within a minute in 53 of 200 seeded runs
  (22 of 200 at noon). The redraw caused by the starfall switch going off was the first to show it, so it looked caused by
  that switch. Any state that started or ended by itself between two redraws looked the same.
- **Fix (TK-360, v0.52.1):** `refreshLive()` — on each `debug-live-update` while the panel is open (`DevTools` calls it on
  every page module that has it) the section compares which switched elements are on (one integer, no allocation) with what
  it shows and redraws only when that changed. The section is now «Керування», a strength slider shows only while its
  element is on, «Болід зараз» is last and closes the panel on a phone.
- **Rule R26:** a control that shows a live state follows it while the panel is open; redraw on change only.
- **Check:** `utils/checks/gameplay/weather-check.js` (TK-360: every switch alone and in every pair over the real
  `WeatherModel`, `EmissionModel`, `StarfallNight` changes only its own element; a fog that starts by itself shows at once)
  and `utils/checks/tooling/devtools-controls-check.js` (TK-360: live updates reach the section while open; the bolide closes
  the panel on a coarse pointer). Both fail on v0.52.0.

## I-25 · 2026-11-16 · up to v0.51.54: the ash's «slow and smooth» check compared the wrong embers (TK-358)

- **Seen:** the TK-358 refactor of the ash renderer (one more random number per new ember) made `scene-layer` fail
  with «slow and smooth: under 6 px per frame (1211.55)» while the embers moved as before.
- **Cause:** `checkAsh` (`utils/checks/platform/scene-layer-check.js`) filtered the moved embers out of `after` and then
  compared the filtered list with `before` by the filtered position (`moved.map((…, index) => before[index])`): once an
  ember earlier in the pool had died, every later one was compared with its neighbour. It passed only while no ember
  before them died in that frame.
- **Fix (v0.51.55):** each moved ember keeps its pool index (`after.map((sample, index) => [...sample, index])`) and is
  compared with its own previous position.
- **Rule R25:** see the table.
- **Check:** `scene-layer` (the ash's steps measured per ember; passes on the refactored renderer, as the embers did
  not change).

<a id="i-24"></a>

## I-24 · 2026-11-16 · v0.51.16–0.51.23: WebGL buttons above «ПОГОДА», the «· змінено» mark only after a redraw (TK-333)

- **Seen:** the agent in the live panel (`dev.html`, owner allowed UI testing in this session): in «СЦЕНА WebGL» the
  switch «Сцена WebGL», «Втратити / Відновити WebGL-контекст» and «↻ Оновити» stood above «ПОГОДА» (spec 180 D4: at the
  very bottom); an edit in «ШТОРМ» updated «Збереження», but «ШТОРМ · змінено» and «↺ Скинути розділ до коду» appeared
  only after the section was redrawn (a selector press).
- **Cause:** `DevToolsUI.#insertTreeNode` (`src/dev/tools/dev_tools_ui.js`) puts a parent's rows (order 0) before its
  nested sections (order 1), so rows made after the weather section still went above it; the scene-layer check's fake
  only pushed labels in call order and passed. `WeatherDevSection.#elementSection` computed the mark once at render and
  `#onConfigUpdated` refreshed only the saving status.
- **Fix (v0.51.24):** the scene section puts its switch and buttons into `createSectionSlot` made after the weather;
  `DevToolsUI.setSectionLabel` changes a title in place and `createButtonRow` returns its row; the weather section keeps
  its element sections and on every `config-updated` refreshes their marks and shows / hides each reset row (no redraw,
  open groups stay open).
- **Rule R24:** see the table.
- **Check:** `scene-layer` (the fake places rows like `#insertTreeNode`; fails on v0.51.23: «the WebGL buttons come after
  every section») and `weather` (an edit marks «ШТОРМ · змінено» and shows its reset at once, a reset clears both;
  fails on v0.51.23).

<a id="i-20"></a>

## I-23 · 2026-11-16 · v0.51.16–0.51.20: clicking «Викид: пік зараз» left the «Викид» switch OFF until reopening the panel (TK-330)

- **Seen:** the owner in DevTools (`dev.html`): inside «ПОГОДА» → «Стан і керування», clicking «Викид: пік зараз» left the «Викид» switch OFF on screen; after closing the panel/section and opening it again, the switch was ON.
- **Cause:** with `СЦЕНА WebGL` (`depth 0`) → `ПОГОДА` (`depth 1`), every subsection inside `ПОГОДА` (`Стан і керування`, element sections, `Збереження`) sits at `depth 2 >= MAX_INLINE_SECTION_DEPTH` (`src/dev/tools/dev_tools_ui.js:17`). Clicking «Стан і керування» triggers `focusSection()`, moving its `content` out of `ПОГОДА` into `page > .devtools__drill` under `.devtools__page--drilled`. `WeatherDevSection.#fill()` (`src/dev/tools/weather_dev_section.js:210`) then called `replaceChildren()` on the hidden `ПОГОДА` container, leaving the stale old `content` visible in `.devtools__drill`. In addition, `EmissionModel.force()` (`src/game/domain/weather/emission_model.js:91`) did not clear `#intensityHold = 0` when starting an active phase.
- **Fix (v0.51.21):** added `DevToolsUI.preserveDrill(container, rebuild)` (`#leaveDrill()` before freeing/replacing bindings, then re-focusing the rebuilt drill section by `devtoolsPath`), wrapped `WeatherDevSection.#fill()` in it, and cleared `#intensityHold` in `EmissionModel.force` for non-idle phases.
- **Rule R23:** wrap dynamic parent-section redraws in `DevToolsUI.preserveDrill`, and test modules at real production section depth (`СЦЕНА WebGL` → `ПОГОДА`).
- **Check:** `utils/checks/tooling/devtools-controls-check.js` (TK-330) and `utils/checks/gameplay/weather-check.js` (zero-hold `force('peak')`); both fail on v0.51.20.

## I-22 · 2026-11-15 · v0.51.5–0.51.13: switching the storm off left the rain on for good (spec 180, TK-325)

- **Seen:** the owner in DevTools «ПОГОДА»: rain on and off worked; storm on and off left it raining and the rain never stopped.
- **Cause:** `src/dev/tools/weather_dev_section.js:478` — switching «Гроза» off called `#hold(model, "precipitation", "rain", …)`: it forced the precipitation into **rain** and kept the whole weather **frozen** (one shared `setFrozen`), so the rain stayed until «Дощ» was switched off by hand. Under it, `src/game/domain/weather/weather_model.js:217` made a storm a state of the same precipitation that «rains at least as hard as its strength», so a storm always meant rain. Reproduced on the real model and the `test` settings (spec 180 «Що є зараз»).
- **Fix:** rain, storm and fog became independent processes (`WeatherEventProcess`), each with its own manual hold; a storm raises the rain's chance and strength but never sets it; the section's switches hold their own process only.
- **Rule R22:** each switch of a manual control holds only its own process; never one shared freeze or a switch that sets another process.
- **Check:** `utils/checks/gameplay/weather-check.js` section 5 (the owner's sequence: storm off leaves no rain; every switch released in three orders leaves the others as they were) and the DevTools scenario (the storm switch calls `hold("storm", …)` only); both fail on the old model and section.

## I-21 · 2026-11-14 · v0.50.114–0.50.127: on a portrait phone the DevTools rail was a 60 px column (TK-313)

- **Seen:** the owner's phone screenshot: the bottom sheet showed the module rail as a short strip with one icon («Сервіс») and the next cut off, scrolling vertically, instead of a row of icons.
- **Cause:** the phone layouts (`@container ui-surface (orientation: portrait) and (max-width: 480px)`) were written in `src/dev/styles/dev-tools.css` above the base rules of spec 174 C2/C4 (`.devtools__rail { flex: 0 0 60px; flex-direction: column }`, `.devtools__crumbs`, `.devtools__body`). A container query adds no specificity, so the later base rules won: in the column `.devtools__main` the rail kept `flex-direction: column` and a 60 px basis, now a height. The landscape compact rail lost its 52 px width the same way. The checks run in a test DOM without a cascade, so none saw it.
- **Fix:** all phone and adaptive layout blocks moved to the end of the file; the portrait layout is now the whole screen (owner's request) with the rail as one row of icons.
- **Rule R21:** layout overrides in queries stay after every base rule of the same selector.
- **Check:** `utils/checks/tooling/devtools-controls-check.js` (TK-313 block) parses `dev-tools.css` and fails when a top-level rule of a selector that a phone query overrides comes after that query; it failed on the old stylesheet (`.devtools__rail` after the landscape query) and passes now.

## I-20 · 2026-11-13 · v0.50.107: overlay link «Ніч 0…1» highlighted root `.devtools__section-title` instead of `startHour` (TK-296.2)

- **Seen:** clicking `Ніч 0…1` in the `ПОГОДА Й ХВИЛІ` overlay opened DevTools and highlighted `.devtools__section-title` (`⚙️ НАЛАШТУВАННЯ (CONFIG)`) in green instead of revealing and highlighting the night start-hour parameter row.
- **Cause:** `WeatherOverlayModule` (`src/dev/overlay/modules/weather_overlay_module.js:78`) emitted `devtoolsPath: "CONFIG.timePhases.night.startHour"`, whereas `timePhases` actually lives under `CONFIG.spawns.timePhases.night.startHour` (`src/game/config/runtime/game_config.js:285-297`). Because the exact `data-devtools-path="CONFIG.timePhases.night.startHour"` element did not exist in the DevTools DOM, `DevToolsUI.#findPathTarget` (`src/dev/tools/dev_tools_ui.js:617-627`) stripped trailing segments until a matching ancestor prefix remained (`"CONFIG"`, a `.devtools__section`), and `DevToolsDependencyFeedback.showRevealed` (`src/dev/services/dev_tools_dependency_feedback.js:37-40`) highlighted `row.children[0]` (the `.devtools__section-title`). Meanwhile `weather-check.js` only compared `html.includes('data-devtools-path="CONFIG.timePhases.night.startHour"')` without resolving the string against `CONFIG`.
- **Fix:** corrected the path to `"CONFIG.spawns.timePhases.night.startHour"` in `src/dev/overlay/modules/weather_overlay_module.js` and `specs/177-overlay-devtools-links/spec.md`, and updated `utils/checks/gameplay/weather-check.js` to traverse every `data-devtools-path="CONFIG.…"` link against real `CONFIG`.
- **Rule R20:** never write hardcoded `CONFIG.*` or `DEVTOOLS` link paths checked only as literal strings. Automated checks must resolve every emitted `data-devtools-path` against the real `CONFIG` tree (and/or mounted DevTools index) and assert that it reaches a scalar leaf parameter, not a missing key or section container.
- **Check:** `utils/checks/gameplay/weather-check.js` (iterates every `data-devtools-path="CONFIG.…"` in rendered overlay HTML and asserts every segment exists in `GAME` / `CONFIG` and lands on a non-object leaf; failed before the fix, passes after).

### Verification algorithm for new or changed DevTools links

When adding or editing any `devtoolsPath` / `data-devtools-path` in overlay modules or tools:

1. **For `CONFIG.*` paths:** inspect `src/game/config/runtime/game_config.js` (or run a quick check against imported `CONFIG`) and verify every dot-separated segment from `CONFIG` down to the scalar leaf property (`number`, `boolean`, `string`). Remember intermediate wrapper objects like `CONFIG.spawns.*`, `CONFIG.canvas.*`, `CONFIG.physics.*`.
2. **For specialized DevTools section paths (e.g. `WEATHER.controls.*`):** inspect the corresponding `src/dev/tools/*_section.js` (for `data-devtools-path` / `recordPath`) and ensure the exact string matches the mounted control attribute, not just a conceptual name.
3. **Resolving check in automated tests:** in the module's check file, parse all `data-devtools-path="..."` strings from the rendered HTML and verify:
   - every `CONFIG.*` path traverses `CONFIG` without `undefined` and ends on a non-object leaf value (not an intermediate section object);
   - every non-`CONFIG` control path matches an explicitly declared path on the matching `DevSection` / `DevTools` check.
4. **Target specificity:** `DevToolsUI.#findPathTarget` prefers non-section leaf rows when `CONFIG.*` exists in both a specialized section and `CONFIG`, and falls back by prefix only if the full path is absent — so passing a test against real `CONFIG` + section paths guarantees no root `.devtools__section-title` fallback.

### What to do if clicking a link highlights `.devtools__section-title`

If a link opens DevTools and highlights a section header (`.devtools__section-title`) in green instead of a control row:

1. **Inspect the link's `data-devtools-path` attribute** in DevTools Element Inspector or in the overlay module source.
2. **Locate the deepest common prefix shown highlighted** (e.g. `CONFIG` means the very first segment after `CONFIG.` is wrong, or an intermediate key such as `spawns.` or `canvas.` was omitted; `CONFIG.canvas.water` means everything up to `water` exists, while the leaf key is wrong or renamed).
3. **Compare against real `CONFIG` / section paths:** check `src/game/config/runtime/game_config.js` (or `src/dev/tools/*_section.js`) for the exact nested path and rename `devtoolsPath` accordingly — **never** work around it by weakening `#findPathTarget` or pointing links at section headers.
4. **Harden the automated check first:** add a traversal assertion in the corresponding check script proving it fails on the broken path, apply the path fix, confirm the check passes, and record any new missed pattern here.

<a id="i-18"></a>

## I-19 · 2026-11-13 · v0.50.75–0.50.98: rain drops and rings stayed on the screen while the camera moved (TK-271.2)

- **Seen:** the owner noticed that the rain moved with the browser window: narrowing it squeezed all the drops into the
  narrow screen, and moving the rod (the camera) carried the drops and the rings on the water along with it.
- **Cause:** `PixiRainRenderer` kept each drop's landing point and each ring in screen coordinates
  (`#spawnDrop`, `#impact`) and drew them there every frame, so the location moved under them; the number of drops came
  from `maxDrops` alone, so any visible part of the rain area received all of them.
- **Fix:** landing points and rings are shares of the location's background (`world.backgroundLayers[0]`), placed on
  screen every frame; `maxDrops` is the rain over the whole rain area (zones, or the background below the water) and
  the screen shows its visible share; the rain updates before the water, so the ripples read this frame's rings.
- **Rule R19** (extended to scene effects). Check: `scene-layer` (a camera move carries every drop and ring by the same
  100 px; a window half as wide shows half the drops; fails with the old renderer on both).
<a id="i-19"></a>

## I-18 · 2026-11-09 · v0.50.53: narrowing the window pulled the fish, float and boat (G-126, spec 153)

- **Seen:** the owner noticed (2026-10-30) that narrowing the browser window during a fight or a boat trip pushed objects
  near the screen edge towards the centre: a player could pull the fish in by resizing the window.
- **Cause:** `GameWorld.getDynamicBounds()` took the physics X bounds from the visible screen while
  `CONFIG.locations.lockZoneXToScreen` was true, and `WaterEntity` clamps the float and the fish into them every frame;
  the rod stood at the screen centre, so its world X followed the canvas and the camera; the DEV side share divided by half
  the canvas width and, with no bounds passed, `RodVisualOffsetSystem.resolveScreenX` read `Number(null) = 0` as the
  playable edge and pinned the rod at the left padding.
- **Fix:** the bounds are the map's water; the rod has a world anchor (`GameViewportFacade`) that moves only with the
  player's pan, and every resize puts it back at its screen place; the camera follows the tackle along X near the edge
  with the rod kept in view (`ViewportProjector.followVirtualX`); the side share is map units over half the reference
  width; a missing playable edge is no limit.
- **Rule R19.** Check: `viewport` (three window sizes: map bounds, rod world X, side share; the camera follows the tackle
  and keeps the rod in view; fails with the old `GameWorld`).
<a id="i-17"></a>

## I-17 · 2026-11-08 · v0.50.43: stamina sliders of ACTIVE FISH did nothing in the fight (TK-254.1)

- **Seen:** the owner moved the stamina sliders of the hooked fish: the fish's stamina bar and its tiring did not change.
- **Cause:** `FishCondition` computes the fish's stamina and endurance limits once, when the fish is hooked
  (`fight_session_factory.js`); `FightService.syncFishRuntime` (the path of every DevTools / window edit) refreshed only
  `Fish` (force, behaviour), so baseStamina, staminaRatioFromEndurance, staminaBossMultiplier, weight and level never
  reached the limits. The window also showed only the stamina keys the species config happens to have (the crucian: one).
- **Fix:** v0.50.44: `FishCondition.updateLimits` (the current values keep their share), `FightService.refreshStaminaLimits`
  after a fish edit and an edit of `CONFIG.stamina.fish`; the window lists every stamina value the fight reads with its
  effective default, the live stamina / endurance / phase, and the stamina rules `CONFIG.stamina`.
- **Rule:** R18.
- **Check:** overlay-balance-windows (real `FishCondition` and `FightService`: an edit changes the fight's limits; every
  stamina row); fails on 0.50.43.

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
