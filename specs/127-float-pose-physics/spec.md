# Float pose: one physical tilt and submersion model

Owner request, 2026-10-21. Status: stages 1–3 implemented in v0.46.0 (see Implementation and Stage 3).
The float is a bar turned by several hand-made angles. It must move simply and believably: lean the right way when
pulled or moved, react to the fish, wind and current through a few general multipliers, change smoothly, look
farther when far, and sink an image without distorting it.

## Owner criteria

| # | Criterion | Where it is met |
| --- | --- | --- |
| 1 | Moving toward the player at an angle, the float leans the right way | Model: the line pulls the body's bottom, the tip lags behind the motion |
| 2 | While biting and moving, the tip leans opposite to the pull: line or fish pulls the bottom left, the tip goes right | One force sum for every state; the fish is one more force at the bottom |
| 3 | No hard-coded tilts; the engine derives them from speed, current and wind; a few general multipliers | `CONFIG.physics.floatPose`: one gain per force, one spring |
| 4 | Smooth transitions, including sharp reversals | One damped spring per axis, frame-rate independent; nothing writes the angle directly |
| 5 | Scale as pseudo-distance, and when the tilt points away from the viewer | Surface size from WaterMetric (spec 126) plus foreshortening of a lean along the depth axis |
| 6 | Image float: initial submersion, sinking without distortion | A waterline crop of the unchanged image (texture frame / source rect), no mask |

Interpretation to confirm (D1): criterion 5 is read as "a lean toward or away from the viewer cannot be drawn as a
rotation, so it shortens the visible float (foreshortening); distance scale comes from the water metric".

## Current state (verified in the code)

The float's pose is spread over `WaterEntity` (952 lines) and `FloatEntity`, as five separately smoothed angles that
`getVisualState()` adds up, plus a height scale:

| Source | Code | Problem |
| --- | --- | --- |
| Motion tilt | `WaterEntity._updateMotionTilt` | Roll mixes the depth motion into the side lean (`moveY * verticalInfluence * verticalTiltSign`): moving straight toward the player turns the float sideways (criterion 1). Pixels per second, so the same metres tilt differently near and far |
| Pull impulse | `FloatEntity._updatePullImpulseTilt` | A second sideways channel with its own smoothing; the depth pull shrinks the height (`pullImpulseDepthScaleDrop`): the shape deforms |
| Wind | `_windAngleOffset`, `_lerp(..., dt * 0.005)` | Wind is a random angle, not a force; linear lerp is not frame-rate independent and overshoots for dt > 200 ms |
| Sinking | `_sinkingStartAngle * (1 - progress)` | ±90° chosen at random, written directly |
| Bite | `_currentAngle`, `_currentScaleY` eased per step (`_generateRandomAnim`) | Angles and heights authored per fish (`tilt.angle`, `sink/rise.heightPercent`); "rise" stretches the bar (`scaleY > 1`); during a bite `getVisualState()` drops wind, motion and pull, so bite start and end snap; `stopBite()` and `hook()` zero angles at once (criterion 4) |
| Ballast | `heightScale` 1 / 0.85 / 0.7 | Heavier ballast shortens the bar instead of sinking it deeper |
| Dead | `perspectiveScaleRange` → `_perspectiveScale` | Returned by `getVisualState()`, read by nobody; the builder already uses the water metric's surface size |

Rendering: `FishingEquipmentRenderModelBuilder.buildFloat` turns `visual.angle` into `rotationRad`, height =
`length × scale × scaleY`; `FloatRenderer` (Canvas) and `PixiFloatRenderer` (scene, spec 107) draw a rectangle from
the waterline point up, rotated about that point.

Signs today: a positive angle turns the tip right (clockwise). Rod/pull to the right gives a negative angle
(`rod-side-tension` check), which matches criterion 2 and must stay.

Gameplay coupling: the bite timing, colours (yellow / red guaranteed) and `getBiteStepInfo()` drive the hook window;
`_applyPhysics` skips the wind RNG draws while `_currentAngle` or `_currentScaleY` shows an active bite. The pose itself
moves nothing in gameplay.

## Model

