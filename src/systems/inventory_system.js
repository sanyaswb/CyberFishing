class InventoryManager {
  #itemDB;
  #inventory;
  #equipment;

  constructor(itemDB, playerConfig) {
    this.#itemDB = itemDB;
    this.#inventory =
      CacheManager.get("player_inventory") || playerConfig.inventory || [];
    this.#equipment =
      CacheManager.get("player_equipment") || playerConfig.equipment || {};
  }

  getEquipped() {
    return {
      rod: this._hydrateItem(this.#equipment.rodId, "rods"),
      reel: this._hydrateItem(this.#equipment.reelId, "reels"),
      hook: this._hydrateItem(this.#equipment.hookId, "hooks"),
      float: this._hydrateItem(this.#equipment.floatId, "floats"),
      sinker: this._hydrateItem(this.#equipment.sinkerId, "sinkers"),
      net: this._hydrateItem(this.#equipment.netId, "nets"),
      baits: this.#equipment.baits || [],
      feeder: {
        chumId: this.#equipment.feeder?.chumId,
        deliveryMethodId: this.#equipment.feeder?.deliveryMethodId,
      },
    };
  }

  equipBait(itemId) {
    this.#equipment.baits = [itemId];
    this.#saveAndNotify();
  }

  unequipBait() {
    this.#equipment.baits = [];
    this.#saveAndNotify();
  }

  equipFeeder(itemId) {
    if (!this.#equipment.feeder) this.#equipment.feeder = {};
    this.#equipment.feeder.chumId = itemId;
    this.#saveAndNotify();
  }

  unequipFeeder() {
    if (this.#equipment.feeder) this.#equipment.feeder.chumId = null;
    this.#saveAndNotify();
  }

  _hydrateItem(id, category) {
    if (!id) return null;
    const item = this.#itemDB[category]?.[id];
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      icon: item.icon,
      type: item.engineStats?.type || item.type,
      ...item.displayStats,
      ...item.engineStats,
    };
  }

  getInventoryItems() {
    return this.#inventory;
  }

  equipItem(slot, itemId) {
    const key = slot.endsWith("Id") ? slot : `${slot}Id`;
    this.#equipment[key] = itemId;
    this.#saveAndNotify();
  }

  unequipItem(slot) {
    const key = slot.endsWith("Id") ? slot : `${slot}Id`;
    this.#equipment[key] = null;
    this.#saveAndNotify();
  }

  #saveAndNotify() {
    CacheManager.set("player_equipment", this.#equipment);
    document.dispatchEvent(
      new CustomEvent("inventory-changed", {
        detail: { equipment: this.getEquipped() },
      }),
    );
  }
}
