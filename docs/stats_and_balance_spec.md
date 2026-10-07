# Statistics and balance telemetry — specification stub

Status: **draft, not implemented.** The previous unwired prototype (browser `EventLogger` posting to an
Express `backend/` that kept the last 50 events in `logs/events.json`) was removed in 0.28.x; it remains in
Git at tag `v0.28.0` (`src/platform/browser/diagnostics/event_logger.js`, `backend/`). Implement only
after the open questions below have concrete answers.

## Goal

Collect gameplay facts that answer balance questions (catch rates, fight duration, line breaks, gear
usage) without affecting gameplay, timing or saves.

## Open questions (must be answered before implementation)

1. **Events.** Which events, with which fields? Candidates: cast (distance, gear), bite (fish, chance
   sources), fight end (outcome, duration, max tension, break cause), catch (fish, weight, rarity), gear
   wear/consumption, location/session start and end.
2. **Metrics.** Which numbers are computed from them, per what grouping (fish, gear, location, version)?
   E.g. catch rate per bite, break rate per tackle, median fight time, durability loss per catch.
3. **Audience and scope.** DEV balance sessions only, or also production players? Production collection
   needs consent and a privacy note; DEV-only can stay local.
4. **Storage and viewing.** Local file/IndexedDB export, a DEV overlay/report, or a server? How long are
   records kept, and how are runs compared (A/B between config overrides, between versions)?
5. **Volume.** Expected events per minute; sampling or aggregation on the client?

## Constraints from the architecture

- Events are emitted by game/application use cases through an application-owned port; the browser
  transport (fetch/IndexedDB/file) is a platform adapter composed only in bootstrap. Domain stays free of it.
- No allocation or I/O in the frame loop: buffer facts and flush outside `update()`/`render()`.
- Telemetry must never change gameplay state, RNG sequences, saves or the game-cycle output; failures are
  swallowed and reported only to diagnostics.
- If DEV-only, compose it in Development Bootstrap; production must not import it.
- Record the config override set and project version with every run so balance comparisons are reproducible.

## Acceptance (when implemented)

Focused checks for event shape and metric computation, unchanged game-cycle output, architecture guard,
and a browser run showing the chosen viewing path.
