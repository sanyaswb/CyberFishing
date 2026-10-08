# Feature Specification: GameCompositionRoot split into named composition steps

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: maintainability, same behavior

## Problem (verified)
`GameCompositionRoot.create` was one 631-line method and `createApplicationServices` a 353-line method; the class
file had 1 343 lines and ~150 imports.

## Solution
- A scripted extraction (scope analysis: block inputs = variables declared before the block and read in it,
  outputs = variables declared in it and read later; aborts on any write across the boundary) moved consecutive
  statement blocks verbatim into named private steps, called in the original order:
  `create` → rendering infrastructure, style resolvers, item models, outcome interaction, fish models, render
  pipeline, location, player inventory, chum config, world systems, inventory UI, rules and world;
  `createApplicationServices` → fishing services, bite environment, state machine, chum controller, frame builders,
  render coordinator. Cold-start ownership (`own`) and the cleanup `catch` are unchanged.
- The render pipeline, frame builders, render coordinator and their contract checks moved verbatim into
  `GameRenderComposition` (`src/bootstrap/production/game_render_composition.js`), created once by the root with the
  render diagnostics lookup, the optional-diagnostic helper and the two DEV render factories.

## Evidence
`create` 129 lines, `createApplicationServices` 80; root file 1 343 → 1 180 lines, rendering composition 372.
38/38 checks (startup, composition seam and render frame checks); game-cycle digest unchanged; guard;
dev.html renders, cast reaches WAITING, 0 console errors.