The float is a rigid body with a pivot at the waterline. Its state is two lean angles and a submersion:

- **roll** — lean sideways in the picture (drawn as rotation);
- **pitch** — lean toward (+) or away from the viewer (drawn as foreshortening);
- **draft** — share of the body length under water (0 = lying on the surface, 1 = fully submerged).

### Forces (inputs), all in ground units

Every input is read in ground metres through the WaterMetric (spec 126), so the same motion tilts the same near and
far. X is sideways (right +), Y is toward the player (+).

| Input | Source | Effect on the tip |
| --- | --- | --- |
| Motion relative to water `v` (m/s) | The float's own displacement per frame (`toGround` of its position), minus the water current | Tip lags: lean opposite to `v` |
| Line pull `L` (0..1 along the line direction) | Pull direction toward the rod while retrieving, the cast-rod lateral move (`castRodDeltaX`) | Bottom pulled toward the rod, tip away from it |
| Fish pull `F` | The bite step's intent (below) | Bottom pulled, tip away |
| Wind `W` (signed share) | The existing wind state and gust schedule, scaled by `1 − windCompensation` | Tip downwind |

Using the measured displacement as the motion input means retrieval, drift, bite slides and fight movement all lean
the float through one path: no state writes an angle.

Steady lean per axis, in degrees: `target = gMotion·(−v) + gLine·(−L) + gFish·(−F) + gWind·W + base`, where the
gains are the general multipliers (criterion 3) and mean "degrees of lean per unit at full load". Roll uses the X
components, pitch the Y components; small leans add, large ones are limited softly to `maxTiltDeg`
(`max · tanh(target / max)`), so the sum never jumps.

### Dynamics (criterion 4)

Each of roll, pitch and draft follows a damped spring toward its target:
`a = ω² · (target − x) − 2ζω · ẋ`, with `ω = 2π · naturalFrequencyHz` and damping ratio `ζ`. The integration is
semi-implicit Euler with fixed substeps (at most 1/240 s each, at most 12 per frame), so 30, 60 and 144 FPS give the
same motion. A reversal from left to right passes through the middle with the spring's own speed and a small
overshoot when `ζ < 1`: never a jump. State changes (bite start/end, hook, stop) change targets only.

### Load, standing up and lying down

`load` (0..1) is the share of the shot weight the float carries:

- after the cast it grows with the existing sinking progress (`_getSinkingDepthProgress`), so the float lies, then
  stands up as the shot sinks;
- over-depth (hook lies on the bottom) keeps it at 0: the float lies;
- a "rise" bite (the fish lifts the shot) lowers it.

The lying side is the existing random sign drawn at the cast (`_chance(0.5)`, kept for the RNG order) and turned by
the first pull, as today. The base lean is `side × 90° × (1 − load)`; the spring stiffness scales with
`stabilityMin + (1 − stabilityMin) × load`, so a light float wobbles more. The rest draft is
`restDraft × load` (float item, ballast profile).

### Bites without authored angles (criteria 2, 3)

The bite sequence keeps its RNG, timing, colours and step info unchanged. Each eased step becomes an intent instead of
a final pose:

| Fish config (unchanged data) | Becomes |
| --- | --- |
| `tilt.angle`, guaranteed `tiltAngle` | Fish pull `F` sideways, sized so its steady lean equals that angle at full load; its direction follows the step's movement (`moveVelX`), as today |
| `sink.heightPercent` (negative) | Draft target increases by that share of the body (−100 % = fully under) |
| `rise.heightPercent` (positive) | Load decreases by that share: the float rises and, near 0, lies down. The body is never stretched |
| `bob.heightPercent` | Small draft change |
| `slide` and step movement | Moves the float as today; the lean comes from the motion input |

The entity keeps easing `_currentAngle` / `_currentScaleY` exactly as now (they also gate the wind RNG), and only
exposes them as intent. Hence the game-cycle report and the hook window stay identical.

### Distance and foreshortening (criterion 5)

Drawn length = `displayLengthPx × surfaceScaleAt(y) × projector scale × cos(pitch) × visibleShare`, where
`surfaceScaleAt` is the spec 126 surface size (already used for the float). `cos(pitch)` shortens a float leaning
toward or away from the viewer; roll stays a rotation. Width is not foreshortened.

