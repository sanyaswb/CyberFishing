# Feature Specification: Perspective metres on the water (water metric)

**Created**: 2026-10-11 · **Status**: Step 1 of 6 implemented · **Kind**: gameplay mechanic, staged (backlog G-006)

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

## Steps
1. **`WaterMetric` (this step):** domain class and the `water-metric` check. No consumer yet; behavior unchanged.
2. **Casting:** compose the metric per location. Cast limit, power cast target (power × metres → height), `CastRules`,
   the depth limit line, recast and the line paid out at the cast go through it. Uniform metric → game-cycle
   unchanged.
3. **Line and fish motion:** `LineSystem` distance, line constraint and radial split, fish force velocities and
   retrieve run in ground metres. Uniform → unchanged.
4. **Rod and landing:** rod lateral control, rod movement, pole sector, net reach, landing and fight area frames.
   Uniform → unchanged.
5. **Water entities:** float and lure drift, retrieve and sinking in the waiting state; DEV diagnostics. Uniform →
   unchanged.
6. **Enable** `distanceProfile: { maxMeters: 30, linearShare: 0.5 }` on the test location (gameplay change). The
   owner tunes it in play.

Steps 2–5 are structural (unchanged game-cycle report). Step 6 is the gameplay change.

## Step 1 evidence
- `water-metric` check:
  - the uniform metric equals `hypot(dx, dy) / pixelsPerMeter` and `(shoreY − y) / pixelsPerMeter` bitwise over 500
    random points;
  - the 30 m profile gives 3.2 m at 160 px, 6.4 m at the join, 30 m at the top, and no kink at the join;
  - metres grow monotonically and pixels per metre never grow with distance; `yAtMeters` inverts `metersFromShore`;
  - `toVirtual` inverts `toGround`; lateral compression is the square root of the depth compression;
  - invalid profiles are rejected.
