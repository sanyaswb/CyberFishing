# Cast rod speed and line feedback at the slack boundary

Owner request: 2026-10-17. Status: implemented and automatically checked in v0.41.0; visual testing reserved for the owner.

## Requirements

- While a cast rod moves laterally in waiting/biting, multiply its base speed by 3 while free cast-line length remains and by 1 once that length is exhausted and the line must draw the tackle.
- Owner clarified that "float" means any tackle and that exhausted free line is the authoritative condition. Ordinary environmental drift is not the speed switch. Water-blocked tackle cannot create extra slack; a disabled float-drag option does not remove the line-reach condition.
- Expose independent, live-editable, finite nonnegative multipliers at `physics.castRodControl.speedMultipliers.stationaryFloat` (3) and `.movingFloat` (1). Base speed remains 100 screen px/s. Both multipliers set to 1 restore constant base speed; zero stops the relevant phase.
- When slack ends partway through a frame, spend only the appropriate part at each speed. Do not apply the fast speed to the tackle for an extra frame or delay visual tightening until the following frame.
- Existing line straightening begins at the same boundary, rather than on every rod displacement. It remains inactive through slack. Explicit retrieval retains its existing line response. Releasing or holding a motion limit does not create an active lateral pull.
- Keep cast ranges, analog targets, delta cap, bite windows, actual tackle disturbance probability, spinning exception, float tilt configuration, fight controls and save format unchanged.

## Ownership

- `CastRodLineConstraint` computes the straight rod path ratio at which free line ends using the same ground-plane reach as its tackle projection. A ratio greater than one means the target remains within slack.
- `CastRodControl` owns rod position and cast-line reach. It splits the frame's movement time and publishes a derived `lineTensionActive` in its existing reused observation frame. The renderer uses that signal for the existing line response. No new rendering-owned gameplay state, raw config dependency or session latch is added.
- Reuse vectors and scalar calculations; do not allocate per-frame state or query the DOM. No architecture migration or new composition contract is needed.

## Validation

- Initial deterministic reproduction: the new slack-speed assertion in `cast-rod-control-check.js` failed with `405 !== 415` for a 50 ms frame, base speed 100 and multiplier 3.
- Focused coverage includes default/custom/zero/live multipliers, both directions, exact/mixed-frame slack exhaustion, 5/10/50 ms time partitioning, return through slack, water rejection, disabled tackle drag, analog/green boundaries, perspective geometry and unchanged bite observations.
- Render composition verifies that moving through slack does not straighten the line, exhausted slack does, release clears it and the existing enable flag/retrieval behavior still work.
- The exact staged gameplay snapshot passed Architecture (4), Quick (29) and Full (55), including the existing unchanged game-cycle baseline. It was checked separately from unrelated in-progress Spine changes. Temporary filesystem fixture checks ran outside the sandbox for junction/rename support.
- Per the owner's explicit instruction, browser/visual tests and gameplay feel acceptance remain with the owner.
