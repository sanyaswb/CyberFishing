# Feature Specification: Name force and tackle snapshots diagnostics

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: owner-requested internal naming change

## Verified consumers and requirements
Rename `FishForceSystem.#debug` to `#diagnostics` and its calculation result's `debug` key to `diagnostics`.
Update all three result readers in `FightPhysicsOrchestrator`. Rename `TackleStressSystem.#debug`
and its private stress snapshot/helpers consistently. Preserve `getDiagnostics`/`setDiagnostics`,
snapshot fields, ownership, object identity and calculations. Runtime config's `debug` group and DEV APIs
are separate concepts and remain unchanged.

## Acceptance
No old snapshot identifier/key remains in these two classes; all result readers use `diagnostics`.
Architecture, Quick, Full, DEV diagnostic checks and unchanged handoff game-cycle SHA256.

Implemented: all three readers updated; Architecture 2/2, Quick 12/12, Full 37/37, unchanged digest;
Chrome inventories render 20 cards each with 0/0 console errors. No snapshot compatibility alias added.
