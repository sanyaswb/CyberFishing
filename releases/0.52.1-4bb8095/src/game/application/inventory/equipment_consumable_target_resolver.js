// The assembly slots the header consumable switchers fill (bait on a hook, chum in a feeder rig; spec 074).
export const HEADER_CONSUMABLE_SLOT_IDS = Object.freeze(["bait", "chum"]);

// Header consumables belong to the equipped cast tackle, never to hand chum or boat cargo.
export class EquipmentConsumableTargetResolver {
  #equipmentState;
  #targets;

  constructor({ equipmentState, attachmentTargetResolver }) {
    if (!equipmentState?.getRootInstanceId || !attachmentTargetResolver?.listTargets) {
      throw new TypeError("EquipmentConsumableTargetResolver requires equipment state and attachment targets");
    }
    this.#equipmentState = equipmentState;
    this.#targets = attachmentTargetResolver;
  }

  list(kind) {
    const rootInstanceId = this.#equipmentState.getRootInstanceId("tackle");
    return this.#targets.listTargets(rootInstanceId).filter((target) => target.slotId === kind);
  }

  resolve(kind, slotIndex) {
    return this.list(kind)[slotIndex] || null;
  }
}
