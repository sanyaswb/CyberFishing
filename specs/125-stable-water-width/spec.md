# Stable width inside fixed castable bounds

Owner, 2026-10-21: remove the large tilt-driven width changes, default lateralExpansion to false, and keep the
metre grid and animated water attached to the full height between the green castable zone's upper/lower edges.
G-111, v0.45.42. The owner's latest instruction supersedes moving/cropping the water edge and spec 124's angle-driven zoom.

## Contract

- One WaterMetric owns coordinates, distances and the Jacobian for grid, gameplay, sprites, waves and ground-circle
  contours. Authored castable bounds, their complete height and background placement remain unchanged at every angle.
- maxMeters calibrates the fixed rectangle's reference distance when viewed overhead; DEV labels it "Дальність при
  90°, м" and separately shows the actual far-edge metres at the current tilt. Let H be map height, L this reference,
  B=H/L the fixed shore X scale, A=B*sin(tilt) and k=cos(tilt)/cameraDistance (exactly 0 at 90 degrees). For map height h
  above shore, q=h/A and ground depth d=q*(1+k*q/2). This monotone 2D warp has no horizon inside the finite rectangle;
  the actual far distance is computed at h=H. Angle changes distort spacing/visible metres without fitting X zoom.
- Exact inverse: q=2*d/(1+sqrt(1+2*k*d)), h=A*q. Lateral scale is B when expansion is off; explicit on uses
  B/sqrt(1+k*q). Depth scale is A/(1+k*q). Use the exact lateral/depth derivatives for velocity conversion, including
  off-centre motion. Outside the water keep boundary tangent extensions. At 90 degrees both axes equal B everywhere.
- Modern camera profiles default lateralExpansion to false, including omitted settings and local reset. Existing
  explicit saved true overrides remain choices. The uniform/unconfigured and legacy distance-only metric contracts
  remain; engine base pixels are always ground metres times injected pixelsPerMeter (50), independently of map scale.
- Runtime bounds, animation masks and green-zone annotations keep the authored edges. The metre grid fills that same
  rectangle; add its exact upper boundary if an adaptive metre step does not divide the far distance. Cache/reuse
  unchanged geometry and keep work bounded. No extra loop, per-frame DOM measurement, visual-only correction or globals.
- Preserve catalog radii, bonus timing, species/delivery rules and complete chum save shape. DEV retains tilt,
  distance, reference length, width/diagram toggles, independent config paths and validated reset/export/import.
- The DEV schematic shows a near ray at 0 m, a far ray at the actual far distance, their angle labels and a
  translucent sector between them. Derive the far effective inclination from asin(far Y scale / far X scale),
  including the width toggle; it is not a separate angleTop setting or a second camera formula. At 90 degrees
  both rays are vertical and parallel. Numeric diagram input remains finite, with an accessible description.

## Evidence and acceptance

The fixed-width regression initially fails (17/53-degree zoom), then the owner's full-height regression fails
with topY=1153.45 instead of authored 520. Extend existing water-metric scenarios for stable real near/far contour
widths, constant bounds/full animation clipping, inverses/velocity derivatives, modern width defaults and save/timing.
Editor scenarios cover unchanged geometry on repeated tilt edits, exact top grid boundary, bounded/unchanged redraw
and reset/import. Boat paths retain flat-lake equivalence. Replace the water test's old arbitrary far-amplitude
threshold with the behavioral contract that projection edits change the pattern in the same reused fixed-size field.
No live check, guard, manifest entry, baseline or utility is removed or weakened; no utility becomes obsolete.

Owner: index/dev in portrait/landscape, 17/53/90 degrees with width off/on, fixed green/grid/water edges, near/far
chum, actual far metres and casting/boat/retrieve; reset/export/import and Canvas fallback. Check the two rays,
sector and far label as tilt/distance change, including the parallel 90-degree case. Phone performance uses
the existing overlay. The agent performs no browser visual acceptance or phone measurement.

## Verification, 2026-10-21

Focused water-metric and zone-editor checks pass, including the fractional-distance exact 90-degree case.
The far-angle axis-ratio regression fails under the former independent camera formula and passes with the shared
projection. Final `npm run check`: 65/65 in 9.26 seconds, including Quick and Architecture; game-cycle baseline
unchanged. `npm run clean:artifacts` and whitespace/version/cache-link/retention checks pass. Browser appearance
and phone performance are pending owner acceptance; the agent did not perform them.
