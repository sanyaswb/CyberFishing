# Feature Specification: Perspective metres on the water (water metric)

**Created**: 2026-10-11 · **Status**: Steps 1–4 of 6 implemented · **Kind**: gameplay mechanic, staged (backlog G-006)

## Owner request (2026-10-11)
Distances are flat today: 1 m is always 50 px, so the castable water of the test location (520..1160 virtual px,
640 px) is 12.8 m from shore to top. The water is painted in perspective. Each location gets its own distance
profile, for example `maxMeters: 30` at the top edge of the castable water and 0 m at the shore line (its bottom
edge):
- the lower half keeps the usual scale;
- higher up, every pixel stands for more metres, with a smooth transition;
- far away a fish covers fewer pixels at the same speed, both sideways and away from the shore;
- tackle limits stay in metres, so not every rig reaches the far edge.

## Decisions (owner delegated them to Claude)
- **Curve.** Up to `linearShare` of the water height the base scale (`pixelsPerMeter`) holds. Above it, metres per
  pixel grow linearly with height. This gives a quadratic distance curve, joined without a kink, that reaches
  `maxMeters` at the top edge. A profile whose `maxMeters` is below the uniform distance is rejected: it would
  decelerate instead of compressing.
  - Why not a pinhole curve: the owner wants the lower water uniform and an exact designer-set top distance. A pinhole
    curve has neither and needs a horizon solve.
- **Lateral scale** = the square root of the depth-axis compression, so no second parameter is needed. A pinhole
  camera compresses depth with the square of distance and lateral size linearly.
- **One `WaterMetric` per location** for every gameplay distance. Converting only the cast would leave the fight
  measuring a different world: a cast to 30 m, but a fish 12.8 m away in line physics.
- **Ground coordinates** are metres: X sideways from the vertical centre line of the map, Y away from the shore. The
  metric converts between ground and virtual pixels without allocations (hot loop).
- **Uniform default.** A location without `maxMeters` has a uniform metric whose conversions reproduce the current
  `pixelsPerMeter` arithmetic exactly (bitwise equal distances).
- **Base pixels.** Gameplay code keeps measuring water distances in base pixels (ground metres × `pixelsPerMeter`,
  the unit it used before). The metric converts base pixels to virtual positions (`topBasePixels`, `yAtBasePixels`,
  `distanceBasePixels`, `lateralVirtualPixels`); on a uniform metric they return the old expressions exactly.

## Steps
1. **`WaterMetric` (this step):** domain class and the `water-metric` check. No consumer yet; behavior unchanged.
2. **Casting:** compose the metric per location. Cast limit, power cast target (power × metres → height), `CastRules`,
   the depth limit line, recast and the line paid out at the cast go through it. Uniform metric → game-cycle
   unchanged.
3. **The fight on the ground plane:** the whole fight step (line distance and constraint, radial split, fish forces
   and velocities, retrieve, rod pull and lateral control, pole sector, landing distances) runs in ground base pixels
   through `FightGroundPlane`. Uniform → unchanged.
4. **Rod and landing on the map:** the net zone check in the playing state, the empty-tackle landing in the waiting
   state, the fight area render frames (pole sector, line radius, landing and net zones) and the DEV fight
   diagnostics convert plane distances to the map. Uniform → unchanged.
5. **Water entities:** float and lure drift, retrieve and sinking in the waiting state, and the current drift the
   tackle adds during the fight (still virtual pixels). Uniform → unchanged.
6. **Enable** `distanceProfile: { maxMeters: 30, linearShare: 0.5 }` on the test location (gameplay change). The
   owner tunes it in play.

Steps 2–5 are structural (unchanged game-cycle report). Step 6 is the gameplay change.

## Step 2: casting
- `LocationWaterMetricResolver` (domain) builds the metric of the current location from the castable bounds (shore =
  bottom edge, top = top edge, centre line between the side edges) and `MAP_DB[id].distanceProfile`; it rebuilds only
  when those inputs change. `GameWorld.getWaterMetric()` is the single source; production composes the resolver with
  the casting `pixelsPerMeter`. The session port `getWaterMetric` reaches the states, `CastService`,
  `ChumController` and `CastingRenderFrameBuilder`.
- Through the metric: `CastRules.canCastAt` (takes the metric instead of bounds), `CastPowerAim` (cast limit, target
  height, distance check, accuracy spread), `CastService` (cast distance ratio), the hand chum limit, the aiming zone,
  the depth limit line and the power aim line. The depth limit intent no longer carries `virtualBottomY`.
- The game-cycle check composes a uniform metric over its own water (0..800) through the same resolver.
- Open for step 6: the accuracy spread now converts with the lateral scale, and the projector's sprite perspective
  scale still applies on top of it. With a profile the far spread therefore shrinks twice; the owner tunes it in play
  (accuracy percent or the sprite factor).

