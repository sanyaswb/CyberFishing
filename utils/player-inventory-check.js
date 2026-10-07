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
function compose({ cache = new MemoryCache(), playerConfig = null, makeRandomId = () => null } = {}) {
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
  const { ItemStatOverridePolicy } = load("src/game/domain/items/item_stat_override_policy.js");
  const { EffectiveItemStatsResolver } = load("src/game/domain/items/effective_item_stats_resolver.js");
  const { ITEM_STAT_OVERRIDE_CONFIG } = load("src/game/config/raw/items/item_stat_overrides.js");
  const { getInventoryAssemblyProfileConfig } = load("src/game/config/inventory/inventory_composition_config.js");
  const { InventoryV2ActionType } = load("src/game/presentation/inventory/inventory_view_model.js");
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
    itemRarityResolver: new ItemRarityResolver(),
    itemProgressionResolver: { resolve: () => ({ available: false }) },
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
  return { inventory, cache, forwarded, actions: InventoryV2ActionType, TackleLoadLimitPolicy, runtime, CONFIG };
}

const items = (inventory) => inventory.inventoryV2Facade.getViewModel().inventory.items;

function checkFreshStart() {
  const { inventory, cache, CONFIG } = compose();
  assert.equal(cache.writes.includes("player_inventory") || cache.writes.includes("player_equipment"), false,
    "the legacy save keys are only read, never written");
  assert(cache.writes.length > 0, "Inventory V2 saves its migrated snapshot");
  const ids = new Set(items(inventory).map((item) => item.itemId));
  for (const configured of CONFIG.player.inventory) assert(ids.has(configured.itemId), `configured ${configured.itemId} is seeded`);
  assert.equal(inventory.getEquipped().rod, null, "nothing is equipped on a fresh start");
  assert.equal(inventory.getMaxTackleLoadKg(), 0, "an empty tackle has no load limit");
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
  const blocked = inventory.dispatchInventoryV2Action({ type: actions.INVENTORY_ITEM_ACTIVATE, instanceId: rod.instanceId });
  assert.deepEqual({ ...blocked }, { success: false, warning: "Витягніть снасть з води, щоб змінити спорядження.", refresh: false },
    "equipment changes are blocked while tackle is in the water");
  assert.equal(inventory.dispatchInventoryV2Action({ type: actions.OPEN }).success, true, "opening stays allowed while locked");
  assert.equal(inventory.getEquipped().rod, null);

  inventory.setLock(false);
  const before = changes.length;
  assert.equal(inventory.dispatchInventoryV2Action({ type: actions.INVENTORY_ITEM_ACTIVATE, instanceId: rod.instanceId }).success, true);
  assert(changes.length > before, "a V2 change announces inventory-changed");
  assert.equal(changes.at(-1).source, "inventory-v2");
  assert(forwarded.some((event) => event.type === "inventory-changed"), "changes reach the injected event target");
  const equipped = inventory.getEquipped();
  assert.equal(equipped.rod?.itemId, "rod_test_float", "the rod is equipped");
  assert.equal(inventory.getEquipped(), equipped, "the equipped read model is cached until the next change");
  assert.equal(equipped.rod.displayStats["Ліска"], "Не споряджена", "rod display stats report the missing line");
  assert.match(equipped.rod.displayStats["Мін. ліска"], /^\d+(\.\d)?м$/u, "rod display stats report the minimum line");
  assert.match(equipped.rod.displayStats["Масштаб"], /^\d+(\.\d+)?px = 1м$/u);
  assert.equal(inventory.getMaxTackleLoadKg(), new TackleLoadLimitPolicy().resolveMaxLoadKg(equipped));
  assert(inventory.getMaxTackleLoadKg() > 0, "an equipped rod with a load limit bounds the tackle");
  assert.equal(inventory.evaluateCastReadiness().canCast, false, "cast readiness comes from Inventory V2");

  assert.throws(() => inventory.setLineCapacityStateProvider(null), /Line capacity state provider must be a function/u);
  assert.throws(() => inventory.setFreshnessExposureProvider("x"), /Freshness exposure provider must be a function/u);
  inventory.refreshItemData();
  assert.notEqual(inventory.getEquipped(), equipped, "refreshing item data rebuilds the equipped read model");

  inventory.dispose();
  const afterDispose = changes.length;
  inventory.inventoryV2Facade.notify();
  assert.equal(changes.length, afterDispose, "dispose removes the V2 listener and the change handlers");
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
}

checkFreshStart();
checkLegacySaveMigration();
checkPlayerInventoryPort();
checkInstanceIds();
console.log("Player inventory passed: fresh start seeds V2 without writing legacy keys; a legacy save migrates " +
  "(sinker -> feeder rig); lock policy, change events, cached equipment with rod display stats, tackle load " +
  "limit, readiness, provider validation, refresh, dispose and the id fallback behave as composed in production.");
