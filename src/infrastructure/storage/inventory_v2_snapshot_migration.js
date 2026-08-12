class InventoryV2SnapshotMigration {
  #definitionResolver;
  #itemStateMigration;
  #targetSchemaVersion;

  constructor({
    itemDefinitionResolver,
    itemStateMigration = new LegacyItemStateMigration(),
    targetSchemaVersion,
  } = {}) {
    this.#definitionResolver = itemDefinitionResolver;
    this.#itemStateMigration = itemStateMigration;
    this.#targetSchemaVersion = Number(targetSchemaVersion);
    if (!Number.isInteger(this.#targetSchemaVersion)) {
      throw new TypeError("InventoryV2SnapshotMigration requires targetSchemaVersion");
    }
  }

  migrate(snapshot = {}) {
    const sourceItems = Array.isArray(snapshot.items) ? snapshot.items : [];
    const items = sourceItems
      .map((item) => {
          const definition = this.#definition(item?.itemId) || {};
          return this.#itemStateMigration.migrate(item, definition);
        });
    const migrated =
      Number(snapshot.schemaVersion) !== this.#targetSchemaVersion ||
      sourceItems.some((item) => this.#hasLegacyFields(item));
    return Object.freeze({
      snapshot: {
        schemaVersion: this.#targetSchemaVersion,
        items,
        assemblies: this.#cloneArray(snapshot.assemblies),
        equipment: this.#cloneObject(snapshot.equipment),
        loadouts: this.#cloneArray(snapshot.loadouts),
        settings: this.#cloneObject(snapshot.settings),
      },
      warnings: Object.freeze(
        migrated
          ? [
              `Inventory snapshot schema ${snapshot.schemaVersion ?? "unknown"} migrated to ${this.#targetSchemaVersion}.`,
            ]
          : [],
      ),
    });
  }

  #hasLegacyFields(item) {
    if (!item || typeof item !== "object") return false;
    return ["type", "level", "engineStats", "effectiveStats"].some((key) =>
      Object.prototype.hasOwnProperty.call(item, key),
    );
  }

  #definition(itemId) {
    if (!itemId) return null;
    if (typeof this.#definitionResolver === "function") {
      return this.#definitionResolver(itemId) || null;
    }
    return (
      this.#definitionResolver?.getItemData?.(itemId) ||
      this.#definitionResolver?.get?.(itemId) ||
      null
    );
  }

  #cloneArray(value) {
    return Array.isArray(value) ? this.#clone(value) : [];
  }

  #cloneObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? this.#clone(value)
      : {};
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

globalThis.InventoryV2SnapshotMigration = InventoryV2SnapshotMigration;
