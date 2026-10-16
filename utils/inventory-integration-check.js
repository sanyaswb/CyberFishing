const path = require("node:path");
const vm = require("node:vm");
const {
  NativeEsmTestLoader,
} = require("./testing/runtime/native_esm_test_loader");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
const files = [
  "src/game/presentation/rarity/rarity_visual_config.js",
  "src/game/config/raw/inventory/item_assembly_profiles.js",
  "src/game/domain/equipment/equipment_slot_catalog.js",
  "src/game/presentation/inventory/equipment_slot_presentation.js",
  "src/game/presentation/inventory/inventory_rule_messages.js",
  "src/game/presentation/inventory/inventory_sort_config.js",
  "src/game/config/raw/items/item_stat_overrides.js",
  "src/game/domain/items/item_stat_override_policy.js",
  "src/game/domain/items/effective_item_stats_resolver.js",
  "src/game/domain/inventory/inventory_item_location.js",
  "src/game/domain/inventory/inventory_item_reservation_policy.js",
  "src/game/domain/inventory/flat_inventory_item_repository.js",
  "src/game/domain/inventory/item_assembly_stacking_policy.js",
  "src/game/domain/inventory/unlimited_assembly_capacity_policy.js",
  "src/game/domain/assemblies/assembly_state.js",
  "src/game/domain/assemblies/assembly_state_repository.js",
  "src/game/domain/assemblies/assembly_profile_registry.js",
  "src/game/domain/assemblies/item_assembly_path.js",
  "src/game/domain/assemblies/item_assembly_reader.js",
  "src/game/domain/assemblies/assembly_attachment_target_resolver.js",
  "src/game/domain/assemblies/assembly_completion_policy.js",
  "src/game/domain/assemblies/exact_assembly_refill_signature_policy.js",
  "src/game/domain/assemblies/item_assembly_domain_error.js",
  "src/game/domain/assemblies/item_assembly_service.js",
  "src/game/domain/equipment/rod_capability_resolver.js",
  "src/game/domain/equipment/equipment_slot_visibility_policy.js",
  "src/game/domain/equipment/terminal_line_slot_resolver.js",
  "src/game/presentation/inventory/terminal_line_slot_label_resolver.js",
  "src/game/domain/equipment/equipment_state.js",
  "src/game/presentation/inventory/equipment_slot_availability_policy.js",
  "src/game/domain/inventory/inventory_capacity_policy.js",
  "src/game/domain/inventory/unlimited_inventory_capacity_policy.js",
  "utils/testing/doubles/delegating_inventory_capacity_policy.js",
  "src/game/domain/equipment/equipment_transition_plan.js",
  "src/game/domain/equipment/manual_rod_change_planner.js",
  "src/game/domain/equipment/auto_refill_trigger.js",
  "src/game/domain/equipment/auto_refill_scope.js",
  "src/game/domain/equipment/auto_refill_settings.js",
  "src/game/domain/equipment/auto_refill_memory.js",
  "src/game/domain/equipment/auto_refill_policy.js",
  "src/game/domain/equipment/fishing_readiness_policy.js",
  "src/game/domain/equipment/equipment_compatibility_policy.js",
  "src/game/domain/loadouts/equipment_loadout.js",
  "src/game/domain/loadouts/equipment_loadout_repository.js",
  "src/game/domain/loadouts/loadout_equipment_transition_planner.js",
  "src/game/domain/line/line_allocation_policy.js",
  "src/game/application/inventory/legacy_inventory_unit_allocator.js",
  "src/game/domain/items/freshness/item_freshness_state_policy.js",
  "src/game/application/inventory/persistence/inventory_item_snapshot_mapper.js",
  "src/game/application/inventory/persistence/legacy_item_state_migration.js",
  "src/game/application/inventory/persistence/inventory_snapshot_migration.js",
  "src/game/application/inventory/persistence/inventory_state_store.js",
  "src/game/application/inventory/persistence/inventory_legacy_migration.js",
  "src/game/application/inventory/persistence/inventory_snapshot_factory.js",
  "src/game/application/inventory/inventory_transaction_coordinator.js",
  "src/game/application/inventory/inventory_settings_transaction_participant.js",
  "src/game/application/inventory/inventory_refill_memory_transaction_participant.js",
  "src/game/application/inventory/equipment_transition_port.js",
  "src/game/application/inventory/equipment_transition_executor.js",
  "src/game/application/inventory/inventory_equipment_transition_adapter.js",
  "src/game/application/inventory/loadout_application_port.js",
  "src/game/application/inventory/loadout_application_service.js",
  "src/game/application/inventory/inventory_loadout_adapter.js",
  "src/game/application/inventory/equipment_read_model_factory.js",
  "src/game/application/inventory/equipment_auto_refill_target_provider.js",
  "src/game/application/inventory/auto_refill_port.js",
  "src/game/application/inventory/exact_inventory_auto_refill_port.js",
  "src/game/application/inventory/auto_refill_coordinator.js",
  "src/game/application/inventory/inventory_refill_inventory_port.js",
  "src/game/application/inventory/inventory_refill_target_writer.js",
  "src/game/domain/assemblies/refill_compatible_signature_policy.js",
  "src/game/application/inventory/freshest_refill_candidate_policy.js",
  "src/game/application/inventory/apply_bait_exposure_service.js",
  "src/game/application/inventory/inventory_item_hydrator.js",
  "src/game/presentation/inventory/inventory_item_tree_view_factory.js",
  "src/game/presentation/inventory/inventory_subfilter_resolver.js",
  "src/game/presentation/inventory/inventory_item_order_resolver.js",
  "src/game/application/inventory/inventory_context_item_filter.js",
  "src/game/application/inventory/assembly_inventory_context_filter_strategy.js",
  "src/game/application/inventory/equipment_inventory_context_filter_strategy.js",
  "src/game/presentation/inventory/inventory_view_model_factory.js",
  "src/game/application/inventory/inventory_line_allocation_service.js",
  "src/game/application/inventory/inventory_equipment_line_readiness_policy.js",
  "src/game/presentation/inventory/inventory_action_type.js",
  "src/game/presentation/inventory/inventory_facade_contract.js",
  "src/game/presentation/inventory/inventory_action_contract.js",
  "src/game/presentation/inventory/inventory_view_model_normalizer.js",
  "src/game/application/inventory/inventory_application_error.js",
  "src/game/application/inventory/inventory_command_service.js",
  "src/game/application/inventory/equipment_consumable_target_resolver.js",
  "src/game/application/inventory/inventory_gameplay_bridge.js",
  "src/game/application/inventory/inventory_facade.js",
  "src/bootstrap/production/inventory_composition_root.js",
  "src/game/presentation/inventory/inventory_messages.js",
];

new NativeEsmTestLoader({ projectRoot: root, context }).loadAll(files);
// Player-facing inventory messages are injected the way the composition roots inject them.
const { bindConstructorDefaults } = require("./testing/runtime/constructor_defaults");
for (const name of ["InventoryLoadoutAdapter","LoadoutApplicationService"]) {
  context[name] = bindConstructorDefaults(context[name], { messages: context.INVENTORY_MESSAGES });
}

