/**
 * Anti-corruption layer for legacy fishing systems. It unfolds inventory-v2
 * roots and assembly children into the former flat equipment read model.
 */
class EquipmentProjectionService {
  #itemReader;
  #assemblyReader;
  #capabilityResolver;

  constructor({
    itemReader,
    assemblyReader,
    capabilityResolver = null,
  } = {}) {
    this.#itemReader = itemReader;
    this.#assemblyReader = assemblyReader;
    this.#capabilityResolver =
      capabilityResolver ||
      (typeof RodCapabilityResolver !== "undefined"
        ? new RodCapabilityResolver()
        : null);
  }

  project(equipmentState) {
    const rod = this.#rootItem(equipmentState, "rod");
    const reel = this.#rootItem(equipmentState, "reel");
    const terminalLine = this.#rootItem(equipmentState, "terminalLine");
    const tackle = this.#rootItem(equipmentState, "tackle");
    const float = this.#rootItem(equipmentState, "float");
    const net = this.#rootItem(equipmentState, "net");
    const delivery = this.#rootItem(equipmentState, "delivery");
    const handChum = this.#rootItem(equipmentState, "handChum");

    const reelLine = reel
      ? this.#child(this.#instanceId(reel), "line", 0)
      : null;
    const terminalType = this.#type(terminalLine);
    const line = reelLine || (terminalType === "fishing_line" ? terminalLine : null);
    const leader = terminalType === "leader_line" ? terminalLine : null;

    const hooks = this.#resolveHooks(tackle);
    const baits = this.#resolveBaits(tackle, hooks);
    const feederRig = this.#isFeederTackle(rod, tackle) ? tackle : null;
    const feederChum = feederRig
      ? this.#child(this.#instanceId(tackle), "chum", 0) ||
        this.#child(this.#instanceId(tackle), "feederChum", 0)
      : null;
    const deliveryChums = this.#resolveIndexedChildren(
      delivery,
      ["cargo", "bay"],
      "cargo",
    );

    return Object.freeze({
      rod,
      reel,
      line,
      leader,
      float,
      feederRig,
      hooks: Object.freeze(hooks),
      baits: Object.freeze(baits),
      feederChum,
      net,
      delivery,
      deliveryChums: Object.freeze(deliveryChums),
      handChum,
    });
  }

  #resolveHooks(tackle) {
    if (!tackle) return [];
    if (this.#type(tackle) === "hook") return [tackle];
    return this.#resolveIndexedChildren(tackle, ["hook", "hooks"], "hook");
  }

  #resolveBaits(tackle, hooks) {
    if (!tackle) return [];
    if (["lure", "spinner", "wobbler", "jig"].includes(this.#type(tackle))) {
      return [tackle];
    }
    return hooks.map((hook) =>
      hook ? this.#child(this.#instanceId(hook), "bait", 0) : null,
    );
  }

  #resolveIndexedChildren(rootItem, slotAliases, refillPathPrefix) {
    if (!rootItem) return [];
    const rootInstanceId = this.#instanceId(rootItem);
    let source = [];
    let selectedSlotId = slotAliases[0];
    for (const slotId of slotAliases) {
      const children = this.#assemblyReader?.getChildren?.(rootInstanceId, slotId);
      if (Array.isArray(children) && children.length > 0) {
        source = children;
        selectedSlotId = slotId;
        break;
      }
    }

    let maxIndex = source.length - 1;
    for (let index = 0; index < source.length; index += 1) {
      const explicitIndex = this.#childSlotIndex(source[index]);
      if (explicitIndex !== null) maxIndex = Math.max(maxIndex, explicitIndex);
    }
    const assemblyState =
      this.#assemblyReader?.getAssemblyState?.(rootInstanceId) || null;
    const remembered = assemblyState?.refillSignatures || {};
    for (const path of Object.keys(remembered)) {
      const match = path.match(
        new RegExp(`^(?:${refillPathPrefix}|${selectedSlotId})\\[(\\d+)\\]`),
      );
      if (match) maxIndex = Math.max(maxIndex, Number(match[1]));
    }
    const assemblyCapacity = assemblyState
      ? this.#assemblyReader?.getSlotCapacity?.(rootInstanceId, selectedSlotId)
      : null;
    const configuredCount = Number(
      assemblyCapacity ??
        rootItem.slotCount ??
        rootItem.sections ??
        rootItem.hooksCount ??
        rootItem.engineStats?.slotCount ??
        rootItem.engineStats?.sections ??
        rootItem.engineStats?.hooksCount,
    );
    if (Number.isInteger(configuredCount) && configuredCount > 0) {
      maxIndex = Math.max(maxIndex, configuredCount - 1);
    }
    if (maxIndex < 0) return [];

    const result = new Array(maxIndex + 1).fill(null);
    for (let index = 0; index <= maxIndex; index += 1) {
      const direct = this.#child(rootInstanceId, selectedSlotId, index);
      if (direct) result[index] = direct;
    }
    for (let index = 0; index < source.length; index += 1) {
      const item = this.#item(source[index]);
      const explicitIndex = this.#childSlotIndex(source[index]);
      const targetIndex = explicitIndex === null ? index : explicitIndex;
      if (item && !result[targetIndex]) result[targetIndex] = item;
    }
    return result;
  }

  #isFeederTackle(rod, tackle) {
    if (!tackle) return false;
    const type = this.#type(tackle);
    if (["feeder_rig", "spring", "feeder_tackle"].includes(type)) return true;
    return this.#capabilityResolver?.resolve?.(rod)?.supportsFeederRig === true;
  }

  #rootItem(equipmentState, slotId) {
    let reference = null;
    if (typeof equipmentState?.getRootInstanceId === "function") {
      reference = equipmentState.getRootInstanceId(slotId);
    } else {
      reference =
        equipmentState?.rootInstanceIds?.[slotId] ?? equipmentState?.[slotId] ?? null;
    }
    return this.#item(reference);
  }

  #child(parentInstanceId, slotId, slotIndex) {
    if (!parentInstanceId) return null;
    return this.#item(
      this.#assemblyReader?.getChild?.(parentInstanceId, slotId, slotIndex) || null,
    );
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

  #instanceId(item) {
    return item?.instanceId || null;
  }

  #type(item) {
    return item?.type ?? item?.engineStats?.type ?? null;
  }

  #childSlotIndex(reference) {
    if (!reference || typeof reference !== "object") return null;
    const raw =
      reference.parentSlotIndex ??
      reference.slotIndex ??
      reference.attachment?.slotIndex ??
      reference.location?.slotIndex;
    const index = Number(raw);
    return Number.isInteger(index) && index >= 0 ? index : null;
  }
}
