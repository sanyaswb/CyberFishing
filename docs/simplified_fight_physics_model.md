# Simplified fight physics model

## Goal

Make fish fight balance readable and predictable:

- fish force is passive + active;
- rod hold is the player's main fight force;
- only part of rod hold becomes line tension;
- excess hold on a movable small fish becomes speed, not instant line break;
- reel hold is separate safe line recovery after the rod stroke is full.

## Active production classes

```txt
src/core/fishing/simple_fight_force_calculator.js
src/core/fishing/line_tension_calculator.js
src/systems/fish_force_system.js
src/systems/fish_retrieve_system.js
src/systems/rod_pull_system.js
src/systems/reel_system.js
src/systems/tension_system.js
src/systems/fight_physics_system.js
```

## Removed legacy fight classes

The following old pressure/retrieve-water-drag helpers are no longer part of production:

```txt
FishMotionLoadCalculator
FishPullResistanceModel
FishRetrievePhysicsSettings
FishRetrieveResistanceCalculator
PlayerPressureTransferCalculator
PullWaterDragCalculator
```

`physics.retrieve` still exists for lure/pole/bite gameplay, but it is not the fight tension model.

## Production config groups

```txt
physics.water
physics.fight.directionForce
physics.fight.rodHold
physics.fight.tension
physics.fight.reelHold
physics.tackle
physics.tension.breaking
```

## Fish config rules

Fish fight physics should store only:

```txt
forceProfile.basePower
staminaProfile.*
movementProfile.baseSpeed
behaviorProfile.behaviors[state].forceMultiplier
behaviorProfile.behaviors[state].speedMultiplier
```

Do not store:

```txt
minPowerRatio
maxSpeedMetersPerSec
resistanceProfile
retrieveProfile
powerRatio
speedRatio
```


## Fight movement authority

From `v0.19.7`, hooked fish movement is authoritative from the simplified fight model:

```txt
Fish behavior state smoothing happens inside `Fish.getBehavior()`.
FishForceSystem calculates target velocity from the simplified formulas.
FightPhysicsSystem applies that target velocity directly through `WaterEntity.applyHookedFightMovement()`.
WaterEntity generic velocity damping is not applied to hooked fight movement.
```

This keeps a single source of truth for speed:

```txt
physics.water.motionResistance
physics.water.speedMultiplier
fish.movementProfile.baseSpeed
behavior.speedMultiplier
reel drag escape multiplier
```

`movementProfile.agility` must only smooth transitions between behavior multipliers and directions.
It must not continuously damp stable target speed.

Reel drag is still the official fight speed/tension limiter: increasing drag reduces escape speed and increases tension risk.

## Reel hold rule

`rodHold` moves the fish through force.
`reelHold` only recovers line after full rod stroke and only when safe.
Do not add reel hold into `netForceKg`.
