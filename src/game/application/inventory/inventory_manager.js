import { ConfiguredInventorySeeder } from "./configured_inventory_seeder.js";
import { EffectiveItemRarityResolver } from "../../domain/items/rarity/effective_item_rarity_resolver.js";
import { EquipmentStateMigrationPolicy } from "./persistence/equipment_state_migration_policy.js";
import { EquipmentValidator } from "./equipment_validator.js";
import { Inventory } from "./inventory.js";
import { InventoryEquipment } from "./inventory_equipment.js";
import { InventoryItemFactory } from "./inventory_item_factory.js";
import { InventoryItemIdMigrationPolicy } from "./persistence/inventory_item_id_migration_policy.js";
import { InventoryRuntimeDisplayStatsResolver } from "./inventory_runtime_display_stats_resolver.js";
import { ItemDatabase } from "./item_database.js";
import { LineInventoryController } from "./line_inventory_controller.js";

export class InventoryManager {
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
  #freshnessExposureProvider = () => 0;
  #isLocked = false;
  #equippedCache = null;
  #effectiveStatsResolver;
  #itemStatOverridePolicy;
  #effectiveRarityResolver;
  #itemFreshnessResolver;
  #cache;
  #slotConfig;
  #composeInventoryV2;
  #actions;
  #makeRandomId;
  #now;