## Configuration

`CONFIG.physics.floatPose` replaces `floatMotion`:

```js
floatPose: {
  enabled: true,
  naturalFrequencyHz: 3,   // how quickly the float rights itself
  dampingRatio: 0.6,       // < 1: a small wobble after a jerk
  maxTiltDeg: 80,          // soft limit of the summed lean
  stabilityMin: 0.3,       // stiffness share of an unloaded float
  gains: {                 // degrees of lean per unit at full load: the general multipliers
    motion: 18,            // per m/s relative to the water
    line: 20,              // at full line pull
    fish: 1,               // scales the fish's authored pull
    wind: 12,              // at full wind on the antenna
  },
  draft: { naturalFrequencyHz: 5, dampingRatio: 0.8, linePull: 0.15 },  // line pull sinks it slightly
}
```

Float items (`gameplayStats`): `restDraft` (share under water at rest, e.g. 0.6), and ballast profiles get
`restDraftAdd` and `stability` in place of `heightScale`. Values live in configuration, are validated by the schema
and have parameter labels, so the DEV config tree edits them live.

## Architecture

| Responsibility | Owner |
| --- | --- |
| Bite sequence, timing, RNG, colours, step info, sinking progress, load, intents | `WaterEntity` / `FloatEntity` (domain, as today) |
| Spring integration of roll, pitch and draft from inputs | New `FloatPoseSimulator` (domain/tackle, pure, allocation-free, writes a reused pose record) |
| Inputs per frame: ground velocity via WaterMetric, current, wind, line pull | `FloatEntity` collects them into a reused input record; the metric is passed in by the states that already pass it (waiting, biting) |
| Render model: rotation, drawn length, visible share, crop | `FishingEquipmentRenderModelBuilder.buildFloat` |
| Drawing | `FloatRenderer` (Canvas fallback) and `PixiFloatRenderer` (scene) |

`getVisualState()` returns the simulated pose (roll, pitch, draft, visible share) instead of summed angles. Removed:
`_motionTiltAngle`, `_pullImpulse*`, `_windAngleOffset` as an angle, `_updateMotionTilt`, `_updatePullImpulseTilt`,
`perspectiveScaleRange` / `_perspectiveScale`, `heightScale`, and the `floatMotion` config and labels. Feeder and
lures are out of scope (they keep their own visuals).

## Image float and submersion (criterion 6)

Art contract: the float image is upright, tip at the top, keel at the bottom, transparent margins trimmed, height
≈ display length × largest surface scale × pixel-ratio cap (rendering rule 6). Its item visual names the image and
the body's length in art pixels. The waterline is not painted into the art: it is physics (`restDraft`).

Drawing: the body hangs on the pivot (the tackle point on the water). The part above the waterline is
`visibleShare = clamp(1 − draft, 0, 1)` of the body. Only that part is drawn: the image's source rectangle is the top
`visibleShare` of its height, placed so its lower edge is at the pivot, then turned by roll. The image is never
scaled differently in its two axes, so a dip shows less of the same picture, as a real float does.

| Option | Cost | Decision |
| --- | --- | --- |
| **Crop by source rectangle** (Pixi texture frame updated in place + `updateUvs()`; Canvas `drawImage` with a source rect) | One sprite, batches, no extra pass, nothing allocated per frame | **Chosen** |
| Invisible rectangle mask under the waterline | Stencil pass per float, breaks batching, needs a second rotated rect | Rejected |
| Shader cut or vertical scale | A filter pass (rule 23) or distortion | Rejected |

The crop is perpendicular to the float's axis. For leans up to ~30° this matches how an illustrated float reads; a
lying float (draft near 0) shows the whole body. Fully submerged (`draft ≥ 1`) hides the body. The bite colours stay
on the existing glow halo (spec 107 D5) behind the image (D2).

The rectangle float stays the fallback without an image and uses the same visible share, so the bar sinks instead of
shrinking.

## Stages

