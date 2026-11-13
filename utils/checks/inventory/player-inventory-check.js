"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const NOW = 1700000000000;

class MemoryCache {
  values = new Map();
  writes = [];
  get(key, fallback = null) { return this.values.has(key) ? structuredClone(this.values.get(key)) : fallback; }
  set(key, value) { this.writes.push(key); this.values.set(key, structuredClone(value)); }
  remove(key) { this.values.delete(key); }
}

// Composes PlayerInventory with the production modules, the way GameCompositionRoot does.
function compose({ cache = new MemoryCache(), playerConfig = null, makeRandomId = () => null,
  itemProgressionResolver = { resolve: () => ({ available: false }) } } = {}) {
  const runtime = new SourceRuntime();
  const load = (file) => runtime.importModule(file);
  const { createPlayerInventory } = load("src/bootstrap/production/player_inventory_composition.js");
  const { CONFIG } = load("src/game/config/runtime/game_config.js");
  const { ITEM_DB } = load("src/game/config/databases/item_catalog.js");
  const { CastDistanceCalculator } = load("src/game/domain/casting/cast_distance_calculator.js");
  const { FightPhysicsConfigAdapter } = load("src/game/config/physics/fight_physics_config_adapter.js");
  const { LineCompatibilityRules } = load("src/game/application/inventory/line_compatibility_rules.js");
  const { INVENTORY_RULE_MESSAGES } = load("src/game/presentation/inventory/inventory_rule_messages.js");
  const { InventoryEventBridge } = load("src/game/application/inventory/inventory_event_bridge.js");
  const { InventoryRuntimeConfigProvider } = load("src/game/application/inventory/inventory_runtime_config_provider.js");
  const { ItemRarityResolver } = load("src/game/domain/items/rarity/item_rarity_resolver.js");
  const { ItemRarityStrategyRegistry } = load("src/game/domain/items/rarity/item_rarity_strategy_registry.js");
  const { AuthoredItemRarityStrategy } = load("src/game/domain/items/rarity/authored_item_rarity_strategy.js");
  const { ItemStatOverridePolicy } = load("src/game/domain/items/item_stat_override_policy.js");
  const { EffectiveItemStatsResolver } = load("src/game/domain/items/effective_item_stats_resolver.js");
  const { ITEM_STAT_OVERRIDE_CONFIG } = load("src/game/config/raw/items/item_stat_overrides.js");
  const { getInventoryAssemblyProfileConfig } = load("src/game/config/inventory/inventory_composition_config.js");
  const { InventoryActionType } = load("src/game/presentation/inventory/inventory_action_type.js");
  const { TackleLoadLimitPolicy } = load("src/game/domain/equipment/tackle_load_limit_policy.js");
  const physicsConfig = new FightPhysicsConfigAdapter(CONFIG);
  const itemStatOverridePolicy = new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG });
  const forwarded = [];
  const inventory = createPlayerInventory({
    itemDB: ITEM_DB,
    playerConfig: playerConfig || CONFIG.player,
    events: new InventoryEventBridge({ emit: (type, detail) => forwarded.push({ type, detail }) }),
    castDistanceCalculator: new CastDistanceCalculator(CONFIG),
    lineRules: new LineCompatibilityRules(physicsConfig.getLineConfig(), { messages: INVENTORY_RULE_MESSAGES }),
    runtimeConfigProvider: new InventoryRuntimeConfigProvider(CONFIG, physicsConfig),
    itemRarityResolver: new ItemRarityResolver({
      strategyRegistry: new ItemRarityStrategyRegistry([new AuthoredItemRarityStrategy()]) }),
    itemProgressionResolver,
    itemConditionResolver: null,
    itemFreshnessResolver: null,
    baitEffectivenessCatalogResolver: null,
    effectiveStatsResolver: new EffectiveItemStatsResolver({ overridePolicy: itemStatOverridePolicy }),
    itemStatOverridePolicy,
    cache,
    assemblyProfileConfig: getInventoryAssemblyProfileConfig(),
    makeRandomId,
    now: () => NOW,
  });
  return { inventory, cache, forwarded, actions: InventoryActionType, TackleLoadLimitPolicy, runtime, CONFIG };
}

