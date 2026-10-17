# Rod lateral movement: controls and gameplay

Verified against the working tree on **2026-10-17**, package version **0.40.0**, including the current Spine work. This document describes fight movement. For waiting/biting, see [Lateral control after casting](cast_rod_control.md). For the free-alignment addition, see [tension compensation](rod_tension_compensation.md). Numbers below are production defaults; runtime configuration and DEV overrides can change them.

For screen movement formulas, Spine poses and animation signals, see [Rod animation reference](rod_animation_reference.md). For line and pull-stroke terminology, see [Line and rod stroke debug model](line_and_rod_stroke_debug.md).

## 1. What moves

Three things can move sideways, with different rules:

| Movement | Driver | Result |
| --- | --- | --- |
| Rod base on the screen | Player's lateral input, filtered by the fight's permitted direction | A limited horizontal offset around the rod's base position. |
| Hooked fish in the simulation | Applied lateral force, geometry, line constraints and water boundaries | Changes the fish/float position and contributes to fight pressure and tension. |
| Rod bend and animated tip | Fish position relative to the displayed rod base, plus rod stress | Selects/blends the Spine fight poses; the visible line follows the animated tip. |

These signals can differ. For example, when a fish is on the right, a valid **left** input moves the rod base left and pulls the fish toward the base anchor, while the rod can still **bend right** toward the fish.

The `cast_base` alignment target is captured when the fight first updates. Rod/line distance calculations use the position supplied by the application's world callbacks. In the current production state composition, `PlayingState` falls back to `getRodVirtualPos()` because its world dependency does not expose `getBaseRodVirtualPos()`; consequently the horizontal screen offset can also shift the physical rod anchor. The animated Spine tip is separate and does not feed back into that anchor. Do not assume all screen movement is purely cosmetic.

## 2. When lateral control is available

| Situation | Player-driven lateral fight movement |
| --- | --- |
| Scouting / preparing a cast | Inactive. During cast aiming, A/D or the arrow keys can move the cast target using a separate casting system. |
| Casting | Fight control inactive during cast travel. |
| Waiting for a bite, biting | Separate [cast lateral control](cast_rod_control.md), enabled by default; movement can affect the tackle and bite outcome. |
| `playing`: fish hooked and fight running | Available when direction, geometry, force and movement constraints permit it. |
| Fight ended / state changed to victory or failure | Inactive. Any remaining screen offset approaches zero; Spine bend relaxes. Visibility depends on whether the fishing scene still has a float. |
| Game loop paused | No movement update runs. |

Lateral control works with reel-equipped rods and poles without reels. Having a reel or drag is not a prerequisite for lateral control. Their presence changes line release, recovery and fatigue behavior.

During active cast aiming, the same left/right keys change the cast target's screen X at **420 px/s** by default (`casting.keyboardAimSpeedPxPerSecond`), with the casting system's own screen limits. This is separate from fighting. The committed cast can supply the stored rod screen X around which later fight aim is displayed.

`physics.fight.rodControl.enabled = false` disables lateral gameplay control and active screen aim. `rodControl.rodAim.enabled = false` disables active screen aim separately; it does not switch off the gameplay force system.

## 3. Controls

### Keyboard

| Input | Action during a fight |
| --- | --- |
| A / Left Arrow | Request left control (`directionX = -1`). |
| D / Right Arrow | Request right control (`directionX = +1`). |
| Left and right together | Keyboard lateral direction cancels to zero; pointer input can still be active. |
| Space | Hold/pull with the rod; can be combined with lateral control. |
| Release Space | Enables automatic reel recovery when a reel is present. Lateral keys remain independent. |
| Shift | Manual retrieve request when not pulling. |

The browser builds a keyboard input ratio from 0 to 1 over **0.25 s** of holding a lateral key and decays its stored ratio over **0.18 s** after release. The ratio controls requested strength and screen target distance. Releasing the key makes keyboard lateral control inactive immediately; the decay is not a continued sideways movement or the rod's return speed.

