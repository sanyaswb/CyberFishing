class ItemCapacityResolver {
  resolve({ item, capacityConfig, context = {} } = {}) {
    if (!capacityConfig || typeof capacityConfig !== "object") {
      return this.#unavailable("capacity_config_missing");
    }
    if (capacityConfig.strategyId !== "line_capacity") {
      return this.#unavailable("capacity_strategy_unsupported");
    }

    const currentLength = this.#number(
      this.#readPath(item, capacityConfig.statPath),
    );
    if (!Number.isFinite(currentLength)) {
      return this.#unavailable("capacity_value_missing");
    }

    const lineContext = context.lineCapacity || {};
    const isEquipped = !!item?.instanceId &&
      item.instanceId === lineContext.equippedLineInstanceId;
    const reelCapacity = this.#number(lineContext.reelCapacityMeters);
    const catalogLength = this.#number(
      this.#readPath(context.catalogItem, capacityConfig.statPath),
    );

    let current = Math.max(0, currentLength);
    let maximum = Number.isFinite(catalogLength) && catalogLength > 0
      ? Math.max(catalogLength, current)
      : current;
    let source = "line_spool";
    let detailLabel = capacityConfig.inventoryDetailLabel || "Залишок ліски";

    if (isEquipped && Number.isFinite(reelCapacity) && reelCapacity > 0) {
      maximum = reelCapacity;
      current = Math.min(current, maximum);
      source = "equipped_reel";
      detailLabel = capacityConfig.equippedDetailLabel || "На котушці";

      const activeState = lineContext.activeState;
      if (
        activeState?.lineInstanceId === item.instanceId &&
        activeState.hasReel === true
      ) {
        const activeRemaining = this.#number(activeState.remainingMeters);
        if (Number.isFinite(activeRemaining)) {
          current = Math.max(0, Math.min(maximum, activeRemaining));
          source = "active_reel";
        }
      }
    }

    if (!Number.isFinite(maximum) || maximum <= 0) {
      return this.#unavailable("capacity_maximum_missing");
    }

    const normalized = Math.max(0, Math.min(1, current / maximum));
    return Object.freeze({
      available: true,
      reason: null,
      strategyId: capacityConfig.strategyId,
      metricLabel: capacityConfig.metricLabel || "Ємність",
      metricSuffix: capacityConfig.metricSuffix || "м",
      detailLabel,
      source,
      current,
      maximum,
      used: Math.max(0, maximum - current),
      normalized,
      percent: Math.round(normalized * 10000) / 100,
    });
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

  #number(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  #unavailable(reason) {
    return Object.freeze({
      available: false,
      reason,
      strategyId: null,
      metricLabel: null,
      metricSuffix: "",
      detailLabel: null,
      source: null,
      current: null,
      maximum: null,
      used: null,
      normalized: null,
      percent: null,
    });
  }
}
