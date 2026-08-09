class EquipmentSlotVisibilityPolicy {
  #slotConfig;
  #capabilityResolver;

  constructor({
    slotConfig = null,
    capabilityResolver = null,
  } = {}) {
    this.#slotConfig =
      slotConfig ||
      (typeof EQUIPMENT_SLOT_CONFIG !== "undefined" ? EQUIPMENT_SLOT_CONFIG : {});
    this.#capabilityResolver =
      capabilityResolver ||
      (typeof RodCapabilityResolver !== "undefined"
        ? new RodCapabilityResolver()
        : null);
  }

  isVisible(slotId, { rod = null } = {}) {
    const config = this.#slotConfig[slotId];
    if (!config) return false;
    if (config.group === "auxiliary" || config.visibility === "always") return true;
    if (!rod) return false;

    const capabilities = this.#capabilityResolver?.resolve?.(rod) || {};
    if (config.visibility === "supportsReel") {
      return capabilities.supportsReel === true;
    }
    if (config.visibility === "supportsFloat") {
      return capabilities.supportsFloat === true;
    }
    return config.visibility === "rodSelected";
  }

  resolveVisibleSlotIds({ rod = null, slotIds = null } = {}) {
    const source =
      slotIds ||
      (typeof EQUIPMENT_ALL_SLOT_IDS !== "undefined"
        ? EQUIPMENT_ALL_SLOT_IDS
        : Object.keys(this.#slotConfig));
    return source.filter((slotId) => this.isVisible(slotId, { rod }));
  }
}
