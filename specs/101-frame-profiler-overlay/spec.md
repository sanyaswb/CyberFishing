# Frame profiler and the performance overlay

Owner request, 2026-10-17: after spec 099/100 the game loads the phone (and a little the PC), and it is not clear
where. The DevTools overlay should show FPS, CPU and GPU load, and a bar that shows freezes. Status:
**implemented, committed and published with spec 100 on 2026-10-17; the owner's readings on the phone and the PC
(dev.html on Pages) are pending.**

## Decision

- **Port in the engine.** `src/engine/diagnostics/inactive_frame_probe.js` defines `FRAME_PROBE_METHODS`
  (`beginFrame`, `begin`, `end`, `gauge`, `endFrame`), the section ids (`update`, `draw`, `rod-spine`), the gauge id
  `gl-pixels`, and `InactiveFrameProbe`. The probe reaches production code the way every DEV port does: composed in
  bootstrap (`GameCompositionRoot` option `createFrameProbe`, else `InactiveFrameProbe`), injected and required. No
  constructor defaults.
- **Three reporting points, all in production code.**
  - `GameLoop`: the animation-frame timestamp, and `update` / `draw` around the two callbacks.
  - `GameRenderPipeline`: one section per pass (`world`, `casting`, `fishing`, `hud`, `outcome`).
  - `RodSpineRenderer`: `rod-spine` (the GL draw plus the copy into the 2D canvas) and the GL surface pixels.
  
  In production the probe does nothing: six empty calls per frame, plus two per pass and two for the Spine rod.
- **DEV `FrameProfiler`** (`src/dev/diagnostics/frame_profiler.js`): rings of 240 frames. It records the frame
  interval (what the player feels), the game-loop work (update + draw), every section and gauge, and long tasks
  (`PerformanceObserver`, Chromium). Intervals over 1 s are not counted, because a hidden tab pauses the loop. Jank
  is over 25 ms, a freeze over 50 ms.
- **Overlay module "⚡ ПРОДУКТИВНІСТЬ"** (`performance`, group "Performance", on by default) shows:
  - FPS;
  - frame interval mean / p95 / max;
  - game CPU per frame and its share of the 16.7 ms budget;
  - "поза CPU гри", the interval not spent in the loop (GPU, compositor, DOM, other page work);
  - jank and freeze counts;
  - the freeze bar: one bar per frame, with lines at 60 and 30 FPS;
  - section times;
  - long tasks;
  - canvas backing pixels and pixel ratio;
  - JS heap (Chromium);
  - Spine GL pixels.
  
  The overlay's own HTML rebuild runs every 150 ms outside the game frame. It is measured as the `overlay` section,
  so DEV cost is never read as game cost.
- **GPU.** A page cannot measure GPU time. WebGL timer queries are disabled in current browsers. The module says so
  and shows the proxies instead: a large "поза CPU гри" at small CPU, together with the pixel load.

## How to read it (cost sources that changed in specs 099/100)

| Suspect | Where it shows | Experiment |
| --- | --- | --- |
| Pixel ratio 2: 4× the pixels per frame (background, HUD, line) | `фон і світ`, `HUD`, "поза CPU гри" | DevTools `CONFIG.canvas.maxPixelRatio` 1 vs 2 (applies on the next resize or rotation) |
| `imageSmoothingQuality "high"` on the full-screen background every frame | `фон і світ` | same, plus compare the static rod (`Spine увімкнено` off) |
| Spine: the WebGL draw plus the copy into the 2D canvas every frame (a cross-context copy may stall the GPU) | `Spine вудка (GL + копія)`, "поза CPU гри" | DevTools "SPINE ВУДКА" → `Spine увімкнено` off |
| DEV only: overlay HTML rebuild, debug snapshots | `overlay (DEV, поза кадром)` | close the overlay or compare with `index.html` |

## Verification

`frame-profiler` check (Quick, Tools): inactive probe methods, statistics with a fake clock (fps, work, nested
sections, budget share, jank/freeze counts, hidden-tab gaps, ring wrap, gauges, long tasks, the overlay section), and
the module's rendering (empty state, freeze bar colours, backing store row). `platform-runtime`: the loop's probe calls
per frame and the required probe. Render frame composition: one section per pass and the required probe.
`config-runtime`: the overlay composes the performance module with the shared profiler. `spine-rod`: one section per
Spine frame. Architecture 4/4 (production 566 modules: only the inactive probe), Quick 31/31, Full 57/57, game-cycle
baseline unchanged.
