# Feature Specification: Bait boat on the water metric

**Created**: 2026-10-11 · **Status**: Specified, not implemented · **Kind**: gameplay fix on the 053 metric
(backlog G-007)

## Owner request (2026-10-11)
The perspective metres of [053](../053-water-metric/spec.md) must also drive the bait boat's movement speed. Write the
task; the implementation runs in a separate session.

## Current state (verified 2026-10-11, develop b2aa5b1e)
The boat is not on the metric. `BaitBoat.update(dt, checkPhysics, checkSensor, cellSize, env)`
(`src/game/application/chum/bait_boat.js`) integrates everything in map (virtual) pixels:
- speed `stats.speedPxPerSec` (item levels 150 / 200 / 250, `item_database.js`), acceleration, brake and reverse
  thrust in px/s;
- arrival radii `finishRadiusTarget` 10, `finishRadiusReturning` 30, smart drop 45, stall speed 15 px/s,
  `slowRadius` 150, shore parking 50 / 30 px from `startPos`;
- sensors: look distance `cellSize × sensorRangeFactor + speedRatio × cellSize × 2` (map cells), rays written into
  `#sensorRays` for rendering;
- current drift `env.current.speedPxPerSec × 0.8`.

`ChumService.updateBoats` calls it from `GameWorld.update` with the virtual water lookup (`checkPhysics`, bounded by
the dynamic bounds), the collision lookup (`checkSensor`) and `locations.cellSize`. On the 30 m test location a level-1
boat therefore crosses the far half of the water (≈ 23.6 m in 320 px) up to ≈ 6.4× faster in metres away from the shore and ≈ 2.5× sideways at the far edge
than near the shore.

## Required behavior
- The boat's speed, acceleration, braking, turning-circle distances, arrival radii and drift are ground metres
  (base pixels = metres × pixelsPerMeter), the same everywhere on the water: far away it covers fewer map pixels per
  second, sideways and away from the shore, exactly like the tackle since 053 step 5.
- A uniform metric (no or disabled `distanceProfile`) leaves the boat bitwise unchanged.
- Save bytes do not change: chum zones are stored at the boat's drop point in map pixels (`ChumService.saveToStorage`).
- Hot loop: no allocations per frame.

## Design (follow 053 step 5)
Run each boat update on the metric's ground plane, converting the boat's own spatial state in place around
`boat.update`, like `GroundPlaneScope` does for the tackle.

1. **`BaitBoatGroundPlaneScope`** (new, `src/game/application/chum/bait_boat_ground_plane_scope.js`; one
   responsibility, allocation-free scratch vectors). `enter({ metric, boat, checkPhysics, checkSensor, cellSize })`:
   - uniform metric: convert nothing, return the original lookups and `cellSize`;
   - otherwise convert in place to the plane: `pos`, `startPos`, `target` (when set), every `waypoints[i]`
     (`{x, y}` objects pushed by `ChumController`), `velocity` (exact derivative, `velocityToBasePlane` at the virtual
     `pos`), and the heading `angle`: map the unit heading `(cos, sin)` with `velocityToBasePlane`, then `atan2`;
   - hand out plane lookups: `(baseX, baseY) → fromBasePlane → original lookup` for both `checkPhysics` and
     `checkSensor` (the virtual bounds test inside `GameWorld`'s lambda stays as is);
   - hand out the plane size of one map cell at the boat: `cellSize / metric.pixelsPerMeterY(pos.y) ×
     pixelsPerMeter` (decision below).

   `exit()` converts back in the reverse order (position first, then velocity and heading at the new virtual
   position, then `startPos`, `target`, waypoints) and maps the three `#sensorRays` start/end points to the map so
   the renderer keeps drawing virtual coordinates. The rays are `BaitBoat` private state: add one public method that
   maps them through a callback (or exposes the ray records for the scope); do not make the fields public.
2. **`ChumService.updateBoats(dt, checkPhysics, checkSensor, cellSize, env, waterMetric)`** wraps every
   `boat.update` in the scope (`try/finally`). The drop handling after the update (`zone.x = boat.pos.x`) runs after
   `exit()`, so zones keep map coordinates.
3. **`GameWorld.update`** passes `this.getWaterMetric()`.
4. Everything the boat persists between frames must be converted. Before coding, list all `this.*` spatial fields of
   `BaitBoat` (at least `pos`, `startPos`, `target`, `waypoints`, `velocity`, `angle`, `#sensorRays`,
   `#lastScanData.lookDist`, `avoidanceTargetAngle`) and decide for each: converted, plane-only (recomputed every
   update), or angle. `#lastScanData.lookDist` is computed in the plane and only used inside the update.
   `avoidanceTargetAngle` is a heading and needs the same conversion as `angle`.

### Decisions
- **Speed values stay in config as `speedPxPerSec`.** On the plane they mean base pixels per second (metres × 50), as
  the tackle's `speedPxPerSec` values do since 053. No config migration.
- **Sensor range follows the local map cell size.** The sensors detect collision cells, which are map cells. Far away a
  cell spans more metres, so the look distance uses the plane size of a cell at the boat. A fixed `cellSize` would
  make the boat notice far obstacles late.
- **Out of scope** (map-pixel UI, unchanged): the 40 px boat click radius and the `bounds.bottom − 200` recall zone in
  `ChumController.handleGlobalBoatControl`, the idle spawn at `bounds.bottom − 5`, chum zone radii and bonuses, the boat
  sprite's perspective scale.
- **Rejected:** scaling only `speedPxPerSec` by the local metric. Acceleration, braking distance, arrival radii and
  drift would stay in map pixels, so the boat would overshoot and stall differently far away.

## Acceptance
- New focused check `bait-boat-water-metric` (register it in `utils/run-checks.js`; 40 → 41 checks):
  - **Flat-lake equivalence:** a boat delivering to a target 25 m out on a 40 m profile over 0..800 virtual px moves, in
    ground metres, exactly like the same boat on a flat 40 m lake (0..2000 px) for its whole trip there and back
    (tolerance 1e-6 m per frame). Same seeds, water lookup always true, no collisions, a constant current.
  - **Uniform identity:** with a uniform metric the scope hands out the original lookups and `cellSize` and leaves
    `pos`, `velocity`, `angle`, `target`, waypoints and rays bitwise unchanged after an update (`Object.is`).
  - **Map output:** after `exit()` the drop point written into the zone and the rays read by the renderer are virtual
    (compare with `fromBasePlane` of the plane values).
  - **Mutation evidence:** skipping the heading conversion, the velocity conversion or the waypoint conversion each
    fail the equivalence.
- Existing checks unchanged: consumable identity and chum composition (both drive real boats) pass with a uniform
  metric. The game-cycle report stays unchanged (SHA256 `7b9baea3…d5b6`). Architecture + Quick + Full green.
- Owner play check on the test location: a level-1 boat slows down visibly far away and keeps the same speed in
  metres; delivery and return still finish (no stalls at the far edge).

## Process
Gameplay change on the 053 metric: backlog G-007, this spec and one commit (the test location already has its profile
enabled, so the wiring itself changes the boat there; the uniform identity check proves every other location is
unchanged). The release bumps the minor version together with 053.
