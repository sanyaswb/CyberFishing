/**
 * Converts legacy quantity references into unique physical units. It also
 * remembers allocated units so an active item that belongs to a legacy build
 * can reuse the exact same unit now owned by the migrated loadout.
 */
class LegacyInventoryUnitAllocator {
  #repository;
  #allocations = new Map();

  constructor({ repository } = {}) {
    this.#repository = repository;
  }

  allocate(legacyInstanceId) {
    const source = this.#repository.get(legacyInstanceId);
    if (!source || !InventoryItemLocation.isInventory(source.location)) {
      return null;
    }
    const allocated = this.#allocations.get(legacyInstanceId) || [];
    if (source.quantity === 1 && allocated.includes(source.instanceId)) {
      return null;
    }
    const unit = this.#repository.splitOne(legacyInstanceId);
    if (allocated.includes(unit.instanceId)) return null;
    allocated.push(unit.instanceId);
    this.#allocations.set(legacyInstanceId, allocated);
    return unit.instanceId;
  }

  reuseOrAllocate(legacyInstanceId, occurrenceIndex = 0) {
    const existing = this.getAllocated(legacyInstanceId, occurrenceIndex);
    return existing || this.allocate(legacyInstanceId);
  }

  getAllocated(legacyInstanceId, occurrenceIndex = 0) {
    return this.#allocations.get(legacyInstanceId)?.[occurrenceIndex] || null;
  }

  getAllocations(legacyInstanceId) {
    return [...(this.#allocations.get(legacyInstanceId) || [])];
  }
}

globalThis.LegacyInventoryUnitAllocator = LegacyInventoryUnitAllocator;
