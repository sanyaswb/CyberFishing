# CyberFishing changelog

## v0.19.52 - Radial pole fight sector geometry

- Added `PoleFightSectorGeometry` as the shared source of truth for the sector origin, vertical forward axis, half-angle, boundary directions and physical line radius.
- Rebuilt `PoleFightSectorConstraint` around the intersection of the angular sector and the released-line radius, stopping movement at the first trajectory intersection without adding displacement.
- Autonomous fish movement, Rod Hold and Rod Control now pass the same line-derived radius into the shared constraint frame.
- Preserved gradual recovery for fish already outside the angular sector while blocking movement farther outside.
- Replaced the viewport-sized sector visualization with a red filled physical sector whose outer arc uses the exact fight-line radius.
- Added an independent yellow `showFightLineRadius` semicircle for the unrestricted radial line boundary.
- Renderer consumes the physics geometry frame during fights and uses the same geometry builder for its pre-snapshot fallback.
- Added runtime debug fields for sector limit radius, forward axis, boundary directions, boundary type, outside state and recovery movement.
- Added labels, DevTools schema wiring and config validation for the new location visibility toggle.
- Expanded regressions for the 6 m pole radius, widening sector shape, angle/radius intersections, no added movement, gradual recovery and exact red/yellow render alignment.

## v0.19.51 - Movement constraint invariants

- Reworked locked-line Rod Control as a swept segment-to-circle projection instead of selecting a boundary point only from the input sign.
- Positions slightly outside the released line radius are normalized locally; that correction is tracked separately and is never counted as player movement or rod stroke.
- Added the invariant that applied Rod Control path cannot exceed the movement requested for the frame, preventing cross-circle teleports from keyboard and pointer input.
- Added pre-player hard-line normalization for pole tackle so Rod Hold and Rod Control receive valid line geometry in the same frame.
- Sector clipping is now a directional movement block rather than a hard tension obstruction, preserving movable-fish tension behavior.
- Rod Hold and Rod Control no longer mutate autonomous fish velocity when the shared sector limits player movement.
- Added constraint feedback to PlayerPullMotionSmoother so blocked X/Y velocity cannot accumulate and release as a later jump.
- Added stable tangent boundary steering when an active fish reaches the empty-spool radius with only outward movement, preventing the center-line deadlock.
- Added regressions for outside-radius A/D control, no cross-circle teleport, sector displacement invariants, smoother feedback and tangent fallback.

## v0.19.50 - Swept pole fight sector

- Replaced direct fish-position snapping with a swept `from -> proposed -> allowed` movement constraint.
- Fish crossing a sector boundary now stops at the trajectory intersection instead of teleporting along a circular radius.
- Fish already outside the sector may return toward the center over multiple frames, while movement farther outside is blocked.
- Applied the same movement constraint to autonomous fish movement, Rod Hold and Rod Control before downstream line/tension state is finalized.
- Fixed a stale `.constrain` runtime guard that forced `poleFightSectorActive` to remain false and prevented visualization.
- Added a config-backed visual frame fallback plus regressions for crossing, recovery, outward blocking and visible rendering.

## v0.19.49 - Nested location debug controls

- Moved `Locations / Zones` inside the existing `DEBUG (CONFIG.debug)` section instead of exposing a separate top-level section.
- Kept all switches bound directly to the authoritative runtime `CONFIG.locations` values.
- Made the pole fight sector visualization clearly visible with stronger fill, boundary rays and a vertical center axis.
- Replaced map-size-dependent visualization radius calculations with a viewport-covering render radius.
- Added regression coverage for Debug nesting and complete sector rendering.

## v0.19.48 - DevTools location controls

- Added a dedicated `LOCATIONS / ZONES (CONFIG.locations)` section next to the main Debug controls.
- Grouped all 14 location booleans into master visibility, gameplay zones and zone overlays.
- Added live switches for castable, collisions, snags, dynamic zones, catch/lastDash/net/aiming zones and the pole fight sector visualization.
- The shortcut edits the authoritative runtime `CONFIG.locations` paths and does not duplicate location state or map data.
- Added regression coverage for missing, duplicate and accidentally exposed structural location keys.

## v0.19.47 - Pole fight sector

- Added `physics.fight.poleFightSector` with an enabled flag and configurable half-angle from the vertical-up center axis.
- The sector origin uses the base rod position on the lower boundary of the active castable zone, not the visual rod tip.
- Fish AI, Rod Hold and Rod Control now share one final angular constraint without duplicating sector logic.
- Sector correction preserves the current line radius and removes only velocity that would continue pushing outside the boundary.
- Added `locations.showPoleFightSector` for an independent clipped debug visualization.
- Added sector geometry/debug fields and regression coverage for position, velocity, radius preservation, visualization toggling and the 6 m pole fight cycle.
- `RodLateralControlSystem` now accepts its tension-mode resolver through constructor injection.

## v0.19.46 - Rod Control movement isolation

- Rod Control now moves freely along X while the requested point remains inside the already released line radius.
- Locked-line arc projection starts only for the part of movement that would exceed that radius, preventing toward-center control from lifting the fish.
- Horizontal pointer Control no longer activates pointer Rod Hold; explicit keyboard `Space + A/D` composition remains supported.
- Aligned or direction-blocked Rod Control no longer reserves player force budget from Rod Hold.
- Rod Control distance changes no longer charge or consume Rod Hold stroke.
- Added a full 6 m pole regression for `Control -> release -> Hold` with a 0.05 kg fish.

## v0.19.45 - Utility role cleanup

- Separated manual diagnostics, compatibility checks and static lifecycle audits into explicit utility folders and npm command groups.
- Renamed the fish speed diagnostic around radial movement and replaced legacy Y terminology with radial force and speed metrics.
- Added `finalRadialSpeedPxPerSec` and `radialAwayRatio` debug fields while preserving existing Y aliases for compatibility.
- Split legacy Y rod-stroke coverage out of the core Rod Pull regression check.
- Documented the simplified fish-force simulator as a manual diagnostic that does not validate the complete fight pipeline.

## v0.19.44 - Runtime fish overlay

- Fight physics now exposes the normalized runtime fish behavior profiles in its per-frame debug snapshot.
- Fish state force rows and worst-case force diagnostics now react to Active Fish DevTools changes instead of reading stale catch configuration.
- Corrected fish force display formulas and units: passive force, state active force and total force are shown separately.
- Valid zero force and speed multipliers remain zero in the overlay.
- Added regression coverage that rejects stale hooked-fish values after a runtime update.

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
