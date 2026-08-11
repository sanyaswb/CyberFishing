const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
const files = [
  "src/config/rarity/rarity_visual_config.js",
  "src/config/inventory/item_assembly_profile_config.js",
  "src/config/inventory/equipment_slot_config.js",
  "src/config/inventory/inventory_v2_sort_config.js",
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
  "src/infrastructure/storage/inventory_v2_state_store.js",
  "src/infrastructure/storage/inventory_v2_legacy_migration.js",
  "src/infrastructure/storage/inventory_v2_snapshot_factory.js",
  "src/infrastructure/storage/inventory_v2_transaction_coordinator.js",
  "src/application/inventory/inventory_v2_transaction_participants.js",
  "src/application/inventory/equipment_transition_executor.js",
  "src/application/inventory/inventory_v2_equipment_transition_port.js",
  "src/application/inventory/loadout_application_service.js",
  "src/application/inventory/inventory_v2_loadout_port.js",
  "src/application/inventory/equipment_projection_service.js",
  "src/application/inventory/equipment_auto_refill_target_provider.js",
  "src/application/inventory/auto_refill_coordinator.js",
  "src/application/inventory/inventory_v2_refill_ports.js",
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
];

for (const file of files) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(
  `
  const assertIntegration = (condition, message) => {
    if (!condition) {
      throw new Error("Inventory-v2 integration check failed: " + message);
    }
  };

  const definitions = Object.freeze({
    rodPole: {
      id: "rodPole",
      name: "Pole rod",
      type: "pole",
      engineStats: {
        type: "pole",
        equipmentCapabilities: {
          supportsReel: false,
          supportsFloat: true,
          supportsFeederRig: false,
          supportsLures: false,
        },
      },
    },
    rodFeeder: {
      id: "rodFeeder",
      name: "Feeder rod",
      type: "feeder",
      engineStats: {
        type: "feeder",
        equipmentCapabilities: {
          supportsReel: true,
          supportsFloat: false,
          supportsFeederRig: true,
          supportsLures: false,
        },
      },
    },
    rodSpinning: {
      id: "rodSpinning",
      name: "Spinning rod",
      type: "spinning",
      engineStats: {
        type: "spinning",
        equipmentCapabilities: {
          supportsReel: true,
          supportsFloat: false,
          supportsFeederRig: false,
          supportsLures: true,
        },
      },
    },
    reel: {
      id: "reel",
      name: "Reel",
      type: "spinning_reel",
      engineStats: {
        type: "spinning_reel",
        assemblyProfileId: "reel_standard",
      },
    },
    line: {
      id: "line",
      name: "Line",
      type: "fishing_line",
      engineStats: { type: "fishing_line", lengthMeters: 100 },
    },
    leader: {
      id: "leader",
      name: "Leader",
      type: "leader_line",
      engineStats: { type: "leader_line" },
    },
    spring: {
      id: "spring",
      name: "Spring",
      type: "feeder_rig",
      engineStats: {
        type: "feeder_rig",
        assemblyProfileId: "feeder_spring_basic",
        hooksCount: 3,
        hasChumSlot: true,
      },
    },
    hook: {
      id: "hook",
      name: "Hook",
      type: "hook",
      engineStats: { type: "hook", assemblyProfileId: "hook_standard" },
    },
    spinner: {
      id: "spinner",
      name: "Spinner",
      type: "spinner",
      engineStats: { type: "spinner" },
    },
    wobbler: {
      id: "wobbler",
      name: "Wobbler",
      type: "wobbler",
      engineStats: { type: "wobbler" },
    },
    bait: {
      id: "bait",
      name: "Bait",
      type: "bait",
      engineStats: { type: "bait" },
    },
    chum: {
      id: "chum",
      name: "Chum",
      type: "chum_mix",
      engineStats: { type: "chum_mix" },
    },
    boat: {
      id: "boat",
      name: "Bait boat",
      type: "boat",
      engineStats: {
        type: "boat",
        assemblyProfileId: "bait_boat",
        sections: 3,
      },
    },
    floatDay: {
      id: "floatDay",
      name: "Day float",
      type: "day",
      engineStats: { type: "day" },
    },
    net: {
      id: "net",
      name: "Net",
      type: "net",
      engineStats: { type: "net" },
    },
  });

  const inventoryLocation = () => ({ kind: "INVENTORY" });
  const raw = (instanceId, itemId, quantity = 1, extra = {}) => ({
    instanceId,
    itemId,
    type: definitions[itemId]?.type || null,
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
        persisted = JSON.parse(JSON.stringify(value));
      },
    };
    return InventoryV2CompositionRoot.compose({
      cache,
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
  dispatch(cardInspection, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "inspect-pole",
  });
  cardInspection.equipmentState.setRootInstanceId("tackle", "inspect-hook");
  cardInspection.equipmentState.setRootInstanceId("float", "inspect-float");
  dispatch(cardInspection, InventoryV2ActionType.EQUIPMENT_SLOT_ACTIVATE, {
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
  dispatch(cardInspection, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
  dispatch(cardInspection, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: "inspect-reel",
  });
  dispatch(cardInspection, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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

  dispatch(compatibleFiltering, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
  dispatch(compatibleFiltering, InventoryV2ActionType.CATEGORY_SELECT, {
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
  dispatch(compatibleFiltering, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "compatible-net",
  });
  assertIntegration(
    compatibleFiltering.commands.getUiState().activeCategoryId ===
      "compatible",
    "equipping a separate auxiliary item reactivates Compatible",
  );
  const compatibleHookRoot = dispatch(
    compatibleFiltering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "compatible-hook" },
  ).rootInstanceId;
  dispatch(compatibleFiltering, InventoryV2ActionType.ASSEMBLY_EQUIP, {
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
  dispatch(highlightedSelection, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "highlight-rod",
  });
  dispatch(highlightedSelection, InventoryV2ActionType.EQUIPMENT_SLOT_ACTIVATE, {
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
  dispatch(highlightedSelection, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "highlight-float",
  });
  assertIntegration(
    highlightedSelection.equipmentState.getRootInstanceId("float") !== null &&
      highlightedSelection.commands.getUiState().highlightedEquipmentSlotId === null,
    "activating a highlighted compatible card equips it and clears selection",
  );

  const directLureEquipment = makeComposition({
    items: [
      raw("lure-rod", "rodSpinning"),
      raw("lure-spinner", "spinner"),
      raw("lure-wobbler", "wobbler"),
    ],
  });
  dispatch(directLureEquipment, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "lure-rod",
  });
  dispatch(directLureEquipment, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "lure-spinner",
  });
  assertIntegration(
    directLureEquipment.equipmentState.getRootInstanceId("tackle") ===
      "lure-spinner" &&
      directLureEquipment.projectionService.project(
        directLureEquipment.equipmentState,
      ).baits[0]?.instanceId === "lure-spinner",
    "a non-composite spinner equips without requesting assembly slots",
  );
  dispatch(directLureEquipment, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "lure-wobbler",
  });
  assertIntegration(
    directLureEquipment.equipmentState.getRootInstanceId("tackle") ===
      "lure-wobbler" &&
      directLureEquipment.projectionService.project(
        directLureEquipment.equipmentState,
      ).baits[0]?.instanceId === "lure-wobbler",
    "a non-composite wobbler replaces another lure and remains projectable",
  );

  const presentationEnrichment = makeComposition({
    items: [raw("presentation-line", "line", 1, { lengthMeters: 62 })],
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
    "Inventory V2 preserves legacy hover parameters and line-capacity progression",
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
  dispatch(subtypeFiltering, InventoryV2ActionType.SUBFILTER_TOGGLE, {
    filterId: "fishing-lines",
    enabled: true,
  });
  assertIntegration(
    subtypeFiltering.facade.getViewModel().inventory.items.length === 1 &&
      subtypeFiltering.facade.getViewModel().inventory.items[0].instanceId ===
        "filter-line",
    "one selected subtype filters the inventory",
  );
  dispatch(subtypeFiltering, InventoryV2ActionType.SUBFILTER_TOGGLE, {
    filterId: "leaders",
    enabled: true,
  });
  assertIntegration(
    subtypeFiltering.facade.getViewModel().inventory.items.length === 2,
    "multiple subtype filters combine with OR semantics",
  );
  dispatch(subtypeFiltering, InventoryV2ActionType.CATEGORY_SELECT, {
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
  dispatch(contextualFiltering, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "context-rod",
  });
  dispatch(contextualFiltering, InventoryV2ActionType.CATEGORY_SELECT, {
    categoryId: "reels",
  });
  const contextReelRoot = dispatch(
    contextualFiltering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-reel" },
  ).rootInstanceId;
  const reelContextView = contextualFiltering.facade.getViewModel().inventory;
  assertIntegration(
    reelContextView.items.length === 1 &&
      reelContextView.items[0].instanceId === "context-line" &&
      reelContextView.categories.map((category) => category.id).join(",") ===
        "all,lines",
    "an open reel shows only line candidates and ignores an obsolete category",
  );
  dispatch(contextualFiltering, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextReelRoot,
  });
  dispatch(contextualFiltering, InventoryV2ActionType.CATEGORY_SELECT, {
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
  dispatch(contextualFiltering, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "context-hooks",
  });
  dispatch(contextualFiltering, InventoryV2ActionType.ASSEMBLY_SOCKET_ACTIVATE, {
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
    nestedSpringCandidates.has("context-bait") &&
      nestedSpringCandidates.has("context-hooks") &&
      nestedSpringCandidates.has("context-chum"),
    "adding a hook automatically exposes bait through the same nested-slot resolver",
  );
  dispatch(contextualFiltering, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextSpringRoot,
  });

  const contextHookRoot = dispatch(
    contextualFiltering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-hooks" },
  ).rootInstanceId;
  const hookCandidateIds = contextualFiltering.facade
    .getViewModel()
    .inventory.items.map((item) => item.instanceId);
  assertIntegration(
    hookCandidateIds.length === 1 && hookCandidateIds[0] === "context-bait",
    "a standalone hook editor shows only bait",
  );
  dispatch(contextualFiltering, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextHookRoot,
  });

  const contextBoatRoot = dispatch(
    contextualFiltering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "context-boat" },
  ).rootInstanceId;
  const boatCandidateIds = contextualFiltering.facade
    .getViewModel()
    .inventory.items.map((item) => item.instanceId);
  assertIntegration(
    boatCandidateIds.length === 1 && boatCandidateIds[0] === "context-chum",
    "a boat editor shows only cargo accepted by its sections",
  );
  dispatch(contextualFiltering, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: contextBoatRoot,
  });

  const inventoryOrdering = makeComposition({
    items: [
      raw("sort-bait", "bait", 1, {
        rarity: "common",
        engineStats: { level: 2, power: 2 },
      }),
      raw("sort-wobbler", "wobbler", 1, {
        rarity: "rare",
        engineStats: { level: 5, power: 4 },
      }),
      raw("sort-reel", "reel", 1, {
        rarity: "epic",
        engineStats: { level: 4, power: 3 },
      }),
      raw("sort-hook", "hook", 1, {
        rarity: "legendary",
        engineStats: { level: 1, power: 8 },
      }),
      raw("sort-rod", "rodPole", 1, {
        rarity: "uncommon",
        engineStats: { level: 3, power: 1 },
      }),
    ],
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
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "rarity" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-bait,sort-wobbler,sort-reel,sort-hook,sort-rod",
    "reselecting the only active criterion restores stable inventory order",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "type" },
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_DIRECTION_SELECT,
    { directionId: "ascending" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-rod,sort-reel,sort-hook,sort-wobbler,sort-bait",
    "type sorting follows the configured rod-to-consumable order",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "type" },
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "rarity" },
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_DIRECTION_SELECT,
    { directionId: "descending" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-hook,sort-reel,sort-wobbler,sort-rod,sort-bait",
    "rarity sorting supports highest-to-lowest direction",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "level" },
  );
  const rarityThenLevel = inventoryOrdering.facade.getViewModel().inventory.sort;
  assertIntegration(
    rarityThenLevel.criterionIds.join(",") === "rarity,level" &&
      rarityThenLevel.criteria.find((criterion) => criterion.id === "rarity")
        ?.priority === 1 &&
      rarityThenLevel.criteria.find((criterion) => criterion.id === "level")
        ?.priority === 2,
    "additional criteria are appended and expose their sorting priority",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "rarity" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-wobbler,sort-reel,sort-rod,sort-bait,sort-hook",
    "level sorting uses stable numeric gameplay values",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "power" },
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "level" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-hook,sort-wobbler,sort-reel,sort-bait,sort-rod",
    "power sorting uses stable progression or EngineStats values",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.SORT_DIRECTION_SELECT,
    { directionId: "ascending" },
  );
  assertIntegration(
    orderedIds() ===
      "sort-rod,sort-bait,sort-reel,sort-wobbler,sort-hook",
    "sort direction can be reversed without changing the criterion",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.RARITY_FILTER_TOGGLE,
    { rarityId: "rare", enabled: true },
  );
  assertIntegration(
    orderedIds() === "sort-wobbler",
    "rarity square filters inventory independently from sorting",
  );
  dispatch(
    inventoryOrdering,
    InventoryV2ActionType.RARITY_FILTER_TOGGLE,
    { rarityId: "rare", enabled: false },
  );

  const chainedOrdering = makeComposition({
    items: [
      raw("multi-rare-low", "hook", 1, {
        rarity: "rare",
        engineStats: { level: 2 },
      }),
      raw("multi-common-high", "hook", 1, {
        rarity: "common",
        engineStats: { level: 9 },
      }),
      raw("multi-rare-high", "hook", 1, {
        rarity: "rare",
        engineStats: { level: 8 },
      }),
      raw("multi-epic-low", "hook", 1, {
        rarity: "epic",
        engineStats: { level: 1 },
      }),
    ],
  });
  dispatch(
    chainedOrdering,
    InventoryV2ActionType.SORT_CRITERION_SELECT,
    { criterionId: "level" },
  );
  assertIntegration(
    chainedOrdering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId)
      .join(",") ===
      "multi-epic-low,multi-rare-high,multi-rare-low,multi-common-high",
    "secondary level sorting orders items inside the same rarity",
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-spring" },
  ).rootInstanceId;
  stablePlacementOrdering.facade.getViewModel();
  dispatch(
    stablePlacementOrdering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  dispatch(
    stablePlacementOrdering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  assertIntegration(
    stablePlacementOrdering.facade
      .getViewModel()
      .inventory.items.map((item) => item.instanceId)
      .join(",") === "stable-hooks,stable-bait",
    "newly compatible bait appears after the placement source instead of moving it",
  );
  dispatch(
    stablePlacementOrdering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  dispatch(
    stablePlacementOrdering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "stable-hooks" },
  );
  dispatch(
    stablePlacementOrdering,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
        .join(",") === "stable-bait,stable-hooks",
    "normal rarity sorting resumes after all compatible empty cells are filled",
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "rapid-boat" },
  ).rootInstanceId;
  const firstCargoSelection = dispatch(
    repeatedSocketPlacement,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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

  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "hook-stack" },
  ).rootInstanceId;
  assertIntegration(
    flow.assemblyStates.require(hookDraft).isDraft,
    "new hook assembly starts as draft",
  );
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "bait-stack",
  });
  const completedHookEditor = flow.facade.getViewModel().panel.assembly;
  assertIntegration(
    completedHookEditor.showDisassemble === true &&
      completedHookEditor.showEquip === true &&
      completedHookEditor.showUnequip === false &&
      completedHookEditor.root.assemblyCompletion.isComplete === true &&
      completedHookEditor.root.assemblyCompletion.hasAnyComponent === true,
    "an unequipped assembly with an attached component exposes Disassemble",
  );
  dispatch(flow, InventoryV2ActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: hookDraft,
  });
  assertIntegration(
    flow.assemblyStates.require(hookDraft).isPrepared &&
      flow.equipmentState.getRootInstanceId("tackle") === hookDraft,
    "hook becomes prepared and equipped",
  );
  dispatch(flow, InventoryV2ActionType.EQUIPMENT_SLOT_ACTIVATE, {
    slotId: "tackle",
  });
  assertIntegration(
    flow.commands.getUiState().panelMode === "assembly" &&
      flow.facade.getViewModel().panel.assembly.showUnequip === true &&
      flow.facade.getViewModel().panel.assembly.showEquip === false,
    "short press on active prepared stack opens its editor",
  );
  dispatch(flow, InventoryV2ActionType.ASSEMBLY_UNEQUIP, {
    rootInstanceId: hookDraft,
  });

  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "feeder-rod",
  });
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
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "spring-stack" },
  ).rootInstanceId;
  const chooseHookSlot = dispatch(
    flow,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: hookDraft },
  );
  assertIntegration(
    chooseHookSlot.requiresSocketChoice === true,
    "three hook sockets require an explicit target",
  );
  dispatch(flow, InventoryV2ActionType.ASSEMBLY_SOCKET_ACTIVATE, {
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
  dispatch(flow, InventoryV2ActionType.ASSEMBLY_BACK, {
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
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: springDraft,
  });
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "chum-stack",
  });
  dispatch(flow, InventoryV2ActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: springDraft,
  });

  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "chum-stack",
  });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("handChum") !== null,
    "loose chum equips into the separate hand-chum slot",
  );

  const boatRoot = dispatch(
    flow,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "boat-one" },
  ).rootInstanceId;
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "chum-stack",
  });
  dispatch(flow, InventoryV2ActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: boatRoot,
  });
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "net-one",
  });

  const header = flow.facade.getViewModel().header.activeTackle;
  assertIntegration(
    header.baits.length === 1 && header.chums.length === 1,
    "top indicators show only bait and chum nested in active tackle (baits=" +
      header.baits.length +
      ", chums=" +
      header.chums.length +
      ")",
  );

  const saved = dispatch(flow, InventoryV2ActionType.LOADOUT_SAVE, {
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
  dispatch(flow, InventoryV2ActionType.CATEGORY_SELECT, {
    categoryId: "all",
  });
  assertIntegration(
    flow.facade
      .getViewModel()
      .inventory.items.filter((item) => item.type === "equipment_loadout")
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
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: saved.loadoutId,
  });
  const savedPreview = flow.facade.getViewModel();
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === null &&
      flow.commands.getUiState().viewingLoadoutId === saved.loadoutId &&
      savedPreview.panel.mode === "loadout" &&
      savedPreview.inventory.mode === "saved-loadout" &&
      savedPreview.inventory.savedLoadout.slots.every((slot) => slot.item),
    "short press opens only the saved loadout contents on the right without equipping it",
  );
  dispatch(flow, InventoryV2ActionType.LOADOUT_PREVIEW_BACK, {
    loadoutId: saved.loadoutId,
  });
  assertIntegration(
    flow.commands.getUiState().viewingLoadoutId === null &&
      flow.equipmentState.getRootInstanceId("tackle") === null,
    "Back closes saved loadout contents without equipping anything",
  );
  dispatch(flow, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: saved.loadoutId,
  });
  dispatch(flow, InventoryV2ActionType.LOADOUT_PREVIEW_SLOT_EQUIP, {
    loadoutId: saved.loadoutId,
    slotId: "tackle",
  });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === springDraft &&
      flow.commands.getUiState().viewingLoadoutId === saved.loadoutId,
    "a saved loadout root can be equipped separately while its contents stay open",
  );
  flow.equipmentState.clear("tackle");
  dispatch(flow, InventoryV2ActionType.LOADOUT_EQUIP_ALL, {
    loadoutId: saved.loadoutId,
  });
  assertIntegration(
    flow.equipmentState.getRootInstanceId("tackle") === springDraft &&
      flow.commands.getUiState().viewingLoadoutId === null,
    "Equip all restores the complete saved loadout and closes its contents",
  );

  dispatch(flow, InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS, {
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
    dispatch(flow, InventoryV2ActionType.LOADOUT_PREVIEW_SLOT_EQUIP, {
      loadoutId: saved.loadoutId,
      slotId: "rod",
    });
    dispatch(flow, InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS, {
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
    flow.commands.consumeItem(springDraft, 1).success === true &&
      flow.loadouts.has(saved.loadoutId) &&
      flow.commands.consumeItem(remainingLoadoutRod, 1).success === true &&
      !flow.loadouts.has(saved.loadoutId),
    "consuming every loadout root removes the empty loadout card",
  );

  const looseStackCycles = makeComposition({
    items: [raw("stacked-pole-rods", "rodPole", 2)],
  });
  const looseStackInitialSize = looseStackCycles.repository.size;
  for (let cycle = 0; cycle < 3; cycle += 1) {
    dispatch(looseStackCycles, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
      instanceId: "stacked-pole-rods",
    });
    dispatch(looseStackCycles, InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS, {
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
    InventoryV2ActionType.LOADOUT_SAVE,
    { name: "Disassembly kit" },
  ).loadoutId;
  const activeDisassemblyAttempt = disassembly.facade.dispatch({
    type: InventoryV2ActionType.ASSEMBLY_DISASSEMBLE,
    rootInstanceId: disassemblySpring,
  });
  assertIntegration(
    activeDisassemblyAttempt.success === false &&
      disassembly.equipmentState.getRootInstanceId("tackle") ===
        disassemblySpring &&
      disassembly.assemblyStates.has(disassemblySpring),
    "an equipped stack must be unequipped before it can be disassembled",
  );
  dispatch(disassembly, InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS, {
    slotId: "tackle",
    instanceId: disassemblySpring,
  });
  dispatch(disassembly, InventoryV2ActionType.ASSEMBLY_DISASSEMBLE, {
    rootInstanceId: disassemblySpring,
  });
  assertIntegration(
    disassembly.loadouts.has(disassemblyLoadoutId) &&
      disassembly.loadouts
        .require(disassemblyLoadoutId)
        .getRootInstanceId("rod") === "disassembly-rod" &&
      disassembly.loadouts
        .require(disassemblyLoadoutId)
        .getRootInstanceId("tackle") === null &&
      disassembly.repository.require("disassembly-rod").location.kind ===
        "LOADOUT" &&
      !disassembly.assemblyStates.has(disassemblySpring) &&
      disassembly.equipmentState.getRootInstanceId("tackle") === null,
    "disassembling an unequipped stack updates its loadout without destroying the other roots",
  );
  dispatch(disassembly, InventoryV2ActionType.LOADOUT_DISASSEMBLE, {
    loadoutId: disassemblyLoadoutId,
  });
  assertIntegration(
    !disassembly.loadouts.has(disassemblyLoadoutId) &&
      disassembly.repository.require("disassembly-rod").location.kind ===
        "INVENTORY",
    "the loadout preview Disassemble command releases its remaining contents",
  );

  // A loadout transition must return loose pole-line segments to their exact
  // source spool, and disassembly must do the same for its contained segment.
  const lineLoadout = makeComposition({
    items: [
      raw("line-kit-rod", "rodPole", 1, {
        engineStats: { lengthMeters: 4 },
      }),
      raw("loose-rod", "rodPole", 1, {
        engineStats: { lengthMeters: 4 },
      }),
      raw("line-kit-source", "line", 1, { lengthMeters: 25 }),
      raw("loose-line-source", "line", 1, { lengthMeters: 25 }),
      raw("line-kit-float", "floatDay"),
    ],
  });
  dispatch(lineLoadout, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "line-kit-rod",
  });
  const loadoutLineSegment = dispatch(
    lineLoadout,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "line-kit-source" },
  ).equippedInstanceId;
  dispatch(lineLoadout, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "line-kit-float",
  });
  const lineLoadoutId = dispatch(
    lineLoadout,
    InventoryV2ActionType.LOADOUT_SAVE,
    { name: "Pole line kit" },
  ).loadoutId;
  dispatch(lineLoadout, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "loose-rod",
  });
  const looseLineSegment = dispatch(
    lineLoadout,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "loose-line-source" },
  ).equippedInstanceId;
  assertIntegration(
    lineMeters(lineLoadout, looseLineSegment) === 8 &&
      lineMeters(lineLoadout, "loose-line-source") === 17,
    "pole line is split into the exact active segment before loadout swap",
  );
  dispatch(lineLoadout, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: lineLoadoutId,
  });
  assertIntegration(
    lineLoadout.commands.getUiState().viewingLoadoutId === lineLoadoutId &&
      lineLoadout.equipmentState.getRootInstanceId("terminalLine") ===
        looseLineSegment,
    "short loadout press opens its contents without changing active equipment",
  );
  dispatch(lineLoadout, InventoryV2ActionType.LOADOUT_EQUIP_ALL, {
    loadoutId: lineLoadoutId,
  });
  assertIntegration(
    !lineLoadout.repository.has(looseLineSegment) &&
      lineMeters(lineLoadout, "loose-line-source") === 25 &&
      lineLoadout.equipmentState.getRootInstanceId("terminalLine") ===
        loadoutLineSegment,
    "equipping a loadout merges the outgoing terminal-line segment back to exactly 25m",
  );
  dispatch(lineLoadout, InventoryV2ActionType.INVENTORY_ITEM_LONG_PRESS, {
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
      raw("rollback-source", "line", 1, { lengthMeters: 17 }),
      raw("rollback-segment", "line", 1, {
        lengthMeters: 8,
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
  const rollbackTransaction = new InventoryV2TransactionCoordinator({
    participants: [rollbackRepository, rollbackEquipment, rollbackLoadouts],
  });
  const rollbackPort = new InventoryV2LoadoutPort({
    repository: rollbackRepository,
    loadouts: rollbackLoadouts,
    transaction: rollbackTransaction,
    lineAllocationService: {
      release() {
        rollbackRepository.update("rollback-source", { lengthMeters: 999 });
        throw new Error("forced terminal-line cleanup failure");
      },
    },
  });
  const rollbackService = new LoadoutApplicationService({
    port: rollbackPort,
    capacityPolicy: new UnlimitedInventoryCapacityPolicy(),
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
      rollbackRepository.require("rollback-source").lengthMeters === 17 &&
      rollbackRepository.require("rollback-segment").detachedLineSegment ===
        true &&
      rollbackLoadouts.has("rollback-kit"),
    "terminal-line cleanup failure rolls repository, equipment and loadout custody back",
  );

  // Winding a raw reel is rod-independent. Rod compatibility is checked only
  // when that prepared reel is equipped.
  const contextualActivation = makeComposition({
    items: [
      raw("activation-rod", "rodFeeder", 1, {
        engineStats: { lengthMeters: 2 },
      }),
      raw("activation-reel", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
      }),
      raw("activation-line", "line", 1, { lengthMeters: 10 }),
      raw("activation-empty-reel", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
      }),
    ],
  });
  dispatch(contextualActivation, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "activation-rod",
  });
  const completeReelRoot = dispatch(
    contextualActivation,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "activation-reel" },
  ).rootInstanceId;
  dispatch(contextualActivation, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "activation-line",
  });
  dispatch(contextualActivation, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: completeReelRoot,
  });
  dispatch(contextualActivation, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: completeReelRoot,
  });
  assertIntegration(
    contextualActivation.equipmentState.getRootInstanceId("reel") ===
      completeReelRoot &&
      contextualActivation.commands.getUiState().panelMode === "loadout",
    "a complete compatible assembly equips immediately without opening its card",
  );
  dispatch(contextualActivation, InventoryV2ActionType.ASSEMBLY_UNEQUIP, {
    rootInstanceId: completeReelRoot,
  });
  const emptyPreparedReel = dispatch(
    contextualActivation,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "activation-empty-reel" },
  ).rootInstanceId;
  dispatch(contextualActivation, InventoryV2ActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: emptyPreparedReel,
  });
  dispatch(contextualActivation, InventoryV2ActionType.ASSEMBLY_UNEQUIP, {
    rootInstanceId: emptyPreparedReel,
  });
  dispatch(contextualActivation, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
      raw("raw-reel-no-rod", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
      }),
      raw("raw-line-no-rod", "line", 1, { lengthMeters: 25 }),
    ],
  });
  const reelWithoutRodRoot = dispatch(
    reelWithoutRod,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "raw-reel-no-rod" },
  ).rootInstanceId;
  dispatch(reelWithoutRod, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
      raw("active-pole-for-reel", "rodPole", 1, {
        engineStats: { lengthMeters: 4 },
      }),
      raw("raw-reel-with-pole", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
      }),
      raw("raw-line-with-pole", "line", 1, { lengthMeters: 25 }),
    ],
  });
  dispatch(reelWithPoleActive, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "active-pole-for-reel",
  });
  const reelWithPoleRoot = dispatch(
    reelWithPoleActive,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
  dispatch(reelWithPoleActive, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
      raw("short-reel-rod", "rodFeeder", 1, {
        engineStats: { lengthMeters: 2 },
      }),
      raw("long-reel-rod", "rodFeeder", 1, {
        engineStats: { lengthMeters: 4 },
      }),
      raw("prepared-short-reel", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
      }),
      raw("short-reel-line", "line", 1, { lengthMeters: 5 }),
    ],
  });
  dispatch(changedRodReel, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "short-reel-rod",
  });
  const preparedShortReel = dispatch(
    changedRodReel,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "prepared-short-reel" },
  ).rootInstanceId;
  dispatch(changedRodReel, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "short-reel-line",
  });
  dispatch(changedRodReel, InventoryV2ActionType.ASSEMBLY_EQUIP, {
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
  dispatch(changedRodReel, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "long-reel-rod",
  });
  const rejectedPreparedReel = changedRodReel.facade.dispatch({
    type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
      raw("draft-long-rod", "rodFeeder", 1, {
        engineStats: { lengthMeters: 4 },
      }),
      raw("draft-short-reel", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
      }),
      raw("draft-short-line", "line", 1, { lengthMeters: 5 }),
    ],
  });
  dispatch(draftReelRollback, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "draft-long-rod",
  });
  const draftShortReel = dispatch(
    draftReelRollback,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "draft-short-reel" },
  ).rootInstanceId;
  dispatch(draftReelRollback, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "draft-short-line",
  });
  const rejectedDraftReel = draftReelRollback.facade.dispatch({
    type: InventoryV2ActionType.ASSEMBLY_EQUIP,
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
        engineStats: { lengthMeters: 4 },
        location: InventoryItemLocation.loadout("invalid-line-kit", "rod"),
      }),
      raw("invalid-kit-reel", "reel", 1, {
        engineStats: { lineCapacityMeters: 20 },
        location: InventoryItemLocation.loadout("invalid-line-kit", "reel"),
      }),
      raw("invalid-kit-line", "line", 1, {
        lengthMeters: 5,
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
    type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: "invalid-line-kit",
  });
  const invalidLoadoutResult = invalidLoadout.facade.dispatch({
    type: InventoryV2ActionType.LOADOUT_EQUIP_ALL,
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
  dispatch(emptyStack, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "empty-feeder-rod",
  });
  const emptySpringRoot = dispatch(
    emptyStack,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "empty-spring" },
  ).rootInstanceId;
  dispatch(emptyStack, InventoryV2ActionType.ASSEMBLY_BACK, {
    rootInstanceId: emptySpringRoot,
  });
  assertIntegration(
    emptyStack.assemblyStates.require(emptySpringRoot).isDraft &&
      emptyStack.equipmentState.getRootInstanceId("tackle") === null,
    "leaving the editor preserves an unfinished draft in inventory",
  );
  dispatch(emptyStack, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
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
  dispatch(emptyStack, InventoryV2ActionType.ASSEMBLY_EQUIP, {
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
        ?.item?.assemblyCompletion?.isComplete === false &&
      emptyStack.gameplayBridge.evaluateBiteReadiness().canBite === false &&
      emptyStack.gameplayBridge.evaluateChumBonus().hasBonus === false,
    "completely empty feeder stack can equip but has no bite or chum bonus",
  );

  // Empty reel is equippable, but casting and leader readiness remain guarded.
  const readiness = makeComposition({
    items: [
      raw("ready-rod", "rodFeeder"),
      raw("ready-reel", "reel"),
      raw("ready-leader", "leader"),
    ],
  });
  dispatch(readiness, InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE, {
    instanceId: "ready-rod",
  });
  const emptyReelRoot = dispatch(
    readiness,
    InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    { instanceId: "ready-reel" },
  ).rootInstanceId;
  dispatch(readiness, InventoryV2ActionType.ASSEMBLY_EQUIP, {
    rootInstanceId: emptyReelRoot,
  });
  dispatch(readiness, InventoryV2ActionType.EQUIPMENT_SLOT_ACTIVATE, {
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
  dispatch(readiness, InventoryV2ActionType.ASSEMBLY_BACK, {
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
    type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
      refill.commands.consumeEquipped("baits_" + index, 1).success === true,
      "bait " + index + " is consumed",
    );
  }
  assertIntegration(
    refill.commands.consumeEquipped("feederChum", 1).success === true,
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
    type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
    instanceId: "hand-chum",
  });
  assertIntegration(handEquip.success === true, "hand chum equips");
  const firstHandChumId = refill.equipmentState.getRootInstanceId("handChum");
  assertIntegration(
    refill.commands.consumeEquipped("handChum", 1).success === true &&
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
      refill.commands.consumeEquipped("deliveryChums_" + index, 1).success ===
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
        lengthMeters: 5,
        detachedLineSegment: true,
        sourceLineItemId: "line",
        sourceLineInstanceId: "custody-line-source",
      }),
      raw("custody-line-safe", "line", 1, {
        rarity: "common",
        lengthMeters: 10,
      }),
      raw("custody-line-source", "line", 1, {
        rarity: "common",
        lengthMeters: 20,
      }),
      raw("custody-line-return", "line", 1, {
        rarity: "common",
        lengthMeters: 5,
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
    type: InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
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
    custody.commands.consumeEquipped("handChum", 1).success === true &&
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

  console.log("Inventory-v2 integration checks passed.");
  `,
  context,
  { filename: "inventory-v2-integration-scenarios.js" },
);
