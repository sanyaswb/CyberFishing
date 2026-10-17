# Lateral control after casting

Implemented in v0.39.0, 2026-10-17. This mechanic is independent from [fight lateral control](rod_lateral_movement.md).

In v0.40.0, actual lateral motion also tightens the visible line and tilts the float opposite the movement through the existing pull responses. Both effects are enabled by default: `physics.castRodControl.lineTension.enabled` and `physics.castRodControl.floatTilt.enabled`. A held boundary input does not keep these effects active. Float tilt adds no retrieval or depth rise; its strength and settling use the established float motion configuration. See [tension compensation and animation feedback](rod_tension_compensation.md).

In v0.41.0, free line length determines both speed and the start of visible tightening. Rod movement through slack runs at **x3** and does not straighten the line. Once the free length ends and the line must draw the tackle, speed becomes **x1** and the existing straightening response starts. This applies to floats and every other tackle type. Ordinary current/drift alone does not select the speed; water-blocked tackle still has a taut line.

## Movement and range

While the tackle is cast (`waiting` or `biting`), use A/D, Left/Right Arrow or a horizontal mouse/touch gesture. Either direction is permitted regardless of fish position. The rod holds its last position when input ends.

Left and right ranges are independent fractions from the original rod center to the corresponding **green castable-zone edge**, projected into the visible game canvas. The default 1 means 100% on that side. For example, left 0.5 and right 1 allow half the distance toward the left edge and the full distance toward the right edge. Default edge padding is zero. Base speed is 100 canvas px/s: defaults give **300 px/s through slack** and **100 px/s with a taut line**, with a 50 ms update cap. Analog input selects a proportional target within that range. Recast aiming temporarily suppresses lateral movement.

When a frame crosses the slack boundary, its time is split between the two speeds immediately. For example, with 10 screen px of slack and a 50 ms frame, the rod spends 33.33 ms at 300 px/s, then 16.67 ms at 100 px/s, moving 11.67 px total. The tackle is not dragged at the fast speed for an extra frame. Reversing toward the tackle can create new slack and restore x3. Both multipliers are live-editable; setting both to 1 restores constant base speed.

`CastRodControl` owns this position. The viewport and visible rod/line read it. It is reset on a new cast or retrieval. A successful strike transfers the moved base into the fight; the existing fight screen padding and clamps still apply. The cast control does not change the fight's alignment setting.

## Tackle movement and bite chance

The controller remembers the cast's initial line reach in ground metres. Moving toward the tackle can create slack. Moving away first uses that slack; additional extension draws the tackle toward the new rod anchor. This motion respects the water lookup and location bounds and does not reel line onto the spool. Ordinary drift and bite animation alone do not count as rod-driven motion.

If lateral rod movement actually moves the float/tackle, the next bite probability tick uses an **absolute 0.1% chance (`0.001`) for each otherwise eligible fish**, except when spinning equipment is used. `BiteSystem` retains the disturbance between frames until a probability tick consumes it, so a short movement cannot evade the rule between ticks. Undisturbed later ticks use the normal chance again. Hook size, depth and bait compatibility still gate eligibility; existing guaranteed-bite cooldowns and explicit DEV chance overrides keep their behavior.

## Moving during a bite

The current bite window is checked before advancing the bite sequence:

| Real player-driven rod displacement | Result |
| --- | --- |
| Normal/non-guaranteed bite window | End that bite and return to `waiting`. |
| Guaranteed bite window | Hook the same fish and enter `playing`, without an extra random strike roll. |
| No actual displacement, including a held key at a boundary | No lateral-motion bite reaction. |

These bite reactions apply to spinning equipment too; its exemption concerns the reduced bite probability. Existing explicit manual strikes retain their existing behavior. A horizontal touch gesture's 120 ms hold does not additionally retrieve or trigger an ordinary manual strike; explicit keyboard pull still works.

## Configuration

Source: [cast_rod_control_config.js](../src/game/config/raw/physics/cast_rod_control_config.js). Runtime path: **`physics.castRodControl`**. All new enable flags default to true. The existing DEV physics editor exposes these settings through [parameter labels](../src/dev/metadata/parameter_labels.json).

| Key below `physics.castRodControl` | Default | Purpose |
| --- | --- | --- |
| `enabled` | `true` | Enables post-cast lateral control. |
| `range.leftRatio` | `1` | Initial center to left green edge, 0..1. |
| `range.rightRatio` | `1` | Initial center to right green edge, 0..1. |
| `range.edgePaddingPx` | `0` | Additional inset at both green edges. |
| `speedPxPerSecond` | `100` | Base rod speed before the phase multiplier; zero stops motion. |
| `speedMultipliers.stationaryFloat` | `3` | Multiplier while free line length remains; applies to any tackle. |
| `speedMultipliers.movingFloat` | `1` | Multiplier once free length ends and the line draws the tackle. |
| `movementEpsilonPx` | `0.001` | Minimum displacement recognized as rod movement per update. |
| `floatDrag.enabled` | `true` | Lets taut cast line draw the tackle after slack is used. |
| `floatDrag.movementEpsilonMeters` | `0.00001` | Minimum applied tackle displacement for a disturbance. |
| `lineTension.enabled` | `true` | Drives existing line straightening during lateral movement only after slack ends. |
| `floatTilt.enabled` | `true` | Drives existing opposite float pull impulse without retrieval. |
| `biteReaction.enabled` | `true` | Enables the bite-window reaction to rod motion. |
| `biteReaction.releaseNormalBite` | `true` | Ends a normal bite on rod motion. |
| `biteReaction.hookGuaranteedBite` | `true` | Hooks on rod motion during a guaranteed window. |
| `movingFloatBite.enabled` | `true` | Enables the motion-dependent bite probability. |
| `movingFloatBite.chance` | `0.001` | Absolute chance per eligible fish at a disturbed bite tick. |
| `movingFloatBite.excludeSpinning` | `true` | Keeps normal bite probability for spinning equipment. |

## Ownership and checks

- [Cast position and line orchestration](../src/game/application/fishing/cast_rod_control.js), [line geometry](../src/game/domain/fishing/cast_rod_line_constraint.js), [bite policy](../src/game/domain/fishing/cast_rod_bite_policy.js).
- [Waiting](../src/game/application/state/waiting_state.js), [biting](../src/game/application/state/biting_state.js), [bite probability and tick accumulator](../src/game/application/fishing/bite_system.js).
- [Feature spec](../specs/100-cast-rod-control/spec.md), [focused deterministic check](../utils/cast-rod-control-check.js).
- [Slack speed and line feedback spec](../specs/102-cast-line-speed/spec.md). `CastRodControl.getFrame().lineTensionActive` is a derived observation for the existing line response; actual `floatMoved` remains the bite-disturbance signal.

Run `node utils/run-checks.js --check cast-rod-control` for the focused check. Wider validation follows the development rules. Save format is unchanged. Owner play acceptance is recorded separately from automated/browser checks.
