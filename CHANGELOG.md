# CyberFishing changelog

## v0.19.40 - Rod Control input isolation

- Locked horizontal pointer gestures to the dedicated `rod_control_x` action so they cannot silently activate Rod Hold.
- A new pointer press can start Rod Hold normally after Rod Control is released.
- Landing completion now uses authoritative lift and total-tension state instead of waiting for the visually smoothed tension meter.
- Fixed zero-distance handling in landing policies.
- Added regression coverage for `Rod Control -> release -> Rod Hold` and mandatory victory for the 0.05 kg catch scenario.

## v0.19.39 - Tension ceiling semantics

- Clarified that `tensionCeilingMultiplier` scales the maximum allowed total tension, not player force.
- Debug rows now explicitly display the maximum allowed total tension as a percentage of the rod limit.
- Documented that input, angle, fish resistance, and drag can keep actual tension below the ceiling.
- Kept the current `1.05 / 1.15` balance values while preserving `1.0` as the engine fallback for configs without these fields.

## v0.19.38 - Player tension ceilings

- Added independent tension ceiling multipliers for Rod Hold and Rod Control.
- Rod Hold reserve now derives from its configured ceiling instead of stopping at 100% rod load.
- Rod Control reserve uses the current-frame total after Rod Hold, preventing overload budgets from stacking.
- Direction tension multipliers still control lateral risk without bypassing the Rod Control ceiling.
- Added ceiling diagnostics, formulas, parameter labels, and overload regression coverage.

## v0.19.37 - Rod Control axis tension mode

- Added `RodControlTensionModeResolver` for immutable same/side/opposite direction classification.
- Rod Control tension now compares autonomous fish velocity with the normalized control axis.
- Direction classification uses normalized alignment instead of the sign of raw canvas X velocity.
- Added configurable same-direction, opposite-direction, and minimum fish-speed thresholds.
- Preserved the existing `0 / 1 / 2.5` tension multipliers and legacy `fishVelocityX` fallback.
- Added alignment, projection speed, autonomous speed, and control-axis debug diagnostics.
- Added regression coverage for horizontal, vertical, diagonal, near-zero, rotated-axis, threshold, and legacy cases.

## v0.19.36 - Fish direction profile fallback

- Added base `radialRange` and `lateralRange` settings to fish movement profiles.
- Added `FishDirectionIntentSampler` for isolated radial/lateral intent sampling.
- Fish behavior now resolves direction ranges by state override, movement profile, then engine default.
- State direction overrides can provide radial and lateral ranges independently.
- Removed repeated direction ranges from ordinary fish states while preserving dash-specific overrides.
- Added config labels, validation, and regression coverage for every fallback level and legacy fish configs.
