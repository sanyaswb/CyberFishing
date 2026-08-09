const INVENTORY_V2_SCHEMA_VERSION = 2;

/**
 * Persistence boundary for inventory-v2.
 *
 * Domain services receive plain snapshots and never depend on localStorage or
 * CacheManager directly. This keeps persistence replaceable and makes a failed
 * migration recoverable without mutating the legacy cache keys.
 */
class InventoryV2StateStore {
  #cache;
  #key;

  constructor({
    cache = typeof CacheManager !== "undefined" ? CacheManager : null,
    key = "player_inventory_v2",
  } = {}) {
    if (!cache || typeof cache.get !== "function" || typeof cache.set !== "function") {
      throw new TypeError("InventoryV2StateStore requires a cache adapter");
    }
    this.#cache = cache;
    this.#key = key;
  }

  load() {
    const snapshot = this.#cache.get(this.#key, null);
    if (!snapshot || snapshot.schemaVersion !== INVENTORY_V2_SCHEMA_VERSION) {
      return null;
    }
    return this.#clone(snapshot);
  }

  save(snapshot) {
    const normalized = this.#normalize(snapshot);
    this.#cache.set(this.#key, normalized);
    return this.#clone(normalized);
  }

  #normalize(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      throw new TypeError("Inventory-v2 snapshot must be an object");
    }
    return {
      schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
      items: this.#array(snapshot.items),
      assemblies: this.#array(snapshot.assemblies),
      equipment: this.#object(snapshot.equipment),
      loadouts: this.#array(snapshot.loadouts),
      settings: {
        autoBait: snapshot.settings?.autoBait === true,
        autoChum: snapshot.settings?.autoChum === true,
        refillMemory: this.#object(snapshot.settings?.refillMemory),
      },
    };
  }

  #array(value) {
    return Array.isArray(value) ? this.#clone(value) : [];
  }

  #object(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? this.#clone(value)
      : {};
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

globalThis.INVENTORY_V2_SCHEMA_VERSION = INVENTORY_V2_SCHEMA_VERSION;
globalThis.InventoryV2StateStore = InventoryV2StateStore;
