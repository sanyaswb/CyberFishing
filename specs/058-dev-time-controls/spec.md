# DEV calendar control and House tools

Owner request: 2026-10-14. Implemented; Architecture4/4, Quick23/23, Full49/49 PASS. Browser acceptance remains owner-owned.

- Tablet/portrait equipment aligns its primary/auxiliary regions left, including800px. Landscape centers their fixed columns. Mobile region separation, four inventory columns and rod9:16 remain intact.
- Locked/unavailable placeholders are darker than ordinary placeholders. DEV page actions share a compact group without dashed row separators.
- `dev.html?page=house&returnTo=dev.html` runs the House with the same DevTools UI and real House markup fetched from `fisherman-house.html`; production House/game entrypoints never import DEV. The DEV page includes the House stylesheet after the unchanged production CSS prefix.
- `CONFIG.debug.timeAccelerationEnabled` defaults false. Only DEV bootstrap injects a clickable time display/control. Production remains passive even if the flag is true.
- Enabled clock clicks cycle1 →1.5 →2 →2.5 →3 →3.5 →4 →4.5 →5 →1. A faster clock adds `⏩ ×N` before the time icon and expands left; neighbouring HUD controls reserve that width. Disabling the flag resets the multiplier to1.
- The shared calendar clock controls the hour, day/night phase and House lighting. The multiplier changes calendar elapsed time only; fishing physics, game-loop delta, real-time care, repair and survival timers keep their existing clocks.
- The calendar clock owns the transient multiplier. Changes settle elapsed hours before changing rate. Version1 saves retain normal base `timeScale`; the DEV multiplier is never serialized as a persistent rate. Unchanged/off behavior and gameplay baseline remain unchanged.
- Entering the embedded DEV House checkpoints the parent clock at normal rate. A trusted ready handshake transfers its enabled state, base rate and multiplier; House changes return with the trusted existing close message. Parent syncs reached hours and resumes that same session/rate. Catalog uses isolated fixtures.
- Dispose removes listeners, UI resources and pending template fetches, checkpoints reached time at the base rate, and must not restart a disposed game. No extra render loop or per-frame DOM queries.

Validation: deterministic clock/cycle/disable/phase/save/House handoff, production isolation, keyboard/button lifecycle, CSS contracts, Architecture + Quick + Full and artifact cleanup. The owner checks actual800px/landscape alignment, visible darkness and expanded time controls in a browser.

Evidence: `utils/dev-time-check.js` covers the complete cycle, no jump on rate changes, crossing21:00 and midnight back to09:00, base-rate-only version1 saves, inactive House cleanup, active-view handoff,120 unchanged readings with zero class/ARIA/storage writes, compact navigation DOM and template-fetch disposal. `utils/config-runtime-check.js` exercises the actual DEV startup, one stopped/resumed session and the trusted ready/return bridge. Existing game-cycle baseline and inventory save byte checks pass without a rebaseline. No browser/FPS measurements, commit or release are claimed.

The UI catalog's HUD state **DEV час: ×1.5..×5** uses the same real control and a frozen in-memory fixture clock without storage or a continuous timer.
