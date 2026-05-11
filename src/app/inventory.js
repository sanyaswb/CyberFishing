class EquipmentService {
  #inventory;

  constructor(inventory) {
    this.#inventory = inventory;
  }

  getEquipped() {
    return this.#inventory.getEquipped();
  }

  getPrimaryHook(eq = this.getEquipped()) {
    return eq?.hooks?.[0] || null;
  }

  getActiveBaits(eq = this.getEquipped()) {
    return eq?.baits || [];
  }

  consumeFirstBait(eq = this.getEquipped()) {
    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (baits[i]?.type === "bait") {
        return this.#inventory.consumeEquipped(`baits_${i}`, 1, false);
      }
    }
    return false;
  }

  consumeAllBaits(eq = this.getEquipped()) {
    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (baits[i]) this.#inventory.consumeEquipped(`baits_${i}`, 1);
    }
  }

  consumeAllHooks(eq = this.getEquipped()) {
    const hooks = eq?.hooks || [];
    for (let i = 0; i < hooks.length; i++) {
      if (hooks[i]) this.#inventory.consumeEquipped(`hooks_${i}`, 1);
    }
  }

  consumeHook(index) {
    if (!Number.isInteger(index) || index < 0) return false;
    return this.#inventory.consumeEquipped(`hooks_${index}`, 1);
  }

  consumeFloat(eq = this.getEquipped()) {
    if (!eq?.float) return false;
    return this.#inventory.consumeEquipped("float", 1);
  }

  consumeSinker(eq = this.getEquipped()) {
    if (!eq?.sinker) return false;
    return this.#inventory.consumeEquipped("sinker", 1);
  }

  consumeRod(eq = this.getEquipped()) {
    if (!eq?.rod) return false;
    return this.#inventory.consumeEquipped("rod", 1);
  }

  consumeFeederChum(eq = this.getEquipped(), unequipAfterConsume = false) {
    if (!eq?.feederChum) return false;
    return this.#inventory.consumeEquipped(
      "feederChum",
      1,
      unequipAfterConsume,
    );
  }

  consumeDeliveryChum(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return false;
    return this.#inventory.consumeEquipped(`deliveryChums_${slotIndex}`, 1);
  }
}
