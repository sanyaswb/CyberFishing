class InventoryV2ItemOrderResolver {
  #config;
  #typeRanks;
  #rarityOptions;
  #rarityRanks;
  #activePlacementKey = null;
  #placementOrder = Object.freeze([]);
  #lastResolvedOrder = Object.freeze([]);

  constructor({
    config = typeof INVENTORY_V2_SORT_CONFIG !== "undefined"
      ? INVENTORY_V2_SORT_CONFIG
      : null,
    rarityVisualConfig = typeof RARITY_VISUAL_CONFIG !== "undefined"
      ? RARITY_VISUAL_CONFIG
      : null,
  } = {}) {
    if (!config?.criteria || !config?.directions || !config?.typeOrder) {
      throw new TypeError("InventoryV2ItemOrderResolver requires sort config");
    }
    this.#config = config;
    this.#typeRanks = new Map(
      config.typeOrder.map((type, index) => [String(type), index]),
    );
    this.#rarityOptions = Object.freeze(
      [...(rarityVisualConfig?.colorStops || [])].map((stop, index) =>
        Object.freeze({
          id: String(stop.id),
          label: config.rarityLabels?.[stop.id] || String(stop.id),
          color: this.#cssColor(stop.color),
          rank: index,
        }),
      ),
    );
    if (!this.#rarityOptions.length) {
      throw new TypeError(
        "InventoryV2ItemOrderResolver requires rarity color stops",
      );
    }
    this.#rarityRanks = new Map(
      this.#rarityOptions.map((option) => [option.id, option.rank]),
    );
  }

  resolve(items = [], options = {}) {
    const source = [...(items || [])];
    const activeRarityIds = this.#validRarityIds(options.activeRarityIds);
    const filtered = activeRarityIds.size
      ? source.filter((item) => activeRarityIds.has(this.resolveRarityId(item)))
      : source;
    const criterionId = this.#criterionId(options.criterionId);
    const directionId = this.#directionId(options.directionId);
    const originalIndexes = new Map(
      filtered.map((item, index) => [item.instanceId, index]),
    );
    const sorted = filtered.slice().sort((left, right) => {
      const comparison = this.#compare(left, right, criterionId);
      if (comparison !== 0) {
        return directionId === "descending" ? -comparison : comparison;
      }
      return (
        (originalIndexes.get(left.instanceId) || 0) -
        (originalIndexes.get(right.instanceId) || 0)
      );
    });
    const resolved = this.#applyPlacementOrder(
      sorted,
      options.placementOrderKey || null,
    );
    this.#lastResolvedOrder = Object.freeze(
      resolved.map((item) => item.instanceId),
    );
    return Object.freeze(resolved);
  }

  createControls(items = [], options = {}) {
    const criterionId = this.#criterionId(options.criterionId);
    const directionId = this.#directionId(options.directionId);
    const activeRarityIds = this.#validRarityIds(options.activeRarityIds);
    const counts = new Map(this.#rarityOptions.map((option) => [option.id, 0]));
    for (const item of items || []) {
      const rarityId = this.resolveRarityId(item);
      counts.set(rarityId, (counts.get(rarityId) || 0) + 1);
    }
    return Object.freeze({
      criterionId,
      directionId,
      criteria: Object.freeze(
        this.#config.criteria.map((criterion) =>
          Object.freeze({
            ...criterion,
            selected: criterion.id === criterionId,
          }),
        ),
      ),
      directions: Object.freeze(
        this.#config.directions.map((direction) =>
          Object.freeze({
            ...direction,
            selected: direction.id === directionId,
          }),
        ),
      ),
      rarities: Object.freeze(
        this.#rarityOptions.map((rarity) =>
          Object.freeze({
            id: rarity.id,
            label: rarity.label,
            color: rarity.color,
            count: counts.get(rarity.id) || 0,
            selected: activeRarityIds.has(rarity.id),
          }),
        ),
      ),
      activeRarityIds: Object.freeze([...activeRarityIds]),
    });
  }

  resolveRarityId(item) {
    const direct = [
      item?.rarityVisual?.id,
      typeof item?.rarity === "string" ? item.rarity : null,
      item?.rarity?.id,
      item?.rarityProfile?.id,
    ]
      .map((value) => String(value || "").toLocaleLowerCase("en-US"))
      .find((value) => this.#rarityRanks.has(value));
    if (direct) return direct;
    const rarity = item?.rarity || item?.rarityProfile || null;
    if (rarity?.isUnique === true) return "unique";
    const tier = Math.max(1, Math.round(Number(rarity?.tier) || 1));
    const maxTier = Math.max(tier, Math.round(Number(rarity?.maxTier) || tier));
    const ordinary = this.#rarityOptions.filter(
      (option) => option.id !== "unique",
    );
    const normalized = maxTier <= 1 ? 0 : (tier - 1) / (maxTier - 1);
    const index = Math.round(normalized * Math.max(0, ordinary.length - 1));
    return ordinary[index]?.id || this.#rarityOptions[0].id;
  }

  #compare(left, right, criterionId) {
    if (criterionId === "type") {
      const fallback = this.#typeRanks.size;
      const leftType = String(left?.type || left?.engineStats?.type || "");
      const rightType = String(right?.type || right?.engineStats?.type || "");
      const rankDifference =
        (this.#typeRanks.get(leftType) ?? fallback) -
        (this.#typeRanks.get(rightType) ?? fallback);
      return rankDifference || leftType.localeCompare(rightType, "en");
    }
    if (criterionId === "rarity") {
      return (
        (this.#rarityRanks.get(this.resolveRarityId(left)) || 0) -
        (this.#rarityRanks.get(this.resolveRarityId(right)) || 0)
      );
    }
    return (
      this.#numericValue(left, this.#config.numericPaths?.[criterionId]) -
      this.#numericValue(right, this.#config.numericPaths?.[criterionId])
    );
  }

  #numericValue(item, paths = []) {
    for (const path of paths || []) {
      const value = Number(this.#readPath(item, path));
      if (Number.isFinite(value)) return value;
    }
    return 0;
  }

  #readPath(source, path) {
    let current = source;
    for (const part of String(path || "").split(".")) {
      if (!part) continue;
      if (!current || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  #applyPlacementOrder(sorted, placementOrderKey) {
    const key = String(placementOrderKey || "");
    if (!key) {
      this.#activePlacementKey = null;
      this.#placementOrder = Object.freeze([]);
      return sorted;
    }
    if (this.#activePlacementKey !== key) {
      this.#activePlacementKey = key;
      this.#placementOrder = Object.freeze([...this.#lastResolvedOrder]);
    }
    if (!this.#placementOrder.length) return sorted;
    const ranks = new Map(
      this.#placementOrder.map((instanceId, index) => [instanceId, index]),
    );
    const retained = [];
    const appeared = [];
    for (const item of sorted) {
      if (ranks.has(item.instanceId)) retained.push(item);
      else appeared.push(item);
    }
    retained.sort(
      (left, right) => ranks.get(left.instanceId) - ranks.get(right.instanceId),
    );
    return [...retained, ...appeared];
  }

  #criterionId(candidate) {
    const id = String(candidate || this.#config.defaults.criterionId);
    return this.#config.criteria.some((criterion) => criterion.id === id)
      ? id
      : this.#config.defaults.criterionId;
  }

  #directionId(candidate) {
    const id = String(candidate || this.#config.defaults.directionId);
    return this.#config.directions.some((direction) => direction.id === id)
      ? id
      : this.#config.defaults.directionId;
  }

  #validRarityIds(candidates = []) {
    return new Set(
      [...(candidates || [])]
        .map((value) => String(value || ""))
        .filter((id) => this.#rarityRanks.has(id)),
    );
  }

  #cssColor(color) {
    const channels = Array.isArray(color)
      ? color.slice(0, 3).map((value) => Math.max(0, Math.min(255, Number(value) || 0)))
      : [145, 150, 160];
    return `rgb(${channels.join(", ")})`;
  }
}

globalThis.InventoryV2ItemOrderResolver = InventoryV2ItemOrderResolver;
