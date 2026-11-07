import { InventoryItemIdMigrationPolicy } from "./persistence/inventory_item_id_migration_policy.js";

export class ConfiguredInventorySeeder {
  static #legacyDebugBuildInstanceIds = [
    "debug_build_box_001",
    "debug_build_box_002",
    "debug_rod_001",
    "debug_line_001",
    "debug_reel_001",
    "debug_hook_001",
    "debug_chum_001",
    "debug_rod_002",
    "debug_line_002",
    "debug_feeder_spring_001",
    "debug_hook_basic_002",
    "debug_reel_test_002",
  ];

  #inventory;
  #itemDB;
  #playerConfig;

  constructor({ inventory, itemDB, playerConfig }) {
    this.#inventory = inventory;
    this.#itemDB = itemDB || {};
    this.#playerConfig = playerConfig || {};
  }

  seed() {
    this.#seedConfiguredInventory();
    this.#removeLegacyDebugBuildFixtures();
    this.#seedBuildTemplates();
  }

  #seedConfiguredInventory() {
    const configuredInventory = this.#playerConfig.inventory || [];
    for (let i = 0; i < configuredInventory.length; i++) {
      this.#syncConfiguredInventoryItem(configuredInventory[i]);
    }
  }

  #syncConfiguredInventoryItem(item) {
    const migratedItem = InventoryItemIdMigrationPolicy.migrateItem(item);
    if (!migratedItem?.instanceId) return;

    const existing = this.#inventory.getInstance(migratedItem.instanceId);
    if (!existing) {
      this.#inventory.addItem({ ...migratedItem });
      return;
    }

    const migratedExisting = InventoryItemIdMigrationPolicy.migrateItem(existing);
    if (!migratedExisting) {
      this.#inventory.remove(existing.instanceId);
      this.#inventory.addItem({ ...migratedItem });
      return;
    }
    const existingItemId = migratedExisting.itemId;
    if (
      existingItemId !== migratedItem.itemId ||
      existing.buildId !== migratedItem.buildId
    ) {
      this.#inventory.addItem({ ...existing, ...migratedItem });
    }
  }

  #seedBuildTemplates() {
    const buildTemplates = this.#itemDB.builds || {};
    for (const template of Object.values(buildTemplates)) {
      this.#seedBuildTemplate(template);
    }
  }

  #removeLegacyDebugBuildFixtures() {
    const legacyIds = ConfiguredInventorySeeder.#legacyDebugBuildInstanceIds;
    for (let i = 0; i < legacyIds.length; i++) {
      this.#inventory.remove(legacyIds[i]);
    }
  }

  #seedBuildTemplate(template) {
    if (!template?.id || !Array.isArray(template.items)) return;

    const buildBoxId = `${template.id}_box`;
    this.#addMissingInventoryItem({
      instanceId: buildBoxId,
      itemId: "sys_build_box",
      quantity: 1,
      buildName: template.name || template.id,
      type: "build_box",
    });

    for (let i = 0; i < template.items.length; i++) {
      const item = InventoryItemIdMigrationPolicy.migrateItem(template.items[i]);
      if (!item?.itemId) continue;
      this.#addMissingInventoryItem({
        instanceId: `${template.id}_item_${i}`,
        itemId: item.itemId,
        quantity: item.quantity || 1,
        buildId: buildBoxId,
      });
    }
  }

  #addMissingInventoryItem(item) {
    if (!item?.instanceId || this.#inventory.getInstance(item.instanceId)) return;
    this.#inventory.addItem({ ...item });
  }
}