  constructor(
    itemDB,
    playerConfig,
    events,
    castDistanceCalculator,
    lineRules = null,
    runtimeConfigProvider = null,
    itemRarityResolver = null,
    stackingPolicy = null,
    itemProgressionResolver = null,
    itemViewFactory = null,
    itemConditionResolver = null,
    itemFreshnessResolver = null,
    baitEffectivenessCatalogResolver = null,
    effectiveStatsResolver,
    itemStatOverridePolicy,
    cache,
    { slotConfig, createItemViewFactory = null, composeInventoryV2 = null,
      actions = null, makeRandomId = null, now = Date.now } = {},
  ) {
    this.#cache = cache;
    this.#slotConfig = slotConfig;
    this.#composeInventoryV2 = composeInventoryV2;
    this.#actions = actions;
    this.#makeRandomId = makeRandomId;
    this.#now = now;
    const cachedInventory = InventoryItemIdMigrationPolicy.migrateItems(
      this.#cache.get("player_inventory") || playerConfig.inventory || [],
    );
    const cachedEquipment = EquipmentStateMigrationPolicy.migrate({
      equipment:
        this.#cache.get("player_equipment") || playerConfig.equipment || {},
      inventoryItems: cachedInventory,
      itemDB,
    });

    this.#db = new ItemDatabase(itemDB);
    this.#effectiveStatsResolver = effectiveStatsResolver;
    this.#itemStatOverridePolicy = itemStatOverridePolicy;
    const sharedItemRarityResolver = itemRarityResolver;
    this.#effectiveRarityResolver = new EffectiveItemRarityResolver({
      itemRarityResolver: sharedItemRarityResolver,
    });
    this.#itemFreshnessResolver = itemFreshnessResolver;
    this.#itemFactory = new InventoryItemFactory({
      itemDatabase: this.#db,
      itemRarityResolver: sharedItemRarityResolver,
    });
    this.#stackingPolicy = stackingPolicy;
    this.#inventory = new Inventory(cachedInventory, this.#itemFactory);
    this.#equipment = new InventoryEquipment(this.#slotConfig, cachedEquipment);
    this.#events = events;
    this.#castDistanceCalculator = castDistanceCalculator;
    this.#lineRules = lineRules;
    this.#runtimeConfigProvider = runtimeConfigProvider;
    this.#runtimeDisplayStatsResolver =
      new InventoryRuntimeDisplayStatsResolver();
    this.#itemViewFactory = itemViewFactory || (
      itemProgressionResolver &&
      createItemViewFactory
        ? createItemViewFactory({
            itemDatabase: this.#db,
            progressionResolver: itemProgressionResolver,
            conditionResolver: itemConditionResolver,
            freshnessResolver: this.#itemFreshnessResolver,
            baitEffectivenessCatalogResolver,
            effectiveRarityResolver: this.#effectiveRarityResolver,
            displayStatsResolver: this.#runtimeDisplayStatsResolver,
            effectiveStatsResolver: this.#effectiveStatsResolver,
            runtimeContextProvider: (item) => ({
              reelConfig: this.#runtimeConfigProvider.getReelConfig(),
              lineCapacity: this.#buildLineCapacityContext(),
              freshnessExposureMs: this.#freshnessExposureProvider(item),
            }),
          })
        : null
    );
    this.#lineController = new LineInventoryController({
      inventory: this.#inventory,
      db: this.#db,
      makeId: (prefix) => this.#makeId(prefix),
      lineConfig: this.#lineRules.config,
      messages: this.#lineRules.messages,
      isEquipped: (instanceId) => this.#isInstanceEquipped(instanceId),
      effectiveStatsResolver: this.#effectiveStatsResolver,
    });

    this.#setupInventorySeeders(itemDB, playerConfig);
    this.#initializeInventoryV2(cachedEquipment, playerConfig);
  }

  #initializeInventoryV2(legacyEquipment, playerConfig) {
    if (!this.#composeInventoryV2) return;
    this.#inventoryV2 = this.#composeInventoryV2({
      cache: this.#cache,
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
      now: () => this.#now(),
      loadValueProvider: () => this.getMaxTackleLoadKg(),
      lineConfig: this.#lineRules.config,
      itemFreshnessResolver: this.#itemFreshnessResolver,
      itemStatOverridePolicy: this.#itemStatOverridePolicy,
      effectiveStatsResolver: this.#effectiveStatsResolver,
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
    const randomId = this.#makeRandomId?.(prefix);
    if (randomId != null) return randomId;

    InventoryManager.#fallbackId++;
    return `${prefix}_${this.#now()}_${InventoryManager.#fallbackId}`;
  }

  disassembleBuild(buildId) {
    if (this.#inventoryV2Facade) {
      return this.dispatchInventoryV2Action({
        type: this.#actions.INVENTORY_ITEM_LONG_PRESS,
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
        type: this.#actions.INVENTORY_ITEM_ACTIVATE,
        instanceId: buildId,
      });
    }
    this.#unequipSlotsWithLifecycle(Object.keys(this.#slotConfig), {
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
    if (this.#slotConfig.rod.acceptTypes.includes(itemData.itemType)) return 0;
    if (this.#slotConfig.reel.acceptTypes.includes(itemData.itemType)) return 10;
    if (this.#slotConfig.line.acceptTypes.includes(itemData.itemType)) return 20;
    if (this.#slotConfig.leader.acceptTypes.includes(itemData.itemType)) return 30;
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
      this.#actions.OPEN,
      this.#actions.CLOSE,
      this.#actions.CATEGORY_SELECT,
      this.#actions.ASSEMBLY_BACK,
      this.#actions.AUTO_BAIT_CHANGE,
      this.#actions.AUTO_CHUM_CHANGE,
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

  setFreshnessExposureProvider(provider) {
    if (typeof provider !== "function") {
      throw new TypeError("Freshness exposure provider must be a function");
    }
    this.#freshnessExposureProvider = provider;
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
      rod.equipmentCapabilities?.supportsReel ??
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

  #findTargetSlotPath(itemData) {
    let baseSlot = null;
    for (const [slot, config] of Object.entries(this.#slotConfig)) {
      if (config.acceptTypes && config.acceptTypes.includes(itemData.itemType)) {
        baseSlot = slot;
        break;
      }
    }

    if (!baseSlot) return null;

    const eq = this.getEquipped();

    if (baseSlot === "hooks") {
      // Перевірка базової кількості гачків вудки
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
        eq.feederRig?.capabilities ||
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
        type: this.#actions.INVENTORY_ITEM_ACTIVATE,
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
        type: this.#actions.EQUIPMENT_SLOT_LONG_PRESS,
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

    for (const [slotName, settings] of Object.entries(this.#slotConfig)) {
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
    const slotConfig = this.#slotConfig !== undefined ? this.#slotConfig[baseSlot] : null;
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
        rarity: this.#effectiveRarityResolver.resolve({
          definition: baseItem,
          instanceState,
        }),
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
      this.#cache.set("player_inventory", this.#inventory.getAll());
      this.#cache.set("player_equipment", this.#equipment.getRawState());
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
