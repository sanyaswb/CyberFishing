# Feature Specification: Platform singletons become composed instances

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: platform composition, same behavior

## Problem (verified)
`GameLoop` kept the page's active loop and the duplicate-start counter in static fields, and the DEV memory
watchdog read them through `GameLoop.getDiagnostics()`. `InventoryInstanceIdFactory` shared a static fallback
counter across instances. `GameControls` wrote its fullscreen failure with `console.warn` directly.

## Solution
- `ActiveGameLoopGuard` (platform/browser/runtime) owns the active loop, the duplicate-start count and the
  refusal report (same error text through the injected logger, same `cyber-fishing-memory-warning` event on the
  injected window). Each startup creates one guard per page (`??=`, so a restarted DEV game shares it) and passes
  it to `GameCompositionRoot`, which validates it in `build` and gives it to `GameLoop`.
- `GameLoop` acquires and releases the guard; frame scheduling and the clock calls are unchanged. The DEV watchdog
  reads `gameLoopGuard.getDiagnostics()`.
- `InventoryInstanceIdFactory` keeps its fallback counter per instance. Production composes one factory per
  player inventory; the id text format is unchanged.
- `GameControls` receives `logger`; composition passes a `ConsoleLogger`.

Not in this step: module-level listener counters of `EventBus`, `EventLifecycle` and `InputController` serve only
the DEV watchdog; they move with the DEV ports step (checklist item 2).

## Evidence
Architecture 2/2, Quick 13/13, Full 38/38 (platform check drives two loops on one guard and a second guard;
player inventory check pins per-factory counters; config runtime check proves both startups pass the guard).
Game-cycle digest unchanged `7b9baea3…ed5b6`. Production 467 modules / 705 imports.
Browser smoke by Claude in the desktop browser pane: index.html renders and animates, `v0.31.0`, 0 console
messages; dev.html starts (storage report printed after a successful start), 0 errors.
