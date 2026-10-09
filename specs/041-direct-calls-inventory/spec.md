# Feature Specification: Direct calls on inventory collaborators (spec 032, second pass)

**Created**: 2026-10-09 · **Status**: Implemented (bounded pass) · **Kind**: contract clarity, same behavior
(finalization review 8)

## Scope and rule
This pass keeps the spec 032 rule: a call becomes direct only when its receiver is always present and the receiver's
class defines the method. As the review advises, it does not start with the hot loop. It covers inventory
application collaborators that `InventoryCompositionRoot` always composes with one concrete class.

An analyzer (acorn, scratch) for fields assigned only `new X()` found no candidates left after 032. The remaining
optional calls were then grouped by receiver and checked by hand against every construction site in `src` and
`utils`.

## Changes
| Class | Receiver (always composed) | Calls | Contract now validated in the constructor |
| --- | --- | --- | --- |
| `InventoryFacade` | `InventoryGameplayBridge` | 5 | `setAfterMutation`, `handleRodRetrieved`, `handleHandChumUsed`, `handleBoatReturned`, `setBoatChargeProvider` |
| `EquipmentReadModelFactory` | `ItemAssemblyReader` | 4 | `getChild`, `getChildren`, `getAssemblyState`, `getSlotCapacity` |
| `EquipmentAutoRefillTargetProvider` | `ItemAssemblyReader`, `AutoRefillMemory` | 6 | `readPath`, `getRefillSignature`, `getAssemblyState`; `memory.get` (its `null` default is removed: production and the check always pass one) |

Optional calls in `src` go from 450 to 435. Two partial assembly-reader stubs in the hydration check now carry the
full contract as an empty assembly (`[]`/`null`, the same branch the skipped calls took).

## Left optional on purpose
- Optional collaborators by contract: `capabilityResolver` (null in a check), `itemViews`, the bridge's
  `#afterMutation` before it is set.
- Alternative reader shapes: `itemReader` as a function or an object with `hydrate`/`getById`/`get`.
- Duck-typed item records: `reel?.hasReel?.()` and similar.
- Render callbacks, DOM and event methods.
- Fight-only `FightService` fields, DEV adapters and teardown.
- The fight and physics domain (`#fish`, `#physicsConfig`): it is the hot loop, so it goes in a later pass with
  allocation and call-count evidence.

## Evidence
- Checks: Architecture 2/2, Quick 13/13, Full 39/39.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`.
- Browser smoke by Claude in the desktop browser pane: on the `127.0.0.1:4173` origin, index.html shows the inventory
  with 20 cards. Clicking a rod card equips it: the stack splits, the new instance sits in the `rod` slot of the save,
  and there is no warning. 0 errors.
