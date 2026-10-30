# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.22 - Startup measurement

- Spec 157 stage A: the game marks its startup stages (`startup:entry` … `startup:ready`, then `data-game-ready`); DEV overlay «ЗАВАНТАЖЕННЯ» (DevTools → OVERLAY MODULES → Performance → «Завантаження»): stages, T-paint/T-play, requests and bytes by kind, request waves, 10 largest/longest, «Копіювати звіт».
- Tools: `npm run measure:startup` measures a local copy of the Pages release in headless Chrome (HTTP/2, 4G, cold and warm, 5 runs) against the spec 157 budget. Game-cycle report unchanged.

## v0.49.21 - Foam-only boat wake

- Spec 156: the wake's water ripples are off by default (CONFIG.ui.boat.wake.water.enabled = false, owner: only the foam wake of spec 155 for now); the code and checks stay, DevTools turns them on live. Spec 157 text corrected after review (compressed byte budget, single rod art, vinyl-5 load condition).

## v0.49.20 - Visible boat wake ripples

- Spec 156 fix (owner: no visible change in v0.49.19): the wake's ripples now bend the water as far as its own waves (strength 1 = full amplitude), fade over each puff's life instead of the foam's transparency, and always cover at least 2.5 texels of the water map; defaults strength 1, radiusScale 2.5 (CONFIG.ui.boat.wake.water, live in DevTools). Incident I-8, rule R8.

## v0.49.19 - Boat wake ripples in the water

- Delivery / Scene: each wake puff also bends the painted water around it (an outward ring in the water's displacement map, only on water), so the water behind the boat ripples along with the foam; tuning in `CONFIG.ui.boat.wake.water` (spec 156). Game-cycle report unchanged.

## v0.49.18 - Boat targets on a scrolled map

- Delivery / Input: while bait boat targets are chosen, dragging pans the map (as bare scouting does) and a tap places a target, so targets can be set anywhere on the water regardless of where the boat is; hand chum aiming keeps its power drag (TK-166). Game-cycle report unchanged.

## v0.49.17 - Bait boat wake crash fix

- Delivery / Scene: launching the bait boat crashed the frame (`out.set is not a function` in BoatWakeEmitter.buildInto): ViewportProjector writes screen points with `out.set`, the wake passed a plain object; the wake check's projector now follows that contract (TK-163). Game-cycle report unchanged.

## v0.49.16 - Bait boat button without battery charge

- Delivery / HUD: a boat without a charged battery shows the inactive (red, empty) launch button like empty bunkers; with chum loaded a click opens the boat editor at its battery socket in red with the battery warning (TK-162). Game-cycle report unchanged.

## v0.49.15 - Bait boat return route fixes

- Delivery / AI: route points counted as reached within a share of the ground-plane cell, stretched ~3x vertically on far water, so side points beside an obstacle were skipped and the boat headed straight home into it; the reach is now 0.5 m (TK-161).
- Delivery / AI: the boat turns on the spot when its aim is behind it, routes keep at least a cell off land and obstacles where the water allows (distance field), and a boat in a fine-mask notch first returns to free water. Game-cycle report unchanged.

## v0.49.14 - Procedural bait boat wake

- Delivery / Scene: a running boat leaves a procedural foam wake — puffs along both Kelvin arms (19.5°) that spread, grow and fade, smaller on far water — drawn as pooled sprites of one generated foam texture under the boat (2D fallback: translucent dots); the Spine `boats-wave--1` slot is off (spec 155).
- Tuning lives in `CONFIG.ui.boat.wake` (DevTools → SPINE → «Кораблик»). Game-cycle report unchanged.

## v0.49.13 - Inertial bait boat motion test switch

- DEV / Delivery: `CONFIG.ui.boat.inertialMotion` (DevTools → SPINE → «Кораблик») switches the boat to the catalog's inertial preset — 3 m/s² thrust, a quarter of the turn rate at rest, softer drag and more side-slip; off keeps the agile motion unchanged (spec 154 C). Game-cycle report unchanged.
