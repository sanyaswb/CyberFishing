# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.46.3 - Lying Float Towed by Its Bottom

- Spec 127 stage 4 (TK-025…TK-029): the float's lean is one vector on the water plane; a lying float is towed by its bottom (the tip trails at physics.floatPose.lying.trailLengthMeters, swings around through the player side, keeps its direction at rest, ignores drift with the water); the body is projected with the water's tilt, so a float lying toward the player is shorter but visible and a lean away draws slightly longer. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual and phone check pending.

## v0.46.2 - Night Float Halo Switches

- The yellow/red bite-colour halo around the tackle is off by default (owner); the night float gets a green halo in the same style. DevTools switches: ui.float.biteHalo, ui.float.nightHalo, ui.float.nightTipGlow. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual check pending.

## v0.46.1 - Image Float Without Stretching

- TK-024: on the WebGL scene the image float's red antenna stretched while the float stood up and sank. Its cropped textures were not dynamic, so Pixi sprites kept bounds from the old frame. Crop textures are dynamic now; the scene-layer fake Pixi reproduces Pixi's cached sprite bounds (the check failed before the fix); new DEVELOPMENT_RULES section on library contracts and test doubles, rendering incident recorded. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner phone check pending.

## v0.46.0 - Float Pose and Image Float

- G-113 / spec 127: the float's lean comes from forces (motion through the water in ground metres, line pull, fish, wind) scaled by CONFIG.physics.floatPose gains and followed by damped springs for roll, pitch (foreshortening) and draft. Diagonal retrieve leans the right way, pulling straight in never turns it sideways, no jumps at bite start/end, hook or reversals, same at any frame rate; bites and ballast sink the float instead of stretching it. Bite timing and random numbers unchanged.
- The float is drawn from its item art (scene variant 33×384 px) at ui.float.displayScale 2: only the part above the waterline (30 % of the body at rest) shows, cropped by texture frame / source rectangle. New night float: only its red tip glows green (additive, pre-blurred glow art, no filter pass); the day float does not glow. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner play check and phone performance pending.

## v0.45.45 - Surface-Scaled Water Waves

- Spec 126 R4: water waves are a surface pattern. Far crests are farScale times as far apart and as high in both axes, whether or not the grid contracts sideways; rows follow calibrated ground metres. The wave field maps over the clip regions it actually covers. Full 65/65 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual and phone performance acceptance pending.

## v0.45.44 - One Water Projection Source

- Spec 126 review corrections R1–R3, R5, S1–S3: one location branch waterProjection {maxMeters, tiltDegrees, farScale, lateralContraction} replaces perspective + distanceProfile; IllustratedDepthProfile behind WaterMetric with one set of ranges for schema, metric and DEV editor; the legacy linearShare profile removed; LocationWaterMetricSource is the only metric query. A projection without its length is rejected instead of crashing; the editor shows near/far px per metre and an add action for uniform water. Untracked registered checks now fail the runner. Full 65/65 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual acceptance pending.

## v0.45.43 - Simple Illustrated Water Perspective

- G-112 / spec 126: replace camera distance and overhead reference with exact water length, artistic tilt and a far-size ratio. Defaults: 30 m, 30 degrees, 0.3. Preserve full grid/water bounds and exact aim metres; one metric owns surface sizing and matching chum containment. Remove the camera-ray diagram and obsolete controls; optional grid-width contraction defaults off. Full 65/65, including Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.45.42 - Stable Water Width Across Camera Angles

- G-111: remove camera-driven X zoom and default lateral expansion off. Parallel-X chum widths stay stable across tilt edits; the green zone, metre grid and animated water retain their full authored bounds/height. Tilt warps internal spacing and visible metres; DEV distinguishes overhead reference length from actual far distance. Add near/far rays and their shaded sector from the shared metric; overhead rays are parallel at 90°. Full 65/65, including Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.45.41 - Unified Water Plane Projection

- G-110: one fitted camera projection for metres, movement, sprites, waves, chum and landing contours. Overhead water stays uniform and circular; authored bounds/length and the 50 px/m engine unit are preserved. DEV exposes camera tilt/distance and fitted scale; ground chum influence retains save format and timing. Full 65/65, including Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.45.40 - DEV Zone Editor Camera Tilt Diagram

- Add toggleable schematic SVG diagram visualizing camera view angle, tilt arc/right-angle marker and water distance ruler in DevTools zone editor under perspective controls. Full: 65/65, including diagram builder regressions, Quick and Architecture. Owner acceptance pending.