1. **Structural:** `FloatPoseSimulator`, inputs and `floatPose` config behind the current visuals; bite intents keep
   their values. Game-cycle report unchanged (the pose moves no gameplay; RNG draws unchanged).
2. **Pose on screen:** render model and both renderers use roll, pitch foreshortening and visible share; rectangle
   float sinks instead of shrinking. Owner visual and phone check.
3. **Image float:** item visual, crop rendering in Canvas and Pixi, first float art. Owner visual and phone check.
4. Optional (D3): a waterline ripple ring on sharp dips, using the spec 126 surface ellipse.

Each stage: patch version, CHANGELOG line, gameplay backlog entry G-113 (float pose), focused checks and one Full run.
Utils cleanup step: remove the `floatMotion` assertions and labels that stage 1 replaces.

## Checks (deterministic, no visuals)

Extend `rod-side-tension` and add one focused `float-pose` check:

- signs: line or fish pulling the bottom left gives roll > 0 (tip right), right gives roll < 0; retrieving diagonally
  toward the player gives roll from X only, pitch from Y only (a straight pull toward the player gives roll 0);
- the same ground motion near and far gives the same lean (metric-independent);
- continuity: a full left-to-right reversal, bite start, bite end, hook and stop never change roll by more than the
  spring allows in one frame;
- frame rate: 30, 60 and 144 FPS runs reach the same pose within a small tolerance;
- load: lying after the cast, upright after sinking, lying when over-depth, lying down on a full "rise";
- draft: sink −100 % hides the body, rest draft follows ballast, the drawn image keeps its aspect ratio;
- no allocation per frame (reused records), and the game-cycle report unchanged.

## Owner decisions needed

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Criterion 5 means foreshortening of a lean toward/away from the viewer, plus metric distance scale? | Yes |
| D2 | Bite colours on an image float: halo glow only, or also tint the antenna? | Halo only first; tint needs a separate antenna layer in the art |
| D3 | Waterline ripple ring on dips? | Later, optional stage 4 |
| D4 | The spring adds a short lag (~50 ms at 3 Hz) between a bite step and the visible dip | Accept; tune `naturalFrequencyHz` in the owner's play check |
| D5 | Fish bite data stays as authored (angles, height percents) and is read as forces/draft? | Yes: no fish data migration; a later spec may rename the fields |

## Acceptance

Owner, in `dev.html` and `index.html`, both orientations: diagonal retrieve, rod left/right moves, bites with and
without movement, sharp reversals, lying/standing after the cast and over-depth, heavy/light ballast, wind on/off.
DevTools live edits of the gains and the spring. Phone performance overlay "⚡ ПРОДУКТИВНІСТЬ" in both orientations
after stages 2 and 3. No browser appearance or phone check is performed by the agent.

## Implementation, 2026-10-21 (stages 1 and 2, target v0.46.0)

Owner: "approach the problems fundamentally and start fixing the model per the spec plus your corrections"; D1–D5 are
taken as recommended. Corrections to the plan above, made while implementing:

- **The pose lives in presentation, not in the domain.** It moves no gameplay and has no random numbers, so it is a
  client-side animation like the rod (spec 099): `FloatPoseAnimator` (`src/game/presentation/fishing/`), created in
  `GameRenderComposition` and advanced once per frame by `FishingEquipmentRenderModelBuilder.buildFloat` with the
  clock's frame time and the location's metric. This also fits the backend roadmap: the server never needs it.
- **Motion is measured, not reported.** The animator differentiates the float's map position per frame and converts
  it to ground m/s through `WaterMetric.velocityToBasePlane`, minus the water current. Retrieval, the line constraint,
  the sideways rod move of spec 100, bite slides and live-bait motion all lean the float through this one path. A
  jump beyond three times `maxInputSpeedMetersPerSec` counts as a teleport; a new cast (`castSerial`) places the pose
  on its target.
- **The tackle's intended lean stays the base.** `_currentAngle` / `_currentScaleY` keep their exact values and easing
  (lying after the cast, standing up with the sinking progress, over-depth, bite steps), so the hook window, the wind
  gating and the random numbers are unchanged; the animator adds the forces and the springs. `scaleY` below 1 sinks
  the body, above 1 takes the load off (lift bite: the float leans toward lying), never stretches it.
