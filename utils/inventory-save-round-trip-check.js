const path = require("node:path");
const vm = require("node:vm");
const { StageThreeCompatibilityTestLoader } = require("./testing/runtime/stage_three_compatibility_test_loader");

// Save round trip through the production InventoryV2CompositionRoot and its InventoryV2StateStore over an
// in-memory cache: an old (legacy-key) save migrates to the current schema, the current save reloads and saves
// back byte-identically, previous-schema saves (3, 2) upgrade, and an unknown schema falls back to the legacy
// keys. Also the save-round-trip scenario of the Stage 4 tier A evidence (cluster 018 storage).
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
new StageThreeCompatibilityTestLoader({ projectRoot: root, context }).loadAll([
  "src/config/rarity/rarity_visual_config.js",
  "src/config/inventory/item_assembly_profile_config.js",
  "src/config/inventory/equipment_slot_config.js",
  "src/config/inventory/equipment_slot_presentation_config.js",
  "src/config/inventory/inventory_rule_messages.js",
  "src/config/inventory/inventory_v2_sort_config.js",
  "src/config/items/item_stat_override_config.js",
  "src/core/items/item_stat_override_policy.js",
  "src/core/items/effective_item_stats_resolver.js",
  "src/core/inventory/inventory_item_location.js",
  "src/core/inventory/inventory_item_reservation_policy.js",
  "src/core/inventory/flat_inventory_item_repository.js",
  "src/core/inventory/item_assembly_stacking_policy.js",
  "src/core/inventory/unlimited_assembly_capacity_policy.js",
  "src/core/assemblies/assembly_state.js",
  "src/core/assemblies/assembly_state_repository.js",
  "src/core/assemblies/assembly_profile_registry.js",
  "src/core/assemblies/item_assembly_reader.js",
  "src/core/assemblies/assembly_attachment_target_resolver.js",
  "src/core/assemblies/assembly_completion_policy.js",
  "src/core/assemblies/exact_assembly_refill_signature_policy.js",
  "src/core/assemblies/item_assembly_service.js",
  "src/core/equipment/rod_capability_resolver.js",
  "src/core/equipment/equipment_slot_visibility_policy.js",
  "src/core/equipment/terminal_line_slot_resolver.js",
  "src/ui/inventory/terminal_line_slot_label_resolver.js",
  "src/core/equipment/equipment_state.js",
  "src/core/equipment/equipment_slot_availability_policy.js",
  "src/core/equipment/inventory_capacity_policy.js",
  "src/core/equipment/equipment_transition_planner.js",
  "src/core/equipment/exact_item_signature_policy.js",
  "src/core/equipment/auto_refill_policy.js",
  "src/core/equipment/fishing_readiness_policy.js",
  "src/core/equipment/equipment_compatibility_policy.js",
  "src/core/loadouts/equipment_loadout.js",
  "src/core/loadouts/equipment_loadout_repository.js",
  "src/core/loadouts/loadout_equipment_transition_planner.js",
  "src/core/line/line_allocation_policy.js",
  "src/infrastructure/storage/legacy_inventory_unit_allocator.js",
  "src/core/items/freshness/item_freshness_state_policy.js",
  "src/infrastructure/storage/inventory_item_snapshot_mapper.js",
  "src/infrastructure/storage/legacy_item_state_migration.js",
  "src/infrastructure/storage/inventory_v2_snapshot_migration.js",
  "src/infrastructure/storage/inventory_v2_state_store.js",
  "src/infrastructure/storage/inventory_v2_legacy_migration.js",
  "src/infrastructure/storage/inventory_v2_snapshot_factory.js",
  "src/infrastructure/storage/inventory_v2_transaction_coordinator.js",
  "src/application/inventory/inventory_v2_transaction_participants.js",
  "src/application/inventory/equipment_transition_executor.js",
  "src/application/inventory/inventory_v2_equipment_transition_port.js",
  "src/application/inventory/loadout_application_service.js",
  "src/application/inventory/inventory_v2_loadout_port.js",
  "src/application/inventory/equipment_read_model_factory.js",
  "src/application/inventory/equipment_auto_refill_target_provider.js",
  "src/application/inventory/auto_refill_coordinator.js",
  "src/application/inventory/inventory_v2_refill_ports.js",
  "src/application/inventory/refill_compatible_signature_policy.js",
  "src/application/inventory/freshest_refill_candidate_policy.js",
  "src/application/inventory/apply_bait_exposure_service.js",
  "src/application/inventory/inventory_v2_item_hydrator.js",
  "src/application/inventory/inventory_v2_item_view_factory.js",
  "src/application/inventory/inventory_v2_subfilter_resolver.js",
  "src/application/inventory/inventory_v2_item_order_resolver.js",
  "src/application/inventory/inventory_v2_context_item_filter.js",
  "src/application/inventory/inventory_v2_view_model_factory.js",
  "src/application/inventory/inventory_v2_line_allocation_service.js",
  "src/application/inventory/inventory_v2_equipment_line_readiness_policy.js",
  "src/ui/inventory/inventory_v2_view_model.js",
  "src/application/inventory/inventory_v2_command_service.js",
  "src/application/inventory/inventory_v2_gameplay_bridge.js",
  "src/application/inventory/inventory_v2_facade.js",
  "src/application/inventory/inventory_v2_composition_root.js",
]);

