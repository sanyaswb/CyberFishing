# Rod animation reference

Verified against the working tree on **2026-10-17**, package version **0.41.0**, including the current Spine implementation. This is a reference for animators and animation integration. Defaults can be overridden at runtime. Fight rules are documented in [Rod lateral movement](rod_lateral_movement.md); waiting/biting movement uses the separate [cast control](cast_rod_control.md).

Free-alignment rod motion toward the fish now reduces real tension while the rod actually moves; see [tension compensation](rod_tension_compensation.md). That mode updates aim before the fight physics, using the preceding fight frame for its speed factors, so the current clamped displacement can affect the current tension calculation. Other modes retain the previous update order. Before a bite, lateral motion drives the opposite float pull impulse; since v0.41.0, line straightening starts only when free line length ends. Cast rod speed is x3 through slack and x1 after that boundary by default. The application owns the rod offset model; rendering observes its position.

## 1. Separate the animation signals

| Visual property | Authoritative input | Meaning |
| --- | --- | --- |
| Horizontal rod-base position | `GameApplication.getRodScreenX()` through `GameViewportFacade` / `RodVisualOffsetSystem` | Player aim offset, already filtered and clamped. |
| Fight bend amount | `TackleStressSystem.getFightFrame().rodStressRatio` | Effective stress tension divided by the rod's effective load limit; clamped to 0..1 by the animation resolver. |
| Fight bend side | Fish/hook screen X minus displayed rod-base X | Left/front/right pose weights, independent from the pressed direction. |
| Idle sway | Wind direction | Left, calm or right idle clip. |
| Visible line start | `RodAnimationController` anchor `tipX`, `tipY` | Animated Spine point/bone, static-pose point or rectangle top. |

The fight frame is a production read model. The parameter named `fightDebug` in the aim/viewport code also receives this production frame; animation does not require the DEV overlay.

The displayed rod base can move left while the rod bends toward a fish on the right. Releasing the lateral key recenters the base but does not clear fish-side bending during a fight.

## 2. Horizontal base movement

The formulas in this section describe fight aim in `playing`. In `waiting` and `biting`, `CastRodControl` supplies the authoritative screen X directly: configurable green-zone ranges, a separate speed and no automatic return on release. The same Spine base and line-anchor rendering consume that X; these fight-aim formulas do not limit cast movement.

### Target and travel range

Default configuration: `physics.fight.rodControl.rodAim`.

```text
maxOffsetPx = max(40, canvasWidth * 0.02)
targetOffsetPx = permittedDirection * maxOffsetPx * inputRatio
rawScreenX = baseScreenX + offsetPx
```

Active aim is accepted only in state **`playing`**, with rod control and rod aim enabled, nonzero direction and positive input ratio. The visual direction resolver rejects `wrong_direction`, a nonpositive `rodControlDirectionFactor`, or a request that disagrees with the physical control direction.

`baseScreenX` is the cast's stored rod screen X when present; otherwise it is `ui.rod.x` (default canvas center). The movement is a screen-space offset around that base, rather than a new cast or camera pan.

`maxOffsetPx` is **40 px** at widths 320, 1000 and 1920; it is **51.2 px** at width 2560. Input ratio 0.5 targets half the range. The ratio scales target distance rather than directly multiplying travel speed.

The displayed X is clamped to the canvas and, by default, the projected playable zone, with **16 px edge padding**. The internal offset may keep approaching its target while screen X is already clamped. `rodVisualStrokeRatio = abs(offsetPx) / maxOffsetPx`; reaching 0.999 marks its internal limit. The viewport also includes screen clamping in `rodVisualAtLimit`.

### Active travel speed

```text
aimSpeedPxPerSecond = 100 * lineMultiplier * fishLoadSpeedRatio * loadSpeedRatio

effectiveFishLoadKg = max(fishWeightKg, fishTensionKg)
loadLimitKg = rodMaxLoadKg, falling back to maxTackleLoadKg
fishLoadRatio = clamp01(effectiveFishLoadKg / loadLimitKg)
fishLoadSpeedRatio = 1.5 - (1.5 - 0.3) * fishLoadRatio^1.0

loadSpeedRatio = 0.35 + (1 - 0.35) * clamp01(rodControlLoadReserveRatio)
```

If effective fish load or its limit is absent/nonpositive, the fish-load speed ratio is **1.5**. A nonnumeric/non-finite reserve ratio falls back to **1** for load speed. An explicitly zero reserve ratio uses **0.35**.

