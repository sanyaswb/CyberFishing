import { ConfiguredInventorySeeder } from "../configured_inventory_seeder.js";
import { EquipmentStateMigrationPolicy } from "./equipment_state_migration_policy.js";
import { InventoryItemIdMigrationPolicy } from "./inventory_item_id_migration_policy.js";
import { LegacyInventoryItems } from "./legacy_inventory_items.js";

// Reads the classic save keys, applies the legacy id and equipment migrations and seeds the configured starting
// items. The inventory loads it only when it has no current save and a classic save exists.
export class LegacyInventorySaveSource {
  #cache;
  #itemDB;
  #playerConfig;
  #itemFactory;

  constructor({ cache, itemDB, playerConfig, itemFactory }) {
    this.#cache = cache;
    this.#itemDB = itemDB;
    this.#playerConfig = playerConfig;
    this.#itemFactory = itemFactory;
  }

  hasSave() {
    return this.#cache.get("player_inventory") != null || this.#cache.get("player_equipment") != null;
  }

  load() {
    const cachedInventory = InventoryItemIdMigrationPolicy.migrateItems(
      this.#cache.get("player_inventory") || this.#playerConfig.inventory || [],
    );
    const cachedEquipment = EquipmentStateMigrationPolicy.migrate({
      equipment:
        this.#cache.get("player_equipment") || this.#playerConfig.equipment || {},
      inventoryItems: cachedInventory,
      itemDB: this.#itemDB,
    });
    const inventory = new LegacyInventoryItems(cachedInventory, this.#itemFactory);
    new ConfiguredInventorySeeder({
      inventory,
      itemDB: this.#itemDB,
      playerConfig: this.#playerConfig,
    }).seed();
    return Object.freeze({
      inventory,
      equipment: cachedEquipment,
      settings: this.#playerConfig?.inventorySettings || {},
    });
  }
}
