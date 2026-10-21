# Simple 2D water perspective

Owner correction, 2026-10-21. Supersedes the camera and overhead-reference models of specs 124/125.
G-112, target v0.45.43. This is an illustrated 2D game, not an optical camera simulation.

## Authoring contract

Three primary controls in the existing zone editor:

| Control | Default | Meaning |
| --- | --- | --- |
| Дальність води, м | 30 | Exact ground distance from the authored lower water edge to its upper edge |
| Нахил площини, ° | 30 | Artistic flattening of surface areas; 90 makes circles, 30 makes half-height ellipses |
| Масштаб вдалині | 0.3 | Far/near ratio: 0.3 means 30% size and depth motion, 1 means no distance compression |

Changing tilt or far scale never changes the 30 m limit, water bounds, background or animation mask. The grid
always fills the complete green zone. Metres on the aim line, casting, retrieve and boat motion use its exact
inverse. The engine/catalog base remains 50 pixels per metre. Default near sizes approximate the pre-camera game.
Keep the existing optional lateral-grid contraction switch off by default; it does not disable shrinking of
surface markers. Explain it separately as grid width, not as another camera parameter.

Remove camera distance, overhead-reference distance, near/far camera rays, their sector and their diagnostic
state/styles/builder. There is no separate angleTop or near/far camera calculation. Keep reset/export/import,
validation, category visibility and Canvas/WebGL support. Existing explicit local settings remain in the
override store, but obsolete camera/linearShare fields must not affect the modern metric. Reset restores only
this location's profile/perspective and removes obsolete child overrides.

## One authoritative projection owner

WaterMetric remains the injected, immutable location query, cached by LocationWaterMetricResolver. It owns both
the calibrated metre mapping and the illustrated surface-area projection. WorldPerspective only forwards its
readings. DEV composes the production metric; it must not copy formulas. Domain/application receive queries,
not config globals or browser objects. No new runtime globals, compatibility path or parallel render loop.

The two contracts are explicit: ground metres determine position, travel and range; surface areas are local
2D ellipses matching the illustration. Their bonus containment uses the very same scale/flattening as their
rendered footprint, as in the pre-camera game. A tilt edit changes that footprint, never the location's length,
catalog radius, bonus schedule, delivered state or save schema. Landing range overlays continue to project
actual ground distances; they do not define a second source of location metres.

## Developer model

For modern profiles let H be authored map height, L the exact length, P the injected base pixels/metre,
r=farScale in [0.05,1], h=clamp(shoreY-y,0,H), c=(1-r)/(2*r), a=L/(H*(1+c)), b=c*a/H.
Then d(h)=a*h+b*h*h, d(0)=0 and d(H)=L exactly. Near Y pixels/metre are 1/a; far Y pixels/metre are r/a.
The stable inverse is h=2*d/(a+sqrt(a*a+4*b*d)); r=1 is linear. Use boundary tangents outside the water.
Surface size s(h)=a/(a+2*b*h) runs from 1 to r. X metres keep P when lateral contraction is off, or P*s(h)
when explicitly on. Exact derivatives, including off-centre X coupling, convert velocities. Tilt is sin(angle)
for surface ellipse aspect only and never enters these metre equations.

Chum map radii are baseRadius*s and baseRadius*s*sin(tilt). One WaterMetric query owns these factors for
presentation and containment/overlap. Canvas/WebGL consume the existing ellipse frame record; no polygon
allocation or repeated trigonometry per frame. Boats/surface sprites read the same size factor. Wave phase and
ground motion use the calibrated metre mapping inside the existing complete mask. Legacy unconfigured and
distance-only WaterMetric callers retain their existing contracts until separately migrated.

## Functional acceptance and cleanup

- Reproduce the owner's failure first: length 30 must remain 30 at tilt 17/30/53/90 and obsolete camera 30/900.
- Test exact endpoints/inverses, 10/20/30 m aim placement, positive finite scales, slower depth motion at the far
  edge, far/near size ratio, angle-independent width, and no range drift after repeated edits.
- Test rendered ellipse versus actual chum bonus just inside/outside the boundary near/far/off-centre, species,
  delivery, overlap, save/reload and bonus timing. Preserve legacy simulations and game-cycle baseline.
- Retain bounded grid work, unchanged-frame cache reuse, full water clipping, boat flat-ground equivalence,
  reset/import/export and invalid input rejection. Remove superseded camera assertions, not live checks/guards.
- Inspect all consumers before removing the obsolete diagram builder, flags and styles. No utility/check ID is
  retired by this change; keep useful existing scenarios. No baseline or architecture exemption changes.
- Focused checks then Full (includes Quick/Architecture), artifact cleanup and patch/cache-link bump.

