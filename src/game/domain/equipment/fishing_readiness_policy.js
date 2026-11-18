import { EquipmentSlotId } from "./equipment_slot_catalog.js";
import { RodCapabilityResolver } from "./rod_capability_resolver.js";
import { isItemBroken } from "../items/condition/item_condition_quality.js";

export class FishingReadinessPolicy {
  #itemReader;
  #assemblyReader;
  #capabilityResolver;
  #messages;

  // Player-facing texts are injected by composition.
  constructor({
    itemReader = null,
    assemblyReader = null,
    capabilityResolver = null,
    messages = null,
  } = {}) {
    this.#itemReader = itemReader;
    this.#assemblyReader = assemblyReader;
    this.#messages = messages;
    this.#capabilityResolver =
      capabilityResolver || new RodCapabilityResolver();
  }

  validateEquip({ slotId, item, equipmentState } = {}) {
    const reelSlotId = this.#slotId("REEL", "reel");
    const terminalLineSlotId = this.#slotId("TERMINAL_LINE", "terminalLine");
    if (slotId === reelSlotId) {
      return this.#validation(true);
    }
    if (slotId !== terminalLineSlotId || !this.#isLeader(item)) {
      return this.#validation(true);
    }

    const reelRootId = this.#root(equipmentState, reelSlotId);
    const reelLine = reelRootId ? this.#child(reelRootId, "line", 0) : null;
    if (!reelRootId || !reelLine) {
      return this.#validation(
        false,
        this.#messages.leaderRequiresReelLine,
        "reel-line-required-for-leader",
      );
    }
    return this.#validation(true);
  }

  evaluateCast({ equipmentState } = {}) {
    const rodRootId = this.#root(equipmentState, this.#slotId("ROD", "rod"));
    const rod = this.#item(rodRootId);
    if (!rod) {
      return this.#castResult(false, this.#messages.rodRequired, "rod-required");
    }

    const supportsReel =
      this.#capabilityResolver?.resolve?.(rod)?.supportsReel === true;
    if (supportsReel) {
      const reelRootId = this.#root(equipmentState, this.#slotId("REEL", "reel"));
      if (!reelRootId) {
        return this.#castResult(false, this.#messages.reelRequired, "reel-required");
      }
      if (!this.#child(reelRootId, "line", 0)) {
        return this.#castResult(
          false,
          this.#messages.reelLineRequired,
          "reel-line-required",
        );
      }
      return this.#brokenTackleResult(equipmentState);
    }

    const lineRootId = this.#root(
      equipmentState,
      this.#slotId("TERMINAL_LINE", "terminalLine"),
    );
    if (!lineRootId) {
      return this.#castResult(
        false,
        this.#messages.terminalLineRequired,
        "terminal-line-required",
      );
    }
    return this.#brokenTackleResult(equipmentState);
  }

  // Spec 179 D10 (owner Q15): a broken item (condition 0) anywhere in the cast's tackle — the rod, the reel and its line,
  // the terminal line, the rig and their parts — forbids the cast.
  #brokenTackleResult(equipmentState) {
    for (const key of ["ROD", "REEL", "TERMINAL_LINE", "TACKLE"]) {
      const rootId = this.#root(equipmentState, EquipmentSlotId[key]);
      if (!rootId) continue;
      if (isItemBroken(this.#item(rootId))) return this.#brokenTackle();
      for (const child of this.#assemblyReader?.listDescendants?.(rootId) ?? []) {
        if (isItemBroken(this.#item(child?.instanceId))) return this.#brokenTackle();
      }
    }
    return this.#castResult(true);
  }

  #brokenTackle() {
    return this.#castResult(false, this.#messages.brokenTackle, "broken-tackle");
  }

  #castResult(canCast, warning = null, warningCode = null) {
    return Object.freeze({
      canCast,
      shouldOpenInventory: !canCast,
      warning,
      warningCode,
    });
  }

  #validation(isValid, reason = null, warningCode = null) {
    return Object.freeze({ isValid, reason, warningCode });
  }

  #root(state, slotId) {
    if (typeof state?.getRootInstanceId === "function") {
      return state.getRootInstanceId(slotId);
    }
    return state?.rootInstanceIds?.[slotId] ?? state?.[slotId] ?? null;
  }

  #item(reference) {
    if (!reference) return null;
    if (typeof reference === "object") return reference;
    if (typeof this.#itemReader === "function") return this.#itemReader(reference);
    return (
      this.#itemReader?.getById?.(reference) ||
      this.#itemReader?.getInstance?.(reference) ||
      this.#itemReader?.hydrateInstance?.(reference) ||
      this.#itemReader?.get?.(reference) ||
      null
    );
  }

  #child(parentInstanceId, slotId, index) {
    if (!parentInstanceId) return null;
    return this.#item(
      this.#assemblyReader?.getChild?.(parentInstanceId, slotId, index) || null,
    );
  }

  #isLeader(item) {
    return item?.itemType === "leader_line";
  }

  #slotId(key, fallback) {
    return EquipmentSlotId[key];
  }
}
