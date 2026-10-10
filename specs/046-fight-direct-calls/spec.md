# Feature Specification: Direct calls in the fight systems and typeof guards on composed receivers

**Created**: 2026-10-10 · **Status**: Implemented · **Kind**: contract clarity (finalization review 8, hot-loop
part), dead branch removal, same behavior

## Scope and rule
This continues spec 032/041 with the same rule: a call becomes direct only when its receiver is always present and
the receiver's class defines the method. Constructors validate the contract once, so a missing collaborator fails at
composition instead of being skipped every frame. Replacing `x?.m?.()` with `x.m()` on such receivers keeps every
call and allocation, it only drops the checks. The game-cycle digest proves the fight pipeline is unchanged.

## Optional calls (hot loop)
| Class | Receiver (always composed) | Direct calls | Validated |
| --- | --- | ---: | --- |
| `FishForceSystem` | `Fish` (always `new Fish` in `FightSessionFactory`), the physics adapter | 13 | 8 fish methods, 7 adapter methods |
| `PlayerForceSystem` | physics adapter (from `FishForceSystem`) | 3 | 3 adapter methods |
| `StaminaSystem` | `Fish`, `FishCondition` | 7 | 4 fish methods, 3 condition methods |
| `FightSessionFactory` | physics adapter (the orchestrator already required it since spec 032) | 7 | 6 adapter methods |
| `TackleStressSystem` | its own `TackleStressAccumulator`; the DEV flag port | 4 | `devFlags.isEnabled` |
| `FightService` | DEV flag port (production composes `InactiveDevFlags`) | 1 | `devFlags.isEnabled` |

The hydration check now gives `FightSessionFactory` a real `FightPhysicsConfigAdapter`, as production composition does
(it used `config: {}`).

## typeof guards
- **Always true:** these become direct calls:
  - `StateDepsFactory` world `getBiteEnv` in `WaitingState`;
  - `DepthSelector.updateMax` in `ScoutingState` and `GameApplication`;
  - `GameControls.updateNetButtonState` and `Net.updateConfig` in `GameApplication` (a missing net is still created);
  - `LocationMap.refreshConfig` in `GameWorld`;
  - `FishBehavior.reactToWall` in `Fish`;
  - `Fish.setPowerRatioByEnduranceRatio` in `StaminaSystem`;
  - `TackleStressSystem.updateTensionFrame` in `FightLandingTensionStage`.
- **Always false (dead code removed):**
  - both `biteSystem.hookFish` calls in `BitingState`, since `BiteSystem` has no such method and no test or DEV
    code provides one;
  - the `updateTarget` fallback in `FightLandingTensionStage` and `TackleStressSystem.updateTarget`, whose only
    caller was that fallback.
- **Left by design:**
  - function-or-object readers and rng;
  - polymorphic states and bait entities;
  - `hasReel` duck typing on items;
  - optional callbacks;
  - browser feature detection (`structuredClone`, `console.table`, `setPointerCapture`, `performance.now`);
  - thenable detection.

## Result
`?.(` in `src`: 435 → 400. `typeof … === "function"`: 95 → 84.

## Evidence
- Checks: Architecture 2/2, Quick 13/13, Full 39/39. No test stub needed changing except the hydration check's
  adapter.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`.
- Browser smoke by Claude in the desktop browser pane, on the `127.0.0.1:4173` origin: index.html restarts, and
  equipping the net from the inventory saves it and shows the net button through the now direct
  `updateNetButtonState`/`updateMax` path. 0 errors.
