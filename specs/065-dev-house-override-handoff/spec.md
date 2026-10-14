# One config override handoff between the DEV location and House

Owner decision: 2026-10-14 (proposal from spec 064). The DEV House runs in an embedded page with its own runtime
config. Before, the location sent only `liveBait.visual` (separately, on load and on every `debug-live-update`) and
the time settings inside `debugTime`; every other location edit was missing in the House and House edits were lost
on return.

## Decision

- One message type, `cyber-fishing:dev-house-handoff`. After `dev-house-ready` the location sends
  `{ overrides: configRuntime.exportOverrides(), debugTime }`; the House return message carries the same pair.
- `DevTools.replaceOverrides(overrides)` makes the receiver's override set identical: `resetAll`, then the existing
  import path (alias normalization, `config-updated` with `importOverrides`, item progression invalidation, open
  panel refresh) and a quiet validation report. The Import button reuses the same private path.
- `debugTime` now carries only the transient clock rate; `debug.timeScale` and `debug.timeAccelerationEnabled`
  travel as ordinary overrides. The House applies overrides before resuming its clock.
- The aquarium visual reaches the House through the override set and the `config-updated` listener from spec 064;
  the separate visual message, its `debug-live-update` listener and the production `visual` branch are removed.

Not synchronized: direct catalog edits (`ITEM_DB`, `FISH_DB`, `MAP_DB` in DevTools mutate the page's own catalog
objects, not overrides) and DEV-only state outside the config (overlay switches, console modules).

## Verification

`config-runtime-check`: a real DevTools replaces the set (absent paths return to base, a missing payload changes
nothing); the location sends one message with every override and no visual message; the return applies the House set
through DevTools before the clock resumes. `dev-time-check`: the House applies the received set before resuming and
returns its own set; a time-only message keeps House overrides. Architecture, Quick and Full pass; game-cycle
unchanged. No browser testing by Claude.
