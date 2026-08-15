class DisplayStatsResolver {
  static resolve(item) {
    const schema = item?.displayStats || {};
    const effectiveStats =
      item?.effectiveStats ||
      item?.gameplayStats ||
      {};
    const resolved = {};

    for (const [key, descriptor] of Object.entries(schema)) {
      const value = this.#resolveValue(key, descriptor, item, effectiveStats);
      const stat = this.#buildStat(key, descriptor, value);
      if (!stat) continue;
      resolved[stat.label] = stat.value;
    }

    return resolved;
  }

  static #resolveValue(key, descriptor, item, effectiveStats) {
    if (descriptor && typeof descriptor === "object") {
      if (descriptor.byLevel) {
        const table = this.#readPath(descriptor.byLevel, item, effectiveStats);
        const level = this.#readPath(
          descriptor.levelKey,
          item,
          effectiveStats,
        );
        return table?.[level]?.[descriptor.stat];
      }

      if (descriptor.range) {
        const from = this.#readPath(descriptor.range[0], item, effectiveStats);
        const to = this.#readPath(descriptor.range[1], item, effectiveStats);
        if (from === undefined || to === undefined) return undefined;
        return `${this.#formatScalar(from)}-${this.#formatScalar(to)}`;
      }

      const valueKey = descriptor.key || key;
      return this.#readPath(valueKey, item, effectiveStats);
    }

    if (Object.prototype.hasOwnProperty.call(effectiveStats, key)) {
      return effectiveStats[key];
    }

    if (Object.prototype.hasOwnProperty.call(item || {}, key)) {
      return item[key];
    }

    if (typeof descriptor === "string" && descriptor.includes(":")) {
      return undefined;
    }

    return descriptor;
  }

  static #buildStat(key, descriptor, value) {
    if (value === undefined || value === null) return null;

    if (descriptor && typeof descriptor === "object") {
      const label = descriptor.label || key;
      const mappedValue =
        descriptor.map && Object.prototype.hasOwnProperty.call(descriptor.map, value)
          ? descriptor.map[value]
          : value;
      const formatted = this.#formatScalar(mappedValue, descriptor.decimals);
      return {
        label,
        value: this.#joinSuffix(formatted, descriptor.suffix || ""),
      };
    }

    if (typeof descriptor === "string") {
      const parsed = this.#parseTextDescriptor(key, descriptor, value);
      return {
        label: parsed.label,
        value: this.#joinSuffix(this.#formatScalar(value), parsed.suffix),
      };
    }

    return {
      label: key,
      value: this.#formatScalar(value),
    };
  }

  static #parseTextDescriptor(key, descriptor, value) {
    if (descriptor.includes(":")) {
      const separatorIndex = descriptor.indexOf(":");
      return {
        label: descriptor.slice(0, separatorIndex).trim() || key,
        suffix: descriptor.slice(separatorIndex + 1).trim(),
      };
    }

    return {
      label: key,
      suffix: "",
    };
  }

  static #readPath(path, item, effectiveStats) {
    if (!path) return undefined;
    if (Object.prototype.hasOwnProperty.call(effectiveStats, path)) {
      return effectiveStats[path];
    }
    if (Object.prototype.hasOwnProperty.call(item || {}, path)) {
      return item[path];
    }

    const parts = String(path).split(".");
    let current = { ...item, effectiveStats };
    for (let i = 0; i < parts.length; i++) {
      if (!current || typeof current !== "object") return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  static #formatScalar(value, decimals) {
    if (typeof value === "number") {
      if (Number.isInteger(value)) return String(value);
      const precision = Number.isInteger(decimals) ? decimals : 2;
      return value
        .toFixed(precision)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
    }
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  }

  static #joinSuffix(value, suffix) {
    const normalized = String(suffix || "").trim();
    if (!normalized) return value;
    const glue = normalized.startsWith("%") ? "" : " ";
    return `${value}${glue}${normalized}`;
  }
}

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
      if (category === "builds") continue;
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
      itemType: item.itemType,
      variant: item.variant || null,
      rarityProfile: item.rarityProfile ?? null,
      progressionProfile: item.progressionProfile ?? null,
      displayStats: DisplayStatsResolver.resolve(item),
      displayStatsSchema: item.displayStats || {},
      gameplayStats: { ...(item.gameplayStats || {}) },
    };
  }
}

class RuntimeDisplayStatFormatter {
  formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  formatCoefficient(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
}

class RuntimeDisplayStatWriter {
  #formatter;

  constructor({ formatter = new RuntimeDisplayStatFormatter() } = {}) {
    this.#formatter = formatter;
  }

  write(item, key, value, { format = "coefficient" } = {}) {
    if (!item?.displayStats || value === undefined || value === null) return;
    const stat = this.#parseDescriptor(key, item.displayStatsSchema?.[key]);
    item.displayStats[stat.label] = this.#joinSuffix(
      this.#format(value, format),
      stat.suffix,
    );
  }

  #format(value, format) {
    if (format === "meters") return this.#formatter.formatMeters(value);
    return this.#formatter.formatCoefficient(value);
  }

  #parseDescriptor(key, descriptor) {
    if (descriptor && typeof descriptor === "object") {
      return {
        label: descriptor.label || key,
        suffix: descriptor.suffix || "",
      };
    }

    const text = String(descriptor || key);
    const separatorIndex = text.indexOf(":");
    if (separatorIndex < 0) {
      return { label: text.trim() || key, suffix: "" };
    }

    return {
      label: text.slice(0, separatorIndex).trim() || key,
      suffix: text.slice(separatorIndex + 1).trim(),
    };
  }

  #joinSuffix(value, suffix) {
    const normalized = String(suffix || "").trim();
    if (!normalized) return value;
    const glue = normalized.startsWith("%") ? "" : " ";
    return `${value}${glue}${normalized}`;
  }
}

class InventoryRuntimeConfigProvider {
  #config;
  #physicsConfig;

  constructor(
    config = typeof CONFIG !== "undefined" ? CONFIG : null,
    physicsConfig = null,
  ) {
    this.#config = config || null;
    this.#physicsConfig =
      physicsConfig ||
      this.#config?.fightPhysicsConfig ||
      this.#createPhysicsConfig(this.#config);
  }

  getReelConfig() {
    return this.#physicsConfig?.getReelConfig?.() || {};
  }

  #createPhysicsConfig(config) {
    if (!config || typeof FightPhysicsConfigAdapter === "undefined") {
      return null;
    }
    return new FightPhysicsConfigAdapter(config);
  }
}

class InventoryRuntimeDisplayStatsResolver {
  #reelStatsResolver;
  #lineStatsResolver;

