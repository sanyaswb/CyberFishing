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
