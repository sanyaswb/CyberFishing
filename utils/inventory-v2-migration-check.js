const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
const files = [
  "src/config/inventory/item_assembly_profile_config.js",
  "src/config/inventory/equipment_slot_config.js",
  "src/core/inventory/inventory_item_location.js",
  "src/core/inventory/flat_inventory_item_repository.js",
  "src/core/inventory/item_assembly_stacking_policy.js",
  "src/core/inventory/unlimited_assembly_capacity_policy.js",
  "src/core/assemblies/assembly_state.js",
  "src/core/assemblies/assembly_state_repository.js",
  "src/core/assemblies/assembly_profile_registry.js",
  "src/core/assemblies/item_assembly_reader.js",
  "src/core/assemblies/exact_assembly_refill_signature_policy.js",
  "src/core/assemblies/item_assembly_service.js",
  "src/core/equipment/rod_capability_resolver.js",
  "src/core/equipment/equipment_state.js",
  "src/core/loadouts/equipment_loadout.js",
  "src/core/loadouts/equipment_loadout_repository.js",
  "src/infrastructure/storage/legacy_inventory_unit_allocator.js",
  "src/infrastructure/storage/inventory_v2_state_store.js",
  "src/infrastructure/storage/inventory_v2_legacy_migration.js",
];
for (const file of files) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(
  `
  const definitions = {
    rod: { id: "rod", type: "feeder", engineStats: { type: "feeder", equipmentCapabilities: { supportsReel: true, supportsFloat: false, supportsFeederRig: true, supportsLures: false } } },
    spinRod: { id: "spinRod", type: "spinning", engineStats: { type: "spinning", equipmentCapabilities: { supportsReel: true, supportsFloat: false, supportsFeederRig: false, supportsLures: true } } },
    floatRod: { id: "floatRod", type: "float", engineStats: { type: "float", equipmentCapabilities: { supportsReel: false, supportsFloat: true, supportsFeederRig: false, supportsLures: false } } },
    poleRod: { id: "poleRod", type: "pole", engineStats: { type: "pole", equipmentCapabilities: { supportsReel: false, supportsFloat: true, supportsFeederRig: false, supportsLures: false } } },
    reel: { id: "reel", type: "spinning_reel", engineStats: { type: "spinning_reel", assemblyProfileId: "reel_standard" } },
    line: { id: "line", type: "fishing_line", engineStats: { type: "fishing_line" } },
    line_test_1: { id: "line_test_1", type: "fishing_line", engineStats: { type: "fishing_line", lengthMeters: 25 } },
    leader: { id: "leader", type: "leader_line", engineStats: { type: "leader_line" } },
    spring: { id: "spring", type: "feeder_rig", engineStats: { type: "feeder_rig", assemblyProfileId: "feeder_spring_basic", hooksCount: 2, hasChumSlot: true } },
    hook: { id: "hook", type: "hook", engineStats: { type: "hook", assemblyProfileId: "hook_standard" } },
    bait: { id: "bait", type: "bait", engineStats: { type: "bait" } },
    lure: { id: "lure", type: "lure", engineStats: { type: "lure" } },
    chum: { id: "chum", type: "chum_mix", engineStats: { type: "chum_mix" } },
    net: { id: "net", type: "net", engineStats: { type: "net" } },
    boat: { id: "boat", type: "boat", engineStats: { type: "boat", assemblyProfileId: "bait_boat", sections: 2 } },
  };
  let sequence = 0;
  const migration = new InventoryV2LegacyMigration({
    itemDefinitionResolver: (itemId) => definitions[itemId] || null,
    instanceIdFactory: (source) => source.instanceId + "~split-" + (++sequence),
  });
  globalThis.migrationResult = migration.migrate({
    legacyItems: [
      { instanceId: "build-a", itemId: "sys_build_box", buildName: "Фідер" },
      { instanceId: "rod-1", itemId: "rod", buildId: "build-a" },
      { instanceId: "reel-1", itemId: "reel", buildId: "build-a" },
      { instanceId: "line-1", itemId: "line", buildId: "build-a", lengthMeters: 20 },
      { instanceId: "leader-1", itemId: "leader", buildId: "build-a" },
      { instanceId: "spring-1", itemId: "spring", buildId: "build-a" },
      { instanceId: "hook-stack", itemId: "hook", buildId: "build-a", quantity: 2 },
      { instanceId: "bait-stack", itemId: "bait", quantity: 2 },
      { instanceId: "chum-stack", itemId: "chum", quantity: 3 },
      { instanceId: "net-1", itemId: "net", buildId: "build-a" },
      { instanceId: "boat-1", itemId: "boat", buildId: "build-a" },
    ],
    legacyEquipment: {
      rodId: "rod-1",
      reelId: "reel-1",
      lineId: "line-1",
      leaderId: "leader-1",
      feederRigId: "spring-1",
      hooks: ["hook-stack", "hook-stack"],
      baits: ["bait-stack", "bait-stack"],
      feederChumId: "chum-stack",
      netId: "net-1",
      deliveryId: "boat-1",
      deliveryChums: ["chum-stack", "chum-stack"],
    },
  });
  `,
  context,
);

