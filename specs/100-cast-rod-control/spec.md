# Cast rod lateral control

Owner request: 2026-10-17. Status: implemented in v0.39.0; automated and browser checks passed; owner play acceptance pending.

## Behavior

- Enable lateral rod control after a cast, in `waiting` and `biting`, by default. Keep fight controls independent.
- Owner clarified: 100% independently from the initial rod center to each edge of the location's green castable zone. Use its visible projected interval; default edge padding is zero. Provide independent left/right ratios. Default speed is 100 screen px/s. Releasing control preserves the position.
- A real player-driven rod displacement during a non-guaranteed bite ends that bite and returns to waiting. During a guaranteed bite it hooks the same fish and enters playing. A held input against a boundary does neither. Use the bite window at the moment of displacement; existing manual strike behavior stays unchanged.
- Rod movement takes up existing slack. When the rod would stretch the cast line, move the tackle toward the new rod anchor by the extra extension, respecting water and map bounds. No reel line is recovered by this motion. Ordinary current, bite animation and live-bait motion alone do not count as rod-driven tackle movement.
- For non-spinning equipment, any rod-driven tackle motion since the last bite tick sets each otherwise eligible fish's bite probability to the configured absolute 0.001 (0.1%) for that tick. Accumulate motion between ticks, then clear it. Spinning equipment is exempt. Preserve bait/depth/hook eligibility and existing cooldown behavior. Explicit DEV chance overrides keep precedence.
- Each feature and its balance values is configurable, with enable flags true by default. Horizontal touch gestures do not also trigger passive retrieval or an ordinary strike merely because their hold timer expires. Explicit Space retains its existing action.
- Recasting/retrieving resets cast control. A successful strike transfers the moved base to the fight; existing fight aim padding/clamps still apply. Live configuration and viewport changes remain supported. Save format is unchanged.

## Boundaries and ownership

- `game/domain/fishing/cast_rod_bite_policy.js`: stateless bite-window response and probability policy.
- `game/application/fishing/cast_rod_control.js`: authoritative cast rod position and cast-line reach; orchestrates numeric geometry through injected projector, canvas metrics and live configuration, exposes one reused observation frame.
- Waiting/biting states call cast control and retain their own state transitions and fish ownership. `BiteSystem` accumulates rod-driven float disturbance until a probability tick consumes it.
- Viewport presentation reads the cast position; it never owns or writes this gameplay position. Existing fight aim remains in its current owner.
- Bootstrap creates/injects the cast-control session. Production does not depend on DEV. DEV edits use the existing generic physics editor and parameter labels.

## Validation

- Before implementation, `node utils/cast-rod-control-check.js` failed with `0.5 !== 0.001`, reproducing the missing moving-float rule.
- Focused deterministic check passes: asymmetric green-zone ranges, analog/composed input, release, zero speed, delta cap, disabled/live settings, reused frame, viewport reads/resize, slack/taut line, uniform/perspective ground geometry, water rejection, actual displacement versus held boundary input, touch hold isolation, normal/guaranteed bite windows, same-fish identity, tick accumulation/reset, hook/depth/zero-chance eligibility and spinning exception.
- Game application composition checks verify transfer of the moved cast base into the fight and removal of the cast session position. Stage split reprojects the moved rod and original base independently; camera changes do not count as player rod motion.
- `npm run check:architecture`: 4 checks passed. `npm run check:quick`: 28 checks passed. `npm run check`: 54 checks passed. Windows filesystem fixture suites ran outside the restricted sandbox to permit temporary junctions/renames.
- The existing game-cycle report/baseline is unchanged. Its alignment-specific force fixture now explicitly enables alignment, so it tests that branch independently of the owner's existing `alignment.enabled = false` default; no assertion was removed.
- Browser smoke at `http://127.0.0.1:5500/`: production and DEV load v0.39.0 without console errors; normal casting, left/right movement after casting and position retention were observed. DEV shows left/right ratios 1/1, enabled flags and absolute chance 0.001. Bite-window outcomes are verified by deterministic tests; no random browser bite is claimed as evidence.
- Current browser evidence: [production left movement](../../utils/generated/cast-rod-control/index-left.png), [DEV right movement in WAITING](../../utils/generated/cast-rod-control/dev-right.png). Images are local ignored diagnostic artifacts.
- Owner play acceptance of motion feel remains pending. Save format and unrelated fight mechanics were not migrated.
