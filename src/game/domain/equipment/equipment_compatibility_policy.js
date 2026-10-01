import { EQUIPMENT_SLOT_CONFIG } from "./equipment_slot_catalog.js";
import { EquipmentSlotVisibilityPolicy } from "./equipment_slot_visibility_policy.js";
import { RodCapabilityResolver } from "./rod_capability_resolver.js";
import { TerminalLineSlotResolver } from "./terminal_line_slot_resolver.js";

export class EquipmentCompatibilityPolicy {
  #slotConfig;
  #visibilityPolicy;
  #terminalLineResolver;
  #capabilityResolver;
  #readinessPolicy;
  #messages;

  // Player-facing texts are injected by composition.
  constructor({
    slotConfig = typeof EQUIPMENT_SLOT_CONFIG !== "undefined"
      ? EQUIPMENT_SLOT_CONFIG
      : {},
    visibilityPolicy = null,
    terminalLineResolver = null,
    capabilityResolver = null,
    readinessPolicy = null,
    messages = null,
  } = {}) {
    this.#slotConfig = slotConfig;
    this.#capabilityResolver =
      capabilityResolver || new RodCapabilityResolver();
    this.#visibilityPolicy =
      visibilityPolicy ||
      new EquipmentSlotVisibilityPolicy({
        slotConfig,
        capabilityResolver: this.#capabilityResolver,
      });
    this.#terminalLineResolver =
      terminalLineResolver ||
      new TerminalLineSlotResolver({
        capabilityResolver: this.#capabilityResolver,
      });
    this.#readinessPolicy = readinessPolicy;
    this.#messages = messages;
  }

  isCompatible(context = {}) {
    return this.validate(context).isValid;
  }

  validate({
    slotId,
    item,
    equipmentState,
    rod = null,
    enforceReadiness = true,
  } = {}) {
    const config = this.#slotConfig[slotId];
    if (!config || !item) {
      return this.#result(false, this.#messages.itemOrSlotMissing);
    }
    if (config.locked === true) {
      return this.#result(false, this.#messages.equipmentSlotLocked(slotId));
    }

    const selectedRod = rod || this.#readRootItem(equipmentState, "rod");
    if (!this.#visibilityPolicy.isVisible(slotId, { rod: selectedRod })) {
      return this.#result(false, this.#messages.slotUnsupportedByRod);
    }

    const acceptedTypes = this.#acceptedTypes(slotId, config, selectedRod);
    const itemType = this.#type(item);
    if (!acceptedTypes.includes(itemType)) {
      return this.#result(false, this.#messages.itemNotAcceptedBySlot);
    }

    if (slotId === "tackle" && !this.#isTackleCompatible(itemType, selectedRod)) {
      return this.#result(false, this.#messages.tackleIncompatibleWithRod);
    }

    if (enforceReadiness !== false) {
      const readiness = this.#readinessPolicy?.validateEquip?.({
        slotId,
        item,
        equipmentState,
      });
      if (readiness?.isValid === false) {
        return this.#result(false, readiness.reason, readiness.warningCode);
      }
    }
    return this.#result(true);
  }

  #acceptedTypes(slotId, config, rod) {
    if (slotId === "terminalLine") {
      return [...this.#terminalLineResolver.resolve(rod).acceptTypes];
    }
    return [...(config.acceptTypes || [])];
  }

  #isTackleCompatible(type, rod) {
    const capabilities = this.#capabilityResolver.resolve(rod);
    if (capabilities.supportsFeederRig) {
      return ["feeder_rig", "spring", "feeder_tackle"].includes(type);
    }
    if (capabilities.supportsLures) {
      return ["lure", "spinner", "wobbler", "jig"].includes(type);
    }
    if (capabilities.supportsFloat) return type === "hook";
    return false;
  }

  #readRootItem(equipmentState, slotId) {
    const reference =
      equipmentState?.getRootInstanceId?.(slotId) ?? equipmentState?.[slotId];
    return typeof reference === "object" ? reference : null;
  }

  #type(item) {
    return item?.itemType ?? null;
  }

  #result(isValid, reason = null, warningCode = null) {
    return Object.freeze({ isValid, reason, warningCode });
  }
}