- **Line pull** is the unit pull direction toward the rod while retrieving, or the sign of the sideways rod move, in
  the update plane, recorded every frame by `FloatEntity._recordPoseInputs` (also while biting).
- **Ballast:** `ballastProfiles.*.heightScale` 1 / 0.85 / 0.7 became `restDraft` 0 / 0.15 / 0.3, which shows the same
  rest length but sinks the bar instead of shrinking it.
- **Limits:** the summed force lean is soft-limited by `maxForceTiltDeg` (tanh); roll and pitch stop hard at
  `±lyingAngleDeg`; the draft spring runs 0..1.5.

| Part | File |
| --- | --- |
| Damped spring (engine, substeps of 1/240 s) | `src/engine/animation/damped_spring.js` |
| Pose model | `src/game/presentation/fishing/float_pose_animator.js` |
| Signals | `FloatEntity.getPoseSignals()`, `_recordPoseInputs`; `WaterEntity._waterVelocity` |
| Config | `CONFIG.physics.floatPose` (`physics_config.js`), `getFloatPoseConfig()`, `physics.floatPose.*` labels |
| Drawing | `buildFloat`: rotation = roll, height = length × surface scale × cos(pitch) × visible share |

Removed: `_updateMotionTilt`, `_motionTilt*`, `_updatePullImpulseTilt`, `_pullImpulse*`, the frame-dependent wind
lerp `_windAngleOffset`, `perspectiveScaleRange` / `_perspectiveScale`, `_weightedTackleHeightScale` (also the
always-1 feeder write), the unused `distanceRatio` argument of `cast()`, `floatMotion` config and its 18 labels.
`getVisualState()` returns only the colour, in a reused record (it allocated per frame before).

Stage 3 was then implemented in the same release (see below). The render model carries the visible share,
so the image only needs the crop in `FloatRenderer` / `PixiFloatRenderer` (source rectangle / texture frame).

Checks: new `float-pose` (the failures it catches are listed at its top; no existing scenario covered the drawn pose)
and `rod-side-tension` migrated from the removed impulse to the line pull. Utils cleanup: no tool became unused.
Full 66/66 (Quick and Architecture included), game-cycle baseline unchanged. Owner visual/play check and the phone
performance overlay in both orientations are pending; the agent performed neither.

## Stage 3: image float and night glow (v0.46.0)

Owner, 2026-10-21: "add the float from the ready asset, twice its initial size, minor version, and a night float that
glows green (additive over the colour, a little blur); the day float must not glow"; then "only the red tip glows".

- Art: the existing item art `assets/items/floats/float-day.webp` (219×2525) is the master. Scene variant
  `assets/items/floats-scene/float-day.webp` (33×384, 4.4 KB) made with
  `node utils/convert-images.js --thumbnails --input assets/items/floats --output assets/items/floats-scene --size 384`
  (rule 6: about 100 logical px × the pixel-ratio cap). The red antenna with its black band ends at 0.295 of the body,
  so the skin's `waterline` is 0.3 (the share above water at rest).
- Night glow `assets/items/floats-scene/float-day-glow.webp` (49×392, 1.6 KB): a colour mask of the red antenna only
  (upper 30 %, red over green/blue), scaled to the scene variant, padded 8 art px on the sides and top, a sharp core
  (0.55) plus a Gaussian blur of sigma 2.6 (0.95), painted green (70, 255, 140). Made once with a scratch script from
  the master; the blur is baked in, so no filter pass runs (rule 23).
- Items: `skin.scene { src, waterline, glow? }` on `float_day` and `float_sliding` (no glow) and a new `float_night`
  (copy of the day float, `variant: "night"`, progression group `float.night`, glow). It is not added to the starting
  inventory (the game-cycle report stays unchanged); DEV's shop grants it.
- Size: `CONFIG.ui.float.displayScale` 2 multiplies the bar and the image. For an image float the item length is
  the antenna above the waterline, so the body is `length × displayScale / waterline` (100 logical px at the shore).
