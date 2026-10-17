# Rod tension compensation

Available in v0.40.0. During a fight, disable `physics.fight.rodControl.alignment.enabled` to allow free lateral aim. Moving the rod toward the fish's current side then relieves line tension while the rod actually moves. This provides a short opportunity to counter a dash by following the fish with the rod.

Fish position determines the side; fish swimming direction does not. If the fish is right of the rod, move right. If it is left, move left. Holding against a limit, releasing the control, the automatic return, moving away or a centered fish gives no relief. The accumulated compensation resets immediately on those frames. The displayed tension returns through its existing smoothing; the gameplay load immediately resumes its ordinary value.

Configuration in `physics.fight.rodControl.tension.towardFishCompensation`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Enables relief in free alignment mode. |
| `ratePerSecond` | `4` | Relief response per second at a load equal to the rod limit. Zero disables the effect. |
| `loadCurvePower` | `1` | Power applied to the current load/rod-limit ratio. Larger loads accelerate relief. |
| `movementEpsilonPx` | `0.001` | Minimum actual screen displacement per update. |

Let `T` be uncompensated tension, `L` the rod's load limit, `C` the previous relief and `dt` the moving part of the frame. The response is:

```text
rate = ratePerSecond * (T / L) ^ loadCurvePower
C = min(C, T) + (T - min(C, T)) * (1 - exp(-rate * dt))
supported tension = T - C
```

For example, with a 10 kg rod, an 8 kg load and a 50 ms full-motion frame, initial relief is about 1.18 kg. At 16 kg the same frame relieves about 4.38 kg. Continued motion accumulates relief; a stop resets it to zero. A partial frame that reaches a limit receives only its moving fraction. The constant-load response is consistent across frame rates.

Compensation reduces the load passed into final tension, drag resolution and tackle stress. Fish and player load components are scaled together, so an unreduced diagnostic component cannot bypass the relief. `uncompensatedTensionKg`, `rodSideReliefKg` and `rodSideReliefActive` remain available in the fight frame/DEV diagnostics. Fish motion and dash force generation retain their existing rules.

Before a bite, `physics.castRodControl.lineTension.enabled = true` makes lateral motion use the same line extension and straightening as pulling **once the free line length ends**. It remains inactive through slack and relaxes after motion stops. Since v0.41.0, this boundary also switches rod speed from x3 to x1 by default for any tackle; see [cast control configuration](cast_rod_control.md). `physics.castRodControl.floatTilt.enabled = true` passes lateral displacement into the float's existing opposite pull impulse. Its angle, response and settling use the existing float motion configuration (`pullImpulseOvershootDeg`, `pullImpulseResponseSpeed`, `pullImpulseDecaySpeed`). This adds no retrieval force or depth rise. Both flags default to true and can be edited live in DEV.

See [cast controls](cast_rod_control.md), [lateral movement](rod_lateral_movement.md), [animation reference](rod_animation_reference.md) and [feature spec](../specs/101-rod-side-tension/spec.md).
