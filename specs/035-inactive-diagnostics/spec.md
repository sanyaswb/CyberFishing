# Feature Specification: Session diagnostics behind an injected port

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: DEV isolation (owner decision 3 in
[follow-up decisions](../029-backend-foundation/follow-up-decisions.md)), same gameplay

## Problem (verified)
`GameApplication` created `GameDebugFacade` itself, and `GameCompositionRoot` always composed `BrowserDebugAdapter`
(an `EventBus` plus document `CustomEvent`s). The facade mixed three concerns:
- the debug switch and events, which only DEV overlays and modules consume;
- the DEV tools' `debug-hooked-fish-updated` hook;
- the `config-updated` subscription, which is ordinary session lifecycle for runtime config edits.

Every listener of the debug event types lives in `src/dev`. Inventory events use their own
`BrowserEventTargetAdapter`, not the debug bus.

## Solution
- `config-updated` stays in the session. `GameApplication.subscribeConfigUpdated` registers it on the session's
  own listener lifecycle, as before.
- Ports in `game/application/session` with production implementations:
  - `InactiveDebugEvents` (`on`/`emit`/`clear`, with one shared unsubscribe function);
  - `InactiveGameDiagnostics` (`isDebugEnabled` false; `emit`, `on`, `subscribeHookedFishRuntimeUpdated` and
    `dispose` do nothing).
- `BrowserDebugAdapter` and `GameDebugFacade` move to `src/dev/runtime/`. The facade receives its own
  `EventLifecycle`; its `dispose` removes the hook listener and clears the debug events (it was `clear`).
- `GameCompositionRoot` accepts two optional, coherent DEV factories, `createDebugEvents` and
  `createGameDiagnostics`. Without them it composes the inactive ports, and it validates both contracts in `build`.
  Development startup supplies the factories. `GameApplication` receives `diagnostics` instead of constructing it.

The production effect is limited to modules and allocations: after spec 034 debug was already off there. The
debug bus and the DEV hook subscription are no longer created. DEV behavior is unchanged.

## Evidence
- Checks: Architecture 2/2, Quick 13/13, Full 38/38.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`.
- Production 466 → 465 modules, 704 → 703 imports.
- The session check runs both compositions. DEV shows 3 managed listeners and gets the hooked-fish update.
  Production shows 2 managed listeners and gets no hook. Disposal order is unchanged.
- The config-runtime check proves the DEV factory wiring and the coherence and optional-callback validation.
- The platform check proves the inactive ports never deliver anything.

Browser smoke was run by Claude in the hidden desktop browser pane. Frames were driven by a timer-based
`requestAnimationFrame` after a stop and start:
- dev.html: 116 `debug-live-update` events in 2 s, overlay present, 0 errors.
- index.html: 116 frames, 0 debug events, inactive ports loaded, 0 errors.