const items = (inventory) => inventory.inventoryFacade.getViewModel().inventory.items;

function checkFreshStart() {
  const { inventory, cache, CONFIG } = compose();
  assert.equal(cache.writes.includes("player_inventory") || cache.writes.includes("player_equipment"), false,
    "the legacy save keys are only read, never written");
  assert(cache.writes.length > 0, "Inventory saves its migrated snapshot");
  const equipped = inventory.getEquipped();
  assert.equal(equipped.rod?.itemId, "rod_test_float", "bamboo rod is equipped on a fresh start");
  assert.equal(equipped.line?.itemId, "line_test_1", "line is equipped on a fresh start");
  assert.equal(equipped.float?.itemId, "float_day", "float is equipped on a fresh start");
  assert.equal(equipped.hooks?.[0]?.itemId, "hook_basic", "hook is equipped on a fresh start");
  assert.equal(equipped.baits?.[0]?.itemId, "oil_worm", "oil worm is attached on a fresh start");
  assert.equal(equipped.net?.itemId, "net_basic", "net is equipped on a fresh start");
  assert.equal(inventory.getMaxTackleLoadKg(), 1, "line has 1kg load limit");
  const loose = items(inventory);
  assert.equal(loose.find((i) => i.itemId === "oil_worm")?.quantity, 50, "oil_worm pack has 50 items");
  assert.equal(loose.find((i) => i.itemId === "bread")?.quantity, 25, "bread pack has 25 items");
  assert.equal(loose.find((i) => i.itemId === "carp_mix_basic")?.quantity, 15, "chum mix pack has 15 items");
  assert.equal(loose.find((i) => i.itemId === "oil_worm_100")?.quantity, 100, "oil_worm_100 pack has 100 items");
}

function checkStartingInventory() {
  const key = "player_inventory_v2";
  const { CONFIG } = compose();
  const flatConfig = {
    ...CONFIG.player,
    equipment: {},
    assemblies: [],
    inventory: CONFIG.player.inventory.map((item) => ({ ...item, location: { kind: "INVENTORY" } })),
  };
  const direct = compose({ playerConfig: flatConfig });
  // A classic save key forces the legacy conversion of the same configured items.
  const classicCache = new MemoryCache();
  classicCache.values.set("player_equipment", {});
  const converted = compose({ cache: classicCache, playerConfig: flatConfig });
  assert.equal(JSON.stringify(direct.cache.values.get(key)), JSON.stringify(converted.cache.values.get(key)),
    "the current-format start saves the same bytes as the former legacy conversion of the configuration");
  assert.deepEqual(direct.cache.writes, [key], "a new player's start writes only the current save");
  const equippedDirect = compose();
  assert.equal(equippedDirect.inventory.getEquipped().rod?.itemId, "rod_test_float", "default starting equipment is equipped");
  const settings = compose({ playerConfig: { ...CONFIG.player, inventorySettings: { autoBait: true, autoChum: "yes" } } });
  assert.deepEqual(settings.cache.values.get(key).settings, { autoBait: true, autoChum: false, refillMemory: {} });
}

function checkLegacySaveMigration() {
  const cache = new MemoryCache();
  cache.values.set("player_inventory", [
    { instanceId: "legacy-rod", itemId: "rod_test_feeder" },
    { instanceId: "legacy-feeder-rig", itemId: "feeder_spring_basic" },
    { instanceId: "legacy-sinker", itemId: "sinker_light" },
  ]);
  cache.values.set("player_equipment", { rodId: "legacy-rod", sinkerId: "legacy-feeder-rig" });
  const { inventory } = compose({ cache, playerConfig: { inventory: [], equipment: {}, inventorySettings: {} } });
  const equipped = inventory.getEquipped();
  assert.equal(equipped.rod?.instanceId, "legacy-rod", "legacy rod stays equipped");
  assert.equal(equipped.feederRig?.instanceId, "legacy-feeder-rig", "legacy sinkerId becomes the feeder rig");
  assert(!Object.hasOwn(equipped, "sinker"), "equipment exposes no sinker slot");
  assert(!items(inventory).some((item) => item.itemId === "sinker_light"), "the deprecated sinker is removed");
}

