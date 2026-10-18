# Independent location tilt and length

Owner, 2026-10-19: remove the angle/length coupling in v0.42.0 and restore the initial location values.
G-074, v0.42.1: repair spec 111's newly introduced authoring limitation.

## Verified defaults and boundary

Before the shared-perspective change, `e1a46f79^` authored `perspective.angleBottom = 30` and
`distanceProfile.maxMeters = 30`. Restore the active equivalents `tiltDegrees: 30` and `maxMeters: 30`.
Keep compression starting at the lower green-zone edge (`linearShare: 0`), as explicitly required by the owner.
The old unused `angleTop: 0` described a horizon outside the water; it is not a finite-distance collapse control
and must not be reintroduced as an unused setting or a singular projection at the far edge.

`WaterMetric` remains the only owner of map/ground conversions and metric scale. Physical base pixels remain
metres × `pixelsPerMeter`; rendering zoom must not become a second gameplay unit. No new projection curve or
visual-only squash is needed, and the screen-space rod remains unchanged.

## Fitting

- Any angle 1..90° and any positive representable finite distance can be combined.
- Let H be castable map height, L be maxMeters, P be the existing physical base-pixel unit per metre.
  Fit near-shore depth pixels/metre to `max(P, H/L)`. Near-shore lateral pixels/metre are that scale divided by
  `sin(tiltDegrees)`. The angle is the near-shore ratio of depth to lateral scale; zoom fits it to the authored map.
- Retain the existing linear-share/quadratic depth mapping and its far edge at L. Its shape for ordinary lengths
  is unchanged at 90°. A shorter location is fitted by projection scale, not rejected. Keep exact inverse and
  velocity derivatives, with scale non-increasing away from shore. The angle does not change depth-axis metre
  positions or mutate the authored length.
- Remove the obsolete minimum-distance getter, exception metadata and DEV restrictions after checking consumers.
  Show independent angle/length controls and automatic fitting. Continue rejecting invalid angles, shares and
  non-positive/non-finite lengths without a config write. Update metadata and current rendering docs.

## Evidence

Reproduce first: actual WaterMetric must accept 1° at 0.1 m. Matrix: lengths 0.1/1/5/12.8/30/1000 m × angles
1/15/30/45/90° × both linear shares; endpoints, monotonic scales, map/ground inverses, off-centre finite-difference
velocities and base-pixel units. Actual DEV edits of only the angle/length must preserve the other field and
accept former invalid combinations; invalid inputs still reject. Grid, chum/landing-area, boat and idle-tackle checks use
the fitted metric. Run Architecture + Quick + Full, keep the game-cycle baseline unchanged, commit and publish.
No utilities, fixtures, scripts, vendor files or dependencies become obsolete. Owner handles visual/phone checks
in both orientations; no browser visual check by the agent.

The landing ellipse's lateral radius previously multiplied only by viewport scale. Automatic projection zoom
exposed that missing metric factor; its focused one-metre boundary failed before the fix. Apply the metric's lateral
scale there too, retaining the existing depth-axis endpoint and render model for both WebGL and Canvas.

Verification: focused matrix and actual UI/area/boat/tackle checks pass. Architecture 4, Quick 36 and Full 62 pass;
the game-cycle baseline is unchanged. The obsolete `minimumTopMeters` getter and exception metadata have no remaining
source/test/current-doc consumer. The separate owner request G-075 changes only the existing Overlay master default
to off; manual activation and module selections remain available.