const snapshot = context.migrationResult.snapshot;
const assert = (condition, message) => {
  if (!condition) throw new Error(`Inventory-v2 migration check failed: ${message}`);
};
const byId = new Map(snapshot.items.map((item) => [item.instanceId, item]));
const loadout = snapshot.loadouts[0];

assert(snapshot.schemaVersion === 2, "schema version is 2");
assert(snapshot.loadouts.length === 1, "legacy build becomes one loadout");
assert(loadout.rootInstanceIds.net === undefined, "net is excluded from loadout");
assert(loadout.rootInstanceIds.delivery === undefined, "boat is excluded from loadout");
assert(snapshot.equipment.net === "net-1", "active net stays auxiliary equipment");
assert(snapshot.equipment.delivery === "boat-1", "active boat stays auxiliary equipment");
assert(
  snapshot.items.every((item) => !item.buildId && item.itemId !== "sys_build_box"),
  "legacy build metadata is removed",
);
assert(
  snapshot.items.filter((item) => item.location.kind === "ATTACHED" && item.location.slotId === "hook").length === 2,
  "two hook units are attached",
);
assert(
  snapshot.items.filter((item) => item.location.kind === "ATTACHED" && item.location.slotId === "bait").length === 2,
  "two bait units are attached",
);
assert(
  snapshot.items.filter((item) => item.location.kind === "ATTACHED" && item.location.slotId === "cargo").length === 2,
  "two boat cargo bays are restored",
);
assert(
  [...byId.values()].filter((item) => item.itemId === "chum" && item.location.kind === "INVENTORY").reduce((sum, item) => sum + item.quantity, 0) === 0,
  "three chum units are allocated to tackle and boat",
);
assert(
  snapshot.assemblies.every((assembly) => assembly.status === "PREPARED"),
  "legacy composites migrate as prepared",
);

