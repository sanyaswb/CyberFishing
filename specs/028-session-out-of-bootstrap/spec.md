# Feature Specification: The running game session leaves bootstrap

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: layer placement, same behavior

## Problem (verified)
`src/bootstrap/production` held runtime objects, not only composition: `GameApplication` (933 lines: state machine,
update/draw order, casting and chum flow, inventory reactions), `GameFishingFacade`, `GameDebugFacade` and
`GameViewportFacade`. `GameApplication` imported the platform `GameClock` (as a hidden default) and the authored
`FISH_DB`; `ConfigProvider` (a plain config read wrapper) lived in `platform`.

## Solution (byte-for-byte moves plus import paths)
- `GameApplication`, `GameDebugFacade` → `src/game/application/session/`; `GameFishingFacade` →
  `src/game/application/fishing/`; `GameViewportFacade` (owns the rod visual offset, a presentation system) →
  `src/game/presentation/viewport/`; `ConfigProvider` → `src/game/config/runtime/`.
- `GameCompositionRoot` injects the clock (the hidden `new GameClock()` default is removed), the fish database and the
  viewport facade (built in `createApplicationServices` with the same collaborators as before).
- The architecture guard now enforces application rules on the session: no host globals, no platform or
  presentation imports.

## Evidence
Guard passes with the session in `game/application` (production imports 708 → 707); 38/38 checks (the game application
composition check drives the real session, facades and frame order); game-cycle digest unchanged; dev.html cast
reaches WAITING with 0 console errors.
