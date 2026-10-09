# Feature Specification: Listener counts through an injected DEV counter

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: DEV isolation (owner decision 3), platform singletons

## Problem (verified)
`EventLifecycle` and `EventBus` kept module-level listener counters, `InputController` a static one, each exposed
through a static `getActiveListenerCount()`. Only the DEV memory watchdog read them (their sum as
`managedListeners`). `InputController` also kept a private copy of the `EventLifecycle` add/remove bookkeeping.
`GameApplication` created its own `EventLifecycle`.

## Solution
- `ManagedListenerCounter` (`src/dev/services`) counts adds and removals. Development startup creates one per page
  (`??=`, like the loop guard) and passes it as the `listenerCounter` option; the watchdog reads `getActiveCount()`.
- `EventLifecycle` and `EventBus` take an optional counter in their constructor (absent in production) and report to
  it; the module-level counters and static readers are removed.
- `InputController` receives `listeners` (an `EventLifecycle`) and registers through it; dispose order (reverse) is
  unchanged. `GameApplication` receives its `listeners`. `GameCompositionRoot` composes both lifecycles with its
  optional counter and validates the counter when one is given.
- `BrowserDebugAdapter` (DEV) receives its `EventBus`; DEV composes it and the diagnostics lifecycle with the counter.

Production effect: no listener counting. The counted DEV total covers the same instances as before (session,
diagnostics, debug bus, input).

## Evidence
Architecture 2/2, Quick 13/13, Full 38/38; game-cycle digest unchanged `7b9baea3…ed5b6`;
production 465 modules / 703 imports (unchanged). Platform check: bus subscribe/unsubscribe/clear and lifecycle
add/cleanup/dispose counts, uncounted production lifecycles. Session check reads the injected counter (DEV 3 → 4 → 3
→ 0, production 2 → 3 → 2 → 0). Config runtime check: the DEV counter reaches the root, debug bus and diagnostics.
Browser smoke by Claude in the hidden desktop browser pane: dev.html restarted through its own startup module with the
watchdog switched on reports `managedListeners: 12`, `activeGameLoops: 1`, `duplicateLoopStarts: 0`, 0 errors;
index.html restarts, runs 87 frames and takes pointer input, 0 errors.
