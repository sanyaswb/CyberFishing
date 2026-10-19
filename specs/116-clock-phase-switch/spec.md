# TK-005: double activation changes the shared calendar phase

Owner authorization: `tasks.md`, TK-005, 2026-10-19. Supersedes passive production-clock policy from spec 058.
Status: implemented in v0.43.0; owner acceptance pending. Location and House use production composition; DEV adds acceleration through its own port.

Calendar transitions: current background blend with night > 0 → 12:00; otherwise evening > 0 → 00:00;
otherwise → 19:00. Hours and activation parameters live in GAME_TIME_CONFIG. Do not change spawn/blend thresholds.
GameTimeClock.setHours validates [0,24), reanchors at injected now, preserves base rate and transient multiplier,
and writes the existing v1 store. No simulation delta or care/reward/cooldown time is fabricated.

DoubleActivationController handles two clicks within 300ms, including keyboard-generated clicks, rejects pointer
movement above 8 physical CSS pixels/cancel and delays DEV single activation until the window expires. Double
activation never performs the two singles. Suspend/dispose cancels pending activation. TimePhaseControl owns
the application command, TimeDisplay renders and shields events, bootstrap injects all concrete collaborators.

Acceptance: 299/300/301ms, day/evening/night/day, movement/cancel, DEV speed independence, preserved storage
shape and clock continuation. Existing DEV handoff/environment checks remain required. Owner browser/play
acceptance remains pending in index/dev and House, both orientations. No tools replaced or obsolete.

Validation: task-interactions, DEV time/House handoff, environment/background and catalog checks;
Architecture + Quick + Full (63 checks). No baseline or save-schema update. See G-086 and tasks.md.
