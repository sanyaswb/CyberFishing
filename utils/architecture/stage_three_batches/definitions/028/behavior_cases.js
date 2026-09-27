"use strict";

const { SourceRuntime } = require("../../../../testing/core/source_runtime");

const snapshot = value => JSON.parse(JSON.stringify(value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) {
    return { error: { name: error.name, code: error.code ?? null, message: error.message,
      details: error.details === undefined ? null : snapshot(error.details) } };
  }
};

// Fresh collaborators for every case: configs, the classic repositories and profile registry, and
// the completed ESM owners through the legacy-shaped test loader. Classic and ESM services see the
// same collaborator implementations, so only the service representation differs.
function collaborators() {
  const runtime = new SourceRuntime().loadMany([
    { path: "src/config/inventory/item_assembly_profile_config.js",
      expose: ["ITEM_ASSEMBLY_PROFILE_IDS", "ITEM_ASSEMBLY_PROFILE_CONFIG"] },
    { path: "src/core/inventory/inventory_item_location.js", expose: ["InventoryItemLocationKind", "InventoryItemLocation"] },
    { path: "src/core/inventory/unlimited_assembly_capacity_policy.js", expose: ["UnlimitedAssemblyCapacityPolicy"] },
    { path: "src/core/inventory/item_assembly_stacking_policy.js", expose: ["ItemAssemblyStackingPolicy"] },
    { path: "src/core/inventory/flat_inventory_item_repository.js", expose: ["FlatInventoryItemRepository"] },
    { path: "src/core/assemblies/assembly_state.js", expose: ["AssemblyPreparationStatus", "AssemblyState"] },
    { path: "src/core/assemblies/assembly_state_repository.js", expose: ["AssemblyStateRepository"] },
    { path: "src/core/assemblies/assembly_profile_registry.js", expose: ["AssemblyProfileRegistry"] },
    { path: "src/core/assemblies/exact_assembly_refill_signature_policy.js", expose: ["ExactAssemblyRefillSignaturePolicy"] },
    { path: "src/core/assemblies/item_assembly_reader.js", expose: ["ItemAssemblyPath", "ItemAssemblyReader"] },
  ]).context;
  const inventory = (instanceId, itemId, itemType, quantity = 1, extra = {}) => ({
    instanceId, itemId, itemType, quantity, location: runtime.InventoryItemLocation.inventory(), ...extra });
  let sequence = 0;
  const repository = new runtime.FlatInventoryItemRepository({
    items: [
      inventory("spring-stack", "spring-basic", "feeder_rig", 2,
        { effectiveStats: { assemblyProfileId: "feeder_spring_basic", hooksCount: 2, hasChumSlot: true } }),
      inventory("hook-stack", "hook-basic", "hook", 3, { effectiveStats: { assemblyProfileId: "hook_standard" } }),
      inventory("bait-red", "worm", "bait", 5, { rarity: { tier: 2 }, flavor: "oil" }),
      inventory("bait-blue", "worm", "bait", 2, { rarity: { tier: 3 }, flavor: "ice" }),
      inventory("chum-stack", "carp-mix", "chum_mix", 3, { recipe: "carp-v1" }),
      inventory("reel-one", "reel-test", "reel", 1),
      inventory("hook-one", "hook-basic", "hook", 1),
    ],
    instanceIdFactory: source => `${source.instanceId}-split-${++sequence}`,
  });
  return { runtime, repository, stateRepository: new runtime.AssemblyStateRepository(),
    profileRegistry: new runtime.AssemblyProfileRegistry() };
}

const state = parts => ({ items: snapshot(parts.repository.createSnapshot()),
  assemblies: snapshot(parts.stateRepository.createSnapshot()) });