Owner acceptance: dev.html zone editor, portrait/landscape, 30 m and tilt 17/30/53/90, far scale 0.3/0.6/1;
10/20/30 m aim lines match the grid and the upper edge is always exactly 30 m. Compare chum shape/bonus near/far,
grid contraction off/on, fixed full-height water animation, reset/import/export. index.html and Canvas fallback:
cast, boat, retrieve and landing. Phone performance overlay in both orientations. No browser appearance or phone
performance check is performed by the agent.

## Verification, 2026-10-21

The exact-length regression failed before implementation (270.4187 m instead of 30 m at 17 degrees).
Focused water-metric, editor, viewport, config/schema, scene-layer and boat checks pass. Full: 65/65 in 9.27 s,
including Quick and Architecture (777 modules, 28 negative fixtures; CSS 680 selectors, 20 negative fixtures).
Game-cycle baseline and save schema unchanged. Version/cache links and latest-ten changelog retention pass.
Removed the superseded camera diagram builder, its import, session flag, styles and diagnostic assertions after
checking all consumers. No live check, runner, guard, baseline or utility became obsolete or was removed.
Browser appearance and phone performance remain owner acceptance; the agent performed neither.

## Review corrections, 2026-10-21

Owner request after the review: keep the simple model, make it architecturally correct, open to extension and
convenient to edit and visualize. The review found the formulas exact; the defects are around them.

### Formula evidence (keep as acceptance data)

A scratch probe over 480 combinations (H 120–3000 px, L 5–300 m, r 0.05/0.3/0.6/1, tilt 1/17/30/53/90, lateral
contraction off/on, points from 20% below the shore to 20% above the top edge, x off-centre both sides):

| Property | Worst error |
| --- | --- |
| d(0)=0, d(H)=L, yAtMeters(L)=topY at every tilt | 0 |
| y -> metres -> y, inside and outside the water | 3e-13 px |
| dMetres/dy = 1/pixelsPerMeterY | 7e-10 relative |
| far/near surface size and depth px/m = r | 1e-16 |
| velocity Jacobian vs finite differences of fromBasePlane | <= 4e-6 |
| velocity to/from base plane round trip | 1e-12 |
| rendered chum ellipse boundary vs bonus containment | 1e-10 |

The existing water-metric check keeps endpoint, inverse, Jacobian and ellipse/bonus assertions of this kind; the
probe itself is not added to the repository.

### Defects (bug fixes, each reproduced first)

- **R1 Modern perspective without a distance profile crashes.** `LocationWaterMetricResolver.resolve` reads
  `distanceProfile.maxMeters` when `perspective.tiltDegrees` exists and the profile is null (TypeError); the zone
  editor reads `location.distanceProfile.maxMeters` / `location.perspective.tiltDegrees` unguarded; the schema
  accepts that location. A profile without `maxMeters` silently yields a uniform metric with the tilt ignored.
  Fix: S2 makes the incomplete combination unrepresentable; the schema rejects a projection without its length,
  the resolver never dereferences a missing branch, and the editor shows an "add projection" state for a
  location without one. Reproduction: resolver/schema/editor cases fail before, pass after.
- **R2 Untracked check referenced by the committed manifest.** `utils/testing/suites/check_manifest.js` has listed
  `utils/checks/gameplay/chum-aim-zone-check.js` since v0.45.26 (cd3381d4), but the file was never committed:
  Full fails on a clean checkout. Fix: stage the file by its explicit path in this change. Guard: the check
  runner (or an existing tooling check, no new check ID) fails when a manifest `file` is not in `git ls-files`.
- **R3 Two sources of the water metric.** `GameCompositionRoot.#composeLocation` builds its own closure with a
  fixed `locId` (ChumService, WorldPerspective, debug console), while `GameWorld.getWaterMetric()` reads
  `map.currentLocationId` (appPorts: casting, fight, render builders). Both call the same resolver, so after a
  location change they disagree and the resolver cache rebuilds on every alternating query. Fix: one injected
  metric source. A small `LocationWaterMetricSource` (domain/locations; map + locations config + resolver,
  created once in bootstrap) owns the query; GameWorld delegates to it and every consumer, including DEV,
  receives the same function. Check: after switching the current location every consumer returns the identical
  metric instance, and repeated queries perform no rebuild.
- **R4 Waves do not shrink horizontally with distance.** `WaterWaveField.write` scales the X wavelength and
  X amplitude by `pixelsPerMeterX`, which is constant while lateral contraction is off (the default). Far waves
  keep the near width and full horizontal displacement; the removed `FAR_SCALE` shrank both axes. This
  contradicts "surface sprites/areas shrink with farScale in either mode". Fix: the visual size of the waves
  (X wavelength, X and Y amplitude) follows `surfaceScaleAt(y)`; the Y phase stays in calibrated ground metres.
  Drift (art pixels at the near edge) converts to the same base units as the phase, documented at the field.
  The field maps its columns over the water area it actually covers (clip-region bounds), not over the castable
  bounds, so an `adaptiveX` zone does not stretch the pattern. Check: the far row's X wavelength and both
  amplitudes are `farScale` x the near row in both lateral modes; equal area/castable bounds keep today's rows.
  This changes the look: owner visual check.
