# Current Data Model: Shared Aquarium Feed

Owner revision 2026-10-12 supersedes the per-species care model.

- Fish collection: stable ID, species, weight, art, rarity, anomaly, hasAnomaly/isUnique (boolean or historical unknown null), purpose/disposition, sampled/remaining keepnet lifetime, nullable starvationDeadlineMs. No deathOrder.
- Aquarium: owned, level, nullable feed {itemId, durationMs, remainingMs, seed}, nullable starvation {startedAtMs, windowMs, seed}. Occupancy derives from fish records. Duration = max(minimum, pack base − (count−1)×quality penalty), preserving elapsed time across count changes.
- Feed supply: stock map packId→integer count, selectedFeedId, feeder owned/enabled. Ordinary groundbait and inventory are untouched.
- Episode: each aquarium fish gets a reproducible random deadline within the remaining quality window. Refeeding clears living deadlines. Terminal fish never revive. Keepnet/hook life continues independently; leaving starvation cannot extend remaining keepnet life.
- Snapshot v3: same local key and revision semantics, previous versions validate before migration. Old portions map to Simple 500 g. Old occupied slot minimum fraction maps to shared protection; unfed deadlines retain their previous remaining time. Unknown special status is never reconstructed from current fish catalog.
- Presentation: safe stack IDs separate species groups from individual special fish. Highest rarity (unknown sorts last), then weight, then stable ID chooses thumbnail. Movement position, size, direction and speed are visual-only and not persisted gameplay state.
