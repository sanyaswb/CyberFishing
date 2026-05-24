# CyberFishing physics units and naming convention

This document fixes the language used by physics configs, debug output and balancing tools.

## Gameplay load unit

Values ending with `Kg` are **gameplay load kilograms**. They are calibrated against rod, line and reel max-load values. They are not real-world Newton force values.

Examples:

```txt
lineMaxLoadKg
playerPullPressureKg
waterDragCapacityKg
totalFishForceKg
```

## Required suffixes

Use explicit suffixes whenever a parameter stores a measurable value:

```txt
...Px                     pixels
...PxPerSec              pixels per second
...Meters                world meters
...MetersPerSecond       world meters per second
...Kg                    gameplay load kilograms
...Ratio                 usually 0..1
...Percent               usually 0..100
...Ms                    milliseconds
...PerSecond             per-second rate
...Deg                   degrees
```

Good examples:

```js
referencePullSpeedMetersPerSecond
landingDistanceMeters
speedLoadKgPerKgPerMps
looseLineTautToleranceMeters
breakThresholdPercent
```

Avoid vague global names:

```js
force
speed
resistance
distance
multiplier
```

A nested `Multiplier` is acceptable when the parent path gives enough context:

```js
fish.physics.retrieveProfile.waterDragMultiplier
physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier
```

## Recommended domain terms

Use these terms consistently:

```txt
motionLoad                 load produced by fish movement through water
passiveBodyResistance      passive body resistance on a taut line
activeAwayResistance       active fish force when it pulls away from player
pullWaterDrag              water drag while player retrieves the fish
playerPressure             raw pressure produced by rod/input/tackle
pressureTransfer           how much player pressure becomes line tension
lineTension                final load on tackle
```

## Validation rule

Every numeric/boolean leaf under `CONFIG.physics` must have a label in:

```txt
src/config/metadata/parameter_labels.json
```

Run:

```bash
node utils/validate-config.js
```


## v0.18.0 cleanup

- `physics.retrieve.passive.power` was renamed to `physics.retrieve.passive.passiveRetrievePowerRatio`.
- Open-ended item ranges use `max: null` and `openEnded: true` instead of `Infinity`.
- `validate-config.js` should pass with zero errors and zero warnings before a patch is delivered.
