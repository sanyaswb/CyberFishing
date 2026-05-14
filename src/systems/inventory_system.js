class ItemDatabase {
  #db;
  #categoryMap;

  constructor(db) {
    this.#db = db;
    this.#categoryMap = new Map();
    this.#buildCategoryMap();
  }

  #buildCategoryMap() {
    this.#categoryMap.clear();
    for (const [category, items] of Object.entries(this.#db)) {
      for (const itemId of Object.keys(items)) {
        this.#categoryMap.set(itemId, category);
      }
    }
  }

  refresh() {
    this.#buildCategoryMap();
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
    for (let i = 0; i < initialItems.length; i++) {
      const item = initialItems[i];
      this.#items.set(item.instanceId, item);
    }
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

class InventoryEventBridge {
  #target;
  #listeners = new Map();

  constructor(target = typeof document !== "undefined" ? document : null) {
    this.#target = target;
  }

  on(type, handler) {
    let handlers = this.#listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.#listeners.set(type, handlers);
    }
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  emit(type, detail) {
    const handlers = this.#listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(detail);
      }
    }

    this.#target?.dispatchEvent(new CustomEvent(type, { detail }));
  }

  clear() {
    this.#listeners.clear();
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

  replaceInstance(oldInstanceId, newInstanceId) {
    if (!oldInstanceId || !newInstanceId || oldInstanceId === newInstanceId)
      return;

    for (const [slot, value] of this.#slots.entries()) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (value[i] === oldInstanceId) value[i] = newInstanceId;
        }
      } else if (value === oldInstanceId) {
        this.#slots.set(slot, newInstanceId);
      }
    }
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
    if (itemData.type === "fishing_line") {
      return this.validateFishingLine(itemData, equippedHydrated);
    }

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

  static validateFishingLine(itemData, equippedHydrated) {
    const rod = equippedHydrated?.rod;
    if (!rod) {
      return {
        isValid: false,
        reason: "Спочатку екіпіруйте вудку для ліски.",
      };
    }

    const rodNeedsReel = this.#rodRequiresReel(rod);
    if (rodNeedsReel && !equippedHydrated?.reel) {
      return {
        isValid: false,
        reason: "Для цієї вудки спочатку екіпіруйте котушку.",
      };
    }

    const lineLength = this.#numberOrDefault(
      itemData.lengthMeters ?? itemData.engineStats?.lengthMeters,
      0,
    );
    const minLength = this.getMinimumLineLengthMeters(rod);
    if (lineLength < minLength) {
      return {
        isValid: false,
        reason: `Ліска закоротка: потрібно мінімум ${this.#formatMeters(minLength)}м для цієї вудки.`,
      };
    }

    const reelCapacity = this.#numberOrDefault(
      equippedHydrated?.reel?.lineCapacityMeters ??
        equippedHydrated?.reel?.engineStats?.lineCapacityMeters,
      Infinity,
    );
    if (rodNeedsReel && Number.isFinite(reelCapacity) && lineLength > reelCapacity) {
      return {
        isValid: false,
        reason: `Ліска не вміщується на котушку: максимум ${this.#formatMeters(reelCapacity)}м.`,
      };
    }

    return { isValid: true };
  }

  static getMinimumLineLengthMeters(rod) {
    const rodLength = this.#numberOrDefault(
      rod?.lengthMeters ?? rod?.engineStats?.lengthMeters,
      0,
    );
    const multiplier =
      typeof CONFIG !== "undefined"
        ? Number(CONFIG.physics?.line?.rodLengthReserveMultiplier ?? 2)
        : 2;
    return Math.max(0, rodLength * (Number.isFinite(multiplier) ? multiplier : 2));
  }

  static #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static #formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  static getCompatibilityInfo(itemData, equippedHydrated) {
    if (itemData?.type === "fishing_line") {
      const validation = this.validateFishingLine(itemData, equippedHydrated);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equippedHydrated?.rod?.type || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    const reqTag = itemData?.requiresTag || itemData?.engineStats?.requiresTag;
    if (!reqTag) {
      return {
        hasCompatibility: false,
        isCompatible: true,
        requiredTag: null,
        rodType: equippedHydrated?.rod?.type || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    const availableCaps = this.#getAvailableCapabilities(equippedHydrated || {});
    return {
      hasCompatibility: true,
      isCompatible: availableCaps.has(reqTag),
      requiredTag: reqTag,
      rodType: equippedHydrated?.rod?.type || null,
      rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
    };
  }

  static #rodRequiresReel(rod) {
    if (!rod) return null;
    return rod.hasReel ?? rod.engineStats?.hasReel ?? rod.type !== "pole";
  }

  static #getAvailableCapabilities(equippedHydrated) {
    const caps = new Set();
    const parts = [
      equippedHydrated.rod,
      equippedHydrated.reel,
      equippedHydrated.line,
      equippedHydrated.float,
      equippedHydrated.sinker,
      ...(equippedHydrated.hooks || []),
    ];

    for (const part of parts) {
      if (!part) continue;
      const partCaps =
        part.capabilities || part.engineStats?.capabilities || [];
      for (let i = 0; i < partCaps.length; i++) {
        caps.add(partCaps[i]);
      }
    }
    return caps;
  }
}