Line mode selection is ordered:

| Priority | Condition used by screen aim | Mode | Multiplier |
| --- | --- | --- | --- |
| 1 | `reelSlip`, `shouldSlipDrag`, or positive `lineReleasedThisFrameMeters` | `drag_slip` / `drag_slip_aim` | 1.3 |
| 2 | Line reserve exists (`lineCanRelease` or positive `lineRemainingMeters`) and free-line visuals are enabled | `free_line` / `free_line_aim` | 1.0 |
| 3 | Otherwise | `tight_line` / `tight_line_aim` | 0.35 |

Here, **free line means spool reserve is available**. It does not necessarily mean the line is slack or that drag currently permits payout. Physical arc projection uses the separate tautness/payout constraint.

Examples with valid direction and a positive reserve ratio of 1:

| Effective fish load / rod limit | Fish-load ratio multiplier | Free-line speed | Tight-line speed | Drag-slip speed |
| --- | --- | --- | --- | --- |
| 0 or missing load | 1.5 | 150 px/s | 52.5 px/s | 195 px/s |
| 50% | 0.9 | 90 px/s | 31.5 px/s | 117 px/s |
| 100% or above | 0.3 | 30 px/s | 10.5 px/s | 39 px/s |

For zero load reserve, multiply those speeds by **0.35**, provided direction remains valid. This is why an aiming rod can move while applied gameplay force is zero.

The current lateral force resolver reports `loadReserveRatio` as **1 when its reserve is positive, otherwise 0**. Do not interpret it as a continuous percentage of unused rod capacity. Fish-load speed is the continuous load-based curve in the current visual implementation.

The fields `rodAimDirectionSpeedRatio` and `rodAimLineSpeedRatio` currently carry the same line-mode multiplier. Fish horizontal movement is recorded for inspection, but it does not add a same-direction/opposite-direction speed multiplier to screen aim. Physical tension direction multipliers are a separate gameplay calculation.

### Return and frame progression

Without a valid active aim request, the target offset is **0** and return speed is:

```text
returnSpeedPxPerSecond = 100 * 1.5 = 150
maxStepPx = speedPxPerSecond * max(0, dtMs / 1000)
offsetPx += sign(targetOffsetPx - offsetPx)
            * min(abs(targetOffsetPx - offsetPx), maxStepPx)
```

There is no overshoot or extra acceleration in this visual offset calculation. The return path ignores fish-load, line-mode and reserve speed factors. Returning from a 40 px offset takes approximately **0.267 s**, assuming updates continue. A blocked direction also uses this return behavior.

With free alignment and toward-fish compensation enabled, offset updating runs before fight physics and uses the same **50 ms gameplay cap**, so current actual motion can compensate current tension. Its speed factors use the previous fight frame. Other modes update after the fight/state update using application milliseconds converted to seconds. Keyboard ramp timing uses the browser's wall clock separately. Do not substitute a fixed-duration left/right clip for these variable target/speed calculations.

## 3. Spine pose mapping

Default configuration: `ui.rod.spine` in [game_config.js](../src/game/config/runtime/game_config.js).

### Fighting: load-sampled poses

```text
side = clamp((fishScreenX - rodBaseX) / max(1, canvasWidth * 0.35), -1, 1)
frontAlpha = 1 - abs(side)
sideAlpha = abs(side)
bendTarget = clamp01(rodStressRatio)
bend += (bendTarget - bend) * (1 - exp(-dtSec / 0.12))
sampleTime = bend * clipDuration
```

| Track | Clip | How it is used |
| --- | --- | --- |
| 0 | Previous wind idle | Fades out on entering `playing`, default 0.25 s. |
| 1 | `rod_fighting-1--front` | Sample at `bend * duration`, weight `frontAlpha`. |
| 2 | `rod_fighting-1--left` or `rod_fighting-1--right` | Select by fish side; sample at the same normalized bend, weight `sideAlpha`. |

At a fish offset of zero, the front pose has full weight. At +/-35% of canvas width, the corresponding side pose has full weight. A fish offset of 17.5% produces a 50/50 blend. The side weights follow the current geometry directly; only bend amount uses the 0.12 s smoother.

The fight clips are **sampled**, with track time scale zero. They are not timed loops. Their approximately **3.333 s** durations do not mean a pull takes 3.333 s. A bend of 0.5 samples halfway through the exported ramp. The skeleton returns to setup bones before applying the current tracks every frame, preventing accumulated deformation.

