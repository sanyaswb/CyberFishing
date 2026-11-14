import { AssemblyStateRepository } from "../../../domain/assemblies/assembly_state_repository.js";
import { AutoRefillMemory } from "../../../domain/equipment/auto_refill_memory.js";
import { AutoRefillSettings } from "../../../domain/equipment/auto_refill_settings.js";
import { EquipmentLoadoutRepository } from "../../../domain/loadouts/equipment_loadout_repository.js";
import { EquipmentState } from "../../../domain/equipment/equipment_state.js";
import { FlatInventoryItemRepository } from "../../../domain/inventory/flat_inventory_item_repository.js";
import { InventoryGrantLedger } from "../../../domain/inventory/inventory_grant_ledger.js";
import { InventoryItemLocation } from "../../../domain/inventory/inventory_item_location.js";
import { InventorySnapshotFactory } from "./inventory_snapshot_factory.js";

// A new player's inventory in the current save format: the configured starting items lie in the inventory,
// starting equipment and assemblies are equipped when configured, and the configured auto-refill settings apply.
export class StartingInventorySnapshotFactory {
  #itemSnapshotMapper;

  constructor({ itemSnapshotMapper }) {
    this.#itemSnapshotMapper = itemSnapshotMapper;
  }

  // grants: one-time grant ids a new player already has in the starting items (spec 143: the first battery).
  create({ items = [], equipment = {}, assemblies = [], buildTemplates = {}, settings = {}, grants = [] } = {}) {
    const normalizedItems = items.map((item) => ({
      ...item,
      location: item.location ? InventoryItemLocation.normalize(item.location) : InventoryItemLocation.inventory(),
    }));
    return new InventorySnapshotFactory({
      repository: new FlatInventoryItemRepository({
        items: normalizedItems,
      }),
      assemblyStates: new AssemblyStateRepository({ states: assemblies }),
      equipmentState: new EquipmentState(this.#normalizeEquipment(equipment)),
      loadouts: new EquipmentLoadoutRepository(),
      settings: new AutoRefillSettings(settings),
      refillMemory: new AutoRefillMemory(),
      itemSnapshotMapper: this.#itemSnapshotMapper,
      grantLedger: new InventoryGrantLedger(grants),
    }).create();
  }

  #normalizeEquipment(equipment = {}) {
    if (!equipment || typeof equipment !== "object") return {};
    const normalized = {};
    for (const [key, value] of Object.entries(equipment)) {
      const slotId = key.endsWith("Id") ? key.slice(0, -2) : key;
      normalized[slotId] = value ?? null;
    }
    return normalized;
  }
}
