import { AssemblyStateRepository } from "../../../domain/assemblies/assembly_state_repository.js";
import { AutoRefillMemory } from "../../../domain/equipment/auto_refill_memory.js";
import { AutoRefillSettings } from "../../../domain/equipment/auto_refill_settings.js";
import { EquipmentLoadoutRepository } from "../../../domain/loadouts/equipment_loadout_repository.js";
import { EquipmentState } from "../../../domain/equipment/equipment_state.js";
import { FlatInventoryItemRepository } from "../../../domain/inventory/flat_inventory_item_repository.js";
import { InventoryItemLocation } from "../../../domain/inventory/inventory_item_location.js";
import { InventorySnapshotFactory } from "./inventory_snapshot_factory.js";

// A new player's inventory in the current save format: the configured starting items lie in the inventory, nothing
// is equipped, assembled or kept as a loadout, and the configured auto-refill settings apply. No legacy save
// conversion is involved. Starting equipment and build templates are not supported (both are empty today).
export class StartingInventorySnapshotFactory {
  #itemSnapshotMapper;

  constructor({ itemSnapshotMapper }) {
    this.#itemSnapshotMapper = itemSnapshotMapper;
  }

  create({ items = [], equipment = {}, buildTemplates = {}, settings = {} } = {}) {
    this.#assertFlatStart(equipment, buildTemplates);
    return new InventorySnapshotFactory({
      repository: new FlatInventoryItemRepository({
        items: items.map((item) => ({ ...item, location: InventoryItemLocation.inventory() })),
      }),
      assemblyStates: new AssemblyStateRepository(),
      equipmentState: new EquipmentState(),
      loadouts: new EquipmentLoadoutRepository(),
      settings: new AutoRefillSettings(settings),
      refillMemory: new AutoRefillMemory(),
      itemSnapshotMapper: this.#itemSnapshotMapper,
    }).create();
  }

  #assertFlatStart(equipment, buildTemplates) {
    const equipped = Object.keys(equipment || {}).filter((slot) => equipment[slot] != null);
    const templates = Object.keys(buildTemplates || {});
    if (equipped.length > 0 || templates.length > 0) {
      throw new TypeError(
        `Starting inventory supports items and settings only (equipment: ${equipped.join(", ") || "none"}; ` +
          `build templates: ${templates.join(", ") || "none"})`,
      );
    }
  }
}