// Batch 028: ItemAssemblyService (assembly tree operations) and ItemAssemblyDomainError.
const EXECUTABLE_CASES = Object.freeze({
  ItemAssemblyService: Object.freeze({
    "draft-tree-attach-replace-detach-prepare-consume-disassemble": Service => {
      const parts = collaborators();
      const service = new Service(parts);
      const steps = [];
      const rootId = service.startAssembly("spring-stack");
      steps.push({ rootId, again: service.startAssembly(rootId) });
      const hook = service.attach({ rootInstanceId: rootId, sourceInstanceId: "hook-stack", slotId: "hook", slotIndex: 0 });
      steps.push(snapshot(hook));
      steps.push(snapshot(service.attach({ rootInstanceId: rootId, parentInstanceId: hook.attachedInstanceId,
        sourceInstanceId: "bait-red", slotId: "bait", slotIndex: 0 })));
      steps.push(attempt(() => service.replace({ rootInstanceId: rootId, parentInstanceId: hook.attachedInstanceId,
        sourceInstanceId: "bait-blue", slotId: "bait", slotIndex: 0 })));
      steps.push(attempt(() => service.prepare(rootId)));
      steps.push(state(parts));
      steps.push(attempt(() => service.detach({ rootInstanceId: rootId, parentInstanceId: hook.attachedInstanceId,
        slotId: "bait", slotIndex: 0 })));
      steps.push(attempt(() => service.clearRefillPreference(rootId, "hook[0].bait")));
      steps.push(attempt(() => service.consume({ rootInstanceId: rootId, parentInstanceId: rootId,
        slotId: "hook", slotIndex: 0 })));
      steps.push(attempt(() => service.disassemble(rootId)));
      steps.push(state(parts));
      return steps;
    },
    "invalid-operations-are-atomic-domain-errors": Service => {
      const parts = collaborators();
      const service = new Service(parts);
      const rootId = service.startAssembly("spring-stack");
      const before = state(parts);
      const failures = [
        attempt(() => service.attach({ rootInstanceId: rootId, sourceInstanceId: "reel-one", slotId: "hook", slotIndex: 0 })),
        attempt(() => service.attach({ rootInstanceId: rootId, sourceInstanceId: "hook-stack", slotId: "missing", slotIndex: 0 })),
        attempt(() => service.attach({ rootInstanceId: rootId, sourceInstanceId: "hook-stack", slotId: "hook", slotIndex: 9 })),
        attempt(() => service.attach({ rootInstanceId: "unknown", sourceInstanceId: "hook-stack", slotId: "hook", slotIndex: 0 })),
        attempt(() => service.detach({ rootInstanceId: rootId, parentInstanceId: rootId, slotId: "hook", slotIndex: 0 })),
        attempt(() => service.startAssembly("bait-red")),
        attempt(() => service.disassemble("bait-red")),
      ];
      return { failures, unchanged: JSON.stringify(before) === JSON.stringify(state(parts)) };
    },
    "constructor-validation-and-default-collaborators": Service => {
      const parts = collaborators();
      const missing = [
        attempt(() => new Service({ stateRepository: parts.stateRepository, profileRegistry: parts.profileRegistry })),
        attempt(() => new Service({ repository: parts.repository, profileRegistry: parts.profileRegistry })),
        attempt(() => new Service({ repository: parts.repository, stateRepository: parts.stateRepository })),
        attempt(() => new Service()),
      ];
      const service = new Service({ repository: parts.repository, stateRepository: parts.stateRepository,
        profileRegistry: parts.profileRegistry });
      const rootId = service.startAssembly("spring-stack");
      const attached = service.attach({ rootInstanceId: rootId, sourceInstanceId: "hook-one", slotId: "hook", slotIndex: 1 });
      return { missing, rootId, attached: snapshot(attached), state: state(parts) };
    },
  }),
  ItemAssemblyDomainError: Object.freeze({
    "error-code-message-details-and-prototype": DomainError => {
      const error = new DomainError("SLOT_OCCUPIED", "Slot is occupied", { slotId: "hook" });
      const plain = new DomainError("PLAIN", "No details");
      return { name: error.name, code: error.code, message: error.message, details: snapshot(error.details),
        plainDetails: snapshot(plain.details),
        // Realm-neutral: the classic baseline and the ESM target each extend their own realm's Error.
        isError: error instanceof Object.getPrototypeOf(DomainError.prototype).constructor,
        superclass: Object.getPrototypeOf(DomainError.prototype).constructor.name,
        stackStartsWithName: String(error.stack).startsWith("ItemAssemblyDomainError: Slot is occupied") };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    ItemAssemblyService: ["draft-tree-attach-replace-detach-prepare-consume-disassemble",
      "invalid-operations-are-atomic-domain-errors", "constructor-validation-and-default-collaborators"],
    ItemAssemblyDomainError: ["error-code-message-details-and-prototype"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-two-exact-exports",
    "five-exact-imports-including-two-earlier-batch-exports-bound-to-the-cumulative-instances",
    "four-owner-created-default-collaborator-composition-identities-preserved",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "unactivated-domain-error-kept-as-esm-export-only",
    "two-exact-classic-consumer-relationships-and-five-retired-bridges",
    "transactional-snapshot-restore-and-atomic-failures-preserved",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
