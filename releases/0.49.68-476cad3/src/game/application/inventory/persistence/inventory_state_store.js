export const INVENTORY_SCHEMA_VERSION = 4;

/**
 * Persistence boundary for inventory.
 *
 * Domain services receive plain snapshots and never depend on localStorage or
 * LocalStorageCache directly. This keeps persistence replaceable and makes a failed
 * migration recoverable without mutating the legacy cache keys.
 */
export class InventoryStateStore {
  #cache;
  #key;
  #itemSnapshotMapper;

  constructor({
    cache,
    key = "player_inventory_v2",
    itemSnapshotMapper,
  } = {}) {
    if (!cache || typeof cache.get !== "function" || typeof cache.set !== "function") {
      throw new TypeError("InventoryStateStore requires a cache adapter");
    }
    if (!itemSnapshotMapper?.toSnapshots) {
      throw new TypeError(
        "InventoryStateStore requires InventoryItemSnapshotMapper",
      );
    }
    this.#cache = cache;
    this.#key = key;
    this.#itemSnapshotMapper = itemSnapshotMapper;
  }

  load() {
    const snapshot = this.#cache.get(this.#key, null);
    if (!snapshot || snapshot.schemaVersion !== INVENTORY_SCHEMA_VERSION) {
      return null;
    }
    return this.#clone(snapshot);
  }

  loadPrevious(acceptedVersions = [3, 2]) {
    const snapshot = this.#cache.get(this.#key, null);
    const accepted = new Set(acceptedVersions.map((value) => Number(value)));
    if (!snapshot || !accepted.has(Number(snapshot.schemaVersion))) return null;
    return this.#clone(snapshot);
  }

  save(snapshot) {
    const normalized = this.#normalize(snapshot);
    this.#keepLowerCharge(normalized, this.#cache.get(this.#key, null));
    this.#cache.set(this.#key, normalized);
    return this.#clone(normalized);
  }

  #normalize(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      throw new TypeError("Inventory snapshot must be an object");
    }
    const grants = this.#grants(snapshot.grants);
    return {
      schemaVersion: INVENTORY_SCHEMA_VERSION,
      items: this.#itemSnapshotMapper.toSnapshots(this.#array(snapshot.items)),
      assemblies: this.#array(snapshot.assemblies),
      equipment: this.#object(snapshot.equipment),
      loadouts: this.#array(snapshot.loadouts),
      settings: {
        autoBait: snapshot.settings?.autoBait === true,
        autoChum: snapshot.settings?.autoChum === true,
        refillMemory: this.#object(snapshot.settings?.refillMemory),
      },
      ...(grants.length > 0 ? { grants } : {}),
    };
  }

  // Spec 143: a battery's charge only falls. When another tab of the game has already saved a lower charge for the
  // same battery, the lower one is kept (a missing chargeState is a full battery).
  #keepLowerCharge(normalized, stored) {
    if (!Array.isArray(stored?.items)) return;
    const storedCharge = new Map();
    for (const item of stored.items) {
      if (item?.chargeState && Number.isFinite(Number(item.chargeState.percent))) {
        storedCharge.set(item.instanceId, Number(item.chargeState.percent));
      }
    }
    if (storedCharge.size === 0) return;
    for (const item of normalized.items) {
      if (!storedCharge.has(item.instanceId)) continue;
      const current = Number(item.chargeState?.percent ?? 100);
      const lower = storedCharge.get(item.instanceId);
      if (lower < current) item.chargeState = { percent: lower };
    }
  }

  // One-time grant ids (spec 143): unique non-empty strings, sorted.
  #grants(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id) => typeof id === "string" && id.length > 0))].sort();
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