The fight action composer has a zero-ratio fallback to full keyboard input (`ratio || 1`). Consequently, a key can produce a full-strength request on the initial zero-elapsed-time read before the browser ramp advances. Physical force still has its own build-up described below.

Keyboard lateral input takes priority over pointer lateral input. While browser lateral control is active, W/S and Up/Down do not emit drag-adjustment actions.

### Mouse / touch on the game canvas

1. Press the primary mouse button or touch the canvas. The press position becomes the gesture's horizontal anchor.
2. Move predominantly horizontally: activation requires at least **10 px** of movement and `abs(dx) >= abs(dy) * 1.25`.
3. Once horizontal control locks, it remains the browser gesture mode until release/cancellation. Direction and strength use displacement from the original press, not pointer velocity or distance moved in the last frame.
4. The input is zero inside the **12 px** horizontal dead zone. Full power is reached at `max(90 px, canvas.clientWidth * 0.20)`.
5. To reverse an existing direction, cross the original anchor by at least **24 px**. Between the dead zone and this reversal threshold, the previous direction is retained.
6. Release/cancel the pointer to end the gesture. Losing window focus clears keyboard and pointer control.

These input thresholds use browser pointer/CSS coordinates. They are separate from the simulation's ground-plane distances and the rod's drawing coordinates.

A horizontal gesture can also hold/pull after **120 ms** from the initial press. Thus one touch can produce both rod hold and lateral control. A vertical drag can select drag adjustment when supported; an already selected `DRAG_CONTROL` gesture does not switch to the browser's horizontal mode. Horizontal control cancels long-press detection and takes precedence over later vertical drag activation.

