const INVENTORY_V2_RESOURCE_METER_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "energy",
    icon: "⚡",
    read: (item) => item?.charge || null,
    fallbackLabel: "Заряд",
  }),
  Object.freeze({
    id: "capacity",
    icon: "",
    read: (item) =>
      item?.progression?.capacity?.available === true
        ? item.progression.capacity
        : null,
    fallbackLabel: "Залишок",
  }),
]);

class InventoryV2ResourceMeterResolver {
  #definitions;

  constructor({ definitions = INVENTORY_V2_RESOURCE_METER_DEFINITIONS } = {}) {
    this.#definitions = Object.freeze([...(definitions || [])]);
  }

  resolve(item) {
    for (const definition of this.#definitions) {
      const reading = definition.read?.(item);
      const percent = Number(reading?.percent);
      if (!Number.isFinite(percent)) continue;
      const normalizedPercent = Math.max(0, Math.min(100, percent));
      const label =
        reading.label ||
        reading.detailLabel ||
        reading.metricLabel ||
        definition.fallbackLabel;
      const roundedPercent = Math.round(normalizedPercent);
      const title = this.#title(label, definition.fallbackLabel);
      return Object.freeze({
        id: definition.id,
        percent: normalizedPercent,
        icon: String(definition.icon || ""),
        title,
        value: `${roundedPercent}%`,
        label: `${title} ${roundedPercent}%`,
      });
    }
    return null;
  }

  #title(value, fallback) {
    const text = String(value || fallback || "Ресурс").trim();
    return text.replace(/\s+\d+(?:[.,]\d+)?%$/, "").trim() || fallback;
  }
}

globalThis.INVENTORY_V2_RESOURCE_METER_DEFINITIONS =
  INVENTORY_V2_RESOURCE_METER_DEFINITIONS;
globalThis.InventoryV2ResourceMeterResolver =
  InventoryV2ResourceMeterResolver;