function checkPlayerInventoryPort() {
  const { CONFIG } = compose();
  const flatConfig = {
    ...CONFIG.player,
    equipment: {},
    assemblies: [],
    inventory: CONFIG.player.inventory.map((item) => ({ ...item, location: { kind: "INVENTORY" } })),
  };
  const { inventory, forwarded, actions, TackleLoadLimitPolicy } = compose({ playerConfig: flatConfig });
  const changes = [];
  inventory.onInventoryChanged((detail) => changes.push(detail));
  const rod = items(inventory).find((item) => item.itemId === "rod_test_float");

  inventory.setLock(true);
  assert.equal(inventory.isLocked, true);
  const blocked = inventory.dispatchInventoryAction({ type: actions.INVENTORY_ITEM_ACTIVATE, instanceId: rod.instanceId });
  assert.deepEqual({ ...blocked }, { success: false, warning: "Витягніть снасть з води, щоб змінити спорядження.", refresh: false },
    "equipment changes are blocked while tackle is in the water");
  assert.equal(inventory.dispatchInventoryAction({ type: actions.OPEN }).success, true, "opening stays allowed while locked");
  assert.equal(inventory.dispatchInventoryAction({ type: actions.CONSUMABLE_SLOT_ACTIVATE, kind: "bait", slotIndex: 0 }).success,
    false, "the consumable picker stays blocked while tackle is in the water");
  assert.equal(inventory.getEquipped().rod, null);

  inventory.setLock(false);
  const before = changes.length;
  assert.equal(inventory.dispatchInventoryAction({ type: actions.INVENTORY_ITEM_ACTIVATE, instanceId: rod.instanceId }).success, true);
  assert(changes.length > before, "an inventory change announces inventory-changed");
  assert.equal(changes.at(-1).source, "inventory");
  assert(forwarded.some((event) => event.type === "inventory-changed"), "changes reach the injected event target");
  const equipped = inventory.getEquipped();
  assert.equal(equipped.rod?.itemId, "rod_test_float", "the rod is equipped");
  assert.equal(inventory.getEquipped(), equipped, "the equipped read model is cached until the next change");
  assert.equal(equipped.rod.displayStats["Ліска"], "Не споряджена", "rod display stats report the missing line");
  assert.match(equipped.rod.displayStats["Мін. ліска"], /^\d+(\.\d)?м$/u, "rod display stats report the minimum line");
  assert.match(equipped.rod.displayStats["Масштаб"], /^\d+(\.\d+)?px = 1м$/u);
  assert.equal(inventory.getMaxTackleLoadKg(), new TackleLoadLimitPolicy().resolveMaxLoadKg(equipped));
  assert(inventory.getMaxTackleLoadKg() > 0, "an equipped rod with a load limit bounds the tackle");
  assert.equal(inventory.evaluateCastReadiness().canCast, false, "cast readiness comes from Inventory");

  assert.throws(() => inventory.setLineCapacityStateProvider(null), /Line capacity state provider must be a function/u);
  assert.throws(() => inventory.setFreshnessExposureProvider("x"), /Freshness exposure provider must be a function/u);
  inventory.refreshItemData();
  assert.notEqual(inventory.getEquipped(), equipped, "refreshing item data rebuilds the equipped read model");

  inventory.dispose();
  const afterDispose = changes.length;
  inventory.inventoryFacade.notify();
  assert.equal(changes.length, afterDispose, "dispose removes the inventory listener and the change handlers");
}