const result = vm.runInContext(`(() => {
  const check = (condition, message) => {
    if (!condition) throw new Error("Inventory save round-trip check failed: " + message);
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const itemStatOverridePolicy = new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG });
  const itemStatCollaborators = Object.freeze({ itemStatOverridePolicy,
    effectiveStatsResolver: new EffectiveItemStatsResolver({ overridePolicy: itemStatOverridePolicy }) });
  const definitions = {
    rod: { id: "rod", name: "Feeder rod", itemType: "rod", variant: "feeder", equipmentCapabilities: { supportsReel: true, supportsFloat: false, supportsFeederRig: true, supportsLures: false }, gameplayStats: { lengthMeters: 4 } },
    reel: { id: "reel", name: "Reel", itemType: "reel", variant: "spinning_reel", assemblyProfileId: "reel_standard", gameplayStats: {} },
    line: { id: "line", name: "Line", itemType: "fishing_line", rarityProfile: { mode: "authored", tier: 2, maxTier: 5, isUnique: false }, gameplayStats: { lengthMeters: 25, durability: 100 } },
    leader: { id: "leader", name: "Leader", itemType: "leader_line", gameplayStats: {} },
    spring: { id: "spring", name: "Spring", itemType: "feeder_rig", assemblyProfileId: "feeder_spring_basic", gameplayStats: { hooksCount: 2, hasChumSlot: true } },
    hook: { id: "hook", name: "Hook", itemType: "hook", assemblyProfileId: "hook_standard", gameplayStats: {} },
    bait: { id: "bait", name: "Bait", itemType: "bait", gameplayStats: {} },
    chum: { id: "chum", name: "Chum", itemType: "chum_mix", gameplayStats: {} },
    net: { id: "net", name: "Net", itemType: "net", gameplayStats: {} },
    boat: { id: "boat", name: "Boat", itemType: "boat", assemblyProfileId: "bait_boat", gameplayStats: { sections: 2 } },
  };
  // A legacy save: player_inventory + player_equipment written by the classic inventory (no v2 key).
  const legacyItems = [
    { instanceId: "build-a", itemId: "sys_build_box", buildName: "Фідер" },
    { instanceId: "rod-1", itemId: "rod", buildId: "build-a", durability: 87 },
    { instanceId: "reel-1", itemId: "reel", buildId: "build-a" },
    { instanceId: "line-1", itemId: "line", buildId: "build-a", lengthMeters: 20, rarity: "rare" },
    { instanceId: "leader-1", itemId: "leader", buildId: "build-a" },
    { instanceId: "spring-1", itemId: "spring", buildId: "build-a" },
    { instanceId: "hook-stack", itemId: "hook", buildId: "build-a", quantity: 2 },
    { instanceId: "bait-stack", itemId: "bait", quantity: 2, recipe: "worm" },
    { instanceId: "chum-stack", itemId: "chum", quantity: 3, recipe: "bread" },
    { instanceId: "net-1", itemId: "net", buildId: "build-a" },
    { instanceId: "boat-1", itemId: "boat", buildId: "build-a" },
    { instanceId: "spare-line", itemId: "line", lengthMeters: 25 },
  ];
  const legacyEquipment = {
    rodId: "rod-1", reelId: "reel-1", lineId: "line-1", leaderId: "leader-1", feederRigId: "spring-1",
    hooks: ["hook-stack", "hook-stack"], baits: ["bait-stack", "bait-stack"], feederChumId: "chum-stack",
    netId: "net-1", deliveryId: "boat-1", deliveryChums: ["chum-stack", "chum-stack"],
  };
  const memoryCache = (entries) => {
    const values = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]));
    return {
      writes: [],
      get(key, fallback = null) { return values.has(key) ? JSON.parse(values.get(key)) : fallback; },
      set(key, value) { values.set(key, JSON.stringify(value)); this.writes.push(key); },
      bytes(key) { return values.get(key) ?? null; },
    };
  };
  const compose = (cache) => {
    let sequence = 0;
    return InventoryV2CompositionRoot.compose({
      ...itemStatCollaborators,
      cache,
      assemblyProfileConfig: ITEM_ASSEMBLY_PROFILE_CONFIG,
      itemDefinitionResolver: (itemId) => definitions[itemId] || null,
      instanceIdFactory: (source = {}) => (typeof source === "string" ? source : source.instanceId || source.itemId || "item") +
        "~save-" + (++sequence),
      now: () => 1767225600000,
      lineConfig: { defaultRequiredLengthMeters: 20, poleRequiredLengthMeters: 8 },
    });
  };

  // 1. Old save: the legacy keys migrate to the current schema; the legacy keys stay untouched.
  const oldCache = memoryCache({ player_inventory: legacyItems, player_equipment: legacyEquipment });
  const migrated = compose(oldCache);
  const current = oldCache.get("player_inventory_v2");
  check(current?.schemaVersion === INVENTORY_V2_SCHEMA_VERSION, "legacy save migrates to the current schema");
  check(same(oldCache.writes, ["player_inventory_v2"]), "only the v2 key is written: " + oldCache.writes.join(","));
  check(same(oldCache.get("player_inventory"), legacyItems) && same(oldCache.get("player_equipment"), legacyEquipment),
    "legacy keys are not mutated");
  check(current.loadouts.length === 1 && current.equipment.rod === "rod-1", "legacy build and equipment are kept");
  check(same(migrated.stateStore.load(), current), "the migrated save loads back unchanged");

  // 2. Current save: a new composition loads it without writing, and saving its state reproduces the bytes.
  const currentBytes = oldCache.bytes("player_inventory_v2");
  const reloadCache = memoryCache({ player_inventory_v2: current });
  const reloaded = compose(reloadCache);
  check(reloadCache.writes.length === 0, "loading the current save writes nothing");
  reloaded.stateStore.save(reloaded.snapshotFactory.create());
  check(reloadCache.bytes("player_inventory_v2") === currentBytes, "current save round-trips byte-identically");
  check(reloaded.stateStore.loadPrevious([3, 2]) === null, "the current save is not a previous schema");

  // 3. Previous schemas: 3 and 2 upgrade to the current schema on load.
  const upgraded = {};
  for (const schemaVersion of [3, 2]) {
    const cache = memoryCache({ player_inventory_v2: { ...current, schemaVersion } });
    const composition = compose(cache);
    const saved = cache.get("player_inventory_v2");
    check(saved.schemaVersion === INVENTORY_V2_SCHEMA_VERSION, "schema " + schemaVersion + " upgrades");
    check(same(saved.items, current.items) && same(saved.equipment, current.equipment),
      "schema " + schemaVersion + " keeps items and equipment");
    check(composition.stateStore.load() !== null, "schema " + schemaVersion + " loads after the upgrade");
    upgraded[schemaVersion] = cache.bytes("player_inventory_v2") === currentBytes;
  }

  // 4. Unknown schema: the v2 key is ignored and the legacy keys migrate again.
  const unknownCache = memoryCache({ player_inventory_v2: { ...current, schemaVersion: 1 },
    player_inventory: legacyItems, player_equipment: legacyEquipment });
  compose(unknownCache);
  check(same(unknownCache.get("player_inventory_v2").items, current.items), "unknown schema falls back to legacy keys");

  return { items: current.items.length, assemblies: current.assemblies.length, loadouts: current.loadouts.length,
    upgradedIdentical: upgraded };
})()`, context, { filename: "utils/inventory-save-round-trip-check.js#scenario" });

console.log(`inventory-save-round-trip-check passed: ${result.items} items, ${result.assemblies} assemblies, ` +
  `${result.loadouts} loadout; schema 3/2 byte-identical after upgrade: ${result.upgradedIdentical[3]}/` +
  `${result.upgradedIdentical[2]}`);
