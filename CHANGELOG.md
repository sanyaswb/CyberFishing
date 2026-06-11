# CyberFishing changelog

## v0.19.43 - Player force budget

- Added `PlayerForceBudgetAllocator` as the shared per-frame source of truth for player-applied force.
- Rod Hold now consumes `holdBudgetKg` from the shared budget while Rod Control consumes `controlBudgetKg`.
- Added configurable hold/control budget split and combined tension ceiling safeguards.
- Rod Control no longer creates an independent overload reserve when an external player budget is present.
- Added debug metrics and regression coverage for hold-only, control-only, hold+control split, ceiling caps, and negative-budget prevention.

## v0.19.42 - Rod stroke line distance

- Added `RodStrokeDistanceTracker` to calculate rod stroke gain/loss from actual line-distance changes.
- Fight physics now records player-frame stroke after final line safety constraint, so X/Y movement and clamp results are both respected.
- Pre-player fish escape now consumes stroke credit through line-distance loss instead of Y-only movement.
- Rod stroke debug overlay now exposes line-distance previous/current/delta/gained/lost diagnostics while keeping legacy Y aliases.
- Added regression coverage for distance gain, distance loss, arc movement, X-only line shortening, and jitter tolerance.

## v0.19.41 - Fight input composition

- Added `FightInputActionComposer` as the fight-stage source of truth for `hold` and `lateralControl` actions.
- Fight physics now composes pointer/keyboard actions before pull, drag, fish motion and Rod Control systems consume input.
- Pointer down starts Fight Rod Hold immediately; horizontal pointer movement adds Rod Control without disabling hold.
- Preserved keyboard `Space + A/D` and standalone `A/D` Rod Control behavior.
- Added regression coverage for input composition and the full `0.05 kg` hold+control victory cycle.

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