- Draft: the pose animator gets the art's draft (`1 − waterline`); ballast, bite sinks and the line pull sink only the
  part above the art's waterline, so a full sink hides the antenna and a lying float shows the whole body.
- Drawing: Canvas `FloatRenderer` draws the art's top `visibleShare` with a source rectangle, then the glow with
  `globalCompositeOperation = "lighter"`; `PixiFloatRenderer` uses its own cropped texture frames (updated in place) for
  the body and the glow sprite (`blendMode "add"`). Both anchor at the bottom centre on the waterline point and turn by
  the roll. The bite colours stay on the halo (D2). Missing art falls back to the bar.
- Loading: startup preloads every float's scene art and glow and uploads them with the location's backgrounds
  (`sceneLayer.prepare`); a failed load leaves that float a bar.
- Checks: `float-pose` (model size, day/night glow, Canvas crop and additive glow, bar fallback) and `scene-layer`
  (texture-frame crop, reuse, additive glow sprite, no change without a change). Item progression count 24 → 25.

## Stage 4 (planned): the lying float is towed by its bottom

Owner, 2026-10-21, after v0.46.2: when the float lies and moves at the same time (bite slides, retrieve while lying,
current), the whole body shifts at once, which looks wrong. The motion must start at the bottom end, where the line is
attached; the top must follow the bottom by inertia. Owner agreed this is the better model; status: implemented in
v0.46.3 (see "Stage 4 implementation").

### Why the current model cannot do it

Roll and pitch are two independent axes: roll is drawn as rotation, pitch as `cos(pitch)` foreshortening. A lying
float always lies to the left or right (the side drawn at the cast, turned only by a pull's sign), and its body is
drawn as a rigid bar hanging on the attachment point. When the attachment point moves, the bar translates with it; the
direction it lies in never follows the motion. A lean toward or away from the player is drawn shorter by `cos`, which
reaches 0 at 90°: a float lying toward the player would vanish.

### Model

1. **Lean as one vector.** The pose is a lean vector on the water plane `(leanX, leanZ)` in degrees (X sideways,
   Z toward the player); its length is the angle from upright (0 standing, `lyingAngleDeg` lying), its direction is
   where the tip points. The two existing springs move its components (no new state); the force lean is soft-limited
   on the vector's length (tanh), and the total is clamped to `lyingAngleDeg` as a vector, so a diagonal lean is not
   larger than a straight one. A standing float behaves exactly as now.
2. **The lying direction is towed (tractrix follower).** The animator keeps the tip's ground position of a lying
   body: `tip = bottom − ℓ · normalize(bottom − tipPrevious)`, in ground metres (WaterMetric), with `ℓ =
   lying.trailLengthMeters`. When the attachment point (the bottom) moves, the tip is dragged along the line between
   them: the bottom leads, the top swings behind and lines up with the motion after about ℓ of travel. This is the
   classic follower of a towed stick: it depends on the distance travelled, not on the frame rate, has no extra
   state beyond the tip point, and reverses smoothly (a 180° turn swings the tip around, never flips it). At rest the
   direction stays. The cast places the tip on the cast side (the existing `lyingSide`, so the random draw is
   unchanged); a pull's sign no longer flips it, the tow turns it.
3. **Inertia.** The lean springs follow the target `direction × lyingAngle × (1 − load)` plus the forces, so the top
   overshoots a little after a sharp turn (`dampingRatio < 1`) and settles: "the top moves relative to the bottom by
   inertia". Between lying and standing the lying part fades with the load, as now.
4. **Projection with the water's tilt.** The body direction in 3D is `d = (sin θ · ux, cos θ, sin θ · uz)` (θ the
   lean angle, `u` the lean direction, y up). On screen the vertical part keeps its length and the part along the
   water toward the player is flattened by the surface tilt (`metric.surfaceSquashY`, the spec 126 surface ellipse):
   `screen = L · (d.x, −d.y + d.z · squash)`. Rotation = `atan2(screen.x, −screen.y)`, drawn length = `|screen|`.
   A float lying toward the player is shorter by the tilt but never disappears; one lying sideways keeps its full
   length; a standing float is unchanged. This replaces `cos(pitch)` (criterion 5 keeps its meaning).
