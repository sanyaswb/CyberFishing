# Feature Specification: One fishing services composition for production and game-cycle

**Created**: 2026-10-10 · **Status**: Implemented · **Kind**: composition (refactoring checklist item 6, steps 1–2
for the fishing services)

## Problem (verified)
`GameCompositionRoot#composeFishingServices` built `CastService`, `CatchResolutionService`, `FightSessionFactory` and
`FightService`. The game-cycle check built them a second time by hand, and the two compositions differed:
- the check's fight session factory had no `runtimeConfig` and no `castDistanceCalculator` (constructor default);
- its `CastService` had no DEV flag port, and casting messages came through a constructor-default proxy.

Before gameplay work starts, the behavior reference has to run the composition that the player runs.

## Solution
- `src/bootstrap/production/fishing_services_composition.js` exports `composeFishingServices(...)`. It creates the
  four services exactly as the root did, with `FISHING_MESSAGES` for casting.
- Hosts inject only ports: clock, step clock, DEV flags, loggers, catch-resolution log switch, DEV fight diagnostics
  builder, rod/bounds readers and cast readiness.
- `GameCompositionRoot` calls it with the same arguments as before: two `ConsoleLogger` instances,
  `clock.highResolutionNow`, and the DEV builder only in Development.
- In game-cycle, `createCast` and `createFightService` call it through `composeProductionFishingServices`. That
  helper supplies the live `CONFIG` as `runtimeConfig`, inactive DEV flags, the deterministic step clock and no console
  loggers. The `CastService` constructor-default proxy is removed.
- The direct `FightSessionFactory#create` unit scenario (float depth) stays, already with the production arguments.

## Behavior
Unchanged by construction:
- `runtimeConfig` reaches only the `Reel` fallback for `bearingRetrieveSpeedBonusMetersPerSec`. The factory always
  passes that value explicitly from the physics config adapter.
- The DEV flag port is inactive in both hosts.
- `castDistanceCalculator` equals the former default.

No re-baseline was needed.

## Evidence
- Game-cycle stdout digest unchanged `7b9baea3…ed5b6`; `utils/testing/baselines/game-cycle.txt` unchanged.
- Architecture 2/2 (production 476 modules / 737 imports), Quick 13/13, Full 39/39.
- Browser smoke, performed by Claude in the built-in browser (automated) on the local dev server:
  - `index.html` v0.32.0 loads the new module with 0 console messages; a cast without a rod is answered by
    `CastService` with the player message and the inventory.
  - `dev.html` with a pole, line, float and baited hook (the owner's stored GodMode overrides: 100% bite chance,
    guaranteed sequence) runs the whole cycle: a pull-back power cast puts the state at `BITING`; a tap hooks the fish
    (crucian stalker); then 25 s of held pull. The fish cycles through SWIM/DASH/IDLE, its force falls
    0.560 → 0.474 kg, and the fight HUD shows stamina, endurance and tension. 0 console errors.

## Remaining (item 6, optional test hygiene)
- `GAMEPLAY_FILES`/`CONFIG_FILES` remain a hand-kept list of published names.
- Other checks still use `bindConstructorDefaults` proxies.

Neither changes what the game-cycle composes.