  constructor({
    statWriter = new RuntimeDisplayStatWriter(),
    reelStatsResolver = new ReelRuntimeDisplayStatsResolver({ statWriter }),
    lineStatsResolver = new LineRuntimeDisplayStatsResolver({ statWriter }),
  } = {}) {
    this.#reelStatsResolver = reelStatsResolver;
    this.#lineStatsResolver = lineStatsResolver;
  }

  apply(item, context = {}) {
    this.#reelStatsResolver.apply(item, context);
    this.#lineStatsResolver.apply(item, context);
  }
}

class ReelRuntimeDisplayStatsResolver {
  #retrieveSpeedCalculator;
  #statWriter;

  constructor({
    retrieveSpeedCalculator = new ReelRetrieveSpeedCalculator(),
    statWriter = new RuntimeDisplayStatWriter(),
  } = {}) {
    this.#retrieveSpeedCalculator = retrieveSpeedCalculator;
    this.#statWriter = statWriter;
  }

  apply(item, { reelConfig = {} } = {}) {
    if (!this.#isReel(item)) return;

    const speed = this.#retrieveSpeedCalculator.calculate({
      baseSpeedMetersPerSec: item.effectiveStats?.retrieveSpeedMetersPerSec,
      bearingCount: item.effectiveStats?.bearingCount,
      bearingBonusMetersPerSec:
        reelConfig.bearingRetrieveSpeedBonusMetersPerSec,
    });
    this.#statWriter.write(item, "retrieveSpeedMetersPerSec", speed);
  }

  #isReel(item) {
    return item?.itemType === "reel";
  }
}

class LineRuntimeDisplayStatsResolver {
  #statWriter;

  constructor({ statWriter = new RuntimeDisplayStatWriter() } = {}) {
    this.#statWriter = statWriter;
  }

  apply(item) {
    if (item?.itemType === "fishing_line") {
      this.#writeIfDefined(item, "lengthMeters", "meters");
      this.#writeIfDefined(item, "diameterMm");
      this.#writeIfDefined(item, "maxLoadKg");
      return;
    }

    if (item?.itemType === "leader_line") {
      this.#writeIfDefined(item, "diameterMm");
      this.#writeIfDefined(item, "maxLoadKg");
    }
  }

  #writeIfDefined(item, key, format = "coefficient") {
    const value = item?.effectiveStats?.[key];
    if (value === undefined || value === null) return;
    this.#statWriter.write(item, key, value, { format });
  }
}

class Inventory {
  #items;
  #itemFactory;

  constructor(initialItems = [], itemFactory = null) {
    this.#items = new Map();
    this.#itemFactory = itemFactory;
    for (let i = 0; i < initialItems.length; i++) {
      this.addItem(initialItems[i]);
    }
  }

  addItem(itemData) {
    const item = this.#itemFactory
      ? this.#itemFactory.create(itemData)
      : itemData;
    this.#items.set(item.instanceId, item);
    return item;
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

class InventoryItemIdMigrationPolicy {
  static #itemIdMap = {
    line_test_25m: "line_test_1",
    line_test_10m: "line_test_2",
    line_test_50m: "line_test_3",
  };
  static #removedItemIds = new Set(["sinker_light"]);

  static migrateItems(items = []) {
    if (!Array.isArray(items)) return [];
    const migrated = [];
    for (const item of items) {
      const next = this.migrateItem(item);
      if (next) migrated.push(next);
    }
    return migrated;
  }

  static migrateItem(item) {
    if (!item || typeof item !== "object") return item;
    const itemId = this.#itemIdMap[item.itemId] || item.itemId;
    if (this.#removedItemIds.has(itemId)) return null;
    if (itemId === item.itemId) return { ...item };
    return { ...item, itemId };
  }
}

class EquipmentStateMigrationPolicy {
  static migrate({ equipment = {}, inventoryItems = [], itemDB = {} } = {}) {
    const migrated = { ...(equipment || {}) };
    if (!migrated.feederRigId && migrated.sinkerId) {
      const itemType = this.#getItemType(
        migrated.sinkerId,
        inventoryItems,
        itemDB,
      );
      if (itemType === "feeder_rig") {
        migrated.feederRigId = migrated.sinkerId;
      }
    }
    delete migrated.sinkerId;
    return migrated;
  }

  static #getItemType(instanceId, inventoryItems, itemDB) {
    const instance = inventoryItems.find(
      (item) => item?.instanceId === instanceId,
    );
    if (!instance?.itemId) return null;

    for (const category of Object.values(itemDB || {})) {
      if (!category || typeof category !== "object") continue;
      const item = category[instance.itemId];
      if (item?.itemType) return item.itemType;
    }
    return null;
  }
}

class ConfiguredInventorySeeder {
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

class LineCompatibilityRules {
  #lineConfig;
  #policy;

  constructor(lineConfig = {}) {
    this.#lineConfig = lineConfig || {};
    this.#policy = new LineAllocationPolicy(this.#lineConfig);
  }

  get config() {
    return this.#lineConfig;
  }

  validateLine(lineItem, equippedHydrated) {
    return this.#policy.resolve({ lineItem, equipment: equippedHydrated });
  }

  validateLeader(_leaderItem, equippedHydrated) {
    if (!equippedHydrated?.line) {
      return {
        isValid: false,
        reason: "Поводок можна спорядити тільки після ліски.",
      };
    }
    return { isValid: true };
  }

  getLineLengthMeters(lineItem) {
    return this.#policy.getLineLengthMeters(lineItem);
  }

  getMinimumLineLengthMeters(rod) {
    return this.#policy.getMinimumLineLengthMeters(rod);
  }

  getMaximumLineLengthMeters(rod, reel = null) {
    return this.#policy.getMaximumLineLengthMeters({ rod, reel });
  }

  rodRequiresReel(rod) {
    return this.#policy.rodRequiresReel(rod);
  }
}

class EquipmentValidator {
  static VALID_BASE_TYPES = new Set([
    "rod",
    "reel",
    "float",
    "hook",
    "feeder_rig",
    "lure",
    "bait",
    "net",
    "chum_mix",
    "boat",
  ]);

