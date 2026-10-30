# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.27 - Module preload on Pages

- Spec 157 stage B: the Pages release writes `<link rel="preload" as="style">` for every stylesheet and `<link rel="modulepreload">` for every module of the page's graph into the root pages, so the browser requests them in parallel (request waves 24 → 4; cold start on Fast 4G 3.6 → 2.7 s, 3G 14.2 → 13.0 s locally). Game code unchanged. Game-cycle report unchanged.

## v0.49.26 - Static startup screen

- Spec 157 D0: a black startup screen with an inline SVG spinner paints straight from the HTML (game stylesheets now follow it in the body) and fades out at the first frame of play (data-game-ready); first paint on a cold Fast 4G start 2920 → 120 ms, 3G 12740 → 212 ms locally. Game-cycle report unchanged.

## v0.49.25 - Current keepnet stage only

- Spec 157 R5: the keepnet view loads only its current fill stage; all six stages warm up after the first frame, after the selector artwork (warm start on Fast 4G 828 → 537 ms locally; cold unchanged after R11). Game-cycle report unchanged.

## v0.49.24 - Startup without selector artwork

- Spec 157 R11: the game starts without waiting for the inventory selector's artwork (section sprite, backpack, first keepnet stage, rod thumbnail); the classic inventory and keepnet buttons stand in until it loads right after the first frame (cold start on Fast 4G 8.4 → 3.6 s, 3G 40.8 → 14.2 s locally). The startup measurer names the last stage and page errors when a start never becomes ready. Game-cycle report unchanged.

## v0.49.23 - Startup report as a file

- TK-168: DEV overlay «ЗАВАНТАЖЕННЯ» has «Завантажити JSON» next to «Копіювати звіт»: the same report saved as `cyber-fishing-startup-<version>-<date>_<time>.json`, with a saved/failed status line. Game-cycle report unchanged.

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