// The line-capacity context of item views follows the currently equipped reel and line (spec 002).
function checkLineCapacityContext() {
  const cache = new MemoryCache();
  cache.values.set("player_inventory", [
    { instanceId: "legacy-rod", itemId: "rod_test_spin" },
    { instanceId: "legacy-reel", itemId: "reel_test" },
    { instanceId: "legacy-line", itemId: "line_test_1" },
  ]);
  cache.values.set("player_equipment", { rodId: "legacy-rod", reelId: "legacy-reel", lineId: "legacy-line" });
  const lineContexts = new Map();
  const itemProgressionResolver = { resolve: (item, context = {}) => {
    if (item?.itemType === "fishing_line") lineContexts.set(item.instanceId, context.lineCapacity);
    return { available: false };
  } };
  const { inventory, actions } = compose({ cache, itemProgressionResolver, playerConfig: { inventory: [], equipment: {}, inventorySettings: {} } });
  let fight = null;
  inventory.setLineCapacityStateProvider(() => fight);
  const equipped = inventory.getEquipped();
  const lineId = equipped.line?.instanceId;
  assert(equipped.reel && lineId, "the migrated reel carries its line");
  inventory.refreshItemData();
  inventory.inventoryFacade.getViewModel();
  inventory.getEquipped();
  const context = lineContexts.get(lineId);
  assert.equal(context?.equippedLineInstanceId, lineId, "the equipped line is the line on the current reel");
  assert.equal(context.reelCapacityMeters, equipped.reel.effectiveStats.lineCapacityMeters, "the reel capacity is the equipped reel's effective capacity");
  assert(context.reelCapacityMeters > 0);
  assert.equal(context.activeState, null, "outside a fight there is no live line state");
  fight = { lineInstanceId: lineId, hasReel: true, remainingMeters: 12 };
  lineContexts.clear();
  inventory.refreshItemData();
  inventory.getEquipped();
  assert.deepEqual(lineContexts.get(lineId)?.activeState, fight, "during a fight the live line state reaches the view");
  fight = null;
  assert.equal(inventory.dispatchInventoryAction({ type: actions.EQUIPMENT_SLOT_LONG_PRESS, slotId: "reel" }).success, true, "the reel is unequipped");
  lineContexts.clear();
  inventory.refreshItemData();
  inventory.inventoryFacade.getViewModel();
  const after = [...lineContexts.values()].at(-1);
  assert(after, "the line on the unequipped reel still has a view");
  assert.equal(after.equippedLineInstanceId, null, "without an equipped reel no line counts as equipped");
  assert.equal(after.reelCapacityMeters, null);
}

function checkInstanceIds() {
  const { runtime } = compose();
  const { InventoryInstanceIdFactory } = runtime.importModule("src/game/application/inventory/inventory_instance_id_factory.js");
  const random = new InventoryInstanceIdFactory({ makeRandomId: (prefix) => `${prefix}_uuid`, now: () => NOW });
  assert.equal(random.create("loadout"), "loadout_uuid");
  const fallback = new InventoryInstanceIdFactory({ makeRandomId: () => null, now: () => NOW });
  const first = fallback.create("loadout");
  const second = fallback.create("loadout");
  assert.match(first, new RegExp(`^loadout_${NOW}_\\d+$`, "u"), "without crypto.randomUUID ids use time and a counter");
  assert.notEqual(first, second);
  assert.equal(second, `loadout_${NOW}_2`, "the counter belongs to the factory instance");
  const other = new InventoryInstanceIdFactory({ makeRandomId: () => null, now: () => NOW });
  assert.equal(other.create("loadout"), `loadout_${NOW}_1`, "another factory starts its own counter");
}

