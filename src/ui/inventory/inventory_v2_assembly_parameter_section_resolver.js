class InventoryV2AssemblyParameterSectionResolver {
  resolve(model = {}) {
    const sections = [];
    if (model.root) {
      sections.push(this.#section({
        id: `root:${model.root.instanceId || "item"}`,
        item: model.root,
        title: model.root.name || model.rootLabel || "Основний предмет",
        slotLabel: "Основний предмет",
        count: 1,
      }));
    }

    const rootInstanceId = model.root?.instanceId || null;
    const uniqueItems = new Map();
    for (const socket of model.sockets || []) {
      const item = socket?.item;
      if (!item?.instanceId || item.instanceId === rootInstanceId) continue;
      if (!uniqueItems.has(item.instanceId)) {
        uniqueItems.set(item.instanceId, {
          item,
          slotLabel: socket.label || socket.slotId || "Компонент",
        });
      }
    }
    for (const item of model.parameterItems || []) {
      if (!item?.instanceId || item.instanceId === rootInstanceId) continue;
      if (!uniqueItems.has(item.instanceId)) {
        uniqueItems.set(item.instanceId, {
          item,
          slotLabel: "Компонент спорядження",
        });
      }
    }

    const groups = new Map();
    for (const entry of uniqueItems.values()) {
      const signature = this.#signature(entry.item);
      const current = groups.get(signature);
      if (current) {
        current.count += 1;
        continue;
      }
      groups.set(signature, {
        item: entry.item,
        slotLabel: entry.slotLabel,
        count: 1,
      });
    }

    for (const group of groups.values()) {
      sections.push(this.#section({
        id: `component:${group.item.instanceId}`,
        item: group.item,
        title: group.item.name || group.slotLabel || "Компонент",
        slotLabel: "",
        count: group.count,
      }));
    }
    return Object.freeze(sections);
  }

  #signature(item) {
    return this.#stableSerialize({
      itemId: item.itemId || item.id || item.itemType,
      rarity: item.rarity?.id || item.rarity || item.rarityProfile?.tier,
      progressionLevel:
        item.progression?.progressionLevel?.current ??
        item.progression?.progressionLevel?.value,
      quality:
        item.progression?.quality?.value ??
        item.effectiveStats?.quality,
      condition: item.condition?.percent,
      charge: item.charge?.percent,
      effectiveStats: item.effectiveStats || null,
      displayStats: item.displayStats || null,
    });
  }

  #stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.#stableSerialize(entry)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.#stableSerialize(value[key])}`,
        )
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  #section({ id, item, title, slotLabel, count }) {
    return Object.freeze({
      id,
      item,
      title,
      slotLabel,
      count: Math.max(1, Math.floor(Number(count) || 1)),
    });
  }
}

globalThis.InventoryV2AssemblyParameterSectionResolver =
  InventoryV2AssemblyParameterSectionResolver;
