// The tackle holds at most the weakest effective load of the equipped rod, line and leader; durability loss
// lowers each item's limit. Returns 0 when none of them has a positive limit.
export class TackleLoadLimitPolicy {
  resolveMaxLoadKg(eq) {
    const values = [];

    const pushPositive = (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) values.push(n);
    };

    const effectiveLoad = (item, fallback = 0) => {
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
    };

    pushPositive(effectiveLoad(eq.rod, 0));
    pushPositive(effectiveLoad(eq.line, 0));
    pushPositive(effectiveLoad(eq.leader, 0));

    if (values.length === 0) return 0;
    return Math.min(...values);
  }
}
