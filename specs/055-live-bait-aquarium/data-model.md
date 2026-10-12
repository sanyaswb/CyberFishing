# Current Data Model: Shared Aquarium Feed

Owner revision 2026-10-12 supersedes the per-species care model.

- Fish collection: stable ID, species, weight, art, rarity, anomaly, hasAnomaly/isUnique (boolean or historical unknown null), purpose/disposition, sampled/remaining keepnet lifetime, nullable starvationDeadlineMs. No deathOrder.
- Aquarium: owned, level, nullable feed {itemId, quantity, durationMs, remainingMs, seed}, nullable starvation {startedAtMs, windowMs, seed}. Occupancy derives from fish records. Duration = max(minimum, pack base×quantity − (count−1)×quality penalty), preserving elapsed time across count changes.
- Feed supply: selectedFeedId, feeder owned/enabled. Inventory v4 records own pack quantities. A detached packId→count projection is used for care/commands and is never persisted in the feature snapshot. Ordinary groundbait remains separate.
- Episode: each aquarium fish gets a reproducible random deadline within the remaining quality window. Refeeding clears living deadlines. Terminal fish never revive. Keepnet/hook life continues independently; leaving starvation cannot extend remaining keepnet life.
- Snapshot v4: same local key and revision semantics, previous versions validate before migration. V1/V2 portions map to Simple 500 g through V3; old occupied slot minimum fraction maps to shared protection and unfed deadlines retain their previous remaining time. V3 stock transfers once into inventory; existing active protection gets quantity 1. A write-ahead journal coordinates inventory consumption/migration with feature activation and supports interrupted-write recovery. Unknown special status is never reconstructed from current fish catalog.
- Presentation: safe stack IDs separate species groups from individual special fish. Highest rarity (unknown sorts last), then weight, then stable ID chooses thumbnail. Movement position, size, direction and speed are visual-only and not persisted gameplay state.
