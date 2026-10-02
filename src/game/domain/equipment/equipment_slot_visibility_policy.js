import { EQUIPMENT_ALL_SLOT_IDS } from "./equipment_slot_catalog.js";
import { EQUIPMENT_SLOT_CONFIG } from "./equipment_slot_catalog.js";
import { RodCapabilityResolver } from "./rod_capability_resolver.js";

export class EquipmentSlotVisibilityPolicy {
  #slotConfig;
  #capabilityResolver;

  constructor({
    slotConfig = null,
    capabilityResolver = null,
  } = {}) {
    this.#slotConfig =
      slotConfig || EQUIPMENT_SLOT_CONFIG;
    this.#capabilityResolver =
      capabilityResolver || new RodCapabilityResolver();
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
      slotIds || EQUIPMENT_ALL_SLOT_IDS;
    return source.filter((slotId) => this.isVisible(slotId, { rod }));
  }
}