The front clip keys bone scale; the side clips key rotation. Their authored timelines therefore matter: preserve the intended complementary channels when editing these ramps. Stress can exceed 1 in the gameplay frame, but the animation target saturates at 1. It uses rod stress, not the accumulated tackle-failure meter or the rod-stroke progress bar.

The animated base stays at the resolved screen X and `canvasHeight - ui.rod.yOffset`. Default rod height is **25% of canvas height**, scaled from setup-pose bounds. Its pose can extend sideways from the base; base clamping does not clamp every deformed mesh vertex.

### Outside a fight

| Wind direction | Idle clip |
| --- | --- |
| -1 | `rod_idle-1--left` |
| 0 | `rod_idle-2` |
| +1 | `rod_idle-1--right` |

Wind changes mix over **1 s**. Idle resumes after fighting with **0.4 s** mixing. Bend relaxes toward zero on the **last fight side**, and fight tracks clear when bend falls to **0.001 or below**. This preserves a spring-back on the side where the rod was loaded.

`windRainTimeScale` defaults to **false**. If enabled, a positive rain multiplier changes idle playback speed. Reduced-motion mode sets idle playback speed to zero; the controller still applies load-driven fight poses and bend smoothing.

The rod is prepared/drawn only when the fishing render frame has a float. Before a cast there is no separate idle rod displayed. There are no dedicated cast, bite or break clips wired into the current rod animation controller.

## 4. Animated tip, line and fallbacks

The equipped skin supplies the skeleton, atlas, skin name and line point. The current bamboo rod uses:

```text
assets/animations/rods/bamboo-rod-v1/rod.json
assets/animations/rods/bamboo-rod-v1/rod.atlas
skin: rod-1
linePoint: line-tip
```

`FishingEquipmentRenderModelBuilder.prepareRod()` advances the rod once for the render frame. `buildRodLine()` reads that same anchor's `tipX` and `tipY` as the line start. The Spine adapter can resolve a named point attachment, a named bone, then the deepest usable bone tip. If no animated point resolves, the controller uses a top-of-bounds fallback.

| Available representation | Rod and line attachment |
| --- | --- |
| Spine scene available | Animated skeleton and its current line point. |
| Bundle/setup picture available, runtime/WebGL unavailable or context lost | Static atlas picture and setup-pose point, with top-of-bounds fallback. |
| No animated skin or usable picture | Legacy 3 x 200 px rectangle; line starts at `baseX, baseY - 200`. |

The same screen base offset applies to these representations. Spine fallback does not remove lateral gameplay control. The animated line point is a **presentation** position and never becomes the physical Spine-tip anchor. Gameplay reads its rod position through application world callbacks. In the current `PlayingState` composition, the base-position helper falls back to `getRodVirtualPos()`, which includes the screen offset; distance/line constraints can therefore follow that offset. The optional `cast_base` alignment target is captured separately at the first fight update. See [StateDepsFactory](../src/game/application/state/state_deps_factory.js) and [PlayingState](../src/game/application/state/playing_state.js) before changing this behavior.

## 5. Signals to inspect

| Signal | Use |
| --- | --- |
| `rodControlActive`, `rodControlInputDirectionX`, `rodControlInputRatio` | Requested control; these alone do not prove force or movement was delivered. |
| `rodControlDirectionX`, `rodControlDirectionFactor`, `rodControlBlockedReason` | Permitted physical direction and intent/force rejection. |
| `rodControlMovementBlockReason` | Geometric/environmental movement limit; inspect together with the intent reason. |
| `rodVisualOffsetX`, `rodVisualTargetOffsetX`, `rodVisualDeltaX` | Current internal offset, target and actual offset change. |
| `rodVisualMaxOffsetX`, `rodVisualStrokeRatio`, `rodVisualAtLimit`, `rodVisualClamped` | Visual travel range and clamping; unrelated to physical rod-stroke capacity. |
| `rodAimSpeedPxPerSecond`, `rodAimLineMode` | Computed approach speed and line category; actual delta is smaller near target or zero at target. |
| `rodAimWeightSpeedRatio`, `rodAimLoadSpeedRatio`, `rodAimLineSpeedRatio` | Factors in the active aim speed calculation. |
| `rodControlVisualDrivenByInput`, `rodControlVisualMode` | Active aiming versus `return`. The flag can remain true after the target is reached. |
| `rodStressRatio` | Bend source before animation clamping/smoothing. |
| Controller `getStatus().bend`, `.side`, `.mode` | Current smoothed bend, last/current fight side and representation. |

