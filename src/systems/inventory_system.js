class ItemDatabase {
  #db;
  #categoryMap;

  constructor(db) {
    this.#db = db;
    this.#categoryMap = new Map();
    this.#buildCategoryMap();
  }

  #buildCategoryMap() {
    for (const [category, items] of Object.entries(this.#db)) {
      for (const itemId of Object.keys(items)) {
        this.#categoryMap.set(itemId, category);
      }
    }
  }

  getItemData(itemId) {
    if (!itemId) return null;
    const category = this.#categoryMap.get(itemId);
    if (!category) return null;

    const item = this.#db[category][itemId];
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
}

class Inventory {
  #items;

  constructor(initialItems = []) {
    this.#items = new Map();
    initialItems.forEach((item) => this.#items.set(item.instanceId, item));
  }

  addItem(itemData) {
    this.#items.set(itemData.instanceId, itemData);
  }

  getInstance(instanceId) {
    return this.#items.get(instanceId) || null;
  }

  consume(instanceId, amount = 1) {
    const item = this.#items.get(instanceId);
    if (!item) return false;

    item.quantity = (item.quantity || 1) - amount;

    if (item.quantity <= 0) {
      this.#items.delete(instanceId);
    }
    return true;
  }

  remove(instanceId) {
    return this.#items.delete(instanceId);
  }

  getAll() {
    return Array.from(this.#items.values());
  }

  hasItem(itemId) {
    for (const item of this.#items.values()) {
      if (item.itemId === itemId) return true;
    }
    return false;
  }
}

class InventoryEquipment {
  #slots;
  #config;

  constructor(config, initialEquipment = {}) {
    this.#config = config;
    this.#slots = new Map();
    this.#initializeSlots(initialEquipment);
  }

  #initializeSlots(initialEquipment) {
    for (const [slotName, settings] of Object.entries(this.#config)) {
      if (settings.type === "array") {
        this.#slots.set(slotName, initialEquipment[slotName] || []);
      } else {
        const key = `${slotName}Id`;
        this.#slots.set(slotName, initialEquipment[key] || null);
      }
    }
  }

  equip(slotPath, instanceId) {
    const { baseSlot, index } = this.#parseSlotPath(slotPath);
    if (!this.#config[baseSlot]) return false;

    if (this.#config[baseSlot].type === "array") {
      const arr = this.#slots.get(baseSlot);
      arr[index] = instanceId;
    } else {
      this.#slots.set(baseSlot, instanceId);
    }
    return true;
  }

  unequip(slotPath) {
    const { baseSlot, index } = this.#parseSlotPath(slotPath);
    if (!this.#config[baseSlot]) return;

    if (this.#config[baseSlot].type === "array") {
      if (index !== null) {
        const arr = this.#slots.get(baseSlot);
        arr[index] = null;
      } else {
        this.#slots.set(baseSlot, []);
      }
    } else {
      this.#slots.set(baseSlot, null);
    }

    this.#clearDependencies(baseSlot);
  }

  #clearDependencies(slotName) {
    const deps = this.#config[slotName]?.dependencies || [];
    for (const dep of deps) {
      this.unequip(dep);
    }
  }

  findSlotByInstanceId(instanceId) {
    for (const [slot, value] of this.#slots.entries()) {
      if (Array.isArray(value)) {
        const idx = value.indexOf(instanceId);
        if (idx !== -1) return `${slot}_${idx}`;
      } else if (value === instanceId) {
        return slot;
      }
    }
    return null;
  }

  getRawState() {
    const state = {};
    for (const [slotName, settings] of Object.entries(this.#config)) {
      const value = this.#slots.get(slotName);
      if (settings.type === "array") {
        state[slotName] = [...value];
      } else {
        state[`${slotName}Id`] = value;
      }
    }
    return state;
  }

  #parseSlotPath(slotPath) {
    const parts = slotPath.split("_");
    return {
      baseSlot: parts[0],
      index: parts.length > 1 ? parseInt(parts[1], 10) : null,
    };
  }
}

class EquipmentValidator {
  static VALID_BASE_TYPES = new Set([
    "spinning",
    "float",
    "feeder",
    "net",
    "chum_mix",
    "boat",
  ]);

  static validate(itemData, equippedHydrated) {
    if (!itemData) return { isValid: false, reason: "Помилка даних предмета" };
    if (this.VALID_BASE_TYPES.has(itemData.type)) return { isValid: true };

    const reqTag = itemData.requiresTag || itemData.engineStats?.requiresTag;
    if (!reqTag) return { isValid: true };

    if (!equippedHydrated.rod) {
      return {
        isValid: false,
        reason: "Спочатку екіпіруйте відповідне вудилище!",
      };
    }

    const availableCaps = this.#getAvailableCapabilities(equippedHydrated);

    if (!availableCaps.has(reqTag)) {
      if (reqTag === "bait") {
        return {
          isValid: false,
          reason: "Спочатку екіпіруйте гачок або пружину!",
        };
      }
      return {
        isValid: false,
        reason: `Для цього предмета потрібна оснастка з підтримкою: ${reqTag}`,
      };
    }

    return { isValid: true };
  }

  static #getAvailableCapabilities(equippedHydrated) {
    const caps = new Set();
    const parts = [
      equippedHydrated.rod,
      equippedHydrated.reel,
      equippedHydrated.float,
      equippedHydrated.sinker,
      ...(equippedHydrated.hooks || []),
    ];

    for (const part of parts) {
      if (!part) continue;
      const partCaps =
        part.capabilities || part.engineStats?.capabilities || [];
      partCaps.forEach((c) => caps.add(c));
    }
    return caps;
  }
}

class InventoryManager {
  #db;
  #inventory;
  #equipment;
  #isLocked = false;

  constructor(itemDB, playerConfig) {
    const cachedInventory =
      CacheManager.get("player_inventory") || playerConfig.inventory || [];
    const cachedEquipment =
      CacheManager.get("player_equipment") || playerConfig.equipment || {};

    this.#db = new ItemDatabase(itemDB);
    this.#inventory = new Inventory(cachedInventory);
    this.#equipment = new InventoryEquipment(SLOT_CONFIG, cachedEquipment);

    this.#setupDebugTools();
  }

  #setupDebugTools() {
    TestBuildProvider.injectDebugBuild(this.#inventory);
  }

  saveBuild(buildName) {
    const buildId = "build_" + Date.now();
    const raw = this.#equipment.getRawState();

    const toUnequip = [];
    if (raw.feederChumId) toUnequip.push("feederChum");
    if (raw.deliveryChums)
      raw.deliveryChums.forEach((_, i) => toUnequip.push(`deliveryChums_${i}`));
    if (raw.baits) raw.baits.forEach((_, i) => toUnequip.push(`baits_${i}`));
    toUnequip.forEach((slot) => this.unequipItem(slot));

    const newRaw = this.#equipment.getRawState();

    const eqCounts = {};
    const countId = (id) => {
      if (id) eqCounts[id] = (eqCounts[id] || 0) + 1;
    };

    countId(newRaw.rodId);
    countId(newRaw.reelId);
    countId(newRaw.floatId);
    countId(newRaw.sinkerId);
    countId(newRaw.netId);
    countId(newRaw.deliveryId);
    if (newRaw.hooks) newRaw.hooks.forEach(countId);

    for (const id of Object.keys(eqCounts)) {
      const item = this.#inventory.getInstance(id);
      if (item && item.buildId) {
        const box = this.#inventory.getInstance(item.buildId);
        const boxName = box ? box.buildName : "Невідомий ящик";
        const itemName = this.#db.getItemData(item.itemId)?.name || "Предмет";
        return {
          success: false,
          reason: `Річ "${itemName}" вже знаходиться в ящику "${boxName}"!`,
        };
      }
    }

    let count = 0;

    for (const [id, equippedQty] of Object.entries(eqCounts)) {
      const item = this.#inventory.getInstance(id);
      if (item) {
        if ((item.quantity || 1) > equippedQty) {
          const leftoverQty = item.quantity - equippedQty;

          item.quantity = equippedQty;
          item.buildId = buildId;

          const leftoverId =
            "uuid_leftover_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 10000);
          const leftoverItem = {
            ...item,
            instanceId: leftoverId,
            quantity: leftoverQty,
          };
          delete leftoverItem.buildId;
          this.#inventory.addItem(leftoverItem);
        } else {
          item.buildId = buildId;
        }
        count++;
      }
    }

    if (count === 0)
      return { success: false, reason: "Немає спорядження для збереження!" };

    this.#inventory.addItem({
      instanceId: buildId,
      itemId: "sys_build_box",
      quantity: 1,
      buildName: buildName,
      type: "build_box",
    });

    this.#saveAndNotify();
    return { success: true };
  }

  disassembleBuild(buildId) {
    const items = this.#inventory.getAll();
    items.forEach((item) => {
      if (item.buildId === buildId) {
        delete item.buildId;
      }
    });
    this.removeItem(buildId);
    this.#saveAndNotify();
  }

  equipBuild(buildId) {
    const slotsToClear = [
      "rod",
      "reel",
      "float",
      "sinker",
      "net",
      "delivery",
      "feederChum",
    ];
    slotsToClear.forEach((s) => this.unequipItem(s));

    const eq = this.getEquipped();
    if (eq.hooks) eq.hooks.forEach((_, i) => this.unequipItem(`hooks_${i}`));
    if (eq.baits) eq.baits.forEach((_, i) => this.unequipItem(`baits_${i}`));
    if (eq.deliveryChums)
      eq.deliveryChums.forEach((_, i) =>
        this.unequipItem(`deliveryChums_${i}`),
      );

    const items = this.#inventory.getAll().filter((i) => i.buildId === buildId);

    items.forEach((item) => {
      const itemData = this._hydrateInstance(item.instanceId);

      // Якщо в ящику лежить 2 гачки одного типу, екіпіруємо їх двічі у вільні слоти!
      const qtyToEquip = itemData.quantity || 1;
      for (let q = 0; q < qtyToEquip; q++) {
        const slotPath = this.#findTargetSlotPath(itemData);
        if (slotPath) this.#equipment.equip(slotPath, item.instanceId);
      }
    });

    this.#saveAndNotify();
  }

  setLock(locked) {
    this.#isLocked = locked;
  }

  get isLocked() {
    return this.#isLocked;
  }

  getTotalPower() {
    const eq = this.getEquipped();
    let power = 0;
    if (eq.rod) power += (eq.rod.basePower || 0) * (eq.rod.level || 1);
    if (eq.reel) power += (eq.reel.basePower || 0) * (eq.reel.level || 1);
    return power;
  }

  autoEquipItem(instanceId) {
    const itemData = this._hydrateInstance(instanceId);
    if (!itemData) return { success: false, reason: "Предмет не знайдено" };

    const validation = this.validateEquip(itemData);
    if (!validation.isValid)
      return { success: false, reason: validation.reason };

    const targetSlotPath = this.#findTargetSlotPath(itemData);
    if (!targetSlotPath)
      return {
        success: false,
        reason: `Невідомий тип предмета: ${itemData.name}`,
      };

    const equipped = this.equipItem(targetSlotPath, instanceId);
    return equipped
      ? { success: true }
      : { success: false, reason: "Помилка екіпірування" };
  }

  #findTargetSlotPath(itemData) {
    let baseSlot = null;
    for (const [slot, config] of Object.entries(SLOT_CONFIG)) {
      if (config.acceptTypes && config.acceptTypes.includes(itemData.type)) {
        baseSlot = slot;
        break;
      }
    }

    if (!baseSlot) return null;

    const eq = this.getEquipped();

    if (baseSlot === "baits" || baseSlot === "hooks") {
      // ВИПРАВЛЕНО: Додано перевірку на базову кількість гачків вудки
      const maxHooks =
        eq.sinker?.hooksCount ||
        eq.sinker?.engineStats?.hooksCount ||
        eq.rod?.maxHooks ||
        1;

      const currentArr = eq[baseSlot] || [];
      for (let i = 0; i < maxHooks; i++) {
        if (!currentArr[i]) return `${baseSlot}_${i}`;
      }
      return `${baseSlot}_0`;
    }

    if (itemData.type === "chum_mix") {
      const sinkerCaps =
        eq.sinker?.capabilities || eq.sinker?.engineStats?.capabilities || [];
      const hasFeederSlot = sinkerCaps.includes("chum_mix");

      if (hasFeederSlot && !eq.feederChum) return "feederChum";

      if (eq.delivery) {
        const sections =
          eq.delivery.sections || eq.delivery.engineStats?.sections || 1;
        const arr = eq.deliveryChums || [];
        for (let i = 0; i < sections; i++) {
          if (!arr[i]) return `deliveryChums_${i}`;
        }
      }
      return null;
    }

    return baseSlot;
  }

  consumeItem(instanceId, amount = 1) {
    const success = this.#inventory.consume(instanceId, amount);
    if (success) {
      const slot = this.#equipment.findSlotByInstanceId(instanceId);
      if (slot && !this.#inventory.getInstance(instanceId)) {
        this.#equipment.unequip(slot);
      }
      this.#saveAndNotify();
    }
    return success;
  }

  removeItem(instanceId) {
    if (this.#inventory.remove(instanceId)) {
      const slot = this.#equipment.findSlotByInstanceId(instanceId);
      if (slot) this.#equipment.unequip(slot);
      this.#saveAndNotify();
    }
  }

  equipItem(slotPath, instanceId) {
    if (!this.#inventory.getInstance(instanceId)) return false;

    const itemData = this._hydrateInstance(instanceId);

    // КАСКАД: Якщо вдягаємо нову вудку, і її тип відрізняється від поточної — скидаємо стару оснастку
    if (slotPath === "rod") {
      const currentRod = this.getEquipped().rod;
      if (currentRod && currentRod.type !== itemData.type) {
        ["reel", "line", "float", "sinker", "feederChum"].forEach((s) =>
          this.#equipment.unequip(s),
        );

        const eq = this.getEquipped();
        if (eq.hooks)
          eq.hooks.forEach((_, i) => this.#equipment.unequip(`hooks_${i}`));
        if (eq.baits)
          eq.baits.forEach((_, i) => this.#equipment.unequip(`baits_${i}`));
      }
    }

    if (slotPath === "delivery" && itemData?.type !== "boat") {
      this.#equipment.unequip("deliveryChum");
    }

    const success = this.#equipment.equip(slotPath, instanceId);
    if (success) this.#saveAndNotify();
    return success;
  }

  unequipItem(slotPath) {
    this.#equipment.unequip(slotPath);

    // КАСКАДНЕ ЗНЯТТЯ (Щоб не залишалося прихованих "привидів" у слотах)
    if (slotPath === "rod") {
      // Знімаємо все, що висіло на вудці
      ["reel", "line", "float", "sinker", "feederChum"].forEach((s) =>
        this.#equipment.unequip(s),
      );

      const eq = this.getEquipped();
      if (eq.hooks)
        eq.hooks.forEach((_, i) => this.#equipment.unequip(`hooks_${i}`));
      if (eq.baits)
        eq.baits.forEach((_, i) => this.#equipment.unequip(`baits_${i}`));
    } else if (slotPath === "sinker") {
      // Знімаємо прикормку
      this.#equipment.unequip("feederChum");

      // Відрізаємо зайві гачки, якщо базова вудка підтримує менше
      const eq = this.getEquipped();
      const baseRodHooks = eq.rod?.maxHooks || 1;
      if (eq.hooks) {
        eq.hooks.forEach((_, i) => {
          if (i >= baseRodHooks) {
            this.#equipment.unequip(`hooks_${i}`);
            this.#equipment.unequip(`baits_${i}`);
          }
        });
      }
    } else if (slotPath.startsWith("hooks_")) {
      // Знімаємо наживку саме з ЦЬОГО гачка
      const index = slotPath.split("_")[1];
      this.#equipment.unequip(`baits_${index}`);
    } else if (slotPath === "delivery") {
      // Знімаємо всю прикормку з усіх бункерів кораблика
      const eq = this.getEquipped();
      const sections =
        eq.delivery?.sections || eq.delivery?.engineStats?.sections || 1;
      for (let i = 0; i < sections; i++) {
        this.#equipment.unequip(`deliveryChums_${i}`);
      }
    }

    this.#saveAndNotify();
  }

  validateEquip(itemData) {
    return EquipmentValidator.validate(itemData, this.getEquipped());
  }

  getEquipped() {
    const raw = this.#equipment.getRawState();
    return {
      rod: this._hydrateInstance(raw.rodId),
      reel: this._hydrateInstance(raw.reelId),
      float: this._hydrateInstance(raw.floatId),
      sinker: this._hydrateInstance(raw.sinkerId),
      hooks: (raw.hooks || []).map((id) => this._hydrateInstance(id)),
      feederChum: this._hydrateInstance(raw.feederChumId),
      net: this._hydrateInstance(raw.netId),
      delivery: this._hydrateInstance(raw.deliveryId),
      deliveryChums: (raw.deliveryChums || []).map((id) =>
        this._hydrateInstance(id),
      ),
      baits: (raw.baits || []).map((id) => this._hydrateInstance(id)),
    };
  }

  getInventoryItems() {
    return this.#inventory.getAll();
  }

  _hydrateInstance(instanceId) {
    if (!instanceId) return null;
    const invItem = this.#inventory.getInstance(instanceId);
    if (!invItem) return null;

    const baseItem = this.#db.getItemData(invItem.itemId);
    if (!baseItem) return null;

    const hydrated = {
      ...baseItem,
      instanceId: invItem.instanceId,
      quantity: invItem.quantity || 1,
      buildId: invItem.buildId,
    };

    if (hydrated.type === "build_box") {
      hydrated.name = invItem.buildName || "Без назви (Старий ящик)";

      const contents = this.#inventory
        .getAll()
        .filter((i) => i.buildId === instanceId);
      hydrated.quantity = contents.reduce(
        (sum, c) => sum + (c.quantity || 1),
        0,
      );

      const grouped = {};
      contents.forEach((c) => {
        const cBase = this.#db.getItemData(c.itemId);
        if (cBase) {
          let cat = "Інше";
          if (["spinning", "feeder", "float", "pole"].includes(cBase.type))
            cat = "Вудилище";
          else if (cBase.type === "spinning_reel") cat = "Котушка";
          else if (["float_tackle", "day", "night"].includes(cBase.type))
            cat = "Поплавок";
          else if (["sinker", "feeder_rig"].includes(cBase.type))
            cat = "Грузило/Годівниця";
          else if (cBase.type === "hook") cat = "Гачок";
          else if (["lure", "spinner", "wobbler", "jig"].includes(cBase.type))
            cat = "Приманка";
          else if (cBase.type === "net") cat = "Підсака";
          else if (cBase.type === "boat") cat = "Кораблик";

          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(
            cBase.name + (c.quantity > 1 ? ` (x${c.quantity})` : ""),
          );
        }
      });

      for (const [catName, itemsArr] of Object.entries(grouped)) {
        hydrated[catName] = itemsArr.join(", ");
      }
    }

    return hydrated;
  }

  #saveAndNotify() {
    CacheManager.set("player_inventory", this.#inventory.getAll());
    CacheManager.set("player_equipment", this.#equipment.getRawState());

    document.dispatchEvent(
      new CustomEvent("inventory-changed", {
        detail: { equipment: this.getEquipped() },
      }),
    );
  }
}
