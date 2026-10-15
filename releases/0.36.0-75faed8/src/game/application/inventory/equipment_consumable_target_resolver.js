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
