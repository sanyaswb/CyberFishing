# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.46.6 - Selector Menu Icon and Shared Feedback

- TK-032/033: selector sectors share the main toolbar button's background/accent states without the extra yellow thick border; keyboard focus keeps the toolbar info color. Replace the central suitcase with a symmetric four-square SVG menu and retain the original in asset-sources/ui/archive/inventory-suitcase-v0.46.5.svg outside runtime assets. Interaction geometry and gestures unchanged. Full 66/66 incl. Quick/Architecture; owner visual acceptance pending.

## v0.46.5 - Mobile Float Below Inventory Selector

- TK-031 / G-115: at mobile toolbar widths <=820 logical px, place the radial selector in a dedicated upper row and keep float/depth below, left of appearing chum/net actions. Preserve measured selector bounds, slider expansion, wide/classic layout and shared production/DEV/catalog composition. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner responsive acceptance pending.

## v0.46.4 - Night Float Without Daylight Glow

- TK-030 / G-114: night-float halo and additive tip light now follow the location's night lighting instead of the item variant alone. Daylight renders only the original red-tipped body in WebGL and Canvas, including after dawn on an existing cast; preserve DEV switches and all float geometry/gameplay. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

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
