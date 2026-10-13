import { EquipmentLoadout } from "../../domain/loadouts/equipment_loadout.js";
import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

// Consumes and removes inventory items consistently across stacks, assemblies (with their refill preference),
// equipment slot references, saved loadouts and descendants. Callers run it inside an inventory transaction.
export class InventoryItemRemovalService {
  #repository;
  #assemblyReader;
  #assemblyService;
  #assemblyStates;
  #equipmentState;
  #loadouts;
  #now;

  constructor({
    repository,
    assemblyReader,
    assemblyService,
    assemblyStates,
    equipmentState,
    loadouts,
    now = null,
  }) {
    this.#repository = repository;
    this.#assemblyReader = assemblyReader;
    this.#assemblyService = assemblyService;
    this.#assemblyStates = assemblyStates;
    this.#equipmentState = equipmentState;
    this.#loadouts = loadouts;
    this.#now = now;
  }

  consume(instanceId, amount) {
    const item = this.#repository.get(instanceId);
    const quantity = Number(item?.quantity || 0);
    const requested = Number(amount);
    if (!item || !Number.isInteger(requested) || requested < 1 || quantity < requested) {
      return false;
    }
    if (quantity > requested) {
      this.#repository.update(instanceId, { quantity: quantity - requested });
      return true;
    }

    if (InventoryItemLocation.isAttached(item.location)) {
      if (this.#repository.getChildren(item.instanceId).length === 0) {
        const rootInstanceId = this.#assemblyReader.getRootInstanceId(
          item.instanceId,
        );
        this.#assemblyService.consume({
          rootInstanceId,
          parentInstanceId: item.location.parentInstanceId,
          slotId: item.location.slotId,
          slotIndex: item.location.slotIndex,
        });
        return true;
      }
      const rootInstanceId = this.#assemblyReader.getRootInstanceId(item.instanceId);
      const path = this.#assemblyReader.getPathToItem(rootInstanceId, item.instanceId);
      this.#assemblyService.clearRefillPreference(rootInstanceId, path);
      this.#removeSubtree(item.instanceId);
      return true;
    }

    this.clearEquipmentRootReference(item.instanceId);
    this.releaseRootFromLoadout(item.instanceId);
    this.#removeSubtree(item.instanceId);
    return true;
  }

  releaseRootFromLoadout(instanceId) {
    const item = this.#repository.get(instanceId);
    if (!InventoryItemLocation.isLoadout(item?.location)) return;
    const location = item.location;
    const loadout = this.#loadouts.require(location.loadoutId);
    const roots = { ...loadout.getRootInstanceIds(), [location.slotId]: null };
    this.#loadouts.remove(loadout.loadoutId);
    if (Object.values(roots).some(Boolean)) {
      this.#loadouts.add(
        new EquipmentLoadout({
          loadoutId: loadout.loadoutId,
          name: loadout.name,
          rootInstanceIds: roots,
          createdAt: loadout.createdAt,
          updatedAt: (this.#now ? new Date(this.#now()) : new Date()).toISOString(),
          now: this.#now,
        }),
      );
    }
    this.#repository.setLocation(instanceId, InventoryItemLocation.inventory());
  }

  clearEquipmentRootReference(instanceId) {
    if (!instanceId) return;
    for (const slotId of this.#equipmentState.getSlotIds()) {
      if (this.#equipmentState.getRootInstanceId(slotId) === instanceId) {
        this.#equipmentState.clear(slotId);
      }
    }
  }

  #removeSubtree(instanceId) {
    const descendants = this.#repository
      .listDescendants(instanceId)
      .sort((left, right) => right.depth - left.depth);
    for (const entry of descendants) {
      if (this.#repository.has(entry.item.instanceId)) {
        this.#repository.remove(entry.item.instanceId);
      }
    }
    if (this.#assemblyStates.has(instanceId)) {
      this.#assemblyStates.remove(instanceId);
    }
    if (this.#repository.has(instanceId)) this.#repository.remove(instanceId);
  }
}