  static validate(itemData, equippedHydrated) {
    if (!itemData) return { isValid: false, reason: "Помилка даних предмета" };
    if (this.VALID_BASE_TYPES.has(itemData.itemType)) return { isValid: true };
    if (itemData.itemType === "fishing_line") {
      return this.validateFishingLine(itemData, equippedHydrated);
    }

    if (itemData.itemType === "leader_line") {
      return this.validateLeader(itemData, equippedHydrated);
    }

    const reqTag = itemData.effectiveStats?.requiresTag;
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

  static validateLeader(itemData, equippedHydrated) {
    if (!equippedHydrated?.line) {
      return {
        isValid: false,
        reason: "Поводок можна спорядити тільки після ліски.",
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
      itemData.effectiveStats?.lengthMeters,
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
      equippedHydrated?.reel?.effectiveStats?.lineCapacityMeters,
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
      rod?.effectiveStats?.lengthMeters,
      0,
    );
    return Math.max(0, rodLength);
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
    if (itemData?.itemType === "fishing_line") {
      const validation = this.validateFishingLine(itemData, equippedHydrated);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equippedHydrated?.rod?.variant || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    if (itemData?.itemType === "leader_line") {
      const validation = this.validateLeader(itemData, equippedHydrated);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equippedHydrated?.rod?.variant || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    const reqTag = itemData?.effectiveStats?.requiresTag;
    if (!reqTag) {
      return {
        hasCompatibility: false,
        isCompatible: true,
        requiredTag: null,
        rodType: equippedHydrated?.rod?.variant || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    const availableCaps = this.#getAvailableCapabilities(equippedHydrated || {});
    return {
      hasCompatibility: true,
      isCompatible: availableCaps.has(reqTag),
      requiredTag: reqTag,
      rodType: equippedHydrated?.rod?.variant || null,
      rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
    };
  }

  static #rodRequiresReel(rod) {
    if (!rod) return null;
    return rod.effectiveStats?.hasReel ?? rod.variant !== "pole";
  }

  static #getAvailableCapabilities(equippedHydrated) {
    const caps = new Set();
    const parts = [
      equippedHydrated.rod,
      equippedHydrated.reel,
      equippedHydrated.line,
      equippedHydrated.float,
      equippedHydrated.feederRig,
      ...(equippedHydrated.hooks || []),
    ];

    for (const part of parts) {
      if (!part) continue;
      const partCaps =
        part.effectiveStats?.capabilities || [];
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
  #lineRules;
  #lineController;
  #runtimeConfigProvider;
  #runtimeDisplayStatsResolver;
  #itemFactory;
  #itemViewFactory;
  #stackingPolicy;
  #inventoryV2 = null;
  #inventoryV2Facade = null;
  #inventoryV2Bridge = null;
  #removeInventoryV2Listener = null;
  #lineCapacityStateProvider = () => null;
  #isLocked = false;
  #equippedCache = null;
  #effectiveStatsResolver;

  constructor(
    itemDB,
    playerConfig,
    events = new InventoryEventBridge(),
    castDistanceCalculator = null,
    lineRules = null,
    runtimeConfigProvider = null,
    itemRarityResolver = null,
    stackingPolicy = null,
    itemProgressionResolver = null,
    itemViewFactory = null,
    itemConditionResolver = null,
    itemFreshnessResolver = null,
  ) {
    const cachedInventory = InventoryItemIdMigrationPolicy.migrateItems(
      CacheManager.get("player_inventory") || playerConfig.inventory || [],
    );
    const cachedEquipment = EquipmentStateMigrationPolicy.migrate({
      equipment:
        CacheManager.get("player_equipment") || playerConfig.equipment || {},
      inventoryItems: cachedInventory,
      itemDB,
    });

    this.#db = new ItemDatabase(itemDB);
    this.#effectiveStatsResolver = new EffectiveItemStatsResolver();
    this.#itemFactory = new InventoryItemFactory({
      itemDatabase: this.#db,
      itemRarityResolver: itemRarityResolver || new ItemRarityResolver(),
    });
    this.#stackingPolicy =
      stackingPolicy || new InventoryItemStackingPolicy();
    this.#inventory = new Inventory(cachedInventory, this.#itemFactory);
    this.#equipment = new InventoryEquipment(SLOT_CONFIG, cachedEquipment);
    this.#events = events || new InventoryEventBridge();
    this.#castDistanceCalculator =
      castDistanceCalculator || new CastDistanceCalculator();
    this.#lineRules = lineRules || new LineCompatibilityRules();
    this.#runtimeConfigProvider =
      runtimeConfigProvider || new InventoryRuntimeConfigProvider();
    this.#runtimeDisplayStatsResolver =
      new InventoryRuntimeDisplayStatsResolver();
    this.#itemViewFactory = itemViewFactory || (
      itemProgressionResolver &&
      typeof InventoryItemViewFactory !== "undefined"
        ? new InventoryItemViewFactory({
            itemDatabase: this.#db,
            progressionResolver: itemProgressionResolver,
            conditionResolver: itemConditionResolver,
            freshnessResolver: itemFreshnessResolver,
            displayStatsResolver: this.#runtimeDisplayStatsResolver,
            runtimeContextProvider: () => ({
              reelConfig: this.#runtimeConfigProvider.getReelConfig(),
              lineCapacity: this.#buildLineCapacityContext(),
            }),
          })
        : null
    );
    this.#lineController = new LineInventoryController({
      inventory: this.#inventory,
      db: this.#db,
      makeId: (prefix) => this.#makeId(prefix),
      lineConfig: this.#lineRules.config,
      isEquipped: (instanceId) => this.#isInstanceEquipped(instanceId),
    });

    this.#setupInventorySeeders(itemDB, playerConfig);
    this.#initializeInventoryV2(cachedEquipment, playerConfig);
  }

  #initializeInventoryV2(legacyEquipment, playerConfig) {
    if (typeof InventoryV2CompositionRoot === "undefined") return;
    this.#inventoryV2 = InventoryV2CompositionRoot.compose({
      cache: CacheManager,
      legacyItems: this.#inventory.getAll(),
      legacyEquipment,
      legacySettings: playerConfig?.inventorySettings || {},
      itemDefinitionResolver: this.#db,
      itemViewFactory: this.#itemViewFactory,
      instanceIdFactory: (context = {}) => {
        const prefix =
          typeof context === "string" ? context : context?.prefix || "item";
        return this.#makeId(prefix);
      },
      loadValueProvider: () => this.getMaxTackleLoadKg(),
      lineConfig: this.#lineRules.config,
    });
    this.#inventoryV2Facade = this.#inventoryV2.facade;
    this.#inventoryV2Bridge = this.#inventoryV2.gameplayBridge;
    this.#removeInventoryV2Listener = this.#inventoryV2Facade.subscribe(() => {
      this.#equippedCache = null;
      this.#events.emit("inventory-changed", {
        equipment: this.getEquipped(),
        source: "inventory-v2",
      });
    });
  }

  #setupInventorySeeders(itemDB, playerConfig) {
    new ConfiguredInventorySeeder({
      inventory: this.#inventory,
      itemDB,
      playerConfig,
    }).seed();
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
    if (this.#inventoryV2Facade) {
      const result = this.dispatchInventoryV2Action({
        type: InventoryV2ActionType.LOADOUT_SAVE,
        name: String(buildName || ""),
      });
      return {
        ...result,
        reason: result.warning || null,
      };
    }
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
    countId(newRaw.leaderId);
    countId(newRaw.floatId);
    countId(newRaw.feederRigId);
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
    if (this.#inventoryV2Facade) {
      return this.dispatchInventoryV2Action({
        type: InventoryV2ActionType.INVENTORY_ITEM_LONG_PRESS,
        instanceId: buildId,
      });
    }
    if (!buildId) return;
    const equippedBuildSlotPaths = this.#getEquippedSlotPathsForBuild(buildId);
    this.#unequipSlotsWithLifecycle(equippedBuildSlotPaths, {
      save: false,
      notify: false,
    });

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
    if (this.#inventoryV2Facade) {
      return this.dispatchInventoryV2Action({
        type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
        instanceId: buildId,
      });
    }
    this.#unequipSlotsWithLifecycle(Object.keys(SLOT_CONFIG), {
      save: false,
      notify: false,
    });

    const items = this.#getBuildItemsInEquipOrder(buildId);

    for (let i = 0; i < items.length; i++) {
      const item = items[i].item;
      const itemData = items[i].itemData;

      // Якщо в ящику лежить 2 гачки одного типу, екіпіруємо їх двічі у вільні слоти!
      const qtyToEquip = itemData.quantity || 1;
      for (let q = 0; q < qtyToEquip; q++) {
        const slotPath = this.#findTargetSlotPath(itemData);
        if (slotPath) {
          this.#equipItemWithLifecycle(slotPath, item.instanceId, {
            save: false,
            notify: false,
          });
        }
      }
    }

    this.#enforceEquippedLineCompatibility();
    this.#saveAndNotify();
  }

  #getBuildItemsInEquipOrder(buildId) {
    const items = this.#inventory.getAll();
    const buildItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.buildId !== buildId) continue;
      const itemData = this._hydrateInstance(item.instanceId);
      if (!itemData) continue;
      if (itemData.itemType === "build_box") continue;
      buildItems.push({ item, itemData });
    }

    buildItems.sort((a, b) => {
      const byPriority =
        this.#getBuildEquipPriority(a.itemData) -
        this.#getBuildEquipPriority(b.itemData);
      return byPriority || 0;
    });
    return buildItems;
  }

  #getBuildEquipPriority(itemData) {
    if (!itemData) return 100;
    if (SLOT_CONFIG.rod.acceptTypes.includes(itemData.itemType)) return 0;
    if (SLOT_CONFIG.reel.acceptTypes.includes(itemData.itemType)) return 10;
    if (SLOT_CONFIG.line.acceptTypes.includes(itemData.itemType)) return 20;
    if (SLOT_CONFIG.leader.acceptTypes.includes(itemData.itemType)) return 30;
    return 50;
  }

  setLock(locked) {
    this.#isLocked = locked;
  }

  get inventoryV2Facade() {
    return this.#inventoryV2Facade;
  }

  dispatchInventoryV2Action(action = {}) {
    if (!this.#inventoryV2Facade) {
      return {
        success: false,
        warning: "Нова модель інвентарю недоступна.",
        refresh: false,
      };
    }
    const safeWhileLocked = new Set([
      InventoryV2ActionType.OPEN,
      InventoryV2ActionType.CLOSE,
      InventoryV2ActionType.CATEGORY_SELECT,
      InventoryV2ActionType.ASSEMBLY_BACK,
      InventoryV2ActionType.AUTO_BAIT_CHANGE,
      InventoryV2ActionType.AUTO_CHUM_CHANGE,
    ]);
    if (this.#isLocked && !safeWhileLocked.has(action.type)) {
      return {
        success: false,
        warning: "Витягніть снасть з води, щоб змінити спорядження.",
        refresh: false,
      };
    }
    return this.#inventoryV2Facade.dispatch(action);
  }

  setBoatChargeProvider(provider) {
    this.#inventoryV2Facade?.setBoatChargeProvider?.(provider);
  }

  handleRodRetrieved(context = {}) {
    return this.#inventoryV2Bridge?.handleRodRetrieved?.(context) ??
      this.#inventoryV2Bridge?.rodRetrieved?.(context) ??
      null;
  }

  handleHandChumUsed(context = {}) {
    return this.#inventoryV2Bridge?.handleHandChumUsed?.(context) ??
      this.#inventoryV2Bridge?.handChumUsed?.(context) ??
      null;
  }

  handleBoatReturned(context = {}) {
    return this.#inventoryV2Bridge?.handleBoatReturned?.(context) ??
      this.#inventoryV2Bridge?.boatReturned?.(context) ??
      null;
  }

  evaluateCastReadiness(equipment = null) {
    const inventoryV2Readiness =
      this.#inventoryV2Bridge?.evaluateCastReadiness?.() || null;
    if (typeof inventoryV2Readiness?.canCast === "boolean") {
      return inventoryV2Readiness;
    }

    const eq = equipment || this.getEquipped();
    if (!eq?.rod) {
      return Object.freeze({
        canCast: false,
        shouldOpenInventory: true,
        warning: "Спочатку спорядіть вудилище.",
        warningCode: "rod-required",
      });
    }

    const rod = eq.rod;
    const supportsReel =
      rod.effectiveStats?.equipmentCapabilities?.supportsReel ??
      rod.effectiveStats?.supportsReel ??
      rod.effectiveStats?.hasReel ??
      rod.variant !== "pole";
    if (supportsReel && !eq.reel) {
      return Object.freeze({
        canCast: false,
        shouldOpenInventory: true,
        warning: "Для цієї вудки потрібна котушка.",
        warningCode: "reel-required",
      });
    }

    if ((Number(eq.line?.effectiveStats?.lengthMeters) || 0) <= 0) {
      return Object.freeze({
        canCast: false,
        shouldOpenInventory: true,
        warning: supportsReel
          ? "У котушку потрібно встановити ліску."
          : "Для закидання потрібно спорядити ліску.",
        warningCode: supportsReel
          ? "reel-line-required"
          : "terminal-line-required",
      });
    }

    return Object.freeze({
      canCast: true,
      shouldOpenInventory: false,
      warning: null,
      warningCode: null,
    });
  }

  setLineCapacityStateProvider(provider) {
    if (typeof provider !== "function") {
      throw new TypeError("Line capacity state provider must be a function");
    }
    this.#lineCapacityStateProvider = provider;
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
      const maxLoadKg = Number(item.effectiveStats?.maxLoadKg ?? fallback);
      const durability = Number(item.effectiveStats?.durability ?? 100);
      const lossPerPercent = Number(
        item.effectiveStats?.durabilityMaxLoadLossPerPercent ??
          0.001,
      );
      if (!Number.isFinite(maxLoadKg) || maxLoadKg <= 0) return fallback;
      const lostPercent = Math.max(0, 100 - (Number.isFinite(durability) ? durability : 100));
      return maxLoadKg * Math.max(0.1, 1 - lostPercent * lossPerPercent);
    };

    pushPositive(effectiveLoad(eq.rod, 0));
    pushPositive(effectiveLoad(eq.line, 0));
    pushPositive(effectiveLoad(eq.leader, 0));

    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  autoEquipItem(instanceId) {
    if (this.#inventoryV2Facade) {
      const result = this.dispatchInventoryV2Action({
        type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
        instanceId,
      });
      return {
        ...result,
        reason: result.warning || null,
      };
    }
    const itemData = this._hydrateInstance(instanceId);
    if (!itemData) return { success: false, reason: "Предмет не знайдено" };

    const validation = this.validateEquip(itemData);
    if (!validation.isValid)
      return { success: false, reason: validation.reason };

    const targetSlotPath = this.#findTargetSlotPath(itemData);
    if (!targetSlotPath && itemData.itemType === "bait") {
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
      if (config.acceptTypes && config.acceptTypes.includes(itemData.itemType)) {
        baseSlot = slot;
        break;
      }
    }

    if (!baseSlot) return null;

    const eq = this.getEquipped();

    if (baseSlot === "hooks") {
      // ВИПРАВЛЕНО: Додано перевірку на базову кількість гачків вудки
      const maxHooks =
        eq.feederRig?.effectiveStats?.hooksCount ||
        eq.rod?.effectiveStats?.maxHooks ||
        1;

      const currentArr = eq[baseSlot] || [];
      for (let i = 0; i < maxHooks; i++) {
        if (!currentArr[i]) return `${baseSlot}_${i}`;
      }
      return `${baseSlot}_0`;
    }

    if (baseSlot === "baits") {
      const maxHooks =
        eq.feederRig?.effectiveStats?.hooksCount ||
        eq.rod?.effectiveStats?.maxHooks ||
        1;
      const baits = eq.baits || [];

      if (itemData.itemType === "bait") {
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

    if (itemData.itemType === "chum_mix") {
      const feederRigCaps =
        eq.feederRig?.effectiveStats?.capabilities ||
        [];
      const hasFeederSlot = feederRigCaps.includes("chum_mix");

      if (hasFeederSlot && !eq.feederChum) return "feederChum";

      if (eq.delivery) {
        const sections =
          eq.delivery.effectiveStats?.sections || 1;
        const arr = eq.deliveryChums || [];
        for (let i = 0; i < sections; i++) {
          if (!arr[i]) return `deliveryChums_${i}`;
        }
      }
      return null;
    }

    return baseSlot;
  }

  #prepareInstanceForEquip(slotPath, instanceId, itemData, validation) {
    return this.#lineController.prepareLineForEquip({
      slotPath,
      instanceId,
      itemData,
      validation,
      equipment: this.getEquipped(),
    });
  }

  #getInventoryLineLengthMeters(item) {
    return this.#lineController.getInventoryLineLengthMeters(item);
  }

  #setInventoryLineLengthMeters(item, lengthMeters) {
    if (!item) return;
    item.statOverrides = {
      ...(item.statOverrides || {}),
      lengthMeters: Math.max(0, Number(lengthMeters) || 0),
    };
    item.quantity = 1;
  }

  #mergeDetachedLineSegment(lineItem) {
    return this.#lineController.mergeDetachedLineSegment(lineItem);
  }

  #mergeLineLengthIntoAvailableStack(sourceItem) {
    return this.#lineController.mergeLineLengthIntoAvailableStack(sourceItem);
  }

  #isInstanceEquipped(instanceId) {
    return !!this.#equipment.findSlotByInstanceId(instanceId);
  }

  breakEquippedLine(lossMeters) {
    if (this.#inventoryV2Bridge) {
      return this.#inventoryV2Bridge.breakEquippedLine(lossMeters);
    }
    const raw = this.#equipment.getRawState();
    if (!raw.lineId) return false;

    const item = this.#inventory.getInstance(raw.lineId);
    if (!item) return false;

    const currentLength = this.#getInventoryLineLengthMeters(item);
    const loss = Math.max(0, Number(lossMeters) || 0);
    const nextLength = Math.max(0, currentLength - loss);

    if (nextLength <= 0.001) {
      this.#setInventoryLineLengthMeters(item, 0);
      this.#unequipSlotsWithLifecycle(["line"], {
        save: false,
        notify: false,
      });
      this.#inventory.remove(raw.lineId);
    } else {
      this.#setInventoryLineLengthMeters(item, nextLength);
      this.#enforceEquippedLineCompatibility();
    }

    this.#equippedCache = null;
    this.#saveAndNotify();
    return true;
  }

  consumeItem(instanceId, amount = 1) {
    if (this.#inventoryV2Bridge) {
      return this.#inventoryV2Bridge.consumeItem(instanceId, amount);
    }
    const success = this.#inventory.consume(instanceId, amount);
    if (success) {
      this.#equippedCache = null;
      const slot = this.#equipment.findSlotByInstanceId(instanceId);
      if (slot && !this.#inventory.getInstance(instanceId)) {
        this.#unequipSlotsWithLifecycle([slot], {
          save: false,
          notify: false,
        });
      }
      this.#saveAndNotify();
    }
    return success;
  }

  consumeHandChum() {
    return this.consumeEquipped("handChum", 1, true);
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    if (this.#inventoryV2Bridge) {
      return this.#inventoryV2Bridge.consumeEquipped(
        slotPath,
        amount,
        unequipAfterConsume,
      );
    }
    const item = this.#getEquippedItemAtSlot(slotPath);
    if (!item?.instanceId) return false;

    const success = this.#inventory.consume(item.instanceId, amount);
    if (!success) return false;

    this.#equippedCache = null;
    if (unequipAfterConsume || !this.#inventory.getInstance(item.instanceId)) {
      this.#unequipSlotsWithLifecycle([slotPath], {
        save: false,
        notify: false,
      });
    }

    this.#saveAndNotify();
    return true;
  }

  removeItem(instanceId) {
    if (this.#inventory.remove(instanceId)) {
      this.#equippedCache = null;
      const slot = this.#equipment.findSlotByInstanceId(instanceId);
      if (slot) {
        this.#unequipSlotsWithLifecycle([slot], {
          save: false,
          notify: false,
        });
      }
      this.#saveAndNotify();
    }
  }

  equipItem(slotPath, instanceId) {
    if (this.#inventoryV2Facade) {
      return this.dispatchInventoryV2Action({
        type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
        instanceId,
      }).success === true;
    }
    return this.#equipItemWithLifecycle(slotPath, instanceId);
  }

  #equipItemWithLifecycle(
    slotPath,
    instanceId,
    { save = true, notify = true } = {},
  ) {
    if (!this.#inventory.getInstance(instanceId)) return false;

    let itemData = this._hydrateInstance(instanceId);
    let slotValidation = this.validateEquipToSlot(slotPath, itemData);
    if (!slotValidation.isValid) return false;

    const equippedLineId = this.#equipment.getRawState().lineId;
    if (slotPath === "line" && equippedLineId && equippedLineId !== instanceId) {
      this.#unequipSlotsWithLifecycle(["line"], {
        save: false,
        notify: false,
      });
      itemData = this._hydrateInstance(instanceId);
      slotValidation = this.validateEquipToSlot(slotPath, itemData);
      if (!slotValidation.isValid) return false;
    }

    const preparedInstanceId = this.#prepareInstanceForEquip(
      slotPath,
      instanceId,
      itemData,
      slotValidation,
    );
    if (!preparedInstanceId) return false;
    if (preparedInstanceId !== instanceId) {
      instanceId = preparedInstanceId;
      itemData = this._hydrateInstance(instanceId);
    }

    // КАСКАД: Якщо вдягаємо нову вудку, і її тип відрізняється від поточної — скидаємо стару оснастку
    if (slotPath === "rod") {
      const currentRod = this.getEquipped().rod;
      if (currentRod && currentRod.variant !== itemData.variant) {
        const slotsToUnequip = [
          "reel",
          "line",
          "leader",
          "float",
          "feederRig",
          "feederChum",
          "hooks",
          "baits",
        ];
        this.#unequipSlotsWithLifecycle(slotsToUnequip, {
          save: false,
          notify: false,
        });
      }
    }

    if (slotPath === "delivery" && itemData?.itemType !== "boat") {
      const eq = this.getEquipped();
      const sections =
        eq.delivery?.effectiveStats?.sections || 1;
      const slotsToUnequip = [];
      for (let i = 0; i < sections; i++) {
        slotsToUnequip.push(`deliveryChums_${i}`);
      }
      this.#unequipSlotsWithLifecycle(slotsToUnequip, {
        save: false,
        notify: false,
      });
    }

    const success = this.#equipment.equip(slotPath, instanceId);
    if (success) {
      this.#equippedCache = null;
      this.#enforceEquippedLineCompatibility();
      if (save || notify) this.#saveAndNotify({ save, notify });
    }
    return success;
  }

  unequipItem(slotPath) {
    if (this.#inventoryV2Facade) {
      const slotMap = {
        rod: "rod",
        reel: "reel",
        line: "terminalLine",
        leader: "terminalLine",
        float: "float",
        feederRig: "tackle",
        net: "net",
        delivery: "delivery",
        handChum: "handChum",
      };
      const slotId = slotMap[slotPath];
      if (!slotId) return false;
      return this.dispatchInventoryV2Action({
        type: InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS,
        slotId,
        instanceId:
          this.#inventoryV2.equipmentState.getRootInstanceId(slotId) || "missing",
      }).success === true;
    }
    const equippedBefore = this.getEquipped();
    const slotPaths = [
      slotPath,
      ...this.#getAdditionalUnequipSlots(slotPath, equippedBefore),
    ];
    this.#unequipSlotsWithLifecycle(slotPaths, {
      save: false,
      notify: false,
    });

    this.#saveAndNotify();
  }

  #getEquippedSlotPathsForBuild(buildId) {
    const raw = this.#equipment.getRawState();
    const slotPaths = [];

    for (const [slotName, settings] of Object.entries(SLOT_CONFIG)) {
      if (settings.type === "array") {
        const instanceIds = raw[slotName] || [];
        for (let i = 0; i < instanceIds.length; i++) {
          const item = this.#inventory.getInstance(instanceIds[i]);
          if (item?.buildId === buildId) slotPaths.push(`${slotName}_${i}`);
        }
        continue;
      }

      const item = this.#inventory.getInstance(raw[`${slotName}Id`]);
      if (item?.buildId === buildId) slotPaths.push(slotName);
    }

    return slotPaths;
  }

  #getAdditionalUnequipSlots(slotPath, equippedBefore) {
    const slotPaths = [];

    if (slotPath === "feederRig") {
      slotPaths.push("feederChum");
      const removedHooksCount =
        equippedBefore.feederRig?.effectiveStats?.hooksCount ||
        0;
      const oldHooks = equippedBefore.hooks || [];
      const oldBaits = equippedBefore.baits || [];
      const maxSlots = Math.max(oldHooks.length, oldBaits.length);
      const firstRemovedIndex = removedHooksCount > 0
        ? 0
        : equippedBefore.rod?.maxHooks || 1;

      for (let i = firstRemovedIndex; i < maxSlots; i++) {
        slotPaths.push(`hooks_${i}`, `baits_${i}`);
      }
    } else if (slotPath.startsWith("hooks_")) {
      const index = slotPath.split("_")[1];
      slotPaths.push(`baits_${index}`);
    }

    return slotPaths;
  }

  #unequipSlotsWithLifecycle(
    slotPaths,
    { save = true, notify = true } = {},
  ) {
    const equippedBefore = this.getEquipped();
    const lineBefore = equippedBefore.line;
    const lineInstanceIdBefore = lineBefore?.instanceId || null;
    const uniqueSlotPaths = new Set(slotPaths || []);

    for (const slotPath of uniqueSlotPaths) {
      if (typeof slotPath === "string" && slotPath) {
        this.#equipment.unequip(slotPath);
      }
    }

    this.#equippedCache = null;
    const rawAfter = this.#equipment.getRawState();
    const lineInstanceIdAfter = rawAfter.lineId || null;
    const lineWasRemoved =
      lineInstanceIdBefore && lineInstanceIdAfter !== lineInstanceIdBefore;

    if (lineWasRemoved) {
      this.#mergeDetachedLineSegment(lineBefore);
    }

    if (save || notify) this.#saveAndNotify({ save, notify });
  }

  validateEquip(itemData) {
    if (itemData?.itemType === "fishing_line") {
      return this.#lineController.validateLine(itemData, this.getEquipped());
    }
    if (itemData?.itemType === "leader_line") {
      return this.#lineController.validateLeader(itemData, this.getEquipped());
    }
    return EquipmentValidator.validate(itemData, this.getEquipped());
  }

  getCompatibilityInfo(itemData) {
    const equipment = this.getEquipped();
    if (itemData?.itemType === "fishing_line") {
      const validation = this.#lineController.validateLine(itemData, equipment);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equipment?.rod?.variant || null,
        rodHasReel: this.#lineController.rodRequiresReel(equipment?.rod),
      };
    }
    if (itemData?.itemType === "leader_line") {
      const validation = this.#lineController.validateLeader(itemData, equipment);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equipment?.rod?.variant || null,
        rodHasReel: this.#lineController.rodRequiresReel(equipment?.rod),
      };
    }
    return EquipmentValidator.getCompatibilityInfo(itemData, equipment);
  }

  validateEquipToSlot(slotPath, itemData) {
    const validation = this.validateEquip(itemData);
    if (!validation.isValid) return validation;

    const baseSlot = (slotPath || "").split("_")[0];
    const slotConfig = typeof SLOT_CONFIG !== "undefined" ? SLOT_CONFIG[baseSlot] : null;
    if (
      slotConfig?.acceptTypes &&
      itemData?.itemType &&
      !slotConfig.acceptTypes.includes(itemData.itemType)
    ) {
      return {
        isValid: false,
        reason: `Предмет не підходить для слота: ${baseSlot}`,
      };
    }

    if (itemData?.itemType === "fishing_line") {
      if (baseSlot !== "line") {
        return {
          isValid: false,
          reason: "Ліску можна спорядити тільки у слот ліски.",
        };
      }
      return this.#lineController.validateLine(itemData, this.getEquipped());
    }

    if (itemData?.itemType === "leader_line") {
      if (baseSlot !== "leader") {
        return {
          isValid: false,
          reason: "Поводок можна спорядити тільки у слот поводка.",
        };
      }
      return this.#lineController.validateLeader(itemData, this.getEquipped());
    }

    if (itemData?.itemType !== "bait") return { isValid: true };

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

    if (this.#inventoryV2Bridge) {
      this.#equippedCache = this.#inventoryV2Bridge.getEquipped();
      this.#applyEquippedCastDistanceStats(this.#equippedCache);
      return this.#equippedCache;
    }

    const raw = this.#equipment.getRawState();
    this.#equippedCache = {
      rod: this._hydrateInstance(raw.rodId),
      reel: this._hydrateInstance(raw.reelId),
      line: this._hydrateInstance(raw.lineId),
      leader: this._hydrateInstance(raw.leaderId),
      float: this._hydrateInstance(raw.floatId),
      feederRig: this._hydrateInstance(raw.feederRigId),
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
    if (this.#inventoryV2Bridge) {
      return this.#inventoryV2Bridge.listItems({
        includeAttached: false,
        includeLoadout: false,
        hydrated: false,
      });
    }
    return this.#inventory.getAll();
  }

  hydrateInstance(instanceId) {
    if (this.#inventoryV2Bridge) {
      return this.#inventoryV2Bridge.hydrateInstance(instanceId);
    }
    return this._hydrateInstance(instanceId);
  }

  findFirstItemByType(type) {
    if (this.#inventoryV2Bridge) {
      const items = this.#inventoryV2Bridge.listItems({
        includeAttached: false,
        includeLoadout: false,
        hydrated: true,
      });
      return items.find((item) => this.#matchesItemType(item, type)) || null;
    }
    const items = this.#inventory.getAll();
    for (let i = 0; i < items.length; i++) {
      const hydrated = this._hydrateInstance(items[i].instanceId);
      if (this.#matchesItemType(hydrated, type)) return hydrated;
    }
    return null;
  }

  findItemsByType(type, out = []) {
    if (this.#inventoryV2Bridge) {
      out.length = 0;
      const items = this.#inventoryV2Bridge.listItems({
        includeAttached: false,
        includeLoadout: false,
        hydrated: true,
      });
      for (const item of items) {
        if (this.#matchesItemType(item, type)) out.push(item);
      }
      return out;
    }
    out.length = 0;
    const items = this.#inventory.getAll();
    for (let i = 0; i < items.length; i++) {
      const hydrated = this._hydrateInstance(items[i].instanceId);
      if (this.#matchesItemType(hydrated, type)) out.push(hydrated);
    }
    return out;
  }

  onInventoryChanged(handler) {
    return this.#events.on("inventory-changed", handler);
  }

  refreshItemData() {
    this.#db.refresh();
    this.#equippedCache = null;
    if (this.#inventoryV2Facade) {
      this.#inventoryV2Facade.notify();
      return;
    }
    this.#events.emit("inventory-changed", {
      equipment: this.getEquipped(),
      source: "item-db-updated",
    });
  }

  dispose() {
    this.#removeInventoryV2Listener?.();
    this.#removeInventoryV2Listener = null;
    this.#events.clear();
  }

  #enforceEquippedLineCompatibility() {
    const raw = this.#equipment.getRawState();
    if (!raw.lineId) return false;

    const line = this._hydrateInstance(raw.lineId);
    if (!line) {
      this.#unequipSlotsWithLifecycle(["line"], {
        save: false,
        notify: false,
      });
      return true;
    }

    const equipment = {
      rod: this._hydrateInstance(raw.rodId),
      reel: this._hydrateInstance(raw.reelId),
    };
    const validation = this.#lineController.validateLine(line, equipment);
    if (validation.isValid) {
      if (validation.shouldSplit) {
        const segmentId = this.#lineController.prepareLineForEquip({
          slotPath: "line",
          instanceId: raw.lineId,
          itemData: line,
          validation,
          equipment,
        });
        if (segmentId && segmentId !== raw.lineId) {
          this.#equipment.equip("line", segmentId);
          this.#equippedCache = null;
          return true;
        }
      }
      return false;
    }

    this.#unequipSlotsWithLifecycle(["line"], {
      save: false,
      notify: false,
    });
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
    countId(raw.leaderId);
    countId(raw.floatId);
    countId(raw.feederRigId);
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

    const sourceData = this._hydrateInstance(sourceItem.instanceId);
    if (sourceData?.itemType === "fishing_line") {
      this.#mergeLineLengthIntoAvailableStack(sourceItem);
      return;
    }

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
    return this.#stackingPolicy.canStack(a, b);
  }

  #applyStandaloneCastDistanceStats(item) {
    if (!this.#isRodItem(item)) return;
    const requiredLine = this.#lineController.getMinimumLineLengthMeters(item);
    this.#writeRuntimeDisplayStat(
      item,
      "Мін. ліска",
      `${this.#formatMeters(requiredLine)}м`,
    );
  }

  #applyEquippedCastDistanceStats(equipment) {
    if (!equipment?.rod) return;
    this.#writeCastDistanceStats(equipment.rod, equipment);
  }

  #writeCastDistanceStats(rodItem, equipment) {
    const previewPower = this.#getBuildCastPowerCoefficient(equipment);
    const info = this.#castDistanceCalculator.describe(equipment, previewPower);
    const requiredLine = this.#lineController.getMinimumLineLengthMeters(rodItem);
    this.#writeRuntimeDisplayStat(
      rodItem,
      "Мін. ліска",
      `${this.#formatMeters(requiredLine)}м`,
    );
    this.#writeRuntimeDisplayStat(
      rodItem,
      "Сила закидання",
      this.#formatCoefficient(previewPower),
    );

    if (!equipment?.line) {
      delete rodItem.maxDistance;
      this.#writeRuntimeDisplayStat(rodItem, "Ліска", "Не споряджена");
      this.#deleteRuntimeDisplayStat(rodItem, "Довжина ліски");
      this.#deleteRuntimeDisplayStat(rodItem, "Сила заброса");
      this.#deleteRuntimeDisplayStat(rodItem, "Довжина заброса");
      this.#deleteRuntimeDisplayStat(rodItem, "Макс. дальність закидання");
      this.#writeRuntimeDisplayStat(
        rodItem,
        "Масштаб",
        `${info.pixelsPerMeter}px = 1м`,
      );
      return;
    }

    const lineMeters = this.#formatMeters(info.lineLengthMeters);
    const castMeters = this.#formatMeters(info.effectiveDistanceMeters);
    const castPx = Math.round(info.effectiveDistancePx);
    rodItem.maxDistance = Math.round(info.maxDistancePx);
    this.#writeRuntimeDisplayStat(rodItem, "Довжина ліски", `${lineMeters}м`);
    this.#deleteRuntimeDisplayStat(rodItem, "Сила заброса");
    this.#deleteRuntimeDisplayStat(rodItem, "Довжина заброса");
    this.#writeRuntimeDisplayStat(
      rodItem,
      "Макс. дальність закидання",
      `${castMeters}м (${castPx}px)`,
    );
    this.#writeRuntimeDisplayStat(
      rodItem,
      "Масштаб",
      `${info.pixelsPerMeter}px = 1м`,
    );
    this.#deleteRuntimeDisplayStat(rodItem, "Ліска");
  }

  #writeRuntimeDisplayStat(item, label, value) {
    if (!item) return;
    if (!item.displayStats) item.displayStats = {};
    item.displayStats[label] = value;
    delete item[label];
  }

  #deleteRuntimeDisplayStat(item, label) {
    if (!item) return;
    if (item.displayStats) delete item.displayStats[label];
    delete item[label];
  }

  #getBuildCastPowerCoefficient(equipment) {
    return this.#castDistanceCalculator.getBuildCastPowerCoefficient(equipment);
  }

  #isRodItem(item) {
    return item?.itemType === "rod";
  }

  #matchesItemType(item, type) {
    return item?.itemType === type || item?.variant === type;
  }

  #formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  #formatCoefficient(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  #refreshRuntimeDisplayStats(item) {
    if (!item?.displayStats) return;
    this.#runtimeDisplayStatsResolver.apply(item, {
      reelConfig: this.#runtimeConfigProvider.getReelConfig(),
    });
  }

  _hydrateInstance(instanceId) {
    if (!instanceId) return null;
    if (this.#inventoryV2Bridge) {
      return this.#inventoryV2Bridge.hydrateInstance(instanceId);
    }
    const invItem = this.#inventory.getInstance(instanceId);
    if (!invItem) return null;

    const baseItem = this.#db.getItemData(invItem.itemId);
    if (!baseItem) return null;

    const canonicalView = this.#itemViewFactory?.create(invItem) || (() => {
      const instanceState = invItem;
      const { gameplayStats: _authoredStats, ...definitionMetadata } = baseItem;
      return {
        ...definitionMetadata,
        ...instanceState,
        effectiveStats: this.#effectiveStatsResolver.resolve({
          definition: baseItem,
          instanceState,
        }),
        displayStats: { ...(baseItem.displayStats || {}) },
        instanceId: invItem.instanceId,
        quantity: invItem.quantity || 1,
        buildId: invItem.buildId,
        rarity: invItem.rarity ?? null,
      };
    })();
    const hydrated = canonicalView;
    if (!this.#itemViewFactory) this.#refreshRuntimeDisplayStats(hydrated);
    this.#applyStandaloneCastDistanceStats(hydrated);

    if (hydrated.itemType === "build_box") {
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
          if (cBase.itemType === "rod")
            cat = "Вудилище";
          else if (cBase.itemType === "reel") cat = "Котушка";
          else if (cBase.itemType === "fishing_line") cat = "Ліска";
          else if (cBase.itemType === "leader_line") cat = "Поводок";
          else if (cBase.itemType === "float")
            cat = "Поплавок";
          else if (cBase.itemType === "feeder_rig")
            cat = "Фідерна оснастка";
          else if (cBase.itemType === "hook") cat = "Гачок";
          else if (cBase.itemType === "lure")
            cat = "Приманка";
          else if (cBase.itemType === "net") cat = "Підсака";
          else if (cBase.itemType === "boat") cat = "Кораблик";

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

  #saveAndNotify({ save = true, notify = true } = {}) {
    this.#equippedCache = null;
    if (save) {
      CacheManager.set("player_inventory", this.#inventory.getAll());
      CacheManager.set("player_equipment", this.#equipment.getRawState());
    }

    if (notify) {
      this.#events.emit("inventory-changed", { equipment: this.getEquipped() });
    }
  }

  #buildLineCapacityContext() {
    const equipment = this.#equipment.getRawState();
    const reelInstance = equipment.reelId
      ? this.#inventory.getInstance(equipment.reelId)
      : null;
    const reelBase = reelInstance?.itemId
      ? this.#db.getItemData(reelInstance.itemId)
      : null;
    const reelCapacity = Number(
      reelInstance?.statOverrides?.lineCapacityMeters ??
        reelBase?.gameplayStats?.lineCapacityMeters,
    );
    return {
      equippedLineInstanceId: equipment.lineId || null,
      reelCapacityMeters: Number.isFinite(reelCapacity)
        ? Math.max(0, reelCapacity)
        : null,
      activeState: this.#lineCapacityStateProvider() || null,
    };
  }
}