## Step 3: the fight on the ground plane
- Instead of converting each of the many pixel/metre sites in the fight stages, the fight step itself runs on the
  ground plane of the metric: X = centerX + sideways metres × pixelsPerMeter, Y = shoreY − metres × pixelsPerMeter.
  Every existing `pixelsPerMeter` conversion inside the step then means ground metres. `WaterMetric` gained
  `toBasePlane`/`fromBasePlane` and the exact velocity derivative (`velocityToBasePlane`/`velocityFromBasePlane`).
- `FightGroundPlane` (owned by `FishingForceService`, the only entry into the step) hands the step a tackle facade,
  plane bounds (bounding box of the virtual water), a plane water lookup and plane rod positions. The facade owns the
  plane position and velocity during the step, because stages mutate them in place; the tackle's virtual vectors
  are written back around its movement and after the step (`try/finally`).
- The tackle moves with the virtual velocity that brings it, over its own clamped step
  (`WaterEntity.getStepSeconds`), exactly to the plane point position + velocity × step. A first-order velocity
  conversion drifted by about 4·10⁻⁵ m per frame for a fast fish on the curve.
- A uniform metric hands the step the original objects (no facade), so the uniform fight is the same code path.
- The playing state passes `world.getWaterMetric()` in the fight context (`MutableFightFrameContext.waterMetric`).

## Step 3 evidence
- Silent game-cycle check `runGroundPlaneFightCheck` (the reported list is unchanged):
  - a profile equal to the uniform scale (16 m over 800 px) takes the plane path and follows the direct fight for
    300 frames (line within 1e-6 m, position within 1e-4 px);
  - on a 40 m profile a fish cast to 25 m fights, in ground metres, exactly as on a flat lake 40 m tall
    (1e-5 m per frame over 300 frames), and the line length equals the metric's ground distance on every frame.
- Mutation evidence: an unconverted tackle velocity, a missing write-back after the step and missing plane bounds
  each fail the check.
- `water-metric`: the plane maps invert, the velocity derivative matches finite differences, uniform maps are
  `Object.is` identities.
- Game-cycle report unchanged (SHA256 `7b9baea3…d5b6`); 40/40 checks; production 480 modules.

## Step 4: rod and landing on the map
- `Net.getTriggerVirtualY(waterMetric)` / `isFloatInZone(y, waterMetric)`: the net reach (base pixels) is placed with
  `yAtBasePixels`; the playing state passes the fight context's metric.
- The waiting state's empty-tackle landing measures `waterMetric.distanceMeters` to the rod.
- `FightAreaRenderFrameBuilder` draws the pole sector, its axis and the line radius from plane geometry (the fight
  frame is plane data; the preview converts the float and rod first) and maps each point with `fromBasePlane`.
- `LandingAreaRenderFrameBuilder` places the last-dash band, the net band and the catch ellipse height through the
  metric.
- Not converted: `FightService.getDiagnostics` (DEV values over the screen height of the water) and the
  `pixelsPerMeter` mismatch that predates the metric (casting reads it once at startup, the fight reads it live).

## Step 4 evidence
- 40/40 checks; game-cycle report unchanged (SHA256 `7b9baea3…d5b6`).

## Configuration (owner request 2026-10-11)
The owner tunes the curve in config: where the compression starts and how strong it is.
- `MAP_DB.<location>.distanceProfile = { enabled, linearShare, maxMeters }`, shown and edited live in DevTools under
  "БАЗА ЛОКАЦІЙ (MAP_DB)". `linearShare` is the share of the castable height from the shore with the base scale
  (0.5 = 50 %). `maxMeters` is the strength: the distance from the shore to the top edge of the castable zone.
- The test location carries `{ enabled: false, linearShare: 0.5, maxMeters: 30 }`. Enabling it before step 6 bends
  only casting; the fight still measures the uniform scale.
- A live edit applies on the next frame (MAP_DB edits reload the location config; the resolver compares values).
  An edit that makes the profile invalid is rejected: the previous metric stays and the error is logged once.
  At startup an invalid profile fails fast.
- `ConfigSchemaValidator` checks the ranges (`enabled` boolean, 0 ≤ `linearShare` < 1, `maxMeters` > 0) and the
  shared labels `MAP_DB.distanceProfile.*` in `parameter_labels.json`.

## Step 2 evidence
- `water-metric` check: uniform base-pixel methods equal the old expressions (`Object.is`) over 500 random points;
  on the 30 m profile they follow the curve (top edge 1500 base px); the resolver reuses its metric until the bounds or
  the profile change.
- Game-cycle report unchanged (SHA256 `7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`); 40/40 checks.

## Step 1 evidence
- `water-metric` check:
  - the uniform metric equals `hypot(dx, dy) / pixelsPerMeter` and `(shoreY − y) / pixelsPerMeter` bitwise over 500
    random points;
  - the 30 m profile gives 3.2 m at 160 px, 6.4 m at the join, 30 m at the top, and no kink at the join;
  - metres grow monotonically and pixels per metre never grow with distance; `yAtMeters` inverts `metersFromShore`;
  - `toVirtual` inverts `toGround`; lateral compression is the square root of the depth compression;
  - invalid profiles are rejected.