5. **Attachment point.** The drawn body already hangs on the line's point (its bottom on the waterline, the art
   anchored at its bottom centre), so the bottom is where the motion starts in both renderers; the renderers keep
   reading rotation and length from the model and need no change.

### Configuration

`CONFIG.physics.floatPose.lying.trailLengthMeters` (default 0.25: the body lines up after about 25 cm of tow; larger is
lazier). Label and validation like the other floatPose values. No gameplay value, timing or random draw changes.

### Checks

Extend `float-pose`:
- bottom leads: towing a lying float sideways, the tip ends behind the bottom (opposite to the motion) and the angle
  between them converges within about 3 ℓ of travel; the first frames turn the body gradually;
- a 180° reversal swings the tip around without any frame changing the direction by more than the follower allows;
- distance-based: the same path at 30, 60 and 144 FPS gives the same direction;
- every direction stays visible: lying toward or away from the player is drawn at `squash` of the sideways length,
  never 0;
- the diagonal lean vector is clamped by length; a standing float, the stand-up after the cast and over-depth lying
  keep their current results; at rest a lying float keeps its direction;
- the render model's rotation and length match the projection; scene-layer and Canvas consumers unchanged.

Owner acceptance: `index.html` / `dev.html`, both orientations: a lying float during bites with movement and during a
retrieve moves from its bottom, the top follows and settles; sharp side changes swing smoothly; a float lying toward
the player is shorter but visible; standing behaviour unchanged. Phone performance overlay in both orientations.

### Stage 4 implementation (v0.46.3)

- `FloatPoseAnimator`: the two springs now hold the lean vector's components (`rollDeg` = X, `pitchDeg` = Z); forces
  are soft-limited by the vector's length and the target is clamped by length to `lyingAngleDeg` (TK-025).
- Outside bites the rig's intended lean (`angleDeg`) is not read as a side any more: its value equals
  `lyingAngleDeg × (1 − load)` and the animator lays that magnitude along the towed direction; in a bite the fish's
  step stays a sideways lean (`gains.fish`). With `enabled: false` the old intended lean is shown as before.
- Towing (TK-026): the bottom's ground position (`WaterMetric.toGround`) and the tip point in metres; the tip moves
  with the water, then is placed `trailLengthMeters` from the bottom along their line. Correction found while testing:
  dragged head first (toward its own tip) the follower leaves that balance only after a long tow, so the tip is turned
  toward the player in proportion to how head first the move is; a full head-first reversal lines up after about
  4–6 trail lengths, swinging through the side toward the player (visible, shorter), never flipping.
- Projection (TK-027): `rotationDeg` and `foreshortening` (drawn length share) come from projecting the body; the
  builder uses them. Correction to stage 1: with the camera looking down at the water, a lean **away** from the player
  draws slightly longer and a lean **toward** the player shorter (the old `cos(pitch)` shortened both). A float lying
  toward the player points down the screen at `surfaceSquashY` of its length.
- Config `physics.floatPose.lying.trailLengthMeters` 0.25 with its DEV label. Checks: `float-pose` stage 4 block
  (first-frame turn, trailing after the tow, swing through the player side, smooth steps, rest, 30/60/144 FPS,
  drift, lying toward the player visible, vector clamp, sideways rotation at full length).

### TK-030 daylight correction (v0.46.4)

The night float's outer halo and additive tip overlay are enabled only when the shared
`backgroundTimeBlend` has a night layer. Bootstrap injects `EnvironmentSystem.getSnapshot().time`;
the render-model builder reuses one blend record. The same original red-tipped body remains visible by day,
with no glow even if the optional bite halo is enabled. Existing night/DEV behavior, geometry, state, random
numbers and game-cycle baseline remain unchanged. The already cast float follows sunset and dawn in both
WebGL and Canvas. Existing float-pose and scene-layer scenarios cover these transitions and the switches.
Owner: index/dev, portrait/landscape, night float at noon and midnight, dawn/sunset and live switches;
phone performance overlay in both orientations. No agent visual check or new tool/asset/fixture/dependency.
