# One water-plane projection

Owner, 2026-10-21: replace the separate visual angles and physical metre curves with one water-plane projection.
The owner explicitly chooses exact castable bounds and authored far distance; fit the shore scale automatically,
and expose camera distance to control perspective strength. This supersedes spec 113's rollback for this feature.

## Contract and boundaries

- WaterMetric owns ground/map positions, distances, the Jacobian and fitted scale. Engine base pixels remain
  ground metres times injected pixelsPerMeter (50). WorldPerspective only reads that same live metric; it owns no
  independent geometry. ViewportProjector remains the affine map-to-screen camera. Bootstrap composes queries.
- The location perspective has tiltDegrees (1..90) and cameraDistanceMeters (positive finite distance along the
  optical axis to the shore). distanceProfile.maxMeters is the ground distance to the far castable edge.
  With H map height, L length, alpha tilt and D camera distance: k=cos(alpha)/D,
  A=H*(1+k*L)/L, B=A/sin(alpha). Ground depth d maps to H(d)=A*d/(1+k*d), lateral X to B*X/(1+k*d).
  At 90 degrees k is exactly zero, B=A=H/L: every ground circle is circular and constant-sized.
  Values beyond authored bounds extend with boundary tangents, avoiding a reachable singularity behind the camera.
- Keep the existing uniform/unconfigured WaterMetric contract for callers needing a flat plane and historical
  profile inputs; an explicit camera profile selects the new projection. The shipped location uses the new model.
  Existing lateralExpansion=false remains an explicit parallel-X stylization of this same metric; the editor
  labels it accordingly. linearShare and legacy angle overrides have no role in camera projection.
- All water sprites and area previews read metric scale; the screen-space rod is unchanged. The metre grid uses
  the same ground mapping. Chum radii retain their catalog base-pixel values, interpreted as metres / pixelsPerMeter.
  Chum bonus and overlap use ground distances; rendering projects the actual circle contour through the same metric
  into a reused point buffer, shared by Canvas and WebGL. No double scaling, new globals or per-frame DOM work.
- Existing chum saves retain map centres and the complete save format. Changing projection changes their ground
  interpretation just as editing location geometry already does; bonus timing, fish filters and catalog values stay.
- DEV shows one tilt, camera distance, exact length, fitted shore scale and a derived far viewing angle. Retain
  schematic diagram, category controls, black background, metre grid, validated edits, reset/export/import and binding
  disposal. Validate candidates before mutation. Legacy upper/lower angle controls are removed.

## Implementation stages and evidence

1. Inspect consumers and establish deterministic failures. The new short-location matrix initially fails because
   the legacy metric rejects lengths below H/50. Extend existing water-metric, viewport and editor scenarios.
2. Replace projection ownership and wire runtime/DEV to one resolver. Update existing behavioral tests and docs.
3. Move chum influence/overlap to ground distances and project its contour in both rendering paths. Verify inside,
   boundary/outside, delivery/expiry/targets, overlap, reload and camera pan/resize. Preserve timing and save bytes.
4. Run focused checks and Full once (includes Architecture and Quick), patch release and artifact cleanup.

Owner acceptance: index/dev, phone portrait and landscape, 90/45/1-degree views, near/far grid and chum, off-centre
zones, boat movement, casting/retrieve/landing; editor invalid values, reset/import/export and canvas fallback.
Phone performance uses the existing profiler. Agent does not open a browser or perform visual acceptance.
No check manifest entry, baseline, live check, utility or dependency is removed or weakened.

Tooling correction: Pages still builds and validates committed HEAD bytes. Its separate working-tree structure
assertion incorrectly passed HEAD's path list to productionFiles, rejecting a newly imported module even when
staged. Use the command's actual tracked-working-files input as required by UTILS_RULES.md; all release closure,
immutable bytes and production/DEV exclusion assertions remain. The new production projection module is staged.

## Verification (v0.45.41)

- Full: 65/65, including Quick, Architecture, CSS safety and immutable Pages; game-cycle baseline unchanged.
- Existing focused scenarios cover 1/15/30/45/90 degrees, lengths 0.1/1/30/1000 m and camera distances
  1/30/1000 m, map/ground inverses, off-centre velocity derivatives and finite boundary extensions.
- Actual chum and landing contour points agree with ground radii through portrait/landscape pan/resize.
  Ground bonus/overlap, species/delivery/expiry, save shape and reload/save bytes pass.
- Actual boat journeys agree with flat-water ground motion at 1/30/45/90 degrees. Editor candidate rejection,
  independent controls, projection enable/parallel-X, binding disposal, reset/export/import and grid cache pass.
- Waves use the same projection port; deterministic drift and scene invalidation/fallback remain covered.
- No browser visual check or phone performance measurement was performed; owner acceptance remains in tasks.md.
- No utility, fixture, dependency, manifest entry, baseline or architecture guard became obsolete or was removed.