The DEV diagnostics snapshot additionally exposes requested/applied fish movement, force, tension mode, angle, control build and movement mode. Those extended diagnostics are composed in DEV; the ordinary production fight frame does not contain every diagnostic field. Read returned frames as observations, not writable gameplay state.

The rod-control HUD bar shows **input percentage and direction**, plus delivered lateral tension in kg. A full bar is not a completed movement, maximum physical stroke or guarantee that the fish moved. In same-direction tension mode, the kg label can be zero despite valid force and movement.

## 6. Input and configuration caveats

- `rodAim` is the active speed-based screen movement configuration. Several `rodVisual` fields remain in config but are not read by `RodVisualOffsetSystem`: `moveResponsiveness`, `returnResponsiveness`, `freeLineResponsiveness`, `tightLineFollowsAppliedFish`, `followFishMovementRatio` and `weightSpeed`. They do not currently tune the motion.
- `rodVisual.freeLineUsesInputDrivenVisual` is still read. Range/padding/clamp settings in `rodVisual` also act as fallbacks when corresponding aim settings are absent.
- Browser input uses gesture lock, direction hysteresis and width-dependent full-power distance. The action composer's pointer fallback recalculates from current raw displacement, uses the fallback distance, and has lower priority than browser control. Avoid using its fallback in isolation as a perfect browser-gesture simulation.
- Keyboard direction switches do not reset the browser's stored ratio while lateral input remains active. The fight composer substitutes full keyboard input when the supplied ratio is zero. Releasing and repressing can retain part of the decaying ratio.
- The visual system receives the browser's raw lateral fields; physics uses composed `fightActions`. It then feeds permitted direction and block reasons back through the production fight frame. Custom input integrations should provide consistent values for both paths.
- Runtime `rodControl.tensionCeilingMultiplier = 1.15` is a fallback for the lateral system without an external force budget. The normal pipeline supplies that budget and uses `playerForceBudget.tensionCeiling` (default multipliers 1.0).
- Many screen/input numeric reads use `Number(value) || fallback`. Setting such a parameter to zero can restore a fallback rather than stop motion. Use the dedicated enable flags where supported.

## 7. Source map and existing checks

| Responsibility | Source |
| --- | --- |
| Aim target, speed, return, clamps | [rod_visual_offset_system.js](../src/game/application/fishing/rod_visual_offset_system.js) |
| State gating, screen/base positions, visual frame fields | [game_viewport_facade.js](../src/game/presentation/viewport/game_viewport_facade.js) |
| Update order and public rod X | [game_application.js](../src/game/application/session/game_application.js) |
| Load/side/wind to pose snapshot | [rod_animation_state_resolver.js](../src/game/presentation/fishing/rod_animation_state_resolver.js) |
| Bend smoothing, tracks, line anchor, fallback modes | [rod_animation_controller.js](../src/game/presentation/fishing/rod_animation_controller.js) |
| Frame-independent scalar smoothing | [scalar_smoother.js](../src/engine/animation/scalar_smoother.js) |
| Track sampling and bone/point queries | [spine_scene.js](../src/platform/browser/animation/spine_scene.js) |
| Render context and line attachment | [fishing_equipment_render_model_builder.js](../src/game/presentation/fishing/fishing_equipment_render_model_builder.js) |
| Scene visibility | [fishing_render_frame_builder.js](../src/game/presentation/rendering/fishing_render_frame_builder.js) |
| Rod stress source | [tackle_stress_system.js](../src/game/domain/fishing/tackle_stress_system.js) |
| Extended DEV movement diagnostics | [fight_diagnostics_snapshot_builder.js](../src/dev/fishing/fight_diagnostics_snapshot_builder.js) |
| Rod-control HUD meaning | [fight_hud_frame_builder.js](../src/game/presentation/hud/fight_hud_frame_builder.js) |

Existing checks relevant to changes in this area:

```sh
node utils/run-checks.js --check platform-runtime
node utils/run-checks.js --check spine-rod
node utils/run-checks.js --check game-cycle
```

`platform-runtime` covers visual offset/frame behavior; `spine-rod` covers the export, runtime adapter, pose resolver/controller and line attachment; `game-cycle` checks behavior against the tracked gameplay baseline. Use the project's required wider checks and index/dev browser smoke when changing runtime behavior. These documents themselves do not change runtime behavior.
