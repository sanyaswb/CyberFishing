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

  equipDelivery(itemId) {
    if (!this.#equipment.feeder) this.#equipment.feeder = {};
    this.#equipment.feeder.deliveryMethodId = itemId;
    this.#saveAndNotify();
  }

  unequipFeeder() {
    if (this.#equipment.feeder) this.#equipment.feeder.chumId = null;
    this.#saveAndNotify();
  }

  unequipDelivery() {
    if (this.#equipment.feeder) this.#equipment.feeder.deliveryMethodId = null;
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

    // КАСКАДНЕ ЗНЯТТЯ: Якщо знімаємо вудку, знімаємо всі залежні снасті
    if (key === "rodId") {
      this.#equipment.reelId = null;
      this.#equipment.floatId = null;
      this.#equipment.sinkerId = null;
      this.#equipment.hookId = null;
      this.#equipment.baits = []; // Знімаємо наживки

      // Якщо був екіпірований фідер (годівниця), знімаємо і її, і прикормку в ній
      if (this.#equipment.feeder) {
        this.#equipment.feeder.basketId = null; // Уявний ID самої годівниці
        this.#equipment.feeder.chumId = null; // Прикормка всередині
      }
    }

    this.#saveAndNotify();
  }

  // НОВИЙ МЕТОД: Перевіряє, чи можна одягнути предмет, і повертає текст помилки
  validateEquip(item) {
    const eq = this.getEquipped();
    const rodType = eq.rod?.type;
    const rodTypes = ["spinning", "float", "float_match", "feeder"];

    // Незалежні предмети можна одягати завжди
    if (["net", "chum_delivery", "boat"].includes(item.type)) {
      return { isValid: true };
    }

    // Якщо це снасть, але вудки немає в руках, і ти намагаєшся одягнути НЕ вудку
    if (!eq.rod && !rodTypes.includes(item.type)) {
      return { isValid: false, reason: "Спочатку екіпіруйте вудилище!" };
    }

    // Логіка для КОТУШОК
    if (item.type === "spinning_reel") {
      if (eq.rod && eq.rod.hasReel === false) {
        return {
          isValid: false,
          reason: "Ця махова вудка не підтримує котушки!",
        };
      }
    }

    // Логіка для ГАЧКІВ (за твоїм запитом)
    if (item.type === "hook") {
      if (rodType === "feeder") {
        return {
          isValid: false,
          reason: "Оберіть інше вудилище для цього звичайного гачка!",
        };
      }
    }

    // Логіка для ПОПЛАВКІВ
    if (item.type === "float_tackle") {
      if (rodType !== "float" && rodType !== "float_match") {
        return {
          isValid: false,
          reason: "Поплавок можна встановити лише на поплавкову вудку!",
        };
      }
    }

    return { isValid: true };
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
