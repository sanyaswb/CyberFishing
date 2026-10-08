# Feature Specification: Direct calls on collaborators that always exist

**Created**: 2026-10-09 · **Status**: Implemented (first pass) · **Kind**: contract clarity, same behavior

## Problem (verified)
Production code carries ~500 optional calls (`x?.m?.()`). Many guard collaborators that composition always
provides, which hides real contracts and adds checks in the hot loop. Others are legitimate: duck-typed item
records (`reel?.hasReel?.()`), alternative interfaces, defensive teardown and fields that only exist during a fight.

## Rule used
A call is made direct only when (a) the receiver is always present when the call runs — a field created with
`new Class()` at its declaration, a fight step parameter supplied by the fight session, or a session field set
in the constructor before any use — and (b) the receiver's class (or a superclass) defines the method. A script
checks (b) per call and skips calls whose result continues an optional chain. Teardown (`dispose`) stays
defensive.

## This pass
- `FightPhysicsOrchestrator`: 86 calls on the physics config adapter, the session systems (stress, rod pull,
  rod control, fish force, reel, pull input, float) and its own calculators (92 → 6 optional calls).
- `GameApplication`: 29 calls on the inventory, inventory UI, fishing controller, equipment rules, fight service,
  environment, bite system, input and chum controller (55 → 26).

Left optional on purpose: item records with alternative shapes, fight-only fields of `FightService`, DEV debug
adapters and teardown.

## Evidence
38/38 checks (the game application check drives the session with its real facades and frame order);
game-cycle digest unchanged (every fight step runs the rewritten orchestrator); index.html inventory, chum
warning and cast paths work, 0 console errors.
