# Physics units and naming

## Units

```txt
Kg                  gameplay load/tension unit
Meters              world distance
MetersPerSecond     world speed
Px                  canvas pixels
Ratio               0..1 normalized ratio
Multiplier          gameplay multiplier, usually 0+
Ms                  milliseconds
Seconds             seconds
```

## Simplified fight names

```txt
fishPassiveKg                 fish water weight on taut line
fishActiveKg                  active state/direction fish force
fishOppositionKg              passive + active fish force
fishTensionKg                 fish contribution to line tension
effectiveRodHoldKg            player force against fish after angle/rod limits
holdTensionRatio              part of hold force that becomes line tension
rawPlayerHoldTensionKg        hold tension before movable cap
movableHoldTensionCapKg       max player hold tension while fish can move, based on fishOppositionKg
playerHoldTensionKg           final player contribution to tension
totalTensionKg                fish tension + player hold tension
rodStressRatio                total tension / rod limit
lineStressRatio               total tension / line limit
hookStressRatio               total tension / hook limit
netForceKg                    effective rod hold - fish opposition
speedMps                      movement speed in meters per second
```

## Avoid in fight physics

```txt
pressureTransfer
waterDragCapacity
referencePullSpeedMetersPerSecond
dynamicFishForceKg from relative fish speed
minPowerRatio
maxSpeedMetersPerSec
powerRatio
speedRatio
```
