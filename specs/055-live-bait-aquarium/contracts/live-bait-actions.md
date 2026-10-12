# Live Bait Action Contract

Application commands return `{ ok: boolean, reason?: string, revision?: number }`; presentation maps reasons to localized messages. Domain/application code imports no DOM, Canvas, localStorage, audio, or DEV module.

| Command | Preconditions | Successful effect |
| --- | --- | --- |
| `resolveCatch(catchId, fish, "claim")` | Unresolved catch | Insert one keepnet catch. |
| `resolveCatch(catchId, fish, "release")` | Unresolved catch | Mark outcome resolved, with no live fish. |
| `resolveCatch(catchId, fish, "live_bait")` | Eligible species/weight; unresolved | Insert one bait in owned aquarium with space, else keepnet; sample life once. |
| `selectLiveBait(fishId)` | Living available bait | Set selection to fish ID; no duplicate item. |
| `beginLiveBaitCast(fishId, hookContext)` | Selected living fish; one compatible free hook | Move the same fish to hook and expose read-only candidate. |
| `settleBaitLoss(fishId, cause)` | Fish currently on hook | Mark consumed once; repeat callback is idempotent. |
| `endLiveBaitCast(fishId)` | Fish still living on hook | Return it to keepnet with remaining life. |
| `installAquarium()` | Not owned | Own level 1, capacity from table. |
| `upgradeAquarium()` | Owned, level < 10 | Increase level exactly one. |
| DEV inventory grant | Valid aquarium-feed catalog item | Add/stack the pack in inventory; free shop is the acquisition UI. |
| `selectAquariumFeed(itemId)` | Known aquarium-feed pack | Select the pack used for manual/automatic feeding. |
| `feedAquarium(itemId?, quantity = 1)` | Owned, inhabitants, positive safe-integer quantity within inventory stock | Consume exactly quantity packs, replace shared protection and cancel surviving starvation deadlines. |
| `installAutoFeeder()` / `setAutoFeeder(enabled)` | Valid ownership | Own/toggle feeder without creating feed. |
| `transferToAquarium(fishId)` | Living keepnet bait, owned aquarium, space | Move same fish and preserve remaining life. |

All commands settle elapsed care time with injected `nowMs` first; failed commands do not partially mutate the requested action. Accepted mutations persist one revision. Selection clears on death, release, or consumption. UI read models may display countdowns but cannot change facts.

## Bite and movement integration

Derive one candidate with configured bait ID and source species from the selected/hook fish; set target-species attraction through existing `baitMultipliers` configuration. Do not special-case a DOM/global flag in `BiteSystem`. Carry the exact fish ID through loss, break, and retrieve callbacks. Until that identity path is proven, allow only one live bait on one compatible unoccupied hook. Preserve ordinary attached-bait behavior.

The bait-only motion component receives only the source fish's `swim` behavior profile. It scales speed by a configurable 0.5 multiplier and never enters other fish states. Profile resolution occurs outside the frame loop. Runtime movement uses existing `deltaTime` and a reused output, without repeatedly allocating `FishBehavior.getStateData()` objects.