vm.runInContext(
  `
  const runRegressionMigration = (
    legacyItems,
    legacyEquipment = {},
    settings = {},
  ) => migration.migrate({ legacyItems, legacyEquipment, settings });

  globalThis.migrationRegressions = {
    partialFeeder: runRegressionMigration(
      [
        { instanceId: "partial-rod", itemId: "rod" },
        { instanceId: "partial-spring", itemId: "spring" },
        { instanceId: "partial-hooks", itemId: "hook", quantity: 2 },
      ],
      {
        rodId: "partial-rod",
        feederRigId: "partial-spring",
        hooks: ["partial-hooks"],
      },
    ),

    activeOverridesBuild: runRegressionMigration(
      [
        { instanceId: "replace-build", itemId: "sys_build_box", buildName: "Replace" },
        { instanceId: "replace-rod", itemId: "rod", buildId: "replace-build" },
        { instanceId: "replace-reel", itemId: "reel", buildId: "replace-build" },
        { instanceId: "replace-old-line", itemId: "line", buildId: "replace-build", lengthMeters: 20, variant: "old" },
        { instanceId: "replace-new-line", itemId: "line", lengthMeters: 15, variant: "new" },
        { instanceId: "replace-spring", itemId: "spring", buildId: "replace-build" },
        { instanceId: "replace-old-hook", itemId: "hook", buildId: "replace-build", variant: "old" },
        { instanceId: "replace-new-hook", itemId: "hook", variant: "new" },
        { instanceId: "replace-new-bait", itemId: "bait", variant: "new" },
      ],
      {
        rodId: "replace-rod",
        reelId: "replace-reel",
        lineId: "replace-new-line",
        feederRigId: "replace-spring",
        hooks: ["replace-new-hook"],
        baits: ["replace-new-bait"],
      },
    ),

    sharedBuildChum: runRegressionMigration(
      [
        { instanceId: "chum-build", itemId: "sys_build_box", buildName: "Chum" },
        { instanceId: "chum-rod", itemId: "rod", buildId: "chum-build" },
        { instanceId: "chum-spring", itemId: "spring", buildId: "chum-build" },
        { instanceId: "shared-chum", itemId: "chum", buildId: "chum-build", quantity: 3 },
        { instanceId: "chum-boat", itemId: "boat", buildId: "chum-build" },
      ],
      {
        rodId: "chum-rod",
        feederRigId: "chum-spring",
        feederChumId: "shared-chum",
        deliveryId: "chum-boat",
        deliveryChums: ["shared-chum", "shared-chum"],
      },
    ),

    standaloneHookAlignment: runRegressionMigration(
      [
        { instanceId: "align-rod", itemId: "floatRod" },
        { instanceId: "align-hook-a", itemId: "hook", variant: "a" },
        { instanceId: "align-hook-b", itemId: "hook", variant: "b" },
        { instanceId: "align-bait-b", itemId: "bait", variant: "b" },
      ],
      {
        rodId: "align-rod",
        hooks: ["align-hook-a", "align-hook-b"],
        baits: [null, "align-bait-b"],
      },
    ),

    sparseHookAlignment: runRegressionMigration(
      [
        { instanceId: "sparse-rod", itemId: "floatRod" },
        { instanceId: "sparse-hook", itemId: "hook" },
        { instanceId: "sparse-bait", itemId: "bait" },
      ],
      {
        rodId: "sparse-rod",
        hooks: [null, "sparse-hook"],
        baits: [null, "sparse-bait"],
      },
    ),

    insufficientCargo: runRegressionMigration(
      [
        { instanceId: "short-boat", itemId: "boat" },
        { instanceId: "short-chum", itemId: "chum", quantity: 1 },
      ],
      {
        deliveryId: "short-boat",
        deliveryChums: ["short-chum", "short-chum"],
      },
    ),

    activeLineSegment: runRegressionMigration(
      [
        { instanceId: "active-segment-rod", itemId: "poleRod" },
        { instanceId: "active-segment-source", itemId: "line", lengthMeters: 15, durability: 100 },
        { instanceId: "active-segment", itemId: "line", lengthMeters: 10, durability: 100, detachedLineSegment: true, sourceLineInstanceId: "active-segment-source", sourceLineItemId: "line" },
      ],
      {
        rodId: "active-segment-rod",
        lineId: "active-segment",
      },
    ),

    inactiveLineSegment: runRegressionMigration([
      { instanceId: "inactive-segment-source", itemId: "line", lengthMeters: 15, durability: 100 },
      { instanceId: "inactive-segment", itemId: "line", lengthMeters: 10, durability: 100, detachedLineSegment: true, sourceLineInstanceId: "inactive-segment-source", sourceLineItemId: "line" },
    ]),

    changedLineSegment: runRegressionMigration([
      { instanceId: "changed-segment-source", itemId: "line", lengthMeters: 15, durability: 100 },
      { instanceId: "changed-segment", itemId: "line", lengthMeters: 10, durability: 50, detachedLineSegment: true, sourceLineInstanceId: "changed-segment-source", sourceLineItemId: "line" },
    ]),

    aliasesAndSinker: runRegressionMigration(
      [
        { instanceId: "alias-rod", itemId: "rod" },
        { instanceId: "alias-reel", itemId: "reel" },
        { instanceId: "alias-line", itemId: "line_test_25m", lengthMeters: 25 },
        { instanceId: "alias-spring", itemId: "spring" },
        { instanceId: "removed-sinker", itemId: "sinker_light" },
      ],
      {
        rodId: "alias-rod",
        reelId: "alias-reel",
        lineId: "alias-line",
        sinkerId: "alias-spring",
      },
    ),

    crossLoadoutComponent: runRegressionMigration(
      [
        { instanceId: "cross-build-a", itemId: "sys_build_box", buildName: "Float" },
        { instanceId: "cross-float-rod", itemId: "floatRod", buildId: "cross-build-a" },
        { instanceId: "cross-hook", itemId: "hook", buildId: "cross-build-a" },
        { instanceId: "cross-build-b", itemId: "sys_build_box", buildName: "Feeder" },
        { instanceId: "cross-feeder-rod", itemId: "rod", buildId: "cross-build-b" },
        { instanceId: "cross-spring", itemId: "spring", buildId: "cross-build-b" },
      ],
      {
        rodId: "cross-feeder-rod",
        feederRigId: "cross-spring",
        hooks: ["cross-hook"],
      },
    ),

    crossAssemblyComponent: runRegressionMigration(
      [
        { instanceId: "nested-build-a", itemId: "sys_build_box", buildName: "Nested A" },
        { instanceId: "nested-rod-a", itemId: "rod", buildId: "nested-build-a" },
        { instanceId: "nested-spring-a", itemId: "spring", buildId: "nested-build-a" },
        { instanceId: "nested-hook", itemId: "hook", buildId: "nested-build-a" },
        { instanceId: "nested-bait", itemId: "bait", buildId: "nested-build-a" },
        { instanceId: "nested-build-b", itemId: "sys_build_box", buildName: "Nested B" },
        { instanceId: "nested-rod-b", itemId: "rod", buildId: "nested-build-b" },
        { instanceId: "nested-spring-b", itemId: "spring", buildId: "nested-build-b" },
      ],
      {
        rodId: "nested-rod-b",
        feederRigId: "nested-spring-b",
        hooks: ["nested-hook"],
        baits: ["nested-bait"],
      },
    ),

    capabilityTackle: runRegressionMigration(
      [
        { instanceId: "cap-rod", itemId: "spinRod" },
        { instanceId: "cap-spring", itemId: "spring" },
        { instanceId: "cap-lure", itemId: "lure" },
      ],
      {
        rodId: "cap-rod",
        feederRigId: "cap-spring",
        baits: ["cap-lure"],
      },
    ),

    reelRodWithoutReelBuild: runRegressionMigration([
      { instanceId: "no-reel-build", itemId: "sys_build_box", buildName: "No reel" },
      { instanceId: "no-reel-rod", itemId: "rod", buildId: "no-reel-build" },
      { instanceId: "no-reel-line", itemId: "line", buildId: "no-reel-build", lengthMeters: 12 },
    ]),

    handChum: runRegressionMigration(
      [
        {
          instanceId: "hand-chum-active",
          itemId: "chum",
          rarity: "rare",
          recipeVariant: "garlic",
        },
      ],
      { handChumId: "hand-chum-active" },
      { autoChum: true },
    ),
  };
  `,
  context,
);

