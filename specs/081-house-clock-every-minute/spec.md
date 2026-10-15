# House clock shows every game minute; one time source for map backgrounds

Owner report, 2026-10-15 (G-060): in `fisherman-house.html` the clock jumps, for example from 01 straight to 04, and
02 is never shown. Also asked: review the background switching and time handling on the test map.

## Cause

The House refreshes its whole view, including the clock, once per `CONFIG.liveBait.displayTickMs` (1000 ms). Game time
runs at `CONFIG.debug.timeScale` 240, so one real second is four game minutes: each refresh moved the `HH:MM` reading
by four (three or five with timer drift). The fishing HUD updates its clock every frame and does not skip.

## Change

- `GameTimeClock.msUntilNextMinute()`: real milliseconds until the displayed game minute changes at the current scale
  and rate (pure arithmetic over the existing anchor; nothing new is saved).
- `platform/browser/time/GameMinuteTicker`: a self-rescheduling timeout that fires just after each game-minute
  boundary and updates the House clock only. The delay is capped at `displayTickMs`, so a clock changed elsewhere
  (DEV acceleration, another tab's anchor) shows within a second as before, and floored at 16 ms. Focus restarts it
  after `gameTime.sync()`; dispose clears it. The view refresh, care tick and background blend keep their intervals.

## Test map review

`GameWorld.update` passes the environment's game-time reading to `LocationMap.update` every frame;
`backgroundTimeBlend` (17–21 h dusk, 5–9 h dawn) and the shared `timeOfDayLayers` draw at most two of the
day/evening/night backgrounds, the same composition as the House. No skip there. `LocationMap` still carried a
wall-clock fallback (`currentDate`, composed as `() => new Date()`) for a `null` reading that `EnvironmentSystem`
never produces; it is removed, so map backgrounds have one time source.

No gameplay, save or formula changes; the game-cycle report is unchanged.

## Verification

House check: reproduction (a one-second refresh at x240 shows minutes 2, 6, 10), the ticker shows consecutive minutes
across midnight and after a rate change, idempotent start, dispose. Config runtime check covers the map update with a
game-time reading. Architecture, Quick, Full. Owner checks the House clock in the browser.