class InventoryManager {
  static #fallbackId = 0;

  #db;
  #inventory;
  #equipment;
  #events;
  #castDistanceCalculator;
  #isLocked = false;
  #equippedCache = null;

  constructor(
    itemDB,
    playerConfig,
    events = new InventoryEventBridge(),
    castDistanceCalculator = null,
  ) {
    const cachedInventory =
      CacheManager.get("player_inventory") || playerConfig.inventory || [];
    const cachedEquipment =
      CacheManager.get("player_equipment") || playerConfig.equipment || {};

    this.#db = new ItemDatabase(itemDB);
    this.#inventory = new Inventory(cachedInventory);
    this.#equipment = new InventoryEquipment(SLOT_CONFIG, cachedEquipment);
    this.#events = events || new InventoryEventBridge();
    this.#castDistanceCalculator =
      castDistanceCalculator ||
      new CastDistanceCalculator(typeof CONFIG !== "undefined" ? CONFIG : {});

    this.#setupDebugTools();
  }

  #setupDebugTools() {
    TestBuildProvider.injectDebugBuild(this.#inventory);
  }

  #makeId(prefix) {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.randomUUID) {
      return `${prefix}_${cryptoObj.randomUUID()}`;
    }

    InventoryManager.#fallbackId++;
    return `${prefix}_${Date.now()}_${InventoryManager.#fallbackId}`;
  }

  saveBuild(buildName) {
    const buildId = this.#makeId("build");
    const raw = this.#equipment.getRawState();

    const toUnequip = [];
    if (raw.feederChumId) toUnequip.push("feederChum");
    if (raw.deliveryChums) {
      for (let i = 0; i < raw.deliveryChums.length; i++) {
        toUnequip.push(`deliveryChums_${i}`);
      }
    }
    if (raw.baits) {
      for (let i = 0; i < raw.baits.length; i++) {
        toUnequip.push(`baits_${i}`);
      }
    }
    for (let i = 0; i < toUnequip.length; i++) {
      this.unequipItem(toUnequip[i]);
    }

    const newRaw = this.#equipment.getRawState();

    const eqCounts = {};
    const countId = (id) => {
      if (id) eqCounts[id] = (eqCounts[id] || 0) + 1;
    };

    countId(newRaw.rodId);
    countId(newRaw.reelId);
    countId(newRaw.lineId);
    countId(newRaw.floatId);
    countId(newRaw.sinkerId);
    countId(newRaw.netId);
    countId(newRaw.deliveryId);
    if (newRaw.hooks) {
      for (let i = 0; i < newRaw.hooks.length; i++) {
        countId(newRaw.hooks[i]);
      }
    }

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

          const leftoverId = this.#makeId("uuid_leftover");
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
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.buildId === buildId) {
        delete item.buildId;
        this.#mergeIntoAvailableStack(item);
      }
    }
    this.#inventory.remove(buildId);
    this.#saveAndNotify();
  }

  equipBuild(buildId) {
    const slotsToClear = [
      "rod",
      "reel",
      "line",
      "float",
      "sinker",
      "net",
      "delivery",
      "feederChum",
    ];
    for (let i = 0; i < slotsToClear.length; i++) {
      this.unequipItem(slotsToClear[i]);
    }

    const eq = this.getEquipped();
    if (eq.hooks) {
      for (let i = 0; i < eq.hooks.length; i++) {
        this.unequipItem(`hooks_${i}`);
      }
    }
    if (eq.baits) {
      for (let i = 0; i < eq.baits.length; i++) {
        this.unequipItem(`baits_${i}`);
      }
    }
    if (eq.deliveryChums) {
      for (let i = 0; i < eq.deliveryChums.length; i++) {
        this.unequipItem(`deliveryChums_${i}`);
      }
    }

    const items = this.#inventory.getAll();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.buildId !== buildId) continue;
      const itemData = this._hydrateInstance(item.instanceId);

      // Якщо в ящику лежить 2 гачки одного типу, екіпіруємо їх двічі у вільні слоти!
      const qtyToEquip = itemData.quantity || 1;
      for (let q = 0; q < qtyToEquip; q++) {
        const slotPath = this.#findTargetSlotPath(itemData);
        if (slotPath) this.#equipment.equip(slotPath, item.instanceId);
      }
    }

    this.#enforceEquippedLineCompatibility();
    this.#saveAndNotify();
  }

  setLock(locked) {
    this.#isLocked = locked;
  }

  get isLocked() {
    return this.#isLocked;
  }

  getTotalPower() {
    return this.getMaxTackleLoadKg();
  }

  getMaxTackleLoadKg() {
    const eq = this.getEquipped();
    const values = [];

    const pushPositive = (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) values.push(n);
    };

    const effectiveLoad = (item, fallback = 0) => {
      if (!item) return fallback;
      const maxLoadKg = Number(item.maxLoadKg ?? item.engineStats?.maxLoadKg ?? fallback);
      const durability = Number(item.durability ?? item.engineStats?.durability ?? 100);
      const lossPerPercent = Number(
        item.durabilityMaxLoadLossPerPercent ??
          item.engineStats?.durabilityMaxLoadLossPerPercent ??
          0.001,
      );
      if (!Number.isFinite(maxLoadKg) || maxLoadKg <= 0) return fallback;
      const lostPercent = Math.max(0, 100 - (Number.isFinite(durability) ? durability : 100));
      return maxLoadKg * Math.max(0.1, 1 - lostPercent * lossPerPercent);
    };

    pushPositive(effectiveLoad(eq.rod, 0));

    const rodHasReel =
      eq.rod?.hasReel ?? eq.rod?.engineStats?.hasReel ?? eq.rod?.type !== "float";
    if (rodHasReel && eq.reel) {
      pushPositive(effectiveLoad(eq.reel, 0));
    }
    pushPositive(effectiveLoad(eq.line, 0));

    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  autoEquipItem(instanceId) {
    const itemData = this._hydrateInstance(instanceId);
    if (!itemData) return { success: false, reason: "Предмет не знайдено" };

    const validation = this.validateEquip(itemData);
    if (!validation.isValid)
      return { success: false, reason: validation.reason };

    const targetSlotPath = this.#findTargetSlotPath(itemData);
    if (!targetSlotPath && itemData.type === "bait") {
      return {
        success: false,
        reason: "Немає вільного гачка для наживки.",
      };
    }

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

    if (baseSlot === "hooks") {
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

    if (baseSlot === "baits") {
      const maxHooks =
        eq.sinker?.hooksCount ||
        eq.sinker?.engineStats?.hooksCount ||
        eq.rod?.maxHooks ||
        1;
      const baits = eq.baits || [];

      if (itemData.type === "bait") {
        const hooks = eq.hooks || [];
        for (let i = 0; i < maxHooks; i++) {
          if (hooks[i] && !baits[i]) return `baits_${i}`;
        }
        return null;
      }

      for (let i = 0; i < maxHooks; i++) {
        if (!baits[i]) return `baits_${i}`;
      }
      return "baits_0";
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
      this.#equippedCache = null;
      const slot = this.#equipment.findSlotByInstanceId(instanceId);
      if (slot && !this.#inventory.getInstance(instanceId)) {
        this.#equipment.unequip(slot);
      }
      this.#saveAndNotify();
    }
    return success;
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    const item = this.#getEquippedItemAtSlot(slotPath);
    if (!item?.instanceId) return false;

    const success = this.#inventory.consume(item.instanceId, amount);
    if (!success) return false;

    this.#equippedCache = null;
    if (unequipAfterConsume || !this.#inventory.getInstance(item.instanceId)) {
      this.#equipment.unequip(slotPath);
    }

    this.#saveAndNotify();
    return true;
  }

  removeItem(instanceId) {
    if (this.#inventory.remove(instanceId)) {
      this.#equippedCache = null;
      const slot = this.#equipment.findSlotByInstanceId(instanceId);
      if (slot) this.#equipment.unequip(slot);
      this.#saveAndNotify();
    }
  }

  equipItem(slotPath, instanceId) {
    if (!this.#inventory.getInstance(instanceId)) return false;

    const itemData = this._hydrateInstance(instanceId);
    const slotValidation = this.validateEquipToSlot(slotPath, itemData);
    if (!slotValidation.isValid) return false;

    // КАСКАД: Якщо вдягаємо нову вудку, і її тип відрізняється від поточної — скидаємо стару оснастку
    if (slotPath === "rod") {
      const currentRod = this.getEquipped().rod;
      if (currentRod && currentRod.type !== itemData.type) {
        const slotsToUnequip = [
          "reel",
          "line",
          "float",
          "sinker",
          "feederChum",
        ];
        for (let i = 0; i < slotsToUnequip.length; i++) {
          this.#equipment.unequip(slotsToUnequip[i]);
        }

        this.#equippedCache = null;
        const eq = this.getEquipped();
        if (eq.hooks) {
          for (let i = 0; i < eq.hooks.length; i++) {
            this.#equipment.unequip(`hooks_${i}`);
          }
        }
        if (eq.baits) {
          for (let i = 0; i < eq.baits.length; i++) {
            this.#equipment.unequip(`baits_${i}`);
          }
        }
      }
    }

    if (slotPath === "delivery" && itemData?.type !== "boat") {
      this.#equipment.unequip("deliveryChum");
    }

    const success = this.#equipment.equip(slotPath, instanceId);
    if (success) {
      this.#equippedCache = null;
      this.#enforceEquippedLineCompatibility();
      this.#saveAndNotify();
    }
    return success;
  }

  unequipItem(slotPath) {
    const equippedBefore = this.getEquipped();
    this.#equipment.unequip(slotPath);
    this.#equippedCache = null;

    // КАСКАДНЕ ЗНЯТТЯ (Щоб не залишалося прихованих "привидів" у слотах)
    if (slotPath === "rod") {
      // Знімаємо все, що висіло на вудці
      const slotsToUnequip = ["reel", "line", "float", "sinker", "feederChum"];
      for (let i = 0; i < slotsToUnequip.length; i++) {
        this.#equipment.unequip(slotsToUnequip[i]);
      }

      const eq = this.getEquipped();
      if (eq.hooks) {
        for (let i = 0; i < eq.hooks.length; i++) {
          this.#equipment.unequip(`hooks_${i}`);
        }
      }
      if (eq.baits) {
        for (let i = 0; i < eq.baits.length; i++) {
          this.#equipment.unequip(`baits_${i}`);
        }
      }
    } else if (slotPath === "sinker") {
      // Знімаємо прикормку
      this.#equipment.unequip("feederChum");

      const removedHooksCount =
        equippedBefore.sinker?.hooksCount ||
        equippedBefore.sinker?.engineStats?.hooksCount ||
        0;
      if (removedHooksCount > 0) {
        const oldHooks = equippedBefore.hooks || [];
        const oldBaits = equippedBefore.baits || [];
        const maxSlots = Math.max(oldHooks.length, oldBaits.length);
        for (let i = 0; i < maxSlots; i++) {
          this.#equipment.unequip(`hooks_${i}`);
          this.#equipment.unequip(`baits_${i}`);
        }
        this.#saveAndNotify();
        return;
      }

      // Відрізаємо зайві гачки, якщо базова вудка підтримує менше
      const eq = this.getEquipped();
      const baseRodHooks = eq.rod?.maxHooks || 1;
      if (eq.hooks) {
        for (let i = 0; i < eq.hooks.length; i++) {
          if (i >= baseRodHooks) {
            this.#equipment.unequip(`hooks_${i}`);
            this.#equipment.unequip(`baits_${i}`);
          }
        }
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

  getCompatibilityInfo(itemData) {
    return EquipmentValidator.getCompatibilityInfo(itemData, this.getEquipped());
  }

  validateEquipToSlot(slotPath, itemData) {
    const validation = this.validateEquip(itemData);
    if (!validation.isValid) return validation;

    const baseSlot = (slotPath || "").split("_")[0];
    const slotConfig = typeof SLOT_CONFIG !== "undefined" ? SLOT_CONFIG[baseSlot] : null;
    if (
      slotConfig?.acceptTypes &&
      itemData?.type &&
      !slotConfig.acceptTypes.includes(itemData.type)
    ) {
      return {
        isValid: false,
        reason: `Предмет не підходить для слота: ${baseSlot}`,
      };
    }

    if (itemData?.type === "fishing_line") {
      if (baseSlot !== "line") {
        return {
          isValid: false,
          reason: "Ліску можна спорядити тільки у слот ліски.",
        };
      }
      return EquipmentValidator.validateFishingLine(itemData, this.getEquipped());
    }

    if (itemData?.type !== "bait") return { isValid: true };

    const parsed = this.#parseIndexedSlot(slotPath);
    if (!parsed || parsed.group !== "baits") {
      return {
        isValid: false,
        reason: "Наживку можна спорядити тільки у слот наживки.",
      };
    }

    const hookInSameSlot = this.getEquipped().hooks?.[parsed.index];
    if (!hookInSameSlot) {
      return {
        isValid: false,
        reason: "Спочатку споряди гачок у цей слот.",
      };
    }

    return { isValid: true };
  }

  #parseIndexedSlot(slotPath) {
    const match = /^(hooks|baits|deliveryChums)_(\d+)$/.exec(slotPath || "");
    if (!match) return null;
    return {
      group: match[1],
      index: Number(match[2]),
    };
  }

  #hydrateSlotArray(rawItems) {
    const source = rawItems || [];
    const hydrated = new Array(source.length);
    for (let i = 0; i < source.length; i++) {
      hydrated[i] = this._hydrateInstance(source[i]);
    }
    return hydrated;
  }

  getEquipped() {
    if (this.#equippedCache) return this.#equippedCache;

    const raw = this.#equipment.getRawState();
    this.#equippedCache = {
      rod: this._hydrateInstance(raw.rodId),
      reel: this._hydrateInstance(raw.reelId),
      line: this._hydrateInstance(raw.lineId),
      float: this._hydrateInstance(raw.floatId),
      sinker: this._hydrateInstance(raw.sinkerId),
      hooks: this.#hydrateSlotArray(raw.hooks),
      feederChum: this._hydrateInstance(raw.feederChumId),
      net: this._hydrateInstance(raw.netId),
      delivery: this._hydrateInstance(raw.deliveryId),
      deliveryChums: this.#hydrateSlotArray(raw.deliveryChums),
      baits: this.#hydrateSlotArray(raw.baits),
    };
    this.#applyEquippedCastDistanceStats(this.#equippedCache);
    return this.#equippedCache;
  }

  getInventoryItems() {
    return this.#inventory.getAll();
  }

  hydrateInstance(instanceId) {
    return this._hydrateInstance(instanceId);
  }

  findFirstItemByType(type) {
    const items = this.#inventory.getAll();
    for (let i = 0; i < items.length; i++) {
      const hydrated = this._hydrateInstance(items[i].instanceId);
      if (hydrated && hydrated.type === type) return hydrated;
    }
    return null;
  }

  findItemsByType(type, out = []) {
    out.length = 0;
    const items = this.#inventory.getAll();
    for (let i = 0; i < items.length; i++) {
      const hydrated = this._hydrateInstance(items[i].instanceId);
      if (hydrated && hydrated.type === type) out.push(hydrated);
    }
    return out;
  }

  onInventoryChanged(handler) {
    return this.#events.on("inventory-changed", handler);
  }

  refreshItemData() {
    this.#db.refresh();
    this.#equippedCache = null;
    this.#events.emit("inventory-changed", {
      equipment: this.getEquipped(),
      source: "item-db-updated",
    });
  }

  dispose() {
    this.#events.clear();
  }

  #enforceEquippedLineCompatibility() {
    const raw = this.#equipment.getRawState();
    if (!raw.lineId) return false;

    const line = this._hydrateInstance(raw.lineId);
    if (!line) {
      this.#equipment.unequip("line");
      this.#equippedCache = null;
      return true;
    }

    const equipment = {
      rod: this._hydrateInstance(raw.rodId),
      reel: this._hydrateInstance(raw.reelId),
    };
    const validation = EquipmentValidator.validateFishingLine(line, equipment);
    if (validation.isValid) return false;

    this.#equipment.unequip("line");
    this.#equippedCache = null;
    return true;
  }

  #getEquippedItemAtSlot(slotPath) {
    const parts = slotPath.split("_");
    const baseSlot = parts[0];
    const index = parts.length > 1 ? parseInt(parts[1], 10) : null;
    const eq = this.getEquipped();
    const slotValue = eq[baseSlot];

    if (Array.isArray(slotValue)) {
      return index === null ? null : slotValue[index];
    }
    return slotValue || null;
  }

  #getEquippedInstanceCounts() {
    const raw = this.#equipment.getRawState();
    const counts = {};
    const countId = (id) => {
      if (id) counts[id] = (counts[id] || 0) + 1;
    };

    countId(raw.rodId);
    countId(raw.reelId);
    countId(raw.lineId);
    countId(raw.floatId);
    countId(raw.sinkerId);
    countId(raw.feederChumId);
    countId(raw.netId);
    countId(raw.deliveryId);

    const countArray = (arr) => {
      if (!arr) return;
      for (let i = 0; i < arr.length; i++) countId(arr[i]);
    };

    countArray(raw.hooks);
    countArray(raw.baits);
    countArray(raw.deliveryChums);
    return counts;
  }

  #mergeIntoAvailableStack(sourceItem) {
    if (!sourceItem || sourceItem.itemId === "sys_build_box") return;

    const targetItem = this.#findMergeTarget(sourceItem);
    if (!targetItem) {
      sourceItem.quantity = sourceItem.quantity || 1;
      return;
    }

    targetItem.quantity = (targetItem.quantity || 1) + (sourceItem.quantity || 1);
    this.#equipment.replaceInstance(sourceItem.instanceId, targetItem.instanceId);
    this.#inventory.remove(sourceItem.instanceId);
  }

  #findMergeTarget(sourceItem) {
    const items = this.#inventory.getAll();
    for (let i = 0; i < items.length; i++) {
      const candidate = items[i];
      if (candidate === sourceItem) continue;
      if (candidate.buildId) continue;
      if (candidate.itemId !== sourceItem.itemId) continue;
      if (!this.#canStackItems(sourceItem, candidate)) continue;
      return candidate;
    }
    return null;
  }

  #canStackItems(a, b) {
    const ignored = new Set(["instanceId", "quantity", "buildId"]);
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (ignored.has(key)) continue;
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
    }
    return true;
  }

  #applyStandaloneCastDistanceStats(item) {
    if (!this.#isRodItem(item)) return;
    const requiredLine = EquipmentValidator.getMinimumLineLengthMeters(item);
    item["Мін. ліска"] = `${this.#formatMeters(requiredLine)}м`;
  }

  #applyEquippedCastDistanceStats(equipment) {
    if (!equipment?.rod) return;
    this.#writeCastDistanceStats(equipment.rod, equipment);
  }

  #writeCastDistanceStats(rodItem, equipment) {
    const previewPower = this.#getInventoryPreviewPowerCoefficient();
    const info = this.#castDistanceCalculator.describe(equipment, previewPower);
    const requiredLine = EquipmentValidator.getMinimumLineLengthMeters(rodItem);
    rodItem["Мін. ліска"] = `${this.#formatMeters(requiredLine)}м`;

    if (!equipment?.line) {
      delete rodItem.maxDistance;
      rodItem["Ліска"] = "Не споряджена";
      delete rodItem["Довжина ліски"];
      delete rodItem["Сила заброса"];
      delete rodItem["Довжина заброса"];
      rodItem["Масштаб"] = `${info.pixelsPerMeter}px = 1м`;
      return;
    }

    const lineMeters = this.#formatMeters(info.lineLengthMeters);
    const castMeters = this.#formatMeters(info.effectiveDistanceMeters);
    const castPx = Math.round(info.effectiveDistancePx);
    rodItem.maxDistance = Math.round(info.maxDistancePx);
    rodItem["Довжина ліски"] = `${lineMeters}м`;
    rodItem["Сила заброса"] = previewPower.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    rodItem["Довжина заброса"] = `${castMeters}м (${castPx}px)`;
    rodItem["Масштаб"] = `${info.pixelsPerMeter}px = 1м`;
    delete rodItem["Ліска"];
  }

  #getInventoryPreviewPowerCoefficient() {
    const castingConfig =
      typeof CONFIG !== "undefined" ? CONFIG.casting || {} : {};
    const value =
      castingConfig.inventoryPreviewPowerCoefficient ??
      castingConfig.powerCoefficient ??
      castingConfig.castPowerCoefficient ??
      1;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.min(1, parsed));
  }

  #isRodItem(item) {
    return ["spinning", "feeder", "float", "pole"].includes(item?.type);
  }

  #formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
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
    this.#applyStandaloneCastDistanceStats(hydrated);

    if (hydrated.type === "build_box") {
      hydrated.name = invItem.buildName || "Без назви (Старий ящик)";

      const contents = [];
      const inventoryItems = this.#inventory.getAll();
      let totalQuantity = 0;
      const equippedCounts = this.#getEquippedInstanceCounts();
      for (let i = 0; i < inventoryItems.length; i++) {
        const item = inventoryItems[i];
        if (item.buildId !== instanceId) continue;
        const equippedQuantity = equippedCounts[item.instanceId] || 0;
        const remainingQuantity = Math.max(
          0,
          (item.quantity || 1) - equippedQuantity,
        );
        if (remainingQuantity <= 0) continue;
        contents.push({ ...item, quantity: remainingQuantity });
        totalQuantity += remainingQuantity;
      }
      hydrated.quantity = totalQuantity;

      const grouped = {};
      for (let i = 0; i < contents.length; i++) {
        const c = contents[i];
        const cBase = this.#db.getItemData(c.itemId);
        if (cBase) {
          let cat = "Інше";
          if (["spinning", "feeder", "float", "pole"].includes(cBase.type))
            cat = "Вудилище";
          else if (cBase.type === "spinning_reel") cat = "Котушка";
          else if (cBase.type === "fishing_line") cat = "Ліска";
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
      }

      for (const [catName, itemsArr] of Object.entries(grouped)) {
        hydrated[catName] = itemsArr.join(", ");
      }
    }

    return hydrated;
  }

  #saveAndNotify() {
    this.#equippedCache = null;
    CacheManager.set("player_inventory", this.#inventory.getAll());
    CacheManager.set("player_equipment", this.#equipment.getRawState());

    this.#events.emit("inventory-changed", { equipment: this.getEquipped() });
  }
}