vm.runInContext(
  `
  // Item stat collaborators composed the way GameCompositionRoot composes them.
  const itemStatOverridePolicy = new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG });
  const itemStatCollaborators = Object.freeze({ itemStatOverridePolicy,
    effectiveStatsResolver: new EffectiveItemStatsResolver({ overridePolicy: itemStatOverridePolicy }) });

  const assertIntegration = (condition, message) => {
    if (!condition) {
      throw new Error("Inventory integration check failed: " + message);
    }
  };

  const definitions = Object.freeze({
    rodPole: {
      id: "rodPole",
      name: "Pole rod",
      itemType: "rod",
      variant: "pole",
      rarityProfile: { mode: "authored", tier: 2, maxTier: 5, isUnique: false },
      equipmentCapabilities: {
        supportsReel: false,
        supportsFloat: true,
        supportsFeederRig: false,
        supportsLures: false,
      },
      gameplayStats: {
        lengthMeters: 4,
      },
    },
    rodSkinned: {
      id: "rodSkinned",
      name: "Skinned pole rod",
      itemType: "rod",
      variant: "pole",
      rarityProfile: { mode: "authored", tier: 2, maxTier: 5, isUnique: false },
      skin: {
        thumbnail: { src: "skin-thumb.png", visibleHeight: 0.5, focusX: 0.31 },
        equipment: { withLine: "skin-line.png", withoutLine: "skin-bare.png" },
      },
      equipmentCapabilities: { supportsReel: false, supportsFloat: true, supportsFeederRig: false, supportsLures: false },
      gameplayStats: { lengthMeters: 4 },
    },
    rodFeeder: {
      id: "rodFeeder",
      name: "Feeder rod",
      itemType: "rod",
      variant: "feeder",
      equipmentCapabilities: {
        supportsReel: true,
        supportsFloat: false,
        supportsFeederRig: true,
        supportsLures: false,
      },
      gameplayStats: {
        lengthMeters: 4,
      },
    },
    rodFeederShort: {
      id: "rodFeederShort",
      name: "Short feeder rod",
      itemType: "rod",
      variant: "feeder",
      equipmentCapabilities: {
        supportsReel: true,
        supportsFloat: false,
        supportsFeederRig: true,
        supportsLures: false,
      },
      gameplayStats: {
        lengthMeters: 2,
      },
    },
    rodSpinning: {
      id: "rodSpinning",
      name: "Spinning rod",
      itemType: "rod",
      variant: "spinning",
      equipmentCapabilities: {
        supportsReel: true,
        supportsFloat: false,
        supportsFeederRig: false,
        supportsLures: true,
      },
      gameplayStats: {},
    },
    reel: {
      id: "reel",
      name: "Reel",
      itemType: "reel",
      variant: "spinning_reel",
      rarityProfile: { mode: "authored", tier: 4, maxTier: 5, isUnique: false },
      assemblyProfileId: "reel_standard",
      gameplayStats: {
        lineCapacityMeters: 20,
      },
    },
    reelSmall: {
      id: "reelSmall",
      name: "Small reel",
      itemType: "reel",
      assemblyProfileId: "reel_standard",
      gameplayStats: { lineCapacityMeters: 10 },
    },
    line: {
      id: "line",
      name: "Line",
      itemType: "fishing_line",
      gameplayStats: { lengthMeters: 100 },
    },
    leader: {
      id: "leader",
      name: "Leader",
      itemType: "leader_line",
      gameplayStats: {},
    },
    spring: {
      id: "spring",
      name: "Spring",
      itemType: "feeder_rig",
      assemblyProfileId: "feeder_spring_basic",
      gameplayStats: {
        hooksCount: 3,
        hasChumSlot: true,
      },
    },
    hook: {
      id: "hook",
      name: "Hook",
      itemType: "hook",
      rarityProfile: { mode: "authored", tier: 5, maxTier: 5, isUnique: false },
      assemblyProfileId: "hook_standard",
      gameplayStats: {},
    },
    spinner: {
      id: "spinner",
      name: "Spinner",
      itemType: "lure",
      variant: "spinner",
      gameplayStats: {},
    },
    wobbler: {
      id: "wobbler",
      name: "Wobbler",
      itemType: "lure",
      variant: "wobbler",
      rarityProfile: { mode: "authored", tier: 3, maxTier: 5, isUnique: false },
      gameplayStats: {},
    },
    bait: {
      id: "bait",
      name: "Bait",
      itemType: "bait",
      rarityProfile: { mode: "authored", tier: 1, maxTier: 5, isUnique: false },
      gameplayStats: {},
    },
    bread: { id: "bread", name: "Bread", itemType: "bait", gameplayStats: {} },
    pellet: { id: "pellet", name: "Pellet", itemType: "bait", gameplayStats: {} },
    chum: {
      id: "chum",
      name: "Chum",
      itemType: "chum_mix",
      gameplayStats: {},
    },
    boat: {
      id: "boat",
      name: "Bait boat",
      itemType: "boat",
      assemblyProfileId: "bait_boat",
      gameplayStats: {
        sections: 3,
      },
    },
    floatDay: {
      id: "floatDay",
      name: "Day float",
      itemType: "float",
      variant: "day",
      gameplayStats: {},
    },
    net: {
      id: "net",
      name: "Net",
      itemType: "net",
      gameplayStats: {},
    },
  });

  const inventoryLocation = () => ({ kind: "INVENTORY" });
  const raw = (instanceId, itemId, quantity = 1, extra = {}) => ({
    instanceId,
    itemId,
    itemType: definitions[itemId]?.itemType || null,
    variant: definitions[itemId]?.variant || null,
    quantity,
    location: inventoryLocation(),
    ...extra,
  });
  const emptyEquipment = () => ({
    rod: null,
    reel: null,
    terminalLine: null,
    tackle: null,
    float: null,
    handChum: null,
    net: null,
    delivery: null,
    gasMask: null,
  });
  const makeComposition = ({
    items,
    equipment = emptyEquipment(),
    assemblies = [],
    loadouts = [],
    settings = {},
    itemViewFactory = null,
    now = null,
    onPersist = null,
  }) => {
    let persisted = null;
    let sequence = 0;
    const cache = {
      get(_key, fallback) {
        return persisted === null
          ? fallback
          : JSON.parse(JSON.stringify(persisted));
      },
      set(_key, value) {
        onPersist?.(value);
        persisted = JSON.parse(JSON.stringify(value));
      },
    };
    return InventoryCompositionRoot.compose({
      ...itemStatCollaborators,
      cache,
      assemblyProfileConfig: ITEM_ASSEMBLY_PROFILE_CONFIG,
      initialSnapshot: {
        schemaVersion: 2,
        items,
        assemblies,
        equipment,
        loadouts,
        settings: {
          autoBait: settings.autoBait === true,
          autoChum: settings.autoChum === true,
          refillMemory: settings.refillMemory || {},
        },
      },
      itemDefinitionResolver: (itemId) => definitions[itemId] || null,
      itemViewFactory,
      now,
      instanceIdFactory: (source = {}) => {
        const prefix = typeof source === "string"
          ? source
          : source.prefix || source.itemId || "item";
        sequence += 1;
        return prefix + "~integration-" + sequence;
      },
      lineConfig: {
        defaultRequiredLengthMeters: 20,
        poleRequiredLengthMeters: 8,
      },
    });
  };

  const dispatch = (composition, type, fields = {}) => {
    const result = composition.facade.dispatch({ type, ...fields });
    assertIntegration(
      result.success === true,
      type + " should succeed, warning=" + (result.warning || "none"),
    );
    return result;
  };

  const lineMeters = (composition, instanceId) =>
    composition.lineAllocationService.getLengthMeters(instanceId);

  const rodUx = makeComposition({
    items: [raw("ux-rod", "rodPole"), raw("ux-next-rod", "rodFeeder"),
      raw("ux-line", "line", 1, { statOverrides: { lengthMeters: 8 } }),
      raw("ux-hook", "hook"), raw("ux-bait", "bait", 1, {
        location: InventoryItemLocation.attached("ux-hook", "bait"),
      }), raw("ux-float", "floatDay")],
    // Spec 089: a fully equipped pole rod (line, tackle, float) is the one that offers to be saved.
    equipment: { ...emptyEquipment(), rod: "ux-rod", terminalLine: "ux-line", tackle: "ux-hook", float: "ux-float" },
    assemblies: [{ rootInstanceId: "ux-hook", profileId: "hook_standard", status: "PREPARED", refillSignatures: {} }],
  });
  const beforeRodInspect = JSON.stringify(rodUx.snapshotFactory.create());
  dispatch(rodUx, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "ux-next-rod" });
  const inspectedRod = rodUx.facade.getViewModel();
  assertIntegration(JSON.stringify(rodUx.snapshotFactory.create()) === beforeRodInspect &&
    inspectedRod.panel.assembly.rootInstanceId === "ux-next-rod" &&
    inspectedRod.panel.assembly.sockets.length > 0 &&
    inspectedRod.panel.assembly.sockets.every((slot) => !slot.item) &&
    inspectedRod.panel.assembly.showEquip && !inspectedRod.panel.assembly.showDisassemble &&
    inspectedRod.inventory.activeCategoryId === "compatible",
    "clicking another rod opens its parameters and empty slots without replacing current equipment");
  dispatch(rodUx, InventoryActionType.ASSEMBLY_BACK, { rootInstanceId: "ux-next-rod" });
  const removalRequest = dispatch(rodUx, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, { slotId: "rod" });
  assertIntegration(removalRequest.requiresRodRemovalChoice && rodUx.commands.getUiState().rodRemovalStep === "choice" &&
    JSON.stringify(rodUx.snapshotFactory.create()) === beforeRodInspect,
    "removing a rod with components first requests a choice without mutating saved state");
  dispatch(rodUx, InventoryActionType.ROD_REMOVAL_CHOICE, { choice: "cancel" });
  assertIntegration(JSON.stringify(rodUx.snapshotFactory.create()) === beforeRodInspect,
    "cancelling rod removal preserves every component and line meter");
  dispatch(rodUx, InventoryActionType.ASSEMBLY_UNEQUIP, { rootInstanceId: "ux-rod" });
  dispatch(rodUx, InventoryActionType.ROD_REMOVAL_CHOICE, { choice: "save" });
  const savedRodUx = dispatch(rodUx, InventoryActionType.LOADOUT_SAVE, { name: "" });
  const savedRodRoots = rodUx.loadouts.require(savedRodUx.loadoutId).getRootInstanceIds();
  assertIntegration(rodUx.loadouts.require(savedRodUx.loadoutId).name.trim() &&
    savedRodRoots.rod === "ux-rod" && savedRodRoots.terminalLine === "ux-line" && savedRodRoots.tackle === "ux-hook" &&
    rodUx.equipmentState.getRootInstanceId("rod") === null && lineMeters(rodUx, "ux-line") === 8 &&
    rodUx.repository.require("ux-bait").location.kind === "ATTACHED",
    "saving without a name assigns one automatically and preserves exact roots, nested bait and line length");
  // Spec 067: the inventory section is navigation state; it survives closing and clears a highlighted slot.
  assertIntegration(rodUx.facade.getViewModel().sections.activeId === "equipment" &&
    rodUx.facade.getViewModel().sections.backpackItemCount > 0, "the inventory opens at equipment with a backpack count");
  dispatch(rodUx, InventoryActionType.SECTION_SELECT, { sectionId: "keepnet" });
  dispatch(rodUx, InventoryActionType.CLOSE);
  dispatch(rodUx, InventoryActionType.OPEN);
  assertIntegration(rodUx.facade.getViewModel().sections.activeId === "keepnet" &&
    rodUx.commands.getUiState().highlightedEquipmentSlotId === null, "the selected section persists for the session");
  dispatch(rodUx, InventoryActionType.SECTION_SELECT, { sectionId: "equipment" });
  dispatch(rodUx, InventoryActionType.CATEGORY_SELECT, { categoryId: "all" });
  const savedRodCard = rodUx.facade.getViewModel().inventory.items.find((item) => item.loadoutId === savedRodUx.loadoutId);
  assertIntegration(savedRodCard.icon !== "🧰" && savedRodCard.attachments.length === 3 &&
    savedRodCard.attachments.every((slot) => slot.instanceId !== "ux-bait"),
    "the saved card uses the rod visual and only its first-level equipment roots");
  const inventoryBeforeSavedPreview = rodUx.facade.getViewModel().inventory.items.map((item) => item.instanceId).join(",");
  dispatch(rodUx, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: savedRodUx.loadoutId });
  assertIntegration(rodUx.facade.getViewModel().panel.mode === "saved-loadout" &&
    rodUx.facade.getViewModel().inventory.mode === "inventory" &&
    rodUx.facade.getViewModel().inventory.items.map((item) => item.instanceId).join(",") === inventoryBeforeSavedPreview,
    "the saved loadout opens on the left without changing the inventory list");
  dispatch(rodUx, InventoryActionType.LOADOUT_EQUIP_ALL, { loadoutId: savedRodUx.loadoutId });
  const memberViews = rodUx.facade.getViewModel().panel.loadout.mainSlots.filter((slot) => slot.item).map((slot) => slot.item);
  assertIntegration(memberViews.length === 4 && memberViews.every((item) =>
    item.loadoutMembership?.id === savedRodUx.loadoutId &&
    item.loadoutMembership.color === memberViews[0].loadoutMembership.color),
    "equipped members of one loadout share a stable membership color");
  const savedRemoval = dispatch(rodUx, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, { slotId: "rod" });
  assertIntegration(!savedRemoval.requiresRodRemovalChoice && !rodUx.commands.getUiState().rodRemovalStep &&
    rodUx.loadouts.list().length === 1 && rodUx.repository.size === 6 &&
    savedRodRoots.rod === rodUx.loadouts.require(savedRodUx.loadoutId).getRootInstanceId("rod") &&
    EQUIPMENT_MAIN_SLOT_IDS.every((slot) => !rodUx.equipmentState.getRootInstanceId(slot)) &&
    rodUx.repository.require("ux-bait").location.kind === "ATTACHED" && lineMeters(rodUx, "ux-line") === 8,
    "removing a saved rod returns its complete loadout without a save/disassemble prompt");
  dispatch(rodUx, InventoryActionType.LOADOUT_EQUIP_ALL, { loadoutId: savedRodUx.loadoutId });
  dispatch(rodUx, InventoryActionType.ASSEMBLY_UNEQUIP, { rootInstanceId: "ux-rod" });
  dispatch(rodUx, InventoryActionType.INVENTORY_ITEM_LONG_PRESS, { instanceId: savedRodUx.loadoutId });
  assertIntegration(rodUx.loadouts.list().length === 0 &&
    rodUx.repository.list().every((item) => item.location.kind === "INVENTORY") &&
    EQUIPMENT_MAIN_SLOT_IDS.every((slot) => !rodUx.equipmentState.getRootInstanceId(slot)),
    "long pressing the removed saved loadout returns every root and nested item to the inventory");

  for (const choice of ["save", "disassemble"]) {
    let rejectPersistence = false;
    const removalRollback = makeComposition({ ...JSON.parse(beforeRodInspect), onPersist: () => {
      if (rejectPersistence) throw new Error("Simulated persistence failure");
    } });
    dispatch(removalRollback, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, { slotId: "rod" });
    if (choice === "save") dispatch(removalRollback, InventoryActionType.ROD_REMOVAL_CHOICE, { choice });
    rejectPersistence = true;
    const failedRemoval = removalRollback.facade.dispatch(choice === "save"
      ? { type: InventoryActionType.LOADOUT_SAVE, name: "Test rod" }
      : { type: InventoryActionType.ROD_REMOVAL_CHOICE, choice });
    assertIntegration(failedRemoval.success === false &&
      JSON.stringify(removalRollback.snapshotFactory.create()) === beforeRodInspect,
      "failed " + choice + " persists neither partial equipment changes nor broken custody");
    rejectPersistence = false;
    dispatch(removalRollback, choice === "save" ? InventoryActionType.LOADOUT_SAVE : InventoryActionType.ROD_REMOVAL_CHOICE,
      choice === "save" ? { name: "Test rod" } : { choice });
    assertIntegration(removalRollback.equipmentState.getRootInstanceId("rod") === null &&
      (choice === "save" ? removalRollback.loadouts.list()[0].name === "Test rod" :
        removalRollback.repository.list().every((item) => item.location.kind === "INVENTORY")),
      "retrying " + choice + " after rollback completes the removal");
  }

  const savedDisassembly = makeComposition({
    items: [raw("diss-rod", "rodPole", 1, { location: InventoryItemLocation.loadout("diss-kit", "rod") }),
      raw("diss-hook", "hook", 1, { location: InventoryItemLocation.loadout("diss-kit", "tackle") }),
      raw("diss-bait", "bait", 1, { location: InventoryItemLocation.attached("diss-hook", "bait") })],
    assemblies: [{ rootInstanceId: "diss-hook", profileId: "hook_standard", status: "PREPARED", refillSignatures: {} }],
    loadouts: [{ loadoutId: "diss-kit", name: "Diss", rootInstanceIds: { rod: "diss-rod", tackle: "diss-hook" } }],
  });
  dispatch(savedDisassembly, InventoryActionType.INVENTORY_ITEM_LONG_PRESS, { instanceId: "diss-kit" });
  assertIntegration(savedDisassembly.loadouts.list().length === 0 &&
    savedDisassembly.repository.list().every((item) => item.location.kind === "INVENTORY") &&
    !savedDisassembly.assemblyStates.has("diss-hook"),
    "long pressing a saved loadout releases nested contents as individual inventory items");

  // Full player flow: prepared hook -> nested spring -> saved loadout.
  const flow = makeComposition({
    items: [
      raw("pole-rod", "rodPole"),
      raw("feeder-rod", "rodFeeder"),
      raw("hook-stack", "hook", 2),
      raw("bait-stack", "bait", 3, { rarity: "rare", recipe: "worm" }),
      raw("spring-stack", "spring", 2),
      raw("chum-stack", "chum", 5, { rarity: "common", recipe: "bread" }),
      raw("boat-one", "boat"),
      raw("net-one", "net"),
      raw("float-one", "floatDay"),
    ],
  });

  const compatibleFiltering = makeComposition({
    items: [
      raw("compatible-pole", "rodPole"),
      raw("compatible-alternative-rod", "rodSpinning"),
      raw("compatible-reel", "reel"),
      raw("compatible-hook", "hook"),
      raw("compatible-spinner", "spinner"),
      raw("compatible-float", "floatDay"),
      raw("compatible-bait", "bait"),
      raw("compatible-net", "net"),
    ],
  });
  assertIntegration(
    compatibleFiltering.facade
      .getViewModel()
      .inventory.categories.slice(0, 2)
      .map((category) => category.id)
      .join(",") === "all,compatible",
    "Compatible is the second inventory group after All",
  );

  const cardInspection = makeComposition({
    items: [
      raw("inspect-pole", "rodPole"),
      raw("inspect-hook", "hook"),
      raw("inspect-float", "floatDay"),
      raw("inspect-reel", "reel"),
      raw("inspect-bait", "bait"),
    ],
  });
  dispatch(cardInspection, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "inspect-pole",
  });
  cardInspection.equipmentState.setRootInstanceId("tackle", "inspect-hook");
  cardInspection.equipmentState.setRootInstanceId("float", "inspect-float");
  dispatch(cardInspection, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, {
    slotId: "rod",
  });
  const equippedRodCard = cardInspection.facade.getViewModel();
  const rodParameterItemIds = equippedRodCard.panel.assembly.parameterItems
    .map((item) => item.instanceId)
    .sort()
    .join(",");
  assertIntegration(
    cardInspection.equipmentState.getRootInstanceId("rod") === "inspect-pole" &&
      equippedRodCard.panel.mode === "assembly" &&
      equippedRodCard.panel.assembly.rootInstanceId === "inspect-pole" &&
      equippedRodCard.panel.assembly.showEquip === false &&
      equippedRodCard.panel.assembly.showUnequip === true &&
      rodParameterItemIds === "inspect-float,inspect-hook",
    "short press on an equipped rod opens its card with equipped component sections without unequipping it",
  );
  dispatch(cardInspection, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "inspect-reel",
  });
  const incompatibleReelCard = cardInspection.facade.getViewModel();
  assertIntegration(
    incompatibleReelCard.panel.assembly.rootInstanceId === "inspect-reel" &&
      incompatibleReelCard.panel.assembly.showEquip === true &&
      incompatibleReelCard.panel.assembly.canEquip === false &&
      Boolean(incompatibleReelCard.panel.assembly.equipWarning),
    "an incompatible inventory item still opens its card with a disabled Equip action and a reason",
  );
  dispatch(cardInspection, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: "inspect-reel",
  });
  dispatch(cardInspection, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "inspect-bait",
  });
  const slotlessItemCard = cardInspection.facade.getViewModel();
  assertIntegration(
    slotlessItemCard.panel.assembly.rootInstanceId === "inspect-bait" &&
      slotlessItemCard.panel.assembly.sockets.length === 0 &&
      slotlessItemCard.panel.assembly.canEquip === false &&
      Boolean(slotlessItemCard.panel.assembly.equipWarning),
    "a slotless inventory item opens as a read-only card and keeps normal inventory browsing",
  );

  dispatch(compatibleFiltering, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "compatible-pole",
  });
  const poleCompatibleView = compatibleFiltering.facade.getViewModel();
  const poleCompatibleIds = poleCompatibleView.inventory.items
    .map((item) => item.instanceId)
    .sort()
    .join(",");
  assertIntegration(
    compatibleFiltering.commands.getUiState().activeCategoryId ===
      "compatible" &&
      poleCompatibleView.inventory.activeCategoryId === "compatible" &&
      poleCompatibleIds ===
        "compatible-float,compatible-hook,compatible-net",
    "equipping a pole rod automatically shows only items compatible with its active context",
  );
  dispatch(compatibleFiltering, InventoryActionType.CATEGORY_SELECT, {
    categoryId: "all",
  });
  const allAfterRodEquip = compatibleFiltering.facade.getViewModel();
  assertIntegration(
    allAfterRodEquip.inventory.activeCategoryId === "all" &&
      allAfterRodEquip.inventory.items.some(
        (item) => item.instanceId === "compatible-reel",
      ) &&
      allAfterRodEquip.inventory.items.some(
        (item) => item.instanceId === "compatible-spinner",
      ) &&
      allAfterRodEquip.inventory.items.some(
        (item) => item.instanceId === "compatible-bait",
      ),
    "switching to All restores incompatible and unattached inventory items",
  );
  dispatch(compatibleFiltering, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "compatible-net",
  });
  assertIntegration(
    compatibleFiltering.commands.getUiState().activeCategoryId ===
      "compatible",
    "equipping a separate auxiliary item reactivates Compatible",
  );
  const compatibleHookRoot = dispatch(
    compatibleFiltering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "compatible-hook" },
  ).rootInstanceId;
  dispatch(compatibleFiltering, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: compatibleHookRoot,
  });
  assertIntegration(
    compatibleFiltering.facade
      .getViewModel()
      .inventory.items.some((item) => item.instanceId === "compatible-bait"),
    "Compatible reuses assembly target rules for components of equipped stacks",
  );

  const highlightedSelection = makeComposition({
    items: [
      raw("highlight-rod", "rodPole"),
      raw("highlight-float", "floatDay"),
      raw("highlight-net", "net"),
    ],
  });
  dispatch(highlightedSelection, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "highlight-rod",
  });
  dispatch(highlightedSelection, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, {
    slotId: "float",
  });
  const highlightedView = highlightedSelection.facade.getViewModel();
  assertIntegration(
    highlightedView.panel.loadout.mainSlots.find(
      (slot) => slot.slotId === "float",
    )?.highlighted === true,
    "empty equipment slot keeps its green selection state",
  );
  assertIntegration(
    highlightedView.inventory.items.find(
      (item) => item.instanceId === "highlight-float",
    )?.compatibleWithHighlightedSlot === true &&
      highlightedView.inventory.items.find(
        (item) => item.instanceId === "highlight-net",
      )?.compatibleWithHighlightedSlot === false,
    "only compatible inventory cards are highlighted for the selected slot",
  );
  dispatch(highlightedSelection, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "highlight-float",
  });
  assertIntegration(
    highlightedSelection.equipmentState.getRootInstanceId("float") !== null &&
      highlightedSelection.commands.getUiState().highlightedEquipmentSlotId === null,
    "activating a highlighted compatible card equips it and clears selection",
  );

  // Spec 071: a skinned rod's cell shows the artwork with the line only once a fishing line is equipped.
  const skinned = makeComposition({
    items: [raw("skin-rod", "rodSkinned"), raw("skin-line", "line", 1, { statOverrides: { lengthMeters: 8 } })],
    equipment: { ...emptyEquipment(), rod: "skin-rod" },
  });
  const skinnedRodArt = () => skinned.facade.getViewModel().panel.loadout.mainSlots
    .find((slot) => slot.slotId === "rod").item.equipmentArtUrl;
  assertIntegration(skinnedRodArt() === "skin-bare.png", "a skinned rod without a line shows its lineless artwork");
  dispatch(skinned, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "terminalLine" });
  dispatch(skinned, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "skin-line" });
  assertIntegration(skinned.equipmentState.getRootInstanceId("terminalLine") !== null &&
    skinnedRodArt() === "skin-line.png", "an equipped fishing line switches the rod cell to the artwork with line");

  // Spec 070: one pick flow. An empty cell or craft socket opens the backpack at the compatible items and the activated
  // card returns to the equipment section, equipped or with its craft panel open.
  const feedbackFlow = makeComposition({ items: [raw("feedback-rod", "rodPole"), raw("feedback-hook", "hook")] });
  dispatch(feedbackFlow, InventoryActionType.SECTION_SELECT, { sectionId: "backpack" });
  dispatch(feedbackFlow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "feedback-rod" });
  assertIntegration(feedbackFlow.commands.getUiState().activeSectionId === "equipment" &&
    feedbackFlow.facade.getViewModel().equipmentFeedback?.slotId === "rod",
    "a rod equipped from the backpack returns to equipment with one feedback event");
  dispatch(feedbackFlow, InventoryActionType.SECTION_SELECT, { sectionId: "backpack" });
  dispatch(feedbackFlow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "feedback-hook" });
  assertIntegration(feedbackFlow.commands.getUiState().panelMode === "loadout" &&
    feedbackFlow.commands.getUiState().activeSectionId === "equipment" &&
    feedbackFlow.equipmentState.getRootInstanceId("tackle") &&
    feedbackFlow.facade.getViewModel().equipmentFeedback?.slotId === "tackle",
    "a hook equips directly without a craft panel containing no visible sockets");

  const pick = makeComposition({
    items: [raw("pick-rod", "rodFeeder"), raw("pick-reel", "reel"), raw("pick-line", "line")],
  });
  const pickUi = () => pick.commands.getUiState();
  const pickCard = (instanceId) => pick.facade.getViewModel().inventory.items.find((item) => item.instanceId === instanceId);
  dispatch(pick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "pick-rod" });
  dispatch(pick, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "rod" });
  const pickRodSockets = pick.facade.getViewModel().panel.assembly.sockets;
  assertIntegration(pickRodSockets.find((socket) => socket.slotId === "reel")?.state === "available" &&
    pickRodSockets.some((socket) => !socket.item && socket.state === "unavailable" && socket.warning),
    "the rod craft panel uses the loadout availability for its empty sockets");
  dispatch(pick, InventoryActionType.ASSEMBLY_BACK, { rootInstanceId: pickUi().editingRootInstanceId });
  dispatch(pick, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "reel" });
  assertIntegration(pickUi().activeSectionId === "backpack" && pickUi().highlightedEquipmentSlotId === "reel" &&
    pick.facade.getViewModel().inventory.activeCategoryId === "compatible" &&
    pickCard("pick-reel")?.compatibleWithHighlightedSlot === true &&
    pickCard("pick-line")?.compatibleWithHighlightedSlot !== true,
    "an empty cell opens the backpack at the compatible category with the fitting cards highlighted");
  dispatch(pick, InventoryActionType.CATEGORY_SELECT, { categoryId: "all" });
  assertIntegration(pickUi().highlightedEquipmentSlotId === "reel" && pickUi().activeSectionId === "backpack",
    "browsing categories keeps the pick");
  const pickReelRoot = dispatch(pick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "pick-reel" }).rootInstanceId;
  assertIntegration(pickUi().activeSectionId === "equipment" && pickUi().panelMode === "assembly" &&
    pickUi().editingRootInstanceId === pickReelRoot && pickUi().highlightedEquipmentSlotId === null,
    "a picked card with sockets returns to equipment with its craft panel open");
  const pickLineSocket = pick.facade.getViewModel().panel.assembly.sockets.find((socket) => socket.slotId === "line");
  assertIntegration(pickLineSocket && !pickLineSocket.item && pickLineSocket.state === "available",
    "the craft panel offers an empty line socket");
  dispatch(pick, InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE, { rootInstanceId: pickReelRoot,
    socketId: pickLineSocket.socketId, slotId: pickLineSocket.slotId, slotIndex: pickLineSocket.slotIndex,
    parentInstanceId: pickLineSocket.parentInstanceId });
  assertIntegration(pickUi().activeSectionId === "backpack" && pickUi().pickedSocketId === pickLineSocket.socketId &&
    pickCard("pick-line")?.compatibleWithHighlightedSlot === true,
    "an empty craft socket opens the backpack with the cards it accepts highlighted");
  dispatch(pick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "pick-line" });
  assertIntegration(pickUi().activeSectionId === "equipment" && pickUi().pickedSocketId === null &&
    pickUi().panelMode === "assembly" &&
    Boolean(pick.facade.getViewModel().panel.assembly.sockets.find((socket) => socket.slotId === "line")?.item),
    "a picked component fills that socket and returns to the craft panel");
  dispatch(pick, InventoryActionType.ASSEMBLY_BACK, { rootInstanceId: pickReelRoot });
  dispatch(pick, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "reel" });
  dispatch(pick, InventoryActionType.SECTION_SELECT, { sectionId: "equipment" });
  assertIntegration(pickUi().highlightedEquipmentSlotId === null && pickUi().activeSectionId === "equipment",
    "selecting a section tab ends the pick");
  dispatch(pick, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "reel" });
  dispatch(pick, InventoryActionType.CLOSE);
  dispatch(pick, InventoryActionType.OPEN);
  assertIntegration(pickUi().highlightedEquipmentSlotId === null && pickUi().activeSectionId === "equipment",
    "closing the inventory ends the pick and restores the equipment section");
  dispatch(pick, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "reel", listVisible: true });
  assertIntegration(pickUi().highlightedEquipmentSlotId === "reel" && pickUi().activeSectionId === "equipment" &&
    pick.facade.getViewModel().inventory.activeCategoryId === "compatible",
    "with the item list visible an empty cell highlights it without switching to the backpack");
  dispatch(pick, InventoryActionType.SECTION_SELECT, { sectionId: "equipment" });

  const consumablePick = makeComposition({
    items: [raw("consumable-rod", "rodFeeder"),
      raw("consumable-spring", "spring", 1, { statOverrides: { hooksCount: 2 } }),
      ...[0, 1].map((index) => raw("consumable-hook-" + index, "hook", 1, {
        location: InventoryItemLocation.attached("consumable-spring", "hook", index),
      })),
      raw("worms", "bait", 5), raw("bread", "bread", 4), raw("cast-chum", "chum", 3)],
    equipment: { ...emptyEquipment(), rod: "consumable-rod", tackle: "consumable-spring" },
    assemblies: [{ rootInstanceId: "consumable-spring", profileId: "feeder_spring_basic", status: "PREPARED" }],
  });
  const consumableUi = () => consumablePick.commands.getUiState();
  const consumableHeader = () => consumablePick.facade.getViewModel().header;
  const baitAt = (index) => consumablePick.assemblyReader.getChild("consumable-hook-" + index, "bait", 0);
  assertIntegration(consumableHeader().baitSlots.length === 2 &&
    consumableHeader().baitSlots.every((slot) => slot.available && !slot.item),
    "two equipped hooks keep two available empty bait icons");
  dispatch(consumablePick, InventoryActionType.SECTION_SELECT, { sectionId: "backpack" });
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "worms" });
  assertIntegration(baitAt(0)?.itemId === "bait" && !baitAt(1) && consumableUi().activeSectionId === "backpack",
    "the first bait click equips the first empty slot and keeps the list open");
  assertIntegration(consumableHeader().baitSlots.every((slot) => slot.showCount),
    "a partly filled tackle retains the count for its filled slot");
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "bread" });
  assertIntegration(baitAt(1)?.itemId === "bread" && consumablePick.repository.require("bread").quantity === 3,
    "the next click equips the second slot and consumes exactly one item");
  const beforeReplacement = JSON.stringify(consumablePick.snapshotFactory.create());
  const proposed = dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "worms" });
  assertIntegration(proposed.requiresSocketChoice &&
    JSON.stringify(consumablePick.snapshotFactory.create()) === beforeReplacement &&
    consumableHeader().baitSlots.map((slot) => Boolean(slot.highlighted)).join(",") === "false,true",
    "worm beside worm + bread proposes only bread without mutating inventory");
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "worms" });
  assertIntegration(baitAt(1)?.itemId === "bait" && consumablePick.repository.require("worms").quantity === 3 &&
    consumablePick.repository.list().filter((item) => item.itemId === "bread" && item.location.kind === "INVENTORY")
      .reduce((total, item) => total + item.quantity, 0) === 4 &&
    consumableHeader().baitSlots.every((slot) => !slot.highlighted),
    "a repeated click confirms one replacement, returns the old bait and clears highlighting");
  dispatch(consumablePick, InventoryActionType.CONSUMABLE_SLOT_ACTIVATE, { kind: "bait", slotIndex: 0 });
  assertIntegration(consumablePick.facade.getViewModel().inventory.items.every((item) =>
    item.itemType === "bait" && item.compatibleWithHighlightedSlot),
    "a header icon highlights the available bait candidates");
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "bread" });
  assertIntegration(baitAt(0)?.itemId === "bread" && baitAt(1)?.itemId === "bait",
    "the header chooses exactly which occupied slot to replace");
  // Spec 074: with a backpack item waiting for confirmation, a header slot applies it at the first press.
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "bread" });
  assertIntegration(consumableHeader().baitSlots.map((slot) => Boolean(slot.highlighted)).join(",") === "false,true",
    "bread beside bread + worm proposes the worm slot");
  const breadBeforeHeaderApply = consumablePick.repository.require("bread").quantity;
  dispatch(consumablePick, InventoryActionType.CONSUMABLE_SLOT_ACTIVATE, { kind: "bait", slotIndex: 1 });
  assertIntegration(baitAt(1)?.itemId === "bread" && consumablePick.repository.require("bread").quantity === breadBeforeHeaderApply - 1 &&
    consumableUi().selectedInstanceId === null && consumableUi().activeSectionId === "backpack",
    "pressing the proposed header circle applies the waiting item at once");
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "worms" });
  assertIntegration(consumableHeader().baitSlots.map((slot) => Boolean(slot.highlighted)).join(",") === "true,false",
    "worm beside two breads proposes the first slot");
  dispatch(consumablePick, InventoryActionType.CONSUMABLE_SLOT_ACTIVATE, { kind: "bait", slotIndex: 1 });
  assertIntegration(baitAt(0)?.itemId === "bread" && baitAt(1)?.itemId === "bait" && consumableUi().selectedInstanceId === null,
    "pressing another header circle applies the waiting item to that slot at once");
  dispatch(consumablePick, InventoryActionType.SECTION_SELECT, { sectionId: "equipment" });
  dispatch(consumablePick, InventoryActionType.CONSUMABLE_SLOT_ACTIVATE, { kind: "chum", slotIndex: 0, listVisible: true });
  assertIntegration(consumableUi().activeSectionId === "equipment" && consumableUi().consumableKind === "chum",
    "with the item list visible a header pick keeps the equipment section");
  dispatch(consumablePick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "cast-chum" });
  assertIntegration(consumableHeader().activeTackle.chums.length === 1 &&
    consumablePick.equipmentState.getRootInstanceId("handChum") === null && consumableUi().activeSectionId === "equipment",
    "the chum header equips the cast tackle without equipping hand chum or leaving the visible list");
  dispatch(consumablePick, InventoryActionType.SECTION_SELECT, { sectionId: "keepnet" });
  assertIntegration(consumableUi().consumableKind === null && consumableUi().pickedSocketId === null,
    "section navigation cancels the consumable pick");

  const extraHooks = makeComposition({
    items: [raw("extra-rod", "rodFeeder"), raw("extra-spring", "spring"), raw("extra-bait", "bait", 6),
      ...[0, 1, 2].map((index) => raw("extra-hook-" + index, "hook", 1, {
        location: InventoryItemLocation.attached("extra-spring", "hook", index),
      }))],
    equipment: { ...emptyEquipment(), rod: "extra-rod", tackle: "extra-spring" },
    assemblies: [{ rootInstanceId: "extra-spring", profileId: "feeder_spring_basic", status: "PREPARED" }],
  });
  for (const index of [0, 1, 2]) {
    dispatch(extraHooks, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "extra-bait" });
    assertIntegration(Boolean(extraHooks.assemblyReader.getChild("extra-hook-" + index, "bait", 0)),
      "sequential clicks reach every additional hook");
  }
  assertIntegration(extraHooks.facade.getViewModel().header.baitSlots.length === 3 &&
    extraHooks.facade.getViewModel().header.baitSlots.every((slot) => slot.stock === 3) &&
    extraHooks.facade.getViewModel().header.baitSlots.every((slot) => slot.showCount === false) &&
    extraHooks.facade.getViewModel().header.refillStock.bait === 3 &&
    extraHooks.repository.require("extra-bait").quantity === 3,
    "three hooks have three icons with per-bait reserves and a deduplicated shared total");
  dispatch(extraHooks, InventoryActionType.CONSUMABLE_SLOT_ACTIVATE, { kind: "bait", slotIndex: 1 });
  dispatch(extraHooks, InventoryActionType.CLOSE);
  assertIntegration(extraHooks.commands.getUiState().consumableKind === null &&
    extraHooks.commands.getUiState().activeSectionId === "equipment", "closing cancels the header pick");

  const switcherSketch = makeComposition({
    items: [raw("sketch-rod", "rodFeeder"), raw("sketch-spring", "spring"),
      raw("sketch-worm", "bait", 13), raw("sketch-bread", "bread", 81), raw("sketch-pellet", "pellet", 11),
      ...[0, 1, 2].map((index) => raw("sketch-hook-" + index, "hook", 1, {
        location: InventoryItemLocation.attached("sketch-spring", "hook", index),
      }))],
    equipment: { ...emptyEquipment(), rod: "sketch-rod", tackle: "sketch-spring" },
    assemblies: [{ rootInstanceId: "sketch-spring", profileId: "feeder_spring_basic", status: "PREPARED" }],
  });
  for (const name of ["worm", "bread", "pellet"]) {
    dispatch(switcherSketch, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "sketch-" + name });
  }
  const sketchHeader = switcherSketch.facade.getViewModel().header;
  assertIntegration(sketchHeader.baitSlots.map((slot) => slot.stock).join(",") === "12,80,10" &&
    sketchHeader.baitSlots.every((slot) => slot.showCount) &&
    sketchHeader.refillStock.bait === 102 && sketchHeader.refillStock.chum === 0,
    "the sketch's three individual reserve counts and total come from authoritative inventory stock");
  const sketchFirstBaitIds = [0, 1].map((index) => switcherSketch.assemblyReader.getChild("sketch-hook-" + index, "bait", 0).instanceId);
  dispatch(switcherSketch, InventoryActionType.CONSUMABLE_SLOT_ACTIVATE, { kind: "bait", slotIndex: 2 });
  dispatch(switcherSketch, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "sketch-worm" });
  assertIntegration(switcherSketch.assemblyReader.getChild("sketch-hook-2", "bait", 0).itemId === "bait" &&
    [0, 1].every((index) => switcherSketch.assemblyReader.getChild("sketch-hook-" + index, "bait", 0).instanceId === sketchFirstBaitIds[index]),
    "the third header icon replaces only the third bait");

  const directLureEquipment = makeComposition({
    items: [
      raw("lure-rod", "rodSpinning"),
      raw("lure-spinner", "spinner"),
      raw("lure-wobbler", "wobbler"),
    ],
  });
  dispatch(directLureEquipment, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "lure-rod",
  });
  dispatch(directLureEquipment, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "lure-spinner",
  });
  assertIntegration(
    directLureEquipment.equipmentState.getRootInstanceId("tackle") ===
      "lure-spinner" &&
      directLureEquipment.equipmentReadModelFactory.create(
        directLureEquipment.equipmentState,
      ).baits[0]?.instanceId === "lure-spinner",
    "a non-composite spinner equips without requesting assembly slots",
  );
  dispatch(directLureEquipment, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "lure-wobbler",
  });
  assertIntegration(
    directLureEquipment.equipmentState.getRootInstanceId("tackle") ===
      "lure-wobbler" &&
      directLureEquipment.equipmentReadModelFactory.create(
        directLureEquipment.equipmentState,
      ).baits[0]?.instanceId === "lure-wobbler",
    "a non-composite wobbler replaces another lure and remains projectable",
  );

  const presentationEnrichment = makeComposition({
    items: [raw("presentation-line", "line", 1, { statOverrides: { lengthMeters: 62 } })],
    itemViewFactory: {
      create(instance) {
        return {
          ...definitions[instance.itemId],
          ...instance,
          displayStats: { "Залишок ліски": "62 м" },
          progression: {
            available: true,
            capacity: { available: true, current: 62, maximum: 100, percent: 62 },
          },
        };
      },
    },
  });
  const presentationLine = presentationEnrichment.facade
    .getViewModel()
    .inventory.items.find((item) => item.instanceId === "presentation-line");
  assertIntegration(
    presentationLine?.displayStats?.["Залишок ліски"] === "62 м" &&
      presentationLine?.progression?.capacity?.percent === 62,
    "Inventory preserves legacy hover parameters and line-capacity progression",
  );

  const inventoryBoatCharge = makeComposition({
    items: [raw("charged-inventory-boat", "boat")],
  });
  inventoryBoatCharge.gameplayBridge.setBoatChargeProvider(() => ({
    current: 64,
    maximum: 100,
  }));
  const chargedBoatCard = inventoryBoatCharge.facade
    .getViewModel()
    .inventory.items.find(
      (item) => item.instanceId === "charged-inventory-boat",
    );
  assertIntegration(
    chargedBoatCard?.charge?.percent === 64,
    "boat charge is projected onto its inventory thumbnail",
  );

  const compartmentProjection = makeComposition({
    items: [
      raw("empty-spring-card", "spring"),
      raw("partial-spring-card", "spring"),
      raw("partial-hook-card", "hook", 1, {
        location: InventoryItemLocation.attached("partial-spring-card", "hook", 1),
      }),
      raw("empty-hook-card", "hook"),
      raw("no-compartments-card", "bait"),
      raw("empty-reel-card", "reel"),
    ],
  });
  const compartmentItems = compartmentProjection.facade.getViewModel().inventory.items;
  const compartmentCard = (id) => compartmentItems.find((item) => item.instanceId === id);
  assertIntegration(compartmentCard("empty-spring-card").attachments.length === 4 &&
    compartmentCard("empty-spring-card").attachments.every((slot) => slot.empty),
    "a bare feeder shows its configured three hooks and chum compartment");
  const partialSlots = compartmentCard("partial-spring-card").attachments;
  assertIntegration(partialSlots.length === 4 &&
    partialSlots.filter((slot) => slot.empty).length === 3 &&
    partialSlots.some((slot) => slot.kind === "hook" && slot.slotIndex === 1 && !slot.empty) &&
    !partialSlots.some((slot) => slot.kind === "bait"),
    "hooks retain their index without nesting bait in their cards");
  assertIntegration(compartmentCard("empty-hook-card").attachments.length === 0 &&
    compartmentCard("empty-reel-card").attachments[0]?.kind === "line" &&
    !compartmentCard("empty-reel-card").reelLineCapacity &&
    compartmentCard("no-compartments-card").attachments.length === 0,
    "equipment-bearing items expose empty sockets, while slotless items and empty reels have no resource scale");

  const reelFillProjection = makeComposition({
    items: [
      ...[5, 10, 20].flatMap((length) => [
        raw("fill-reel-" + length, "reel"),
        raw("fill-line-" + length, "line", 1, {
          statOverrides: { lengthMeters: length },
          location: InventoryItemLocation.attached("fill-reel-" + length, "line"),
        }),
      ]),
    ],
  });
  const fillItems = reelFillProjection.facade.getViewModel().inventory.items;
  for (const length of [5, 10, 20]) {
    const capacity = fillItems.find((item) => item.instanceId === "fill-reel-" + length)?.reelLineCapacity;
    assertIntegration(capacity?.percent === length / 20 * 100 && capacity.maximum === 20,
      "reel fill uses the reel's capacity instead of the catalog line spool length");
  }
  let liveLineRemaining = 6;
  const liveReelFill = makeComposition({
    items: [raw("live-fill-reel", "reelSmall"),
      raw("live-fill-line", "line", 1, {
        statOverrides: { lengthMeters: 10 },
        location: InventoryItemLocation.attached("live-fill-reel", "line"),
      })],
    itemViewFactory: { create(instance) {
      return instance.instanceId === "live-fill-line" ? {
        ...instance,
        progression: { capacity: { available: true, current: liveLineRemaining, maximum: 100, percent: liveLineRemaining } },
      } : null;
    } },
  });
  const liveCapacity = () => liveReelFill.facade.getViewModel().inventory.items
    .find((item) => item.instanceId === "live-fill-reel").reelLineCapacity;
  assertIntegration(liveCapacity().percent === 60 && liveCapacity().maximum === 10,
    "reel fill reads the live line remainder and the reel's effective capacity");
  liveLineRemaining = 0;
  assertIntegration(liveCapacity().percent === 0,
    "a depleted attached line keeps a zero-percent reel scale on refresh");

  const subtypeFiltering = makeComposition({
    items: [
      raw("filter-pole", "rodPole"),
      raw("filter-feeder", "rodFeeder"),
      raw("filter-line", "line"),
      raw("filter-leader", "leader"),
    ],
  });
  const availableSubtypeIds = new Set(
    subtypeFiltering.facade
      .getViewModel()
      .inventory.subfilters.map((filter) => filter.id),
  );
  assertIntegration(
    availableSubtypeIds.has("pole-rods") &&
      availableSubtypeIds.has("feeder-rods") &&
      availableSubtypeIds.has("fishing-lines") &&
      availableSubtypeIds.has("leaders"),
    "inventory exposes the legacy subtype groups",
  );
  dispatch(subtypeFiltering, InventoryActionType.SUBFILTER_TOGGLE, {
    filterId: "fishing-lines",
    enabled: true,
  });
  assertIntegration(
    subtypeFiltering.facade.getViewModel().inventory.items.length === 1 &&
      subtypeFiltering.facade.getViewModel().inventory.items[0].instanceId ===
        "filter-line",
    "one selected subtype filters the inventory",
  );
  dispatch(subtypeFiltering, InventoryActionType.SUBFILTER_TOGGLE, {
    filterId: "leaders",
    enabled: true,
  });
  assertIntegration(
    subtypeFiltering.facade.getViewModel().inventory.items.length === 2,
    "multiple subtype filters combine with OR semantics",
  );
  dispatch(subtypeFiltering, InventoryActionType.CATEGORY_SELECT, {
    categoryId: "rods",
  });
  const rodsAfterCategoryChange = subtypeFiltering.facade.getViewModel().inventory;
  assertIntegration(
    rodsAfterCategoryChange.activeSubfilterIds.length === 0 &&
      rodsAfterCategoryChange.items.length === 2,
    "changing category clears obsolete subtype filters",
  );

  // Context-aware inventory filtering for every assembly profile.
  const contextualFiltering = makeComposition({
    items: [
      raw("context-rod", "rodFeeder"),
      raw("context-reel", "reel"),
      raw("context-line", "line"),
      raw("context-leader", "leader"),
      raw("context-spring", "spring"),
      raw("context-hooks", "hook", 2),
      raw("context-bait", "bait"),
      raw("context-chum", "chum"),
      raw("context-boat", "boat"),
      raw("context-net", "net"),
    ],
  });
  dispatch(contextualFiltering, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "context-rod",
  });
  dispatch(contextualFiltering, InventoryActionType.CATEGORY_SELECT, {
    categoryId: "reels",
  });
  const contextReelRoot = dispatch(
    contextualFiltering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-reel" },
  ).rootInstanceId;
  const reelContextView = contextualFiltering.facade.getViewModel().inventory;
  assertIntegration(
    reelContextView.items.length === 1 &&
      reelContextView.items[0].instanceId === "context-line" &&
      reelContextView.categories.map((category) => category.id).join(",") ===
        "all,compatible,lines",
    "an open reel shows only line candidates and ignores an obsolete category",
  );
  dispatch(contextualFiltering, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextReelRoot,
  });
  dispatch(contextualFiltering, InventoryActionType.CATEGORY_SELECT, {
    categoryId: "all",
  });
  const normalInventoryIds = new Set(
    contextualFiltering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId),
  );
  assertIntegration(
    normalInventoryIds.has("context-line") &&
      normalInventoryIds.has("context-leader") &&
      normalInventoryIds.has("context-net") &&
      normalInventoryIds.has("context-bait"),
    "leaving the assembly editor restores the ordinary full inventory",
  );

  const contextSpringRoot = dispatch(
    contextualFiltering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-spring" },
  ).rootInstanceId;
  const initialSpringCandidates = new Set(
    contextualFiltering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId),
  );
  assertIntegration(
    initialSpringCandidates.has("context-hooks") &&
      initialSpringCandidates.has("context-chum") &&
      !initialSpringCandidates.has("context-bait") &&
      !initialSpringCandidates.has("context-line") &&
      !initialSpringCandidates.has("context-net"),
    "a spring shows only components accepted by currently available sockets",
  );
  dispatch(contextualFiltering, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "context-hooks",
  });
  dispatch(contextualFiltering, InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE, {
    rootInstanceId: contextSpringRoot,
    parentInstanceId: contextSpringRoot,
    slotId: "hook",
    slotIndex: 0,
  });
  const nestedSpringCandidates = new Set(
    contextualFiltering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId),
  );
  assertIntegration(
    !nestedSpringCandidates.has("context-bait") &&
      nestedSpringCandidates.has("context-hooks") &&
      nestedSpringCandidates.has("context-chum"),
    "a spring editor exposes hooks and chum while bait is chosen in the header",
  );
  dispatch(contextualFiltering, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextSpringRoot,
  });

  const contextHookRoot = dispatch(
    contextualFiltering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-hooks" },
  ).rootInstanceId;
  const hookCandidateIds = contextualFiltering.facade
    .getViewModel()
    .inventory.items.map((item) => item.instanceId);
  assertIntegration(
    hookCandidateIds.length === 0 && contextualFiltering.facade.getViewModel().panel.assembly.sockets.length === 0,
    "a standalone hook editor has no nested bait picker",
  );
  dispatch(contextualFiltering, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextHookRoot,
  });

  const contextBoatRoot = dispatch(
    contextualFiltering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-boat" },
  ).rootInstanceId;
  const boatCandidateIds = contextualFiltering.facade
    .getViewModel()
    .inventory.items.map((item) => item.instanceId);
  assertIntegration(
    boatCandidateIds.length === 1 && boatCandidateIds[0] === "context-chum",
    "a boat editor shows only cargo accepted by its sections",
  );
  dispatch(contextualFiltering, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextBoatRoot,
  });

  const orderingProgression = {
    "sort-bait": { ratingTier: { current: 2 }, rating: { rawValue: 2 } },
    "sort-wobbler": { ratingTier: { current: 5 }, rating: { rawValue: 4 } },
    "sort-reel": { ratingTier: { current: 4 }, rating: { rawValue: 3 } },
    "sort-hook": { ratingTier: { current: 1 }, rating: { rawValue: 8 } },
    "sort-rod": { ratingTier: { current: 3 }, rating: { rawValue: 1 } },
  };
  const inventoryOrdering = makeComposition({
    items: [
      raw("sort-bait", "bait", 1, {
        rarity: "common",
      }),
      raw("sort-wobbler", "wobbler", 1, {
        rarity: "rare",
      }),
      raw("sort-reel", "reel", 1, {
        rarity: "epic",
      }),
      raw("sort-hook", "hook", 1, {
        rarity: "legendary",
      }),
      raw("sort-rod", "rodPole", 1, {
        rarity: "uncommon",
      }),
    ],
    itemViewFactory: {
      create(instance) {
        const definition = definitions[instance.itemId] || {};
        return {
          ...definition,
          ...instance,
          effectiveStats: Object.freeze({ ...(definition.gameplayStats || {}) }),
          progression: orderingProgression[instance.instanceId] || null,
        };
      },
    },
  });
  const orderedIds = () =>
    inventoryOrdering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId)
      .join(",");
  assertIntegration(
    orderedIds() ===
      "sort-hook,sort-reel,sort-wobbler,sort-rod,sort-bait",
    "inventory defaults to rarity sorting from highest to lowest",
  );
  const defaultSort = inventoryOrdering.facade.getViewModel().inventory.sort;
  assertIntegration(
    defaultSort.criterionIds.join(",") === "rarity" &&
      defaultSort.criteria.find((criterion) => criterion.id === "rarity")
        ?.priority === 1,
    "default rarity criterion exposes the first sorting priority",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "rarity" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-bait,sort-wobbler,sort-reel,sort-hook,sort-rod",
    "reselecting the only active criterion restores stable inventory order",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "type" },
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_DIRECTION_SELECT,
    { directionId: "ascending" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-rod,sort-reel,sort-hook,sort-wobbler,sort-bait",
    "type sorting follows the configured rod-to-consumable order",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "type" },
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "rarity" },
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_DIRECTION_SELECT,
    { directionId: "descending" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-hook,sort-reel,sort-wobbler,sort-rod,sort-bait",
    "rarity sorting supports highest-to-lowest direction",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "ratingTier" },
  );
  const rarityThenLevel = inventoryOrdering.facade.getViewModel().inventory.sort;
  assertIntegration(
    rarityThenLevel.criterionIds.join(",") === "rarity,ratingTier" &&
      rarityThenLevel.criteria.find((criterion) => criterion.id === "rarity")
        ?.priority === 1 &&
      rarityThenLevel.criteria.find(
        (criterion) => criterion.id === "ratingTier",
      )
        ?.priority === 2,
    "additional criteria are appended and expose their sorting priority",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "rarity" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-wobbler,sort-reel,sort-rod,sort-bait,sort-hook",
    "rating-tier sorting uses the explicitly supplied rating segment",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "rating" },
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "ratingTier" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-hook,sort-wobbler,sort-reel,sort-bait,sort-rod",
    "rating sorting uses the progression rating value",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.SORT_DIRECTION_SELECT,
    { directionId: "ascending" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-rod,sort-bait,sort-reel,sort-wobbler,sort-hook",
    "sort direction can be reversed without changing the criterion",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.RARITY_FILTER_TOGGLE,
    { rarityId: "rare", enabled: true },
  );
  assertIntegration(
    orderedIds() === "sort-wobbler",
    "rarity square filters inventory independently from sorting",
  );
  dispatch(
    inventoryOrdering,
    InventoryActionType.RARITY_FILTER_TOGGLE,
    { rarityId: "rare", enabled: false },
  );

  const chainedRatingTiers = {
    "multi-rare-low": 2,
    "multi-common-high": 9,
    "multi-rare-high": 8,
    "multi-epic-low": 1,
  };
  const chainedOrdering = makeComposition({
    items: [
      raw("multi-rare-low", "hook", 1, {
        rarity: "rare",
      }),
      raw("multi-common-high", "hook", 1, {
        rarity: "common",
      }),
      raw("multi-rare-high", "hook", 1, {
        rarity: "rare",
      }),
      raw("multi-epic-low", "hook", 1, {
        rarity: "epic",
      }),
    ],
    itemViewFactory: {
      create(instance) {
        const definition = definitions[instance.itemId] || {};
        return {
          ...definition,
          ...instance,
          effectiveStats: Object.freeze({ ...(definition.gameplayStats || {}) }),
          progression: {
            ratingTier: {
              current: chainedRatingTiers[instance.instanceId],
            },
          },
        };
      },
    },
  });
  dispatch(
    chainedOrdering,
    InventoryActionType.SORT_CRITERION_SELECT,
    { criterionId: "ratingTier" },
  );
  assertIntegration(
    chainedOrdering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId)
      .join(",") ===
      "multi-epic-low,multi-rare-high,multi-rare-low,multi-common-high",
    "secondary rating-tier sorting orders items inside the same rarity",
  );

  const stablePlacementOrdering = makeComposition({
    items: [
      raw("stable-spring", "spring"),
      raw("stable-bait", "bait", 1, { rarity: "rare" }),
      raw("stable-hooks", "hook", 4, { rarity: "common" }),
    ],
  });
  const stableSpringRoot = dispatch(
    stablePlacementOrdering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-spring" },
  ).rootInstanceId;
  stablePlacementOrdering.facade.getViewModel();
  dispatch(
    stablePlacementOrdering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  dispatch(
    stablePlacementOrdering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  assertIntegration(
    stablePlacementOrdering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId)
      .join(",") === "stable-hooks",
    "placing a hook keeps the placement source without exposing nested bait",
  );
  dispatch(
    stablePlacementOrdering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  dispatch(
    stablePlacementOrdering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  dispatch(
    stablePlacementOrdering,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  assertIntegration(
    [0, 1, 2].every(
      (slotIndex) =>
        stablePlacementOrdering.assemblyReader.getChild(
          stableSpringRoot,
          "hook",
          slotIndex,
        ) !== null,
    ) &&
      stablePlacementOrdering.facade
        .getViewModel()
        .inventory.items.map((item) => item.instanceId)
        .join(",") === "stable-hooks",
    "filling hook cells retains the remaining hooks without exposing nested bait",
  );

  const repeatedSocketPlacement = makeComposition({
    items: [
      raw("rapid-boat", "boat"),
      raw("rapid-chum", "chum", 3, {
        rarity: "common",
        recipe: "rapid-fill",
      }),
    ],
  });
  const rapidBoatRoot = dispatch(
    repeatedSocketPlacement,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-boat" },
  ).rootInstanceId;
  const firstCargoSelection = dispatch(
    repeatedSocketPlacement,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-chum" },
  );
  const firstHighlightedCargo = repeatedSocketPlacement.facade
    .getViewModel()
    .panel.assembly.sockets.filter((socket) => socket.highlighted)
    .map((socket) => socket.slotIndex);
  assertIntegration(
    firstCargoSelection.requiresSocketChoice === true &&
      firstHighlightedCargo.join(",") === "0,1,2",
    "the first click highlights all empty compatible boat sections in stable order",
  );
  dispatch(
    repeatedSocketPlacement,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-chum" },
  );
  assertIntegration(
    repeatedSocketPlacement.assemblyReader.getChild(
      rapidBoatRoot,
      "cargo",
      0,
    ) !== null,
    "the second click fills the leftmost highlighted section",
  );
  const secondCargoSelection = dispatch(
    repeatedSocketPlacement,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-chum" },
  );
  const remainingHighlightedCargo = repeatedSocketPlacement.facade
    .getViewModel()
    .panel.assembly.sockets.filter((socket) => socket.highlighted)
    .map((socket) => socket.slotIndex);
  assertIntegration(
    secondCargoSelection.requiresSocketChoice === true &&
      remainingHighlightedCargo.join(",") === "1,2",
    "the next selection highlights only empty sections and keeps left-to-right order",
  );
  dispatch(
    repeatedSocketPlacement,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-chum" },
  );
  assertIntegration(
    repeatedSocketPlacement.assemblyReader.getChild(
      rapidBoatRoot,
      "cargo",
      1,
    ) !== null,
    "the fourth click fills the next empty section",
  );
  dispatch(
    repeatedSocketPlacement,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-chum" },
  );
  assertIntegration(
    [0, 1, 2].every(
      (slotIndex) =>
        repeatedSocketPlacement.assemblyReader.getChild(
          rapidBoatRoot,
          "cargo",
          slotIndex,
        ) !== null,
    ),
    "the last remaining compatible section fills with one click",
  );

  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "pole-rod",
  });
  const poleView = flow.facade.getViewModel();
  assertIntegration(
    poleView.panel.loadout.mainSlots.some((slot) => slot.slotId === "float") &&
      !poleView.panel.loadout.mainSlots.some((slot) => slot.slotId === "reel"),
    "pole rod shows float and hides reel",
  );

  const hookDraft = dispatch(
    flow,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "hook-stack" },
  ).rootInstanceId;
  assertIntegration(
    flow.assemblyStates.require(hookDraft).isPrepared && flow.commands.getUiState().panelMode === "loadout" &&
      flow.equipmentState.getRootInstanceId("tackle") === hookDraft,
    "a new compatible hook is prepared and equipped directly without an empty craft panel",
  );
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "bait-stack",
  });
  dispatch(flow, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "tackle" });
  const completedHookEditor = flow.facade.getViewModel().panel.assembly;
  assertIntegration(
    completedHookEditor.showDisassemble === false &&
      completedHookEditor.showEquip === false &&
      completedHookEditor.showUnequip === true &&
      completedHookEditor.root.assemblyCompletion.isComplete === true &&
      completedHookEditor.root.assemblyCompletion.hasAnyComponent === true,
    "inspecting the directly equipped hook exposes Unequip and retains complete bait state",
  );
  dispatch(flow, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: hookDraft,
  });
  assertIntegration(
    flow.assemblyStates.require(hookDraft).isPrepared &&
      flow.equipmentState.getRootInstanceId("tackle") === hookDraft,
    "hook becomes prepared and equipped",
  );
  dispatch(flow, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, {
    slotId: "tackle",
  });
  assertIntegration(
    flow.commands.getUiState().panelMode === "assembly" &&
      flow.facade.getViewModel().panel.assembly.showUnequip === true &&
      flow.facade.getViewModel().panel.assembly.showEquip === false,
    "short press on active prepared stack opens its editor",
  );
  dispatch(flow, InventoryActionType.ASSEMBLY_UNEQUIP, {
    rootInstanceId: hookDraft,
  });

  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "feeder-rod",
  });
  dispatch(flow, InventoryActionType.ASSEMBLY_EQUIP, { rootInstanceId: "feeder-rod" });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === null,
    "rod change clears previous tackle",
  );
  const feederView = flow.facade.getViewModel();
  assertIntegration(
    feederView.panel.loadout.mainSlots.some((slot) => slot.slotId === "reel") &&
      feederView.panel.loadout.mainSlots.some(
        (slot) => slot.slotId === "terminalLine",
      ) &&
      feederView.panel.loadout.mainSlots.some((slot) => slot.slotId === "tackle") &&
      !feederView.panel.loadout.mainSlots.some((slot) => slot.slotId === "float"),
    "feeder rod exposes reel, leader and tackle while hiding float",
  );

  const springDraft = dispatch(
    flow,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "spring-stack" },
  ).rootInstanceId;
  const chooseHookSlot = dispatch(
    flow,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: hookDraft },
  );
  assertIntegration(
    chooseHookSlot.requiresSocketChoice === true,
    "three hook sockets require an explicit target",
  );
  dispatch(flow, InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE, {
    rootInstanceId: springDraft,
    socketId: "hook[0]",
    parentInstanceId: springDraft,
    slotId: "hook",
    slotIndex: 0,
  });
  assertIntegration(
    flow.assemblyReader.getChild(springDraft, "hook", 0)?.instanceId ===
      hookDraft &&
      flow.assemblyReader.getChild(hookDraft, "bait", 0) !== null &&
      !flow.assemblyStates.has(hookDraft) &&
      flow.assemblyStates
        .require(springDraft)
        .getRefillSignature("hook[0].bait") !== null,
    "prepared hook and bait are absorbed as one nested spring component",
  );
  dispatch(flow, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: springDraft,
  });
  const partialInventorySpring = flow.facade
    .getViewModel()
    .inventory.items.find((item) => item.instanceId === springDraft);
  assertIntegration(
    partialInventorySpring?.assemblyCompletion?.hasAnyComponent === true &&
      partialInventorySpring?.assemblyCompletion?.isComplete === false,
    "a partially filled assembly exposes incomplete metadata in inventory",
  );
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: springDraft,
  });
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "chum-stack",
  });
  dispatch(flow, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: springDraft,
  });

  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "chum-stack",
  });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("handChum") !== null,
    "loose chum equips into the separate hand-chum slot",
  );

  const boatRoot = dispatch(
    flow,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "boat-one" },
  ).rootInstanceId;
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "chum-stack",
  });
  dispatch(flow, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: boatRoot,
  });
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "net-one",
  });

  const header = flow.facade.getViewModel().header.activeTackle;
  assertIntegration(
    header.baits.length === 1 && header.chums.length === 1 &&
      header.chums.some((item) => item.location?.parentInstanceId === springDraft),
    "top controls show only cast tackle consumables, excluding hand chum and boat cargo (baits=" +
      header.baits.length +
      ", chums=" +
      header.chums.length +
      ")",
  );

  const saved = dispatch(flow, InventoryActionType.LOADOUT_SAVE, {
    name: "Feeder kit",
  });
  const loadout = flow.loadouts.require(saved.loadoutId);
  const savedRoots = loadout.getRootInstanceIds();
  assertIntegration(
    savedRoots.rod === flow.equipmentState.getRootInstanceId("rod") &&
      savedRoots.tackle === springDraft &&
      !Object.prototype.hasOwnProperty.call(savedRoots, "handChum") &&
      !Object.prototype.hasOwnProperty.call(savedRoots, "delivery") &&
      !Object.prototype.hasOwnProperty.call(savedRoots, "net"),
    "saved loadout owns only main semantic slots",
  );
  assertIntegration(
    flow.equipmentState.getRootInstanceId("delivery") === boatRoot &&
      flow.equipmentState.getRootInstanceId("net") !== null &&
      flow.equipmentState.getRootInstanceId("handChum") !== null,
    "saving a loadout leaves auxiliary equipment active",
  );
  dispatch(flow, InventoryActionType.CATEGORY_SELECT, {
    categoryId: "all",
  });
  assertIntegration(
    flow.facade
      .getViewModel()
      .inventory.items.filter((item) => item.itemType === "equipment_loadout")
      .length === 1,
    "saved loadout is represented by one inventory card",
  );
  assertIntegration(
    flow.gameplayBridge
      .getInventoryItems()
      .every(
        (item) =>
          item.location.kind === "INVENTORY" &&
          item.location.kind !== "ATTACHED" &&
          item.location.kind !== "LOADOUT",
      ),
    "gameplay inventory lookup excludes attached and loadout-owned items",
  );

  flow.equipmentState.clear("tackle");
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: saved.loadoutId,
  });
  const savedPreview = flow.facade.getViewModel();
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === null &&
      flow.commands.getUiState().viewingLoadoutId === saved.loadoutId &&
      savedPreview.panel.mode === "saved-loadout" && savedPreview.inventory.mode === "inventory" &&
      savedPreview.inventory.savedLoadout.slots.every((slot) => slot.item),
    "short press opens the saved loadout on the left and keeps the inventory on the right without equipping it",
  );
  dispatch(flow, InventoryActionType.LOADOUT_PREVIEW_BACK, {
    loadoutId: saved.loadoutId,
  });
  assertIntegration(
    flow.commands.getUiState().viewingLoadoutId === null &&
      flow.equipmentState.getRootInstanceId("tackle") === null,
    "Back closes saved loadout contents without equipping anything",
  );
  dispatch(flow, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: saved.loadoutId,
  });
  dispatch(flow, InventoryActionType.LOADOUT_PREVIEW_SLOT_EQUIP, {
    loadoutId: saved.loadoutId,
    slotId: "tackle",
  });
  assertIntegration(flow.facade.getViewModel().panel.assembly.rootInstanceId === springDraft &&
    flow.equipmentState.getRootInstanceId("tackle") === null,
    "an incomplete saved root opens its parameters just like the same inventory item");
  dispatch(flow, InventoryActionType.ASSEMBLY_EQUIP, { rootInstanceId: springDraft });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === springDraft &&
      flow.commands.getUiState().viewingLoadoutId === null,
    "a saved root follows normal inventory equip behavior and returns to the equipment panel",
  );
  flow.equipmentState.clear("tackle");
  dispatch(flow, InventoryActionType.LOADOUT_EQUIP_ALL, {
    loadoutId: saved.loadoutId,
  });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === springDraft &&
      flow.commands.getUiState().viewingLoadoutId === null,
    "Equip all restores the complete saved loadout and closes its contents",
  );

  dispatch(flow, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, {
    slotId: "tackle",
    instanceId: springDraft,
  });
  assertIntegration(
    flow.repository.require(springDraft).location.kind === "LOADOUT" &&
      flow.loadouts.require(saved.loadoutId).getRootInstanceId("tackle") ===
        springDraft,
    "long press returns an active stack to its original loadout custody",
  );
  const remainingLoadoutRod = flow.loadouts
    .require(saved.loadoutId)
    .getRootInstanceId("rod");
  const repositorySizeBeforeRodCycles = flow.repository.size;
  for (let cycle = 0; cycle < 3; cycle += 1) {
    dispatch(flow, InventoryActionType.LOADOUT_PREVIEW_SLOT_EQUIP, {
      loadoutId: saved.loadoutId,
      slotId: "rod",
    });
    dispatch(flow, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, {
      slotId: "rod",
      instanceId: remainingLoadoutRod,
    });
    assertIntegration(
      flow.equipmentState.getRootInstanceId("rod") === null &&
        flow.repository.require(remainingLoadoutRod).location.kind ===
          "LOADOUT" &&
        flow.loadouts
          .require(saved.loadoutId)
          .getRootInstanceId("rod") === remainingLoadoutRod &&
        flow.repository.size === repositorySizeBeforeRodCycles &&
        flow.repository.list().filter(
          (item) => item.instanceId === remainingLoadoutRod,
        ).length === 1,
      "repeated loadout rod equip and unequip preserves one owned instance",
    );
  }
  assertIntegration(
    flow.gameplayCommands.consumeItem(springDraft, 1).success === true &&
      flow.loadouts.has(saved.loadoutId) &&
      flow.gameplayCommands.consumeItem(remainingLoadoutRod, 1).success === true &&
      !flow.loadouts.has(saved.loadoutId),
    "consuming every loadout root removes the empty loadout card",
  );

  // Spec 089: an incomplete rod (the pole shows a float cell, here empty) comes off at once: no save prompt, no
  // loadout; its components return to the backpack as they are, the hook keeping its bait.
  const incompleteRod = makeComposition({
    items: [raw("part-rod", "rodPole"), raw("part-line", "line", 1, { statOverrides: { lengthMeters: 8 } }),
      raw("part-hook", "hook"), raw("part-bait", "bait", 1, { location: InventoryItemLocation.attached("part-hook", "bait") })],
    equipment: { ...emptyEquipment(), rod: "part-rod", terminalLine: "part-line", tackle: "part-hook" },
    assemblies: [{ rootInstanceId: "part-hook", profileId: "hook_standard", status: "PREPARED", refillSignatures: {} }],
  });
  const incompleteRemoval = dispatch(incompleteRod, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, { slotId: "rod" });
  assertIntegration(!incompleteRemoval.requiresRodRemovalChoice && !incompleteRod.commands.getUiState().rodRemovalStep &&
    EQUIPMENT_MAIN_SLOT_IDS.every((slot) => !incompleteRod.equipmentState.getRootInstanceId(slot)) &&
    incompleteRod.loadouts.list().length === 0 && incompleteRod.assemblyStates.has("part-hook") &&
    incompleteRod.repository.require("part-bait").location.kind === "ATTACHED" &&
    ["part-rod", "part-line", "part-hook"].every((id) => incompleteRod.repository.require(id).location.kind === "INVENTORY"),
  "an incomplete rod comes off without the save prompt and keeps its components intact in the backpack");

  // Spec 090: bait and tackle chum are filled through the header switchers, so an empty bait slot does not make a hook
  // incomplete equipment (no red marker); the full assembly analysis still reports the empty slot.
  const baitlessHook = makeComposition({
    items: [raw("bare-hook", "hook")],
    assemblies: [{ rootInstanceId: "bare-hook", profileId: "hook_standard", status: "DRAFT", refillSignatures: {} }],
  });
  const baitlessHookView = baitlessHook.facade.getViewModel().inventory.items.find((item) => item.instanceId === "bare-hook");
  assertIntegration(baitlessHookView.equipmentCompletion.isComplete === true &&
    baitlessHookView.assemblyCompletion.isComplete === false,
  "a hook without bait is complete equipment while its assembly still lists the empty bait slot");

  // Spec 092: inside an item editor only its own buttons leave it. An item picked for its empty cell returns to the
  // same editor, and switching sections (keepnet, backpack) never closes it.
  const editorPick = makeComposition({
    items: [raw("pick-rod", "rodPole"), raw("pick-float", "floatDay")],
    equipment: { ...emptyEquipment(), rod: "pick-rod" },
  });
  const editorState = () => editorPick.commands.getUiState();
  dispatch(editorPick, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, { slotId: "rod", listVisible: false });
  dispatch(editorPick, InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE, { rootInstanceId: "pick-rod", socketId: "float",
    slotId: "float", slotIndex: 0, parentInstanceId: "pick-rod", listVisible: false });
  assertIntegration(editorState().activeSectionId === "backpack" && editorState().highlightedEquipmentSlotId === "float",
    "an empty editor cell starts a pick in the backpack");
  dispatch(editorPick, InventoryActionType.INVENTORY_ITEM_ACTIVATE, { instanceId: "pick-float" });
  assertIntegration(editorPick.equipmentState.getRootInstanceId("float") === "pick-float" &&
    editorState().panelMode === "assembly" && editorState().editingRootInstanceId === "pick-rod" &&
    editorState().activeSectionId === "equipment", "an item picked from the editor returns to the same editor");
  for (const sectionId of ["keepnet", "backpack", "equipment"]) {
    dispatch(editorPick, InventoryActionType.SECTION_SELECT, { sectionId });
  }
  assertIntegration(editorState().panelMode === "assembly" && editorState().editingRootInstanceId === "pick-rod",
    "switching sections keeps the open editor");

  const looseStackCycles = makeComposition({
    items: [raw("stacked-pole-rods", "rodPole", 2)],
  });
  const looseStackInitialSize = looseStackCycles.repository.size;
  for (let cycle = 0; cycle < 3; cycle += 1) {
    dispatch(looseStackCycles, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
      instanceId: "stacked-pole-rods",
    });
    dispatch(looseStackCycles, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, {
      slotId: "rod",
      instanceId: looseStackCycles.equipmentState.getRootInstanceId("rod"),
    });
    const looseItems = looseStackCycles.repository.list();
    assertIntegration(
      looseStackCycles.equipmentState.getRootInstanceId("rod") === null &&
        looseStackCycles.repository.size === looseStackInitialSize &&
        looseStackCycles.repository.require("stacked-pole-rods").quantity === 2 &&
        looseItems.reduce((sum, item) => sum + item.quantity, 0) === 2 &&
        new Set(looseItems.map((item) => item.instanceId)).size ===
          looseItems.length,
      "repeated loose-item equip and unequip restores one stack without cloning",
    );
  }

  const disassembly = makeComposition({
    items: [
      raw("disassembly-rod", "rodFeeder"),
      raw("disassembly-spring", "spring"),
      raw("disassembly-hook", "hook"),
      raw("disassembly-bait", "bait"),
    ],
  });
  disassembly.equipmentState.setRootInstanceId("rod", "disassembly-rod");
  const disassemblySpring = disassembly.assemblyService.startAssembly(
    "disassembly-spring",
  );
  const disassemblyHook = disassembly.assemblyService.startAssembly(
    "disassembly-hook",
  );
  disassembly.assemblyService.attach({
    rootInstanceId: disassemblyHook,
    sourceInstanceId: "disassembly-bait",
    slotId: "bait",
  });
  disassembly.assemblyService.prepare(disassemblyHook);
  disassembly.assemblyService.attach({
    rootInstanceId: disassemblySpring,
    sourceInstanceId: disassemblyHook,
    slotId: "hook",
    slotIndex: 0,
  });
  disassembly.assemblyService.prepare(disassemblySpring);
  disassembly.equipmentState.setRootInstanceId("tackle", disassemblySpring);
  const disassemblyLoadoutId = dispatch(
    disassembly,
    InventoryActionType.LOADOUT_SAVE,
    { name: "Disassembly kit" },
  ).loadoutId;
  const activeDisassemblyAttempt = disassembly.facade.dispatch({
    type: InventoryActionType.ASSEMBLY_DISASSEMBLE,
    rootInstanceId: disassemblySpring,
  });
  assertIntegration(
    activeDisassemblyAttempt.success === false &&
      disassembly.equipmentState.getRootInstanceId("tackle") ===
        disassemblySpring &&
      disassembly.assemblyStates.has(disassemblySpring),
    "an equipped stack must be unequipped before it can be disassembled",
  );
  dispatch(disassembly, InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS, {
    slotId: "tackle",
    instanceId: disassemblySpring,
  });
  const savedComponentDisassembly = disassembly.facade.dispatch({ type: InventoryActionType.ASSEMBLY_DISASSEMBLE,
    rootInstanceId: disassemblySpring,
  });
  assertIntegration(
    savedComponentDisassembly.success === false && disassembly.loadouts.has(disassemblyLoadoutId) &&
      disassembly.loadouts
        .require(disassemblyLoadoutId)
        .getRootInstanceId("rod") === "disassembly-rod" &&
      disassembly.loadouts
        .require(disassemblyLoadoutId)
        .getRootInstanceId("tackle") === disassemblySpring &&
      disassembly.repository.require("disassembly-rod").location.kind ===
        "LOADOUT" &&
      disassembly.assemblyStates.has(disassemblySpring) &&
      disassembly.equipmentState.getRootInstanceId("tackle") === null,
    "a saved component cannot be disassembled separately through a button",
  );
  dispatch(disassembly, InventoryActionType.INVENTORY_ITEM_LONG_PRESS, {
    instanceId: disassemblyLoadoutId,
  });
  assertIntegration(
    !disassembly.loadouts.has(disassemblyLoadoutId) &&
      disassembly.repository.require("disassembly-rod").location.kind ===
        "INVENTORY",
    "long pressing a saved loadout releases its remaining contents",
  );

  // A loadout transition must return loose pole-line segments to their exact
  // source spool, and disassembly must do the same for its contained segment.
  const lineLoadout = makeComposition({
    items: [
      raw("line-kit-rod", "rodPole"),
      raw("loose-rod", "rodPole"),
      raw("line-kit-source", "line", 1, { statOverrides: { lengthMeters: 25 } }),
      raw("loose-line-source", "line", 1, { statOverrides: { lengthMeters: 25 } }),
      raw("line-kit-float", "floatDay"),
    ],
  });
  dispatch(lineLoadout, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "line-kit-rod",
  });
  const loadoutLineSegment = dispatch(
    lineLoadout,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "line-kit-source" },
  ).equippedInstanceId;
  dispatch(lineLoadout, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "line-kit-float",
  });
  const lineLoadoutId = dispatch(
    lineLoadout,
    InventoryActionType.LOADOUT_SAVE,
    { name: "Pole line kit" },
  ).loadoutId;
  dispatch(lineLoadout, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "loose-rod",
  });
  const looseLineSegment = dispatch(
    lineLoadout,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "loose-line-source" },
  ).equippedInstanceId;
  assertIntegration(
    lineMeters(lineLoadout, looseLineSegment) === 8 &&
      lineMeters(lineLoadout, "loose-line-source") === 17,
    "pole line is split into the exact active segment before loadout swap",
  );
  dispatch(lineLoadout, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: lineLoadoutId,
  });
  assertIntegration(
    lineLoadout.commands.getUiState().viewingLoadoutId === lineLoadoutId &&
      lineLoadout.equipmentState.getRootInstanceId("terminalLine") ===
        looseLineSegment,
    "short loadout press opens its contents without changing active equipment",
  );
  dispatch(lineLoadout, InventoryActionType.LOADOUT_EQUIP_ALL, {
    loadoutId: lineLoadoutId,
  });
  assertIntegration(
    !lineLoadout.repository.has(looseLineSegment) &&
      lineMeters(lineLoadout, "loose-line-source") === 25 &&
      lineLoadout.equipmentState.getRootInstanceId("terminalLine") ===
        loadoutLineSegment,
    "equipping a loadout merges the outgoing terminal-line segment back to exactly 25m",
  );
  dispatch(lineLoadout, InventoryActionType.INVENTORY_ITEM_LONG_PRESS, {
    instanceId: lineLoadoutId,
  });
  assertIntegration(
    !lineLoadout.loadouts.has(lineLoadoutId) &&
      !lineLoadout.repository.has(loadoutLineSegment) &&
      lineMeters(lineLoadout, "line-kit-source") === 25 &&
      lineLoadout.repository
        .list()
        .every((item) => item.detachedLineSegment !== true) &&
      lineLoadout.repository.require("line-kit-rod").location.kind ===
        "INVENTORY" &&
      lineLoadout.repository.require("line-kit-float").location.kind ===
        "INVENTORY" &&
      lineLoadout.equipmentState.getRootInstanceId("float") === null &&
      lineLoadout.repository.require("loose-rod").location.kind ===
        "INVENTORY",
    "disassembling the loadout restores exact meters with no orphan segment and preserves other roots",
  );

  // A failed cleanup participates in the same aggregate transaction.
  const rollbackRepository = new FlatInventoryItemRepository({
    items: [
      raw("rollback-current-rod", "rodPole"),
      raw("rollback-next-rod", "rodPole", 1, {
        location: InventoryItemLocation.loadout("rollback-kit", "rod"),
      }),
      raw("rollback-source", "line", 1, { statOverrides: { lengthMeters: 17 } }),
      raw("rollback-segment", "line", 1, {
        statOverrides: { lengthMeters: 8 },
        detachedLineSegment: true,
        sourceLineItemId: "line",
        sourceLineInstanceId: "rollback-source",
      }),
    ],
  });
  const rollbackEquipment = new EquipmentState({
    rod: "rollback-current-rod",
    terminalLine: "rollback-segment",
  });
  const rollbackLoadouts = new EquipmentLoadoutRepository({
    loadouts: [{
      loadoutId: "rollback-kit",
      name: "Rollback kit",
      rootInstanceIds: {
        rod: "rollback-next-rod",
        reel: null,
        terminalLine: null,
        tackle: null,
        float: null,
      },
    }],
  });
  const rollbackTransaction = new InventoryTransactionCoordinator({
    participants: [rollbackRepository, rollbackEquipment, rollbackLoadouts],
  });
  const rollbackPort = new InventoryLoadoutAdapter({
    repository: rollbackRepository,
    loadouts: rollbackLoadouts,
    transaction: rollbackTransaction,
    lineAllocationService: {
      release() {
        rollbackRepository.update("rollback-source", {
          statOverrides: { lengthMeters: 999 },
        });
        throw new Error("forced terminal-line cleanup failure");
      },
    },
  });
  const rollbackCapacityPolicy = new UnlimitedInventoryCapacityPolicy();
  const rollbackService = new LoadoutApplicationService({
    port: rollbackPort,
    capacityPolicy: rollbackCapacityPolicy,
    transitionPlanner: new LoadoutEquipmentTransitionPlanner({
      capacityPolicy: rollbackCapacityPolicy,
      ownershipReader: (instanceId) => rollbackPort.getRootOwner?.(instanceId),
      mainSlotIds: [...EQUIPMENT_MAIN_SLOT_IDS],
    }),
  });
  const rollbackResult = rollbackService.equip({
    loadout: rollbackLoadouts.require("rollback-kit"),
    equipmentState: rollbackEquipment,
  });
  assertIntegration(
    rollbackResult.success === false &&
      rollbackEquipment.getRootInstanceId("rod") === "rollback-current-rod" &&
      rollbackEquipment.getRootInstanceId("terminalLine") ===
        "rollback-segment" &&
      rollbackRepository.require("rollback-source").statOverrides.lengthMeters === 17 &&
      rollbackRepository.require("rollback-segment").detachedLineSegment ===
        true &&
      rollbackLoadouts.has("rollback-kit"),
    "terminal-line cleanup failure rolls repository, equipment and loadout custody back",
  );

  // Winding a raw reel is rod-independent. Rod compatibility is checked only
  // when that prepared reel is equipped.
  const contextualActivation = makeComposition({
    items: [
      raw("activation-rod", "rodFeederShort"),
      raw("activation-reel", "reel"),
      raw("activation-line", "line", 1, { statOverrides: { lengthMeters: 10 } }),
      raw("activation-empty-reel", "reel"),
    ],
  });
  dispatch(contextualActivation, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "activation-rod",
  });
  const completeReelRoot = dispatch(
    contextualActivation,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "activation-reel" },
  ).rootInstanceId;
  dispatch(contextualActivation, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "activation-line",
  });
  dispatch(contextualActivation, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: completeReelRoot,
  });
  dispatch(contextualActivation, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: completeReelRoot,
  });
  assertIntegration(
    contextualActivation.equipmentState.getRootInstanceId("reel") ===
      completeReelRoot &&
      contextualActivation.commands.getUiState().panelMode === "loadout",
    "a complete compatible assembly equips immediately without opening its card",
  );
  dispatch(contextualActivation, InventoryActionType.ASSEMBLY_UNEQUIP, {
    rootInstanceId: completeReelRoot,
  });
  const emptyPreparedReel = dispatch(
    contextualActivation,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "activation-empty-reel" },
  ).rootInstanceId;
  dispatch(contextualActivation, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: emptyPreparedReel,
  });
  dispatch(contextualActivation, InventoryActionType.ASSEMBLY_UNEQUIP, {
    rootInstanceId: emptyPreparedReel,
  });
  dispatch(contextualActivation, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: emptyPreparedReel,
  });
  assertIntegration(
    contextualActivation.equipmentState.getRootInstanceId("reel") === null &&
      contextualActivation.facade.getViewModel().panel.assembly.rootInstanceId ===
        emptyPreparedReel,
    "an incomplete prepared assembly opens its card instead of equipping immediately",
  );

  const reelWithoutRod = makeComposition({
    items: [
      raw("raw-reel-no-rod", "reel"),
      raw("raw-line-no-rod", "line", 1, { statOverrides: { lengthMeters: 25 } }),
    ],
  });
  const reelWithoutRodRoot = dispatch(
    reelWithoutRod,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "raw-reel-no-rod" },
  ).rootInstanceId;
  dispatch(reelWithoutRod, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "raw-line-no-rod",
  });
  const noRodInstalledLine = reelWithoutRod.assemblyReader.getChild(
    reelWithoutRodRoot,
    "line",
    0,
  );
  assertIntegration(
    lineMeters(reelWithoutRod, noRodInstalledLine.instanceId) === 20 &&
      lineMeters(reelWithoutRod, "raw-line-no-rod") === 5,
    "a raw reel can be wound to its 20m capacity without an active rod",
  );

  const reelWithPoleActive = makeComposition({
    items: [
      raw("active-pole-for-reel", "rodPole"),
      raw("raw-reel-with-pole", "reel"),
      raw("raw-line-with-pole", "line", 1, { statOverrides: { lengthMeters: 25 } }),
    ],
  });
  dispatch(reelWithPoleActive, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "active-pole-for-reel",
  });
  const reelWithPoleRoot = dispatch(
    reelWithPoleActive,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "raw-reel-with-pole" },
  ).rootInstanceId;
  const poleReelEditor = reelWithPoleActive.facade.getViewModel().panel.assembly;
  assertIntegration(
    poleReelEditor.showEquip === true &&
      poleReelEditor.canEquip === false &&
      poleReelEditor.equipWarning ===
        "Цей слот не підтримується обраним вудилищем.",
    "a reel editor keeps Equip disabled while a pole rod is active",
  );
  dispatch(reelWithPoleActive, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "raw-line-with-pole",
  });
  assertIntegration(
    lineMeters(
      reelWithPoleActive,
      reelWithPoleActive.assemblyReader.getChild(reelWithPoleRoot, "line", 0)
        .instanceId,
    ) === 20,
    "an active pole rod does not truncate line wound onto a 20m reel to pole length",
  );

  const changedRodReel = makeComposition({
    items: [
      raw("short-reel-rod", "rodFeederShort"),
      raw("long-reel-rod", "rodFeeder"),
      raw("prepared-short-reel", "reel"),
      raw("short-reel-line", "line", 1, { statOverrides: { lengthMeters: 5 } }),
    ],
  });
  dispatch(changedRodReel, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "short-reel-rod",
  });
  const preparedShortReel = dispatch(
    changedRodReel,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "prepared-short-reel" },
  ).rootInstanceId;
  dispatch(changedRodReel, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "short-reel-line",
  });
  dispatch(changedRodReel, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: preparedShortReel,
  });
  const equippedTooltipContext =
    changedRodReel.facade.getViewModel().tooltipContext;
  assertIntegration(
    equippedTooltipContext.equipment.rod?.instanceId === "short-reel-rod" &&
      equippedTooltipContext.equipment.reel?.instanceId === preparedShortReel &&
      equippedTooltipContext.equipment.line?.instanceId != null,
    "balance tooltip context exposes projected rod, reel and installed line",
  );
  dispatch(changedRodReel, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "long-reel-rod",
  });
  dispatch(changedRodReel, InventoryActionType.ASSEMBLY_EQUIP, { rootInstanceId: "long-reel-rod" });
  const rejectedPreparedReel = changedRodReel.facade.dispatch({
    type: InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: preparedShortReel,
  });
  assertIntegration(
    rejectedPreparedReel.success === true &&
      changedRodReel.equipmentState.getRootInstanceId("reel") === null &&
      changedRodReel.assemblyStates.require(preparedShortReel).isPrepared &&
      lineMeters(changedRodReel, "short-reel-line") === 5 &&
      changedRodReel.facade.getViewModel().panel.assembly.rootInstanceId ===
        preparedShortReel &&
      changedRodReel.facade.getViewModel().panel.assembly.canEquip === false,
    "an incompatible prepared reel opens its card without consuming line or changing state",
  );

  const draftReelRollback = makeComposition({
    items: [
      raw("draft-long-rod", "rodFeeder"),
      raw("draft-short-reel", "reel"),
      raw("draft-short-line", "line", 1, { statOverrides: { lengthMeters: 5 } }),
    ],
  });
  dispatch(draftReelRollback, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "draft-long-rod",
  });
  const draftShortReel = dispatch(
    draftReelRollback,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "draft-short-reel" },
  ).rootInstanceId;
  dispatch(draftReelRollback, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "draft-short-line",
  });
  const rejectedDraftReel = draftReelRollback.facade.dispatch({
    type: InventoryActionType.ASSEMBLY_EQUIP,
    rootInstanceId: draftShortReel,
  });
  assertIntegration(
    rejectedDraftReel.success === false &&
      draftReelRollback.assemblyStates.require(draftShortReel).isDraft &&
      draftReelRollback.equipmentState.getRootInstanceId("reel") === null &&
      draftReelRollback.assemblyReader.getChild(
        draftShortReel,
        "line",
        0,
      )?.instanceId === "draft-short-line" &&
      lineMeters(draftReelRollback, "draft-short-line") === 5,
    "failed draft-reel equip rolls PREPARED mutation back while preserving its exact attached line",
  );

  const invalidLoadout = makeComposition({
    items: [
      raw("invalid-kit-rod", "rodFeeder", 1, {
        location: InventoryItemLocation.loadout("invalid-line-kit", "rod"),
      }),
      raw("invalid-kit-reel", "reel", 1, {
        location: InventoryItemLocation.loadout("invalid-line-kit", "reel"),
      }),
      raw("invalid-kit-line", "line", 1, {
        statOverrides: { lengthMeters: 5 },
        location: InventoryItemLocation.attached(
          "invalid-kit-reel",
          "line",
          0,
        ),
      }),
    ],
    assemblies: [{
      rootInstanceId: "invalid-kit-reel",
      profileId: "reel_standard",
      status: "PREPARED",
      refillSignatures: {},
    }],
    loadouts: [{
      loadoutId: "invalid-line-kit",
      name: "Invalid line kit",
      rootInstanceIds: {
        rod: "invalid-kit-rod",
        reel: "invalid-kit-reel",
        terminalLine: null,
        tackle: null,
        float: null,
      },
    }],
  });
  const invalidLoadoutBefore = JSON.stringify(
    invalidLoadout.snapshotFactory.create(),
  );
  const invalidLoadoutPreview = invalidLoadout.facade.dispatch({
    type: InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: "invalid-line-kit",
  });
  const invalidLoadoutResult = invalidLoadout.facade.dispatch({
    type: InventoryActionType.LOADOUT_EQUIP_ALL,
    loadoutId: "invalid-line-kit",
  });
  assertIntegration(
    invalidLoadoutPreview.success === true &&
      invalidLoadoutResult.success === false &&
      invalidLoadout.equipmentState.getRootInstanceId("rod") === null &&
      invalidLoadout.equipmentState.getRootInstanceId("reel") === null &&
      lineMeters(invalidLoadout, "invalid-kit-line") === 5 &&
      JSON.stringify(invalidLoadout.snapshotFactory.create()) ===
        invalidLoadoutBefore,
    "an invalid prepared reel inside a loadout is rejected with a full snapshot rollback",
  );

  // Empty draft persistence and permissive preparation.
  const emptyStack = makeComposition({
    items: [raw("empty-feeder-rod", "rodFeeder"), raw("empty-spring", "spring")],
  });
  dispatch(emptyStack, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "empty-feeder-rod",
  });
  const emptySpringRoot = dispatch(
    emptyStack,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "empty-spring" },
  ).rootInstanceId;
  dispatch(emptyStack, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: emptySpringRoot,
  });
  assertIntegration(
    emptyStack.assemblyStates.require(emptySpringRoot).isDraft &&
      emptyStack.equipmentState.getRootInstanceId("tackle") === null,
    "leaving the editor preserves an unfinished draft in inventory",
  );
  dispatch(emptyStack, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: emptySpringRoot,
  });
  const emptySpringEditor = emptyStack.facade.getViewModel().panel.assembly;
  assertIntegration(
    emptySpringEditor.showDisassemble === false &&
      emptySpringEditor.showUnequip === false &&
      emptySpringEditor.root.equipped === false &&
      emptySpringEditor.root.assemblyCompletion.hasAnyComponent === false &&
      emptySpringEditor.root.assemblyCompletion.isComplete === false,
    "an unequipped assembly with empty sockets hides Disassemble",
  );
  dispatch(emptyStack, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: emptySpringRoot,
  });
  assertIntegration(
    emptyStack.assemblyStates.require(emptySpringRoot).isPrepared &&
      emptyStack.equipmentState.getRootInstanceId("tackle") === emptySpringRoot &&
      emptyStack.facade
        .getViewModel()
        .panel.loadout.mainSlots.find((slot) => slot.slotId === "tackle")
        ?.item?.equipped === true &&
      emptyStack.facade
        .getViewModel()
        .panel.loadout.mainSlots.find((slot) => slot.slotId === "tackle")
        ?.item?.assemblyCompletion?.isComplete === false,
    "completely empty feeder stack can equip and stays visibly incomplete",
  );

  // Empty reel is equippable, but casting and leader readiness remain guarded.
  const readiness = makeComposition({
    items: [
      raw("ready-rod", "rodFeeder"),
      raw("ready-reel", "reel"),
      raw("ready-leader", "leader"),
    ],
  });
  dispatch(readiness, InventoryActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "ready-rod",
  });
  const emptyReelRoot = dispatch(
    readiness,
    InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "ready-reel" },
  ).rootInstanceId;
  dispatch(readiness, InventoryActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: emptyReelRoot,
  });
  dispatch(readiness, InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, {
    slotId: "reel",
  });
  const equippedEmptyReelEditor =
    readiness.facade.getViewModel().panel.assembly;
  assertIntegration(
    equippedEmptyReelEditor.equipped === true &&
      equippedEmptyReelEditor.showEquip === false &&
      equippedEmptyReelEditor.showUnequip === true &&
      equippedEmptyReelEditor.showDisassemble === false &&
      equippedEmptyReelEditor.root.assemblyCompletion.hasAnyComponent === false,
    "an equipped empty reel exposes Unequip but hides Disassemble",
  );
  dispatch(readiness, InventoryActionType.ASSEMBLY_BACK, {
    rootInstanceId: emptyReelRoot,
  });
  const castReadiness = readiness.gameplayBridge.evaluateCastReadiness();
  assertIntegration(
    castReadiness.canCast === false &&
      castReadiness.shouldOpenInventory === true &&
      castReadiness.warningCode === "reel-line-required",
    "reel without line equips, while casting opens inventory with a line warning",
  );
  const leaderAttempt = readiness.facade.dispatch({
    type: InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: "ready-leader",
  });
  assertIntegration(
    leaderAttempt.success === true &&
      readiness.equipmentState.getRootInstanceId("terminalLine") === null &&
      readiness.facade.getViewModel().panel.assembly.rootInstanceId ===
        "ready-leader" &&
      readiness.facade.getViewModel().panel.assembly.canEquip === false,
    "leader cannot equip before a reel line is installed, but its card opens with a disabled Equip action",
  );

  // Exact, sequential and partial auto-refill for tackle, hand chum and boat.
  const refill = makeComposition({
    items: [
      raw("refill-rod", "rodFeeder"),
      raw("refill-spring", "spring"),
      raw("refill-hooks", "hook", 3),
      raw("bait-exact", "bait", 5, { rarity: "rare", recipe: "worm" }),
      raw("bait-similar", "bait", 5, { rarity: "rare", recipe: "maggot" }),
      raw("tackle-chum", "chum", 2, { rarity: "common", recipe: "bread" }),
      raw("hand-chum", "chum", 2, { rarity: "rare", recipe: "hand" }),
      raw("boat-refill", "boat"),
      raw("boat-current", "boat"),
      raw("boat-a", "chum", 2, { rarity: "common", recipe: "a" }),
      raw("boat-b", "chum", 2, { rarity: "common", recipe: "b" }),
      raw("boat-c", "chum", 1, { rarity: "common", recipe: "c" }),
    ],
    settings: { autoBait: true, autoChum: true },
  });
  refill.equipmentState.setRootInstanceId("rod", "refill-rod");
  const refillSpring = refill.assemblyService.startAssembly("refill-spring");
  for (let index = 0; index < 3; index += 1) {
    const hook = refill.assemblyService.startAssembly("refill-hooks");
    refill.assemblyService.attach({
      rootInstanceId: hook,
      sourceInstanceId: "bait-exact",
      slotId: "bait",
      slotIndex: 0,
    });
    refill.assemblyService.prepare(hook);
    refill.assemblyService.attach({
      rootInstanceId: refillSpring,
      sourceInstanceId: hook,
      slotId: "hook",
      slotIndex: index,
    });
  }
  refill.assemblyService.attach({
    rootInstanceId: refillSpring,
    sourceInstanceId: "tackle-chum",
    slotId: "chum",
    slotIndex: 0,
  });
  refill.assemblyService.prepare(refillSpring);
  refill.equipmentState.setRootInstanceId("tackle", refillSpring);

  for (let index = 0; index < 3; index += 1) {
    assertIntegration(
      refill.gameplayCommands.consumeEquipped("baits_" + index, 1).success === true,
      "bait " + index + " is consumed",
    );
  }
  assertIntegration(
    refill.gameplayCommands.consumeEquipped("feederChum", 1).success === true,
    "feeder chum is consumed",
  );
  const refillReport = refill.gameplayBridge.rodRetrieved();
  const restoredBaits = [0, 1, 2].map((index) => {
    const hook = refill.assemblyReader.getChild(refillSpring, "hook", index);
    return refill.assemblyReader.getChild(hook.instanceId, "bait", 0);
  });
  assertIntegration(
    refillReport.filled === 3 &&
      refillReport.missing === 1 &&
      restoredBaits[0]?.recipe === "worm" &&
      restoredBaits[1]?.recipe === "worm" &&
      restoredBaits[2] === null &&
      refill.assemblyReader.getChild(refillSpring, "chum", 0)?.recipe ===
        "bread" &&
      refill.repository.require("bait-similar").quantity === 5 &&
      Boolean(refillReport.warning),
    "rod retrieval refills exact stock sequentially and warns about the remainder",
  );

  const detachedBait = refill.assemblyService.detach({
    rootInstanceId: refillSpring,
    parentInstanceId: refill.assemblyReader.getChild(refillSpring, "hook", 0)
      .instanceId,
    slotId: "bait",
    slotIndex: 0,
  });
  assertIntegration(
    detachedBait.detachedInstanceId &&
      refill.assemblyStates
        .require(refillSpring)
        .getRefillSignature("hook[0].bait") === null,
    "manual detach clears the refill preference",
  );

  const handEquip = refill.facade.dispatch({
    type: InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: "hand-chum",
  });
  assertIntegration(handEquip.success === true, "hand chum equips");
  const firstHandChumId = refill.equipmentState.getRootInstanceId("handChum");
  assertIntegration(
    refill.gameplayCommands.consumeEquipped("handChum", 1).success === true &&
      refill.equipmentState.getRootInstanceId("handChum") === null,
    "used hand chum leaves its equipment slot empty",
  );
  const handReport = refill.gameplayBridge.handChumUsed();
  assertIntegration(
    handReport.filled === 1 &&
      refill.equipmentState.getRootInstanceId("handChum") !== null &&
      refill.equipmentState.getRootInstanceId("handChum") !== firstHandChumId,
    "hand chum auto-refills from its exact remembered variant",
  );

  const refillBoat = refill.assemblyService.startAssembly("boat-refill");
  const boatSources = ["boat-a", "boat-b", "boat-c"];
  for (let index = 0; index < boatSources.length; index += 1) {
    refill.assemblyService.attach({
      rootInstanceId: refillBoat,
      sourceInstanceId: boatSources[index],
      slotId: "cargo",
      slotIndex: index,
    });
  }
  refill.assemblyService.prepare(refillBoat);
  refill.equipmentState.setRootInstanceId("delivery", refillBoat);
  for (let index = 0; index < 3; index += 1) {
    assertIntegration(
      refill.gameplayCommands.consumeEquipped("deliveryChums_" + index, 1).success ===
        true,
      "boat section " + index + " is consumed",
    );
  }
  const earlyBoatReport = refill.gameplayBridge.boatReturned({
    allBaysEmptied: true,
    hasReturnedToPlayer: false,
    rootInstanceId: refillBoat,
  });
  assertIntegration(
    earlyBoatReport.attempted === 0,
    "boat does not refill before physically returning to the player",
  );
  const currentBoat = refill.assemblyService.startAssembly("boat-current");
  refill.assemblyService.prepare(currentBoat);
  refill.equipmentState.setRootInstanceId("delivery", currentBoat);
  const boatReport = refill.gameplayBridge.boatReturned({
    allBaysEmptied: true,
    hasReturnedToPlayer: true,
    rootInstanceId: refillBoat,
  });
  const boatRecipes = [0, 1, 2].map(
    (index) =>
      refill.assemblyReader.getChild(refillBoat, "cargo", index)?.recipe || null,
  );
  assertIntegration(
    boatReport.filled === 2 &&
      boatReport.missing === 1 &&
      boatRecipes[0] === "a" &&
      boatRecipes[1] === "b" &&
      boatRecipes[2] === null &&
      refill.equipmentState.getRootInstanceId("delivery") === currentBoat &&
      !refill.assemblyReader.getChild(currentBoat, "cargo", 0) &&
      Boolean(boatReport.warning),
    "returned boat restores its own exact bays even after current delivery changes",
  );

  // Active loose roots remain in INVENTORY custody, but are reserved by the
  // equipment aggregate and must never participate in a merge.
  const custody = makeComposition({
    items: [
      raw("custody-spring", "spring"),
      raw("custody-chum", "chum", 2, {
        rarity: "rare",
        recipe: "custody",
      }),
      raw("custody-safe-chum", "chum", 1, {
        rarity: "rare",
        recipe: "custody",
      }),
      raw("custody-hook-active", "hook"),
      raw("custody-hook-source", "hook"),
      raw("custody-safe-hook", "hook"),
      raw("custody-line-active", "line", 1, {
        rarity: "common",
        statOverrides: { lengthMeters: 5 },
        detachedLineSegment: true,
        sourceLineItemId: "line",
        sourceLineInstanceId: "custody-line-source",
      }),
      raw("custody-line-safe", "line", 1, {
        rarity: "common",
        statOverrides: { lengthMeters: 10 },
      }),
      raw("custody-line-source", "line", 1, {
        rarity: "common",
        statOverrides: { lengthMeters: 20 },
      }),
      raw("custody-line-return", "line", 1, {
        rarity: "common",
        statOverrides: { lengthMeters: 5 },
        detachedLineSegment: true,
        sourceLineItemId: "line",
        sourceLineInstanceId: "custody-line-active",
      }),
    ],
    settings: { autoChum: true },
  });
  const custodySpring = custody.assemblyService.startAssembly(
    "custody-spring",
  );
  custody.assemblyService.attach({
    rootInstanceId: custodySpring,
    sourceInstanceId: "custody-chum",
    slotId: "chum",
    slotIndex: 0,
  });
  const custodyChumEquip = custody.facade.dispatch({
    type: InventoryActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: "custody-chum",
  });
  assertIntegration(
    custodyChumEquip.success === true &&
      custody.equipmentState.getRootInstanceId("handChum") ===
        "custody-chum" &&
      custody.repository.require("custody-chum").quantity === 1,
    "equipping the remainder reserves exactly one hand-chum unit",
  );

  const custodyBeforeRollback = JSON.stringify(
    custody.snapshotFactory.create(),
  );
  let custodyRollbackRaised = false;
  try {
    custody.transaction.runAtomic(() => {
      custody.assemblyService.detach({
        rootInstanceId: custodySpring,
        slotId: "chum",
        slotIndex: 0,
      });
      throw new Error("forced custody rollback");
    });
  } catch (_error) {
    custodyRollbackRaised = true;
  }
  assertIntegration(
    custodyRollbackRaised &&
      JSON.stringify(custody.snapshotFactory.create()) ===
        custodyBeforeRollback &&
      custody.assemblyReader.getChild(custodySpring, "chum", 0) !== null,
    "a failed detach restores repository, assembly and equipment custody",
  );

  const custodyDetachedChum = custody.assemblyService.detach({
    rootInstanceId: custodySpring,
    slotId: "chum",
    slotIndex: 0,
  });
  assertIntegration(
    custody.repository.require("custody-chum").quantity === 1 &&
      custody.equipmentState.getRootInstanceId("handChum") ===
        "custody-chum" &&
      custody.repository.require("custody-safe-chum").quantity === 2 &&
      !custody.repository.has(custodyDetachedChum.detachedInstanceId),
    "detached chum merges only into a safe loose stack, never active hand chum",
  );
  assertIntegration(
    custody.gameplayCommands.consumeEquipped("handChum", 1).success === true &&
      custody.equipmentState.getRootInstanceId("handChum") === null,
    "reserved hand chum still consumes normally",
  );
  const custodyHandRefill = custody.gameplayBridge.handChumUsed();
  const custodyRefilledHandId =
    custody.equipmentState.getRootInstanceId("handChum");
  assertIntegration(
    custodyHandRefill.filled === 1 &&
      custodyRefilledHandId !== null &&
      custody.repository.require(custodyRefilledHandId).quantity === 1 &&
      custody.repository.require("custody-safe-chum").quantity === 1,
    "auto-refill consumes a safe loose unit and preserves the active-root invariant",
  );
  let activeAttachmentBlocked = false;
  try {
    custody.assemblyService.attach({
      rootInstanceId: custodySpring,
      sourceInstanceId: custodyRefilledHandId,
      slotId: "chum",
      slotIndex: 0,
    });
  } catch (error) {
    activeAttachmentBlocked = error?.code === "SOURCE_NOT_AVAILABLE";
  }
  assertIntegration(
    activeAttachmentBlocked &&
      custody.equipmentState.getRootInstanceId("handChum") ===
        custodyRefilledHandId &&
      custody.repository.require(custodyRefilledHandId).quantity === 1,
    "an active root cannot be reused as an assembly source",
  );

  custody.assemblyService.attach({
    rootInstanceId: custodySpring,
    sourceInstanceId: "custody-hook-source",
    slotId: "hook",
    slotIndex: 0,
  });
  custody.equipmentState.setRootInstanceId("tackle", "custody-hook-active");
  const custodyDetachedHook = custody.assemblyService.detach({
    rootInstanceId: custodySpring,
    slotId: "hook",
    slotIndex: 0,
  });
  assertIntegration(
    custody.repository.require("custody-hook-active").quantity === 1 &&
      custody.repository.require("custody-safe-hook").quantity === 2 &&
      !custody.repository.has(custodyDetachedHook.detachedInstanceId),
    "a returned standalone hook cannot merge into the active tackle root",
  );

  custody.equipmentState.setRootInstanceId(
    "terminalLine",
    "custody-line-active",
  );
  const custodyLineRelease = custody.lineAllocationService.release(
    "custody-line-return",
  );
  assertIntegration(
    custodyLineRelease.success === true &&
      custodyLineRelease.merged === true &&
      custody.lineAllocationService.getLengthMeters("custody-line-active") ===
        5 &&
      custody.lineAllocationService.getLengthMeters("custody-line-safe") ===
        15 &&
      !custody.repository.has("custody-line-return"),
    "returned line bypasses the active terminal-line root and merges into a safe spool",
  );
  const activeLineBeforeRelease = JSON.stringify(
    custody.repository.require("custody-line-active"),
  );
  const activeLineRelease = custody.lineAllocationService.release(
    "custody-line-active",
  );
  assertIntegration(
    activeLineRelease.success === false &&
      activeLineRelease.merged === false &&
      activeLineRelease.reserved === true &&
      JSON.stringify(custody.repository.require("custody-line-active")) ===
        activeLineBeforeRelease,
    "releasing an active terminal line is a byte-equivalent no-op",
  );
  custody.equipmentState.clear("terminalLine");
  const unequippedLineRelease = custody.lineAllocationService.release(
    "custody-line-active",
  );
  assertIntegration(
    unequippedLineRelease.success === true &&
      unequippedLineRelease.merged === true &&
      !custody.repository.has("custody-line-active") &&
      custody.lineAllocationService.getLengthMeters("custody-line-source") ===
        25,
    "the same terminal line fully merges after a real unequip unreserves it",
  );

  let corruptEquipmentWarning = "";
  try {
    makeComposition({
      items: [raw("corrupt-active-root", "chum", 2)],
      equipment: {
        ...emptyEquipment(),
        handChum: "corrupt-active-root",
      },
    });
  } catch (error) {
    corruptEquipmentWarning = String(error?.message || error);
  }
  assertIntegration(
    corruptEquipmentWarning.includes("must have quantity 1"),
    "a damaged snapshot with a multi-unit equipment root is rejected explicitly",
  );

  let corruptLoadoutWarning = "";
  try {
    makeComposition({
      items: [raw("corrupt-loadout-root", "rodPole", 2)],
      loadouts: [{
        loadoutId: "corrupt-loadout",
        name: "Corrupt loadout",
        rootInstanceIds: {
          rod: "corrupt-loadout-root",
          reel: null,
          terminalLine: null,
          tackle: null,
          float: null,
        },
      }],
    });
  } catch (error) {
    corruptLoadoutWarning = String(error?.message || error);
  }
  assertIntegration(
    corruptLoadoutWarning.includes("must have quantity 1"),
    "a damaged snapshot with a multi-unit loadout root is rejected explicitly",
  );

  // Injected loadout clock is read only where the original fallback timestamp was created.
  let clockReads = 0;
  let loadoutTime = Date.UTC(2026, 9, 4, 12, 0, 0);
  const loadoutNow = () => { clockReads++; return loadoutTime; };
  const savedCreatedAt = "2021-01-02T03:04:05.000Z";
  const clockRepository = new EquipmentLoadoutRepository({
    now: loadoutNow,
    loadouts: [{ loadoutId: "stored-clock", createdAt: savedCreatedAt }],
  });
  assertIntegration(clockReads === 0 && clockRepository.require("stored-clock").createdAt === savedCreatedAt,
    "restore preserves a stored timestamp without reading the clock");
  const freshClockLoadout = clockRepository.add({ loadoutId: "fresh-clock" });
  assertIntegration(clockReads === 1 && freshClockLoadout.createdAt === new Date(loadoutTime).toISOString() &&
    freshClockLoadout.updatedAt === freshClockLoadout.createdAt, "new loadout reads the injected clock once");
  const clockSnapshot = clockRepository.createSnapshot();
  clockRepository.restoreSnapshot(clockSnapshot);
  assertIntegration(clockReads === 1 && JSON.stringify(clockRepository.createSnapshot()) === JSON.stringify(clockSnapshot),
    "transaction restore preserves timestamp bytes without another clock read");
  clockRepository.restoreSnapshot([{ loadoutId: "missing-clock", createdAt: "", updatedAt: "stored-update" }]);
  assertIntegration(clockReads === 2 && clockRepository.require("missing-clock").updatedAt === "stored-update",
    "missing/falsy createdAt uses the clock while truthy updatedAt stays unchanged");
  const clockFlow = makeComposition({
    items: [raw("clock-rod", "rodPole"), raw("clock-hook", "hook")],
    equipment: { ...emptyEquipment(), rod: "clock-rod", tackle: "clock-hook" },
    now: loadoutNow,
  });
  const clockSaved = dispatch(clockFlow, InventoryActionType.LOADOUT_SAVE, { name: "Clock kit" });
  const createdClockKit = clockFlow.loadouts.require(clockSaved.loadoutId);
  assertIntegration(createdClockKit.createdAt === new Date(loadoutTime).toISOString(),
    "composition passes the same clock through createFromEquipment");
  loadoutTime += 1000;
  const consumedClockHook = clockFlow.gameplayCommands.consumeItem("clock-hook", 1);
  const reconstructedClockKit = clockFlow.loadouts.require(clockSaved.loadoutId);
  assertIntegration(consumedClockHook.success && reconstructedClockKit.createdAt === createdClockKit.createdAt &&
    reconstructedClockKit.updatedAt === new Date(loadoutTime).toISOString(),
    "command reconstruction preserves createdAt and updates the original ISO field using the injected clock");
  const restoredClockFlow = makeComposition({ items: [], loadouts: [reconstructedClockKit.snapshot()], now: loadoutNow });
  assertIntegration(restoredClockFlow.loadouts.require(clockSaved.loadoutId).createdAt === createdClockKit.createdAt,
    "snapshot composition carries clock without rewriting stored dates");

  console.log("Inventory integration checks passed.");
  `,
  context,
  { filename: "inventory-integration-scenarios.js" },
);
