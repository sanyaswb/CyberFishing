# TK-005: double activation changes the shared calendar phase

Owner authorization: TK-005, 2026-10-19; correction 2026-10-20. The correction restores passive production clocks.
Status: corrected in v0.45.22; owner acceptance pending. DEV location and House use the same injected control.

Calendar transitions: fully reached night blend (night = 1) → 12:00; otherwise evening > 0 → 00:00;
otherwise → 19:00. A small night contribution during dusk is not the night phase: real elapsed time after
19:00 must still lead to midnight on the next double activation. Hours and activation parameters live in
GAME_TIME_CONFIG. Do not change spawn/blend thresholds.
GameTimeClock.setHours validates [0,24), reanchors at injected now, preserves base rate and transient multiplier,
and writes the existing v1 store. No simulation delta or care/reward/cooldown time is fabricated.

DoubleActivationController handles two clicks within 300ms, including keyboard-generated clicks, rejects pointer
movement above 8 physical CSS pixels/cancel and delays DEV single activation until the window expires. Double
activation never performs the two singles. Suspend/dispose cancels pending activation. TimePhaseControl owns
the application command, TimeDisplay renders and shields events, bootstrap injects all concrete collaborators.

Both single acceleration and double phase switching require `debug.timeAccelerationEnabled === true`.
The view starts disabled, follows the injected control state, cancels a pending pair when the flag changes,
and advertises the phase action only while enabled. DevTimeControl rechecks the live flag on each command,
including when config changes between clicks before the next view update. Production composition injects no
phase-changing callback; the production House and passive catalog example have no bypass.

Acceptance: disabled/enabled and live flag changes, pending-pair cancellation, 299/300/301ms,
day/evening/night/day with elapsed calendar time between activations, movement/cancel, DEV speed independence,
night environment/background, House phase switching, preserved storage shape and clock continuation.
Existing DEV handoff/environment checks remain required. Owner browser/play
acceptance remains pending in index/dev and House, both orientations. No tools replaced or obsolete.

Validation: existing task-interactions and dev-time scenarios reproduce both failures before the fix;
one final Full includes Architecture, Quick, House/environment and catalog checks. No baseline or save-schema
update and no replaced tools. See G-096/G-097 and tasks.md.
