# Data Model: Live Bait and Aquarium

These are authoritative client facts, not UI or server entities. Existing fish catalog entries remain immutable configuration references.

## CaughtFishCollection

One record per retained fish ID. Fields: `id` (stable unique), `speciesId` (existing catalog ID), `weightKg` (finite positive), immutable caught visual/rarity facts needed for display, `purpose` (`catch | live_bait`), `disposition` (`keepnet | aquarium | hook | dead | consumed`), `caughtAtMs`, `sampledLifetimeMs` and `remainingLifetimeMs` for live bait, and random death tie order. A resolved catch ID is retained in `resolvedCatchIds` with its outcome so Claim/Release/Convert cannot repeat. Claim creates a keepnet catch; Convert creates one live bait in aquarium or keepnet; Release stores only the resolved outcome, not a fish record.

**Invariant**: A fish ID appears once. Terminal dispositions cannot return to live storage. `remainingLifetimeMs` stays within `[0,sampledLifetimeMs]`; only an eligible catch may become live bait. This collection owns disposition/life, not feed or UI selection.

## AquariumState

Fields: `owned`, `level` (1–10 when owned), `feedBySpecies` map of species ID to fraction `[0,1]`, `lastAppliedAtMs`. Capacity is derived from configured levels; occupancy is derived from fish collection records at `aquarium`. Species slots exist only while that species has living fish inside and start at zero feed. Percentages and equal-width bar divisions are derived read data.

**Invariant**: Occupancy never exceeds capacity; level advances once per successful command; feed fractions never exceed 1. No feed slot exists without a contained species.

## FeedSupplyState

Fields: nonnegative integer `portions`, `autoFeederOwned`, `autoFeederEnabled`. Free acquisition increments stock by the configured amount. Successful manual/automatic fill decrements one portion. Enabled implies owned.

## Selection and Hook Binding

Application state holds at most one `selectedFishId` referring to a living bait or null. Selection does not duplicate a bait item. At compatible cast, the fish itself moves to `hook`; a read-only candidate exposes configured bait ID and source species. Existing bait-loss/break events mark it consumed once. Safe retrieval returns a survivor to keepnet with its remaining life. Initial scope is one live bait on one hook; multi-hook identity propagation requires an explicit later change.

## Care Transitions

1. Sample one life duration in configured `[minMs,maxMs]` when the fish becomes bait; persist sampled and remaining values.
2. In keepnet or on hook, subtract real elapsed time. At zero, mark dead and clear selection.
3. In aquarium, deplete each species' feed at its configured count-dependent rate. While feed is positive, its fish life does not decrease. At zero, resume life countdown. Independent sampled lives plus persisted random tie order determine deaths.
4. Feeding fills the selected slot to 1 and pauses survivors' countdowns without resetting them. Transfers do not restore life.
5. Settle elapsed time before commands and after reload. Persist a single snapshot revision; UI only reads a projection.

## Save Snapshot v1

`schemaVersion: 1`, `revision` (nonnegative integer), `lastAppliedAtMs`, `fish[]`, `resolvedCatchIds`, `aquarium`, `feedSupply`, `selectedFishId`. See [local-save-and-assets.md](contracts/local-save-and-assets.md). This is a new local key and does not alter inventory schema v4. Future cloud progress needs an explicit contract/version extension and validation.
