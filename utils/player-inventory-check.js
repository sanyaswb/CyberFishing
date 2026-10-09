"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

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
  const ids = new Set(items(inventory).map((item) => item.itemId));
  for (const configured of CONFIG.player.inventory) assert(ids.has(configured.itemId), `configured ${configured.itemId} is seeded`);
  assert.equal(inventory.getEquipped().rod, null, "nothing is equipped on a fresh start");
  assert.equal(inventory.getMaxTackleLoadKg(), 0, "an empty tackle has no load limit");
}

function checkStartingInventory() {
  const key = "player_inventory_v2";
  const direct = compose();
  // A classic save key forces the legacy conversion of the same configured items.
  const classicCache = new MemoryCache();
  classicCache.values.set("player_equipment", {});
  const converted = compose({ cache: classicCache });
  assert.equal(JSON.stringify(direct.cache.values.get(key)), JSON.stringify(converted.cache.values.get(key)),
    "the current-format start saves the same bytes as the former legacy conversion of the configuration");
  assert.deepEqual(direct.cache.writes, [key], "a new player's start writes only the current save");
  const { CONFIG } = direct;
  assert.throws(() => compose({ playerConfig: { ...CONFIG.player, equipment: { ...CONFIG.player.equipment, rodId: "uuid-rod-spin" } } }),
    /Starting inventory supports items and settings only \(equipment: rodId; build templates: none\)/u,
    "starting equipment is rejected instead of silently dropped");
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
  const { inventory, forwarded, actions, TackleLoadLimitPolicy } = compose();
  const changes = [];
  inventory.onInventoryChanged((detail) => changes.push(detail));
  const rod = items(inventory).find((item) => item.itemId === "rod_test_float");

  inventory.setLock(true);
  assert.equal(inventory.isLocked, true);
  const blocked = inventory.dispatchInventoryAction({ type: actions.INVENTORY_ITEM_ACTIVATE, instanceId: rod.instanceId });
  assert.deepEqual({ ...blocked }, { success: false, warning: "Витягніть снасть з води, щоб змінити спорядження.", refresh: false },
    "equipment changes are blocked while tackle is in the water");
  assert.equal(inventory.dispatchInventoryAction({ type: actions.OPEN }).success, true, "opening stays allowed while locked");
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

checkFreshStart();
checkStartingInventory();
checkLegacySaveMigration();
checkPlayerInventoryPort();
checkLineCapacityContext();
checkInstanceIds();
console.log("Player inventory passed: fresh start creates the current-format inventory directly (same bytes as the former " +
  "legacy conversion, starting equipment rejected) without writing legacy keys; a legacy save migrates " +
  "(sinker -> feeder rig); lock policy, change events, cached equipment with rod display stats, tackle load " +
  "limit, readiness, provider validation, refresh, dispose, the id fallback and the live line-capacity context behave as composed in production.");