The application action composer also supports a pointer fallback from raw displacement, using the configured **90 px** full-power distance. Normal browser-locked control has higher priority and uses the width-dependent distance above. Raw-input fixtures or integrations can therefore differ from normal canvas gestures; see the [animation reference](rod_animation_reference.md#6-input-and-configuration-caveats).

## 4. Which direction is permitted

### Normal start: fish off center

The current owner configuration has **`alignment.enabled = false`** (free directions). The rules in this subsection describe the available alignment-enabled mode. Its target mode is **`cast_base`**. `PlayingState` captures the rod base when the fight first updates, and that anchor stays fixed for the fight. The alternative **`current_base`** follows the current base. If no captured anchor is available, the current base is used.

With alignment enabled:

| Fish relative to the target anchor | Effective control direction |
| --- | --- |
| More than 8 simulation px to the right | Left only. |
| More than 8 simulation px to the left | Right only. |
| Within 8 simulation px of the anchor's X | Already aligned; normal lateral force stops. |

These are ground-plane base pixels. At the default **50 px/m**, the alignment tolerance is **0.16 m**. Perspective can make its apparent screen size different.

The system pulls toward the anchor instead of allowing unrestricted left/right steering. It limits the requested step to the remaining alignment distance, and the movement stage also prevents a smoothed step from overshooting the target X.

### Special start: fish exactly centered

If a new active control session begins within **0.5 simulation px** of the anchor's X (**0.01 m** at 50 px/m), a special `center_start` session can begin:

- The first nonzero input direction is remembered for that session.
- Force geometry uses `angleRatio = 1`, even though the initial line angle is almost zero.
- Normal alignment stopping and the anchor-X movement limit are removed for this session.
- Opposite input is rejected while the session remains active. Ending control clears the remembered direction; the next session evaluates the current fish position again.

A fish between 0.5 and 8 px from center is aligned but does not qualify for this special start. Bounds, water, line and fight-sector constraints still apply to centered starts.

With `alignment.enabled = false`, either input direction is accepted, geometry uses a full angle ratio and there is no alignment-distance cap.

## 5. What determines gameplay speed

### Geometry and force build-up

For a normal, correctly directed request:

```text
dx = abs(fishX - targetAnchorX)
dy = abs(targetAnchorY - fishY)
lineAngleDeg = atan2(dx, max(1, dy)) * 180 / PI
angleRatio = clamp01(lineAngleDeg / 20)
baseRequestedForceRatio = inputRatio * angleRatio * directionFactor
```

`directionFactor` is 1 for the permitted direction and 0 otherwise. Aligned fish have zero angle ratio, except for `center_start`, which uses 1. A larger lateral line angle increases available control up to **20 degrees**. At a greater distance from shore, the same sideways offset generally produces a smaller angle and weaker control.

With the default tension-build system, `controlBuildRatio` increases toward the requested ratio at **4 units/s**. Eligible hold + control increases this build rate by **1.5**, to **6 units/s**. Starting from zero, a full ratio takes 0.25 s or approximately 0.167 s respectively, assuming a full input/angle target throughout. The browser input ramp and movement inertia add their own response time.

The delivered request is the smaller of the geometric request and the built ratio. Lowering the target clamps the build ratio immediately; inactive or zero-strength control resets it. The combined-input bonus accelerates build-up; it does not multiply the final force by 1.5 while the tension-build system is enabled.

### Available force and fish movement direction

The default force-budget allocator uses the rod's **effective** maximum load and the fish's current tension:

```text
totalPlayerBudgetKg = max(0, rodLimitKg * combinedCeilingMultiplier - fishTensionKg)
controlBudgetKg = totalPlayerBudgetKg * controlShare
effectiveForceLimitKg = controlBudgetKg / max(1, tensionMultiplier)
rawForceKg = effectiveForceLimitKg * requestedForceRatio
forceKg = rawForceKg * playerPressureEfficiency
```

Default ceiling multipliers are **1.0**. Control alone gets the full eligible player budget. With hold + control, default allocation mode **`independent`** gives each channel its own full budget share. The configured `control.maxBudgetShare = 0.5` applies only to the alternative **`split`** mode; it is not a permanent 50% control cap.

The fish's autonomous target velocity is projected onto the horizontal control axis to choose the tension multiplier:

| Fish movement versus permitted control axis | Classification | Added lateral tension | Force-limit divisor |
| --- | --- | --- | --- |
| Mainly in the same direction | Normalized projection >= 0.35 | `forceKg * 0.0` | 1 |
| Mainly across the axis, or speed below 1 simulation px/s | `side` | `forceKg * 1.0` | 1 |
| Mainly opposite | Normalized projection <= -0.35 | `forceKg * 2.5` | 2.5 |

This is based on the **2D target velocity**, not just the sign of horizontal speed. The same-direction case can move the fish while contributing zero lateral tension. Pulling against the fish costs more tension per unit force and yields less sideways force for the same budget.

With alignment disabled, [toward-fish compensation](rod_tension_compensation.md) is applied separately to final line tension. It compares actual clamped rod movement with the fish's occupied side, accumulates relief faster at higher loads, and clears it when movement stops. This rule uses fish position rather than the velocity classification above.

Equipment condition and effective stats can affect the rod limit and therefore the budget. Fish weight influences physical control through fish force/tension and behavior; it is not directly divided into the lateral speed formula.

### Force becomes a movement request

```text
speedMetersPerSecond = sqrt(forceKg / motionResistance)
                       * waterSpeedMultiplier
                       * sidePullSpeedMultiplier
requestedMeters = speedMetersPerSecond * dtSec
```

Defaults: **motion resistance 1000**, **water speed multiplier 64**, **side-pull multiplier 1**. Before later limits, 1 kg of lateral force requests approximately **2.024 m/s**, and 4 kg requests approximately **4.048 m/s**. Doubling force increases this speed by `sqrt(2)`.

The request is capped by alignment distance, then passes through exponential X-axis movement smoothing with a **0.16 s** time constant. When control cannot apply, the smoother's X axis resets immediately. Constraints reconcile its stored velocity to prevent accumulated movement at an obstacle.

Fight `dtSec` is capped at **0.05 s** per update. Distances are ground distances through the location's water metric; simulation px are converted with the default 50 px/m. Screen perspective can change the visible speed without changing the physical speed.

## 6. When movement is blocked or shortened

| Condition | Gameplay effect | Screen rod behavior |
| --- | --- | --- |
| No active input / dead zone | No lateral force. | Returns toward zero offset. |
| Wrong direction | `wrong_direction`; no lateral force. | Active sideways aim is rejected; returns toward zero offset. |
| Normally aligned fish | `aligned`; no normal lateral force. | Returns toward zero offset because effective direction is zero. |
| No valid fish point / no usable angle | `no_fish` / `angle_too_small`. | Depends on the resolved direction and direction factor; there is no universal visual block for every reason. |
| No load reserve | `no_load_reserve`; no lateral force. | May still approach a valid aim target at the minimum load-speed factor. |
| No delivered force | `no_force`. | Visual aim is evaluated independently from delivered force. |
| Taut line that cannot pay out | Outward movement is projected onto the released-line circle. | Aim uses its line-state speed multiplier. |
| Water edge / map bounds | Step stops or is shortened at the permitted point (`water_blocked`, `bounds_blocked`). | The screen rod can continue aiming within its own bounds. |
| Fight-sector limit | Step is restricted (`pole_fight_sector`); default sector is +/-50 degrees with a 3 m shore opening. | This does not directly freeze screen aim. |
| Screen or playable-zone edge | Fish movement still follows physical constraints. | Displayed rod X clamps with 16 px padding. |

Line lock is conditional: `radialConstraintActive = tautLine && !dragCanPayout`. Tautness starts at a distance/released-length ratio of **0.995**. With no radial constraint, lateral movement uses `free_x`. With a locked, taut line, inward movement can still use `locked_free_x`; a step that would exceed the available radius transitions to `locked_arc`. The fish can therefore change Y while receiving horizontal control.

An empty spool does not universally disable lateral movement. It can activate the radial constraint. Drag holding or slipping does not independently set a lateral force cap in the current implementation: the force resolver reports `dragLimited = false`. Drag affects payout, movement geometry, tension and presentation speed. The resolver retains a `drag_limit_reached` diagnostic branch, but its current force calculation does not activate that branch.

## 7. Gameplay consequences

### Fish positioning and line tension

Valid control brings an off-center fish toward the fight anchor. Geometry determines whether that shortens its distance or moves it along a fixed-length arc. It does not automatically reel line onto the spool. Lateral tension joins the fight's tension calculation, affecting stress and equipment-failure evaluation. During an active landing lift, the lift calculation supplies final tension instead of simply adding lateral tension to it.

The horizontal system has no separate finite left/right stroke capacity. Physical `RodStrokeState` tracks unrecovered pulling distance. The orchestrator measures that stroke **before lateral control is included** (the before-pull and after-pull line states), so lateral movement is not itself booked as won rod-stroke distance. The screen's `rodVisualStrokeRatio` is a separate normalized visual offset.

### Fish stamina and endurance

Applied lateral force contributes to fish stamina pressure. Under the default linear lateral weighting:

- Near center, hold pressure has weight **1.0**, control pressure **0.1**.
- At full lateral angle ratio, hold pressure has weight **0.1**, control pressure **1.0**.
- Control toward center has direction multiplier **1.0**; neutral/no-direction uses **0.5**, wrong-direction uses **0.15**.

These are pressure weights, not guaranteed damage or movement multipliers. Wrong-direction gameplay force is normally already zero. Actual drain also depends on pressure thresholds, fish resistance, stamina phase and fatigue; active pressure can also contribute to endurance drain. Releasing ineffective control can allow stamina regeneration. The line angle also affects regeneration when regeneration is allowed: default multipliers rise from **1.0 at 15 degrees** to **1.5 at 75 degrees** and **2.0 at 90 degrees**.

The lateral weighting uses the control's normalized angle context. A `center_start` session forces that ratio to 1, so it can receive the high control weight even near the anchor. Exactly at zero lateral offset, its stamina direction classification is neutral and applies the 0.5 direction multiplier.

### Player fatigue

The default fatigue source is **`reel_hold_session`**. A session starts when hold-driven reel recovery engages and continues while the player keeps holding, even if recovery momentarily stops. Simply holding A/D, or using a pole with no reel recovery, does not by itself start this fatigue source.

Once the session is active, fatigue has a **3 s grace period**, followed by **6 s** of decline toward **45% force efficiency**, using curve power **1.2**. The efficiency scales lateral force as well as rod hold. This indirectly reduces physical movement speed through the square-root force formula; it is not a direct multiplier of screen aim speed.

Control exhaustion requires both **8 s** of continuous source pressure and **90% fatigue progress**. From a fresh default session, the latter is reached at approximately **8.4 s**. Exhaustion removes effective player pressure from the stamina calculation; it does not directly disable lateral input or set its physical force to zero. Releasing hold ends the reel-fatigue session. Efficiency recovery begins after **400 ms**, at **0.8 efficiency units/s**.

## 8. Useful scenarios for animation work

| Scenario | Expected distinction |
| --- | --- |
| Fish right of anchor, press left | Rod base travels left; fish is pulled left; Spine can remain bent right. |
| Fish right of anchor, press right | Wrong direction; no lateral force, rod base returns toward neutral. |
| Fish starts exactly centered, press either side | First direction starts a centered session; reversing requires ending that session first. |
| Fish is within alignment tolerance but outside centered-start tolerance | Side force is blocked, even with a held key. |
| Fish consumes the full rod load budget | Physical side force can be zero while valid screen aim still moves slowly. |
| Taut locked line | Fish can travel on an arc; visible rod movement and fish X movement need not match. |
| Rod reaches its visual offset or screen edge | Base stops visually; valid gameplay control can continue. |
| Release lateral input while a fish remains hooked | Base returns at its return speed; Spine still follows fish side and stress. |

## 9. Implementation sources

- [Input defaults and stamina settings](../src/game/config/runtime/game_config.js), [fight defaults](../src/game/config/raw/physics/fight_physics.js), [water defaults](../src/game/config/raw/physics/environment_physics.js), [physics adapter](../src/game/config/physics/fight_physics_config_adapter.js).
- [Browser input](../src/platform/browser/input/input_controller.js), [fight action composition](../src/game/application/input/fight_input_action_composer.js), [cast aiming](../src/game/application/casting/cast_power_aim.js).
- [Fight lifecycle and captured anchor](../src/game/application/state/playing_state.js), [ground-plane entry](../src/game/application/fishing/fishing_force_service.js), [coordinate conversion](../src/game/application/world/ground_plane_scope.js).
- [Lateral intent, force and speed](../src/game/domain/fishing/rod_lateral_control_system.js), [angle](../src/game/domain/fishing/rod_control_angle_resolver.js), [tension direction](../src/game/domain/fishing/rod_control_tension_mode_resolver.js), [force budget](../src/game/domain/fishing/player_force_budget_allocator.js).
- [Movement and boundaries](../src/game/application/fishing/fight_rod_movement_stage.js), [movement projection](../src/game/domain/fishing/rod_control_movement_projector.js), [line lock](../src/game/domain/fishing/line_constraint_state_resolver.js), [inertia](../src/game/domain/fishing/player_pull_motion_smoother.js), [fight sector](../src/game/application/fishing/fight_pole_sector.js).
- [Pipeline and rod-stroke measurement](../src/game/application/fishing/fight_physics_orchestrator.js), [final tension and landing lift](../src/game/application/fishing/fight_landing_tension_stage.js).
- [Stamina frame](../src/game/application/fishing/fight_stamina_frame_builder.js), [stamina pressure](../src/game/domain/fishing/stamina/stamina_pressure_resolver.js), [stamina phases](../src/game/domain/fishing/stamina/stamina_phase_machine.js).
- [Fatigue orchestration](../src/game/application/fishing/fight_player_pressure_stage.js), [fatigue source](../src/game/domain/fishing/player_pressure/player_pressure_fatigue_source_resolver.js), [reel session](../src/game/domain/fishing/player_pressure/player_reel_fatigue_session.js), [fatigue calculation](../src/game/domain/fishing/player_pressure/player_pressure_fatigue_calculator.js).
