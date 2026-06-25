class WeakestTackleLimitResolver {
  resolve({
    rod = null,
    reel = null,
    lineSystem = null,
    leader = null,
    hook = null,
  } = {}) {
    const candidates = [
      this.#candidate("rod", this.#itemLimit(rod)),
      this.#candidate("line", this.#lineLimit(lineSystem)),
      this.#candidate("leader", this.#itemLimit(leader, Infinity)),
      this.#candidate("hook", this.#itemLimit(hook, Infinity)),
    ];

    if (reel?.hasReel?.() === true) {
      candidates.push(this.#candidate("reel", this.#itemLimit(reel, Infinity)));
    }

    const activeCandidates = candidates
      .filter((candidate) => candidate.maxLoadKg > 0)
      .sort((a, b) => a.maxLoadKg - b.maxLoadKg);
    const weakest = activeCandidates[0] || {
      component: "fallback",
      maxLoadKg: 1,
    };

    return Object.freeze({
      weakestTackleLimitKg: weakest.maxLoadKg,
      component: weakest.component,
      candidates: Object.freeze(activeCandidates),
    });
  }

  #candidate(component, maxLoadKg) {
    return Object.freeze({
      component,
      maxLoadKg: this.#positiveFinite(maxLoadKg),
    });
  }

  #lineLimit(lineSystem) {
    return (
      lineSystem?.getEffectiveLineMaxLoadKg?.() ||
      lineSystem?.effectiveLineMaxLoadKg ||
      0
    );
  }

  #itemLimit(item, fallback = 0) {
    if (!item) return fallback;
    return (
      item.getEffectiveMaxLoadKg?.() ||
      item.getMaxLoadKg?.() ||
      WeakestTackleLimitResolver.effectiveItemMaxLoadKg(item, fallback)
    );
  }

  #positiveFinite(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  static effectiveItemMaxLoadKg(item, fallback = 0) {
    if (!item) return fallback;
    const maxLoadKg = Number(
      item.maxLoadKg ?? item.engineStats?.maxLoadKg ?? fallback,
    );
    const durability = Number(
      item.durability ?? item.engineStats?.durability ?? 100,
    );
    const lossPerPercent = Number(
      item.durabilityMaxLoadLossPerPercent ??
        item.engineStats?.durabilityMaxLoadLossPerPercent ??
        0.001,
    );
    if (!Number.isFinite(maxLoadKg) || maxLoadKg <= 0) return fallback;
    const safeDurability = Number.isFinite(durability) ? durability : 100;
    const lostPercent = Math.max(0, 100 - Math.max(0, safeDurability));
    return maxLoadKg * Math.max(0.1, 1 - lostPercent * lossPerPercent);
  }
}

if (typeof window !== "undefined") {
  window.WeakestTackleLimitResolver = WeakestTackleLimitResolver;
}
