# Per-location water tilt

Owner, 2026-10-18: locations have different viewpoints; expose the water-plane tilt in degrees and make the DEV
controls understandable and complete. G-073, v0.42.0. This changes the projection mechanic, not the save format.

## Contract

- `MAP_DB.<id>.distanceProfile.tiltDegrees`: 1..90 degrees above the water at the lower green-zone edge.
  90 is overhead, 45 is oblique, small angles look along the water. Default 90 preserves existing profiles exactly;
  the test location explicitly starts at 90 until the owner tunes its artwork. Disabling the profile keeps the existing
  unprojected identity. The rod remains screen-space.
- Extend the existing WaterMetric rather than multiplying a visual-only squash into the renderer. Near-shore depth
  pixels/metre = `pixelsPerMeter * sin(tiltDegrees)`, lateral pixels/metre stays `pixelsPerMeter`. Keep the existing
  linear-share/quadratic distance curve, inverse, lateral/depth relation and exact velocity Jacobian.
- The top edge remains `maxMeters` from shore. To keep scale non-increasing, it must be at least
  `(shoreY - topY) / (pixelsPerMeter * sin(tiltDegrees))`. Reject incompatible edits explicitly; never silently change
  the angle or the location's length. This angle is the local near-shore ground-plane inclination, not a new full 3D camera.
- All physical distances, movement, metre-grid spacing, area sizes and world scale use this one metric. Camera pan,
  phone orientation and green-zone bounds do not introduce another angle owner. Cache invalidation includes tilt.
- DEV editor shows labelled angle, distance from shore, flat share and enabled controls, an explanation of degrees,
  feedback on rejected edits and export/import/reset controls beside the fields. Reuse existing controls and runtime
  overrides. `maxMeters` is distance along the water, not bathymetric depth from the depth map.

## Verification

First focused failure: a requested 1-degree shore ratio is still 1 against production WaterMetric. Check 1/15/30/45/90 degrees, both
linear shares, inverses, finite-difference velocities, unchanged 90-degree profiles, equal-scale tilted water,
range/incompatible inputs, live resolver caching, actual area render ratios and editor grid invalidation.
Exercise readable DEV controls, rejected edits without a config write, export/import/reset callbacks and binding disposal.
Run focused, Architecture, Quick and Full; keep the game-cycle report unchanged. No tools, fixtures, vendor assets,
scripts or dependencies become obsolete. Owner handles visual/phone verification and performance acceptance in both
orientations; no browser visual check by the agent.

Implemented: candidate metrics are composed through a bootstrap-injected factory. Shared DEV validation reads the
current runtime location catalog after replacements. A local reset exports the explicit default profile so importing
it cannot resurrect older child overrides. Phone labels wrap at full length. Real boat and waiting/biting regressions
also run with 30/45-degree water. Architecture 4, Quick 36 and Full 62 pass; game-cycle baseline unchanged.