const regression = context.migrationRegressions;
const itemAt = (result, instanceId) =>
  result.snapshot.items.find((item) => item.instanceId === instanceId) || null;
const childrenOf = (result, parentInstanceId, slotId) =>
  result.snapshot.items
    .filter(
      (item) =>
        item.location.kind === "ATTACHED" &&
        item.location.parentInstanceId === parentInstanceId &&
        item.location.slotId === slotId,
    )
    .sort((left, right) => left.location.slotIndex - right.location.slotIndex);
const totalByItemId = (result, itemId) =>
  result.snapshot.items
    .filter((item) => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
const totalLineLength = (result) =>
  result.snapshot.items
    .filter((item) => item.itemId === "line")
    .reduce((sum, item) => sum + Number(item.lengthMeters || 0) * item.quantity, 0);

const partial = regression.partialFeeder;
const partialHooks = childrenOf(
  partial,
  partial.snapshot.equipment.tackle,
  "hook",
);
assert(partialHooks.length === 1, "partial feeder keeps exactly one equipped hook");
assert(
  partial.snapshot.items
    .filter(
      (item) => item.itemId === "hook" && item.location.kind === "INVENTORY",
    )
    .reduce((sum, item) => sum + item.quantity, 0) === 1,
  "partial feeder leaves the second hook in inventory",
);

const replaced = regression.activeOverridesBuild;
const activeReel = replaced.snapshot.equipment.reel;
const activeLine = childrenOf(replaced, activeReel, "line")[0];
assert(activeLine?.variant === "new", "active line replaces the saved loadout line");
const activeTackle = replaced.snapshot.equipment.tackle;
const activeHook = childrenOf(replaced, activeTackle, "hook")[0];
assert(activeHook?.variant === "new", "active hook replaces the saved loadout hook");
assert(
  childrenOf(replaced, activeHook.instanceId, "bait")[0]?.variant === "new",
  "active hook keeps its aligned bait",
);
assert(
  replaced.snapshot.items.some(
    (item) => item.variant === "old" && item.location.kind === "INVENTORY",
  ),
  "replaced saved components return to inventory",
);

const sharedChum = regression.sharedBuildChum;
assert(
  sharedChum.snapshot.items.filter(
    (item) => item.itemId === "chum" && item.location.kind === "ATTACHED",
  ).length === 3,
  "one build-owned chum stack restores feeder and both boat bays with distinct units",
);
assert(totalByItemId(sharedChum, "chum") === 3, "shared chum quantity is conserved");

const aligned = regression.standaloneHookAlignment;
assert(
  childrenOf(aligned, aligned.snapshot.equipment.tackle, "bait").length === 0,
  "standalone hook does not steal bait from a later hook index",
);
assert(
  itemAt(aligned, "align-bait-b")?.location.kind === "INVENTORY",
  "unaligned bait remains in inventory",
);
const sparse = regression.sparseHookAlignment;
assert(
  childrenOf(sparse, sparse.snapshot.equipment.tackle, "bait")[0]?.instanceId ===
    "sparse-bait",
  "sparse standalone hook keeps bait from its own legacy index",
);

const shortCargo = regression.insufficientCargo;
assert(
  childrenOf(shortCargo, shortCargo.snapshot.equipment.delivery, "cargo").length === 1,
  "insufficient cargo fills only the first available bay",
);
assert(
  shortCargo.warnings.some((warning) => warning.includes("Not enough units")),
  "insufficient cargo emits a migration warning",
);

const activeSegment = regression.activeLineSegment;
assert(
  activeSegment.snapshot.equipment.terminalLine === "active-segment",
  "active detached segment remains the equipped terminal line",
);
assert(totalLineLength(activeSegment) === 25, "active line segment preserves total length");
assert(
  itemAt(activeSegment, "active-segment")?.lengthMeters === 10 &&
    itemAt(activeSegment, "active-segment-source")?.lengthMeters === 15,
  "active segment and source spool remain separate",
);
const inactiveSegment = regression.inactiveLineSegment;
assert(
  inactiveSegment.snapshot.items.filter((item) => item.itemId === "line").length === 1 &&
    totalLineLength(inactiveSegment) === 25,
  "inactive exact segment merges back into its source",
);
const changedSegment = regression.changedLineSegment;
assert(
  changedSegment.snapshot.items.filter((item) => item.itemId === "line").length === 2 &&
    totalLineLength(changedSegment) === 25,
  "changed line segment is not merged into a different runtime signature",
);

const aliases = regression.aliasesAndSinker;
const aliasLine = childrenOf(aliases, aliases.snapshot.equipment.reel, "line")[0];
assert(aliasLine?.itemId === "line_test_1", "legacy line item id is canonicalized");
assert(
  aliases.snapshot.equipment.tackle === "alias-spring",
  "legacy sinkerId feeder rig becomes active tackle",
);
assert(
  !aliases.snapshot.items.some((item) => item.itemId === "sinker_light"),
  "deprecated sinker item is removed",
);

const crossLoadout = regression.crossLoadoutComponent;
const crossHook = childrenOf(
  crossLoadout,
  crossLoadout.snapshot.equipment.tackle,
  "hook",
)[0];
assert(
  crossHook?.instanceId === "cross-hook",
  "active feeder can reclaim a hook that was a root in another legacy loadout",
);
assert(
  crossLoadout.snapshot.loadouts.find(
    (loadoutEntry) => loadoutEntry.loadoutId === "cross-build-a",
  ).rootInstanceIds.tackle === null,
  "reclaimed component is removed from its previous loadout root assignment",
);

const crossAssembly = regression.crossAssemblyComponent;
const movedNestedHook = childrenOf(
  crossAssembly,
  crossAssembly.snapshot.equipment.tackle,
  "hook",
)[0];
assert(
  movedNestedHook?.instanceId === "nested-hook" &&
    childrenOf(crossAssembly, movedNestedHook.instanceId, "bait")[0]
      ?.instanceId === "nested-bait",
  "active assembly reclaims a nested hook and reattaches its aligned bait",
);

const capability = regression.capabilityTackle;
assert(
  capability.snapshot.equipment.tackle === "cap-lure",
  "spinning rod restores a lure instead of stale feederRigId",
);
assert(
  itemAt(capability, "cap-spring")?.location.kind === "INVENTORY",
  "incompatible stale feeder rig remains safely in inventory",
);

const noReelBuild = regression.reelRodWithoutReelBuild.snapshot;
assert(
  noReelBuild.loadouts[0].rootInstanceIds.terminalLine === null,
  "reel-capable loadout without a reel does not misuse fishing line as terminalLine",
);
assert(
  itemAt(regression.reelRodWithoutReelBuild, "no-reel-line")?.location.kind ===
    "INVENTORY",
  "line from incomplete reel loadout remains recoverable in inventory",
);

const migratedHandChum = regression.handChum.snapshot;
assert(
  migratedHandChum.equipment.handChum === "hand-chum-active",
  "legacy handChumId remains active auxiliary equipment",
);
assert(
  migratedHandChum.settings.autoChum === true &&
    migratedHandChum.settings.refillMemory.handChum?.itemId === "chum" &&
    migratedHandChum.settings.refillMemory.handChum?.properties?.rarity ===
      "rare" &&
    migratedHandChum.settings.refillMemory.handChum?.properties
      ?.recipeVariant === "garlic",
  "active hand chum keeps its exact refill signature during migration",
);

console.log("Inventory-v2 migration checks passed.");