// Catalog items can be added to the inventory (the DEV item grant uses this port); the save and the change event
// follow, and the item survives a restart.
function checkCatalogItemGrant() {
  const key = "player_inventory_v2";
  const { inventory, cache, forwarded, actions } = compose();
  const before = items(inventory).length;
  const writesBefore = cache.writes.length;
  const eventsBefore = forwarded.filter((entry) => entry.type === "inventory-changed").length;
  const granted = inventory.grantCatalogItem("float_sliding");
  assert.equal(granted.success, true, "a catalog item is granted");
  assert.equal(items(inventory).length, before + 1, "the granted item appears in the inventory view");
  assert(items(inventory).some((item) => item.itemId === "float_sliding" && item.instanceId === granted.instanceId),
    "the view shows the granted catalog item");
  assert.equal(cache.writes.length, writesBefore + 1, "the grant saves the inventory once");
  assert(cache.values.get(key).items.some((item) => item.instanceId === granted.instanceId &&
    item.itemId === "float_sliding" && item.quantity === 1), "the saved snapshot holds the granted item");
  assert.equal(forwarded.filter((entry) => entry.type === "inventory-changed").length, eventsBefore + 1,
    "the grant announces one inventory change");

  const stack = inventory.grantCatalogItem("bread", 3);
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === stack.instanceId).quantity, 3,
    "a grant keeps the requested quantity");

  const jar25a = inventory.grantCatalogItem("oil_worm_25", 25);
  const jar25b = inventory.grantCatalogItem("oil_worm_25", 25);
  assert.equal(jar25a.success, true, "jar 25 granted");
  assert.equal(jar25b.success, true, "second jar 25 granted");
  assert.notEqual(jar25a.instanceId, jar25b.instanceId, "two jars of 25 have separate instance IDs");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === jar25a.instanceId).quantity, 25);
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === jar25b.instanceId).quantity, 25);

  const jar50 = inventory.grantCatalogItem("oil_worm_50", 50);
  assert.equal(jar50.success, true, "jar 50 granted");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === jar50.instanceId).quantity, 50);

  const jar75 = inventory.grantCatalogItem("oil_worm_75", 75);
  assert.equal(jar75.success, true, "jar 75 granted");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === jar75.instanceId).quantity, 75);

  const jar100 = inventory.grantCatalogItem("oil_worm_100", 100);
  assert.equal(jar100.success, true, "jar 100 granted");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === jar100.instanceId).quantity, 100);

  const bread10 = inventory.grantCatalogItem("bread_10", 10);
  assert.equal(bread10.success, true, "bread 10 granted");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === bread10.instanceId).quantity, 10);

  const bread25 = inventory.grantCatalogItem("bread_25", 25);
  assert.equal(bread25.success, true, "bread 25 granted");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === bread25.instanceId).quantity, 25);

  const bread50 = inventory.grantCatalogItem("bread_50", 50);
  assert.equal(bread50.success, true, "bread 50 granted");
  assert.equal(cache.values.get(key).items.find((item) => item.instanceId === bread50.instanceId).quantity, 50);

  const backpack = inventory.grantCatalogItem("backpack_basic");
  assert.equal(backpack.success, true, "the backpack is available to the DEV catalog grant port");
  const backpackView = items(inventory).find((item) => item.instanceId === backpack.instanceId);
  assert.equal(backpackView.itemType, "backpack");
  assert.equal(backpackView.iconAsset, "items.briefcases.briefcase--1--close");
  inventory.inventoryFacade.dispatch({ type: actions.CATEGORY_SELECT, categoryId: "tools" });
  assert(items(inventory).some((item) => item.instanceId === backpack.instanceId), "the backpack appears in Other");
  inventory.inventoryFacade.dispatch({ type: actions.CATEGORY_SELECT, categoryId: "all" });

  const writesAfterGrants = cache.writes.length;
  const unknown = inventory.grantCatalogItem("missing_item");
  assert.equal(unknown.success, false, "an unknown item id is rejected");
  assert.equal(cache.writes.length, writesAfterGrants, "a rejected grant does not save");
  assert.equal(inventory.grantCatalogItem("float_sliding", 0).success, false, "a non-positive quantity is rejected");

  const restarted = compose({ cache });
  assert(items(restarted.inventory).some((item) => item.instanceId === granted.instanceId),
    "the granted item survives a restart");
  assert.equal(items(restarted.inventory).find((item) => item.instanceId === backpack.instanceId).iconUrl,
    backpackView.iconUrl, "the backpack retains its full-resolution art after rehydration");
}

