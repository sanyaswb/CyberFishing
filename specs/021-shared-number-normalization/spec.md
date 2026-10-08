# Feature Specification: One shared set of numeric normalization functions

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: reuse, same behavior

## Problem (verified)
81 private helper methods in 57 modules (engine users across domain, application, config, presentation and
DEV) repeat ten small numeric normalizations byte-for-byte, for example `#positive` (18 copies),
`#clamp01` with a finite check (17) and `#clamp01` without it (12). The copies differ only in name.

## Solution
`src/engine/math/number_normalization.js` exports ten pure functions with the exact bodies of the copies:
`nonNegativeOr`, `clampUnitFinite`, `clampUnit`, `clampNumber`, `finiteOr`, `firstFinite`,
`nonNegativeFiniteOr`, `nonNegativeFinite`, `nonNegative`, `positiveFinite`. Similar-looking helpers with
different semantics (finite check vs `|| 0`, Infinity handling, fallback handling) map to different functions.

A scripted AST transform replaced a private method only when its normalized source text equals one of the
function bodies, every reference is a direct `this.#name(...)`/`Class.#name(...)` call and the file has no
identifier with the function's name; it then removed the method and imported the function.

## Requirements
- **FR-001** Same results for every input: the function bodies are the removed bodies.
- **FR-002** No `this` use in replaced methods (checked by the transform).
- **FR-003** Engine stays domain-free; every layer may import engine.

## Acceptance
38/38 checks; guard; game-cycle digest unchanged (fight physics, stamina, tackle stress, drag, hooks, reels and
rods run through the shared functions); browser smoke.
