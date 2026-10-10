// An item's maximum load after durability loss: each lost durability percent removes
// `durabilityMaxLoadLossPerPercent` of the load, never below 10%. Items without a positive
// `effectiveStats.maxLoadKg` (or no item) yield the fallback.
export function durabilityAdjustedMaxLoadKg(item, fallback = 0) {
  if (!item) return fallback;
  const maxLoadKg = Number(item.effectiveStats?.maxLoadKg ?? fallback);
  const durability = Number(item.effectiveStats?.durability ?? 100);
  const lossPerPercent = Number(
    item.effectiveStats?.durabilityMaxLoadLossPerPercent ??
      0.001,
  );
  if (!Number.isFinite(maxLoadKg) || maxLoadKg <= 0) return fallback;
  const lostPercent = Math.max(0, 100 - (Number.isFinite(durability) ? durability : 100));
  return maxLoadKg * Math.max(0.1, 1 - lostPercent * lossPerPercent);
}