- **R5 Per-zone metric query.** `ChumService.getChumDataAt` and the overlap search call `getWaterMetric()` once
  per zone; read it once per call. No behavior change.
- **R6 Encoding.** The working copies of `CHANGELOG.md` (BOM, mixed CRLF/LF) and
  `src/dev/tools/zone_editor_section.js` (mixed CRLF/LF, empty first line) violate "tracked text uses LF".
  Restore UTF-8 without BOM, LF only, no leading empty line.

### Structure (structural commits, unchanged game-cycle digest)

- **S1 Depth profile behind WaterMetric.** Today every WaterMetric method branches over three modes (uniform,
  legacy `linearShare`, modern). Split the mode into a depth profile object built by the resolver and injected
  into WaterMetric: `metersAt(h)`, `heightAt(d)`, `metersPerPixelAt(h)`, `surfaceScaleAt(h)`,
  `lateralFactorAt(h)` and its slope, all on h in [0, H]. WaterMetric keeps the generic parts once: clamping and
  boundary tangents outside the water, base plane, ground conversions, Jacobian, surface distance and tilt
  squash. A new profile is a new class, not a new branch in every method. Hot queries stay allocation-free.
- **S1 limits in one place.** The ranges (tilt 1–90°, farScale 0.05–1, length > 0) and defaults (tilt 30,
  farScale 0.3, lateral contraction off) are frozen constants of the profile module. The schema validator
  (game/config may import domain) and the zone editor read them; the editor validates only by building the
  metric through the injected factory, without its own copy of the ranges.
- **S2 One configuration branch.** Replace the split `perspective.tiltDegrees` + `distanceProfile.{maxMeters,
  farScale, lateralExpansion}` with one location branch
  `waterProjection: { maxMeters, tiltDegrees, farScale, lateralContraction }`. The mode is no longer inferred
  from whether a field exists in another branch, and the editor edits one object. `lateralExpansion` becomes
  `lateralContraction`, matching its label "Звужувати сітку по ширині" (owner-requested convenience; parameter
  labels updated). A location without the branch is uniform (P px/m, circles). Obsolete DEV overrides of
  `perspective`/`distanceProfile` follow the override store's existing handling of unknown paths; a check
  proves they neither crash nor affect the metric, and the location reset removes them. Save schema unchanged.
- **S3 Remove the legacy distance-only profile (owner decision D-R1, recommended).** No location uses it.
  Its consumers are checks only: the game-cycle silent flat-lake equivalence (`run({ enabled: true,
  linearShare: 0.5, maxMeters: 16/40 })`), bait-boat, cast-rod-control, tackle-line-limit, water-metric,
  config-runtime/schema and zone-editor checks. Migrate their scenarios to `waterProjection` profiles with the
  same lengths (the equivalence "profiled fight == flat lake in ground metres" is profile-independent), keep the
  uniform metric, then delete the legacy branch, `linearShare`/`enabled` labels and validation. Digest unchanged;
  if a silent scenario cannot be migrated bit-for-bit, stop and report instead of re-baselining.

### Editing and visualization

- Editor status shows, from the metric: water 0–L m, tilt, far size %, and near/far depth px per metre next to
  the lateral px per metre, so the author sees the derived anisotropy.
- **D-R2 Ground circles vs surface ellipses (owner decision).** Near depth px/m is derived: H(1+c)/L. For the
  test location (H 640 px, L 30, r 0.3) it is 46.2 against 50 lateral, so the landing ground circle is 0.92 high
  near the shore while chum ellipses are sin(30°) = 0.5. For a castable zone taller than L·P/(1+c) (about 690 px
  here) ground circles near the shore become taller than wide. Recommended: keep landing in exact ground metres
  (the authoritative range) and show the anisotropy in the status; the alternative is drawing landing as a
  surface ellipse, which then no longer shows the exact range.

### Order, checks and acceptance

1. R2, R5, R6 (no behavior change), then R3 with its source check.
2. S1, S2, S3 as structural commits, each with focused checks and an unchanged game-cycle digest; R1's
   reproduction is added before S2 and passes after it.
3. R4 as its own visual change.
4. Utils cleanup step: list and remove what S3 made unused (legacy fixtures, labels, helpers), recording it here.
5. Focused checks, one Full, `npm run clean:artifacts`, patch bump with a short CHANGELOG line per delivery.

Owner acceptance in addition to the list above: dev.html zone editor with lateral contraction off/on and far
scale 0.3/0.6/1 — far waves shrink in both axes; status values; reset removes old perspective/distanceProfile
overrides; landing circle vs chum ellipse near the shore (D-R2). Phone performance overlay in both orientations
after R4. No browser appearance or phone performance check is performed by the agent.