// Spec 151 D5: while a boat is on the water the inventory rolls back any action that would change it.
function checkBoatOnWaterGuard() {
  const { inventory, actions } = compose();
  const boat = items(inventory).find((item) => item.itemId === "boat_lvl3");
  assert(boat, "the starting inventory has the bait boat");
  assert.equal(inventory.dispatchInventoryAction({ type: actions.ASSEMBLY_EQUIP, rootInstanceId: boat.instanceId }).success,
    true);
  assert.equal(inventory.getEquipped().delivery?.instanceId, boat.instanceId);
  let away = [boat.instanceId];
  inventory.setBusyDevices({ rootInstanceIds: () => away });
  const blocked = inventory.dispatchInventoryAction({ type: actions.EQUIPMENT_SLOT_LONG_PRESS, slotId: "delivery" });
  assert.equal(blocked.success, false, "a boat on the water cannot be unequipped");
  assert.match(blocked.warning, /Кораблик на воді/u);
  assert.equal(inventory.getEquipped().delivery?.instanceId, boat.instanceId, "the action is rolled back as a whole");
  assert.equal(inventory.dispatchInventoryAction({ type: actions.ASSEMBLY_DISASSEMBLE, rootInstanceId: boat.instanceId })
    .success, false, "nor taken apart");
  assert.equal(inventory.dispatchInventoryAction({ type: actions.SECTION_SELECT, sectionId: "items" }).success, true,
    "actions that leave the boat unchanged still work");
  away = [];
  assert.equal(inventory.dispatchInventoryAction({ type: actions.EQUIPMENT_SLOT_LONG_PRESS, slotId: "delivery" }).success,
    true, "back on shore the boat can be unequipped");
}

// TK-288: the line already on the rod gets the equipping rules. The starting bamboo pole (5 m, no reel) takes exactly
// 2 x 5 = 10 m: the starting 25 m line is cut to 10 m on the rod and 15 m back in the backpack (it used to stay 25 m
// and cast 24.8 m); a save reloads without cutting again; taking the line off merges it back into 25 m.
function checkInstalledLineFit() {
  const cache = new MemoryCache();
  const first = compose({ cache });
  const lineLengths = (inventory) => items(inventory).filter((item) => item.itemId === "line_test_1")
    .map((item) => item.effectiveStats?.lengthMeters).join(",");
  assert.equal(first.inventory.getEquipped().line?.effectiveStats?.lengthMeters, 10, "the starting pole holds a 10 m line");
  assert.equal(lineLengths(first.inventory), "15", "the rest of the 25 m line is back in the backpack");
  const reloaded = compose({ cache });
  assert.equal(reloaded.inventory.getEquipped().line?.effectiveStats?.lengthMeters, 10, "a reload keeps the 10 m line");
  assert.equal(lineLengths(reloaded.inventory), "15", "and cuts nothing again");
  const removed = reloaded.inventory.dispatchInventoryAction({ type: reloaded.actions.EQUIPMENT_SLOT_LONG_PRESS, slotId: "terminalLine" });
  assert.equal(removed.success, true, "the line comes off the rod");
  assert.equal(lineLengths(reloaded.inventory), "25", "and merges back into the whole 25 m line");
}

checkFreshStart();
checkInstalledLineFit();
checkStartingInventory();
checkBoatOnWaterGuard();
checkCatalogItemGrant();
checkLegacySaveMigration();
checkPlayerInventoryPort();
checkLineCapacityContext();
checkInstanceIds();
console.log("Player inventory passed: fresh start creates the current-format inventory directly (same bytes as the former " +
  "legacy conversion, starting equipment rejected) without writing legacy keys; a legacy save migrates " +
  "(sinker -> feeder rig); lock policy, change events, cached equipment with rod display stats, tackle load " +
  "limit, readiness, provider validation, refresh, dispose, the id fallback, the live line-capacity context, the catalog item grant and the boat-on-water guard behave as composed in production.");
