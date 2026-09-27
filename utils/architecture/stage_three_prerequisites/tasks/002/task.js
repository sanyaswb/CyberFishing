"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const POLICY = "src/core/items/item_stat_override_policy.js";
const RESOLVER = "src/core/items/effective_item_stats_resolver.js";
const CONFIG = "src/config/items/item_stat_override_config.js";
const ITEM_DB = "src/config/databases/item_db.js";
const MAPPER = "src/infrastructure/storage/inventory_item_snapshot_mapper.js";
const LEGACY_STATE = "src/infrastructure/storage/legacy_item_state_migration.js";
const FRESHNESS_STATE = "src/core/items/freshness/item_freshness_state_policy.js";
const root = "src/application/inventory/inventory_v2_composition_root.js";
const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";

const drop = (from, to) => Object.freeze([from, to]);

// Stage 3.22 backlog task: ItemStatOverridePolicy stops reading the raw ITEM_STAT_OVERRIDE_CONFIG
// global. CONFIG exposes the table (like itemProgression); GameCompositionRoot composes one policy
// and one EffectiveItemStatsResolver from it and hands both through InventoryManager to the
// InventoryV2CompositionRoot; every former default-parameter call site receives them explicitly.
// Behavior, formulas and snapshots are unchanged.
const SOURCE_EDITS = Object.freeze([
  { path: POLICY, replacements: [drop("  constructor({ config = globalThis.ITEM_STAT_OVERRIDE_CONFIG } = {}) {",
    "  constructor({ config } = {}) {")] },
  { path: RESOLVER, replacements: [drop("  constructor({ overridePolicy = new ItemStatOverridePolicy() } = {}) {",
    "  constructor({ overridePolicy } = {}) {")] },
  { path: MAPPER, replacements: [drop("    overridePolicy = new ItemStatOverridePolicy(),\n", "    overridePolicy,\n")] },
  { path: LEGACY_STATE, replacements: [drop("    overridePolicy = new ItemStatOverridePolicy(),\n", "    overridePolicy,\n")] },
  { path: "src/core/items/progression/item_capacity_resolver.js", replacements: [drop(
    "  constructor({ effectiveStatsResolver = new EffectiveItemStatsResolver() } = {}) {",
    "  constructor({ effectiveStatsResolver } = {}) {")] },
  ...["src/core/items/progression/item_catalog_baseline_registry.js", "src/core/items/progression/item_progression_resolver.js",
    "src/core/line/line_inventory_controller.js", "src/systems/inventory_item_view_factory.js",
    "src/debug/services/item_progression_debug_snapshot_provider.js", "src/application/inventory/inventory_v2_item_hydrator.js",
  ].map(path => ({ path, replacements: [drop("    effectiveStatsResolver = new EffectiveItemStatsResolver(),\n",
    "    effectiveStatsResolver,\n")] })),
  { path: "src/config/validation/item_progression_config_validator.js", replacements: [drop(
    "  #effectiveStatsResolver = new EffectiveItemStatsResolver();\n",
    "  #effectiveStatsResolver;\n\n  constructor({ effectiveStatsResolver } = {}) {\n    this.#effectiveStatsResolver = effectiveStatsResolver;\n  }\n")] },
  { path: "src/infrastructure/storage/inventory_v2_legacy_migration.js", replacements: [
    drop("    itemStateMigration = new LegacyItemStateMigration(),\n    effectiveStatsResolver = new EffectiveItemStatsResolver(),\n    itemSnapshotMapper = null,\n",
      "    itemStateMigration,\n    effectiveStatsResolver,\n    itemSnapshotMapper,\n"),
    drop("    this.#itemSnapshotMapper =\n      itemSnapshotMapper ||\n      new InventoryItemSnapshotMapper({ itemDefinitionResolver });\n",
      "    this.#itemSnapshotMapper = itemSnapshotMapper;\n"),
  ] },
  { path: "src/infrastructure/storage/inventory_v2_snapshot_migration.js", replacements: [
    drop("    itemStateMigration = new LegacyItemStateMigration(),\n    itemSnapshotMapper = null,\n",
      "    itemStateMigration,\n    itemSnapshotMapper,\n"),
    drop("    this.#itemSnapshotMapper =\n      itemSnapshotMapper ||\n      new InventoryItemSnapshotMapper({ itemDefinitionResolver });\n",
      "    this.#itemSnapshotMapper = itemSnapshotMapper;\n"),
  ] },
  { path: root, replacements: [
    drop("    itemFreshnessResolver = null,\n  } = {}) {\n    const definitions =",
      "    itemFreshnessResolver = null,\n    itemStatOverridePolicy,\n    effectiveStatsResolver,\n  } = {}) {\n" +
      "    // The composed item stat override policy is shared by every item-state collaborator.\n" +
      "    const overridePolicy = itemStatOverridePolicy;\n" +
      "    const itemStateMigration = new LegacyItemStateMigration({ overridePolicy });\n" +
      "    const definitions ="),
    drop("    const hydrator = new InventoryV2ItemHydrator({\n      itemDefinitionResolver: definitions,\n    });",
      "    const hydrator = new InventoryV2ItemHydrator({\n      itemDefinitionResolver: definitions,\n      effectiveStatsResolver,\n    });"),
    drop("    const itemSnapshotMapper = new InventoryItemSnapshotMapper({\n      itemDefinitionResolver: definitionLookup,\n    });",
      "    const itemSnapshotMapper = new InventoryItemSnapshotMapper({\n      itemDefinitionResolver: definitionLookup,\n      overridePolicy,\n    });"),
    drop("      itemSnapshotMapper,\n      instanceIdFactory,\n    });\n    const snapshot = resolvedState.snapshot;",
      "      itemSnapshotMapper,\n      instanceIdFactory,\n      itemStateMigration,\n      effectiveStatsResolver,\n    });\n    const snapshot = resolvedState.snapshot;"),
    drop("    itemSnapshotMapper,\n    instanceIdFactory,\n  }) {\n    if (initialSnapshot) {",
      "    itemSnapshotMapper,\n    instanceIdFactory,\n    itemStateMigration,\n    effectiveStatsResolver,\n  }) {\n    if (initialSnapshot) {"),
    Object.freeze(["        itemSnapshotMapper,\n        targetSchemaVersion: INVENTORY_V2_SCHEMA_VERSION,",
      "        itemSnapshotMapper,\n        itemStateMigration,\n        targetSchemaVersion: INVENTORY_V2_SCHEMA_VERSION,", 3]),
    drop("      itemSnapshotMapper,\n      instanceIdFactory,\n    }).migrate({",
      "      itemSnapshotMapper,\n      instanceIdFactory,\n      itemStateMigration,\n      effectiveStatsResolver,\n    }).migrate({"),
  ] },
  { path: "src/systems/inventory_system.js", replacements: [
    drop("    baitEffectivenessCatalogResolver = null,\n  ) {",
      "    baitEffectivenessCatalogResolver = null,\n    effectiveStatsResolver,\n    itemStatOverridePolicy,\n  ) {"),
    drop("    this.#effectiveStatsResolver = new EffectiveItemStatsResolver();",
      "    this.#effectiveStatsResolver = effectiveStatsResolver;\n    this.#itemStatOverridePolicy = itemStatOverridePolicy;"),
    drop("  #effectiveStatsResolver;\n  #effectiveRarityResolver;",
      "  #effectiveStatsResolver;\n  #itemStatOverridePolicy;\n  #effectiveRarityResolver;"),
    drop("      itemFreshnessResolver: this.#itemFreshnessResolver,\n    });\n    this.#inventoryV2Facade",
      "      itemFreshnessResolver: this.#itemFreshnessResolver,\n      itemStatOverridePolicy: this.#itemStatOverridePolicy,\n" +
      "      effectiveStatsResolver: this.#effectiveStatsResolver,\n    });\n    this.#inventoryV2Facade"),
    drop("            displayStatsResolver: this.#runtimeDisplayStatsResolver,\n",
      "            displayStatsResolver: this.#runtimeDisplayStatsResolver,\n            effectiveStatsResolver: this.#effectiveStatsResolver,\n"),
    drop("      isEquipped: (instanceId) => this.#isInstanceEquipped(instanceId),\n    });",
      "      isEquipped: (instanceId) => this.#isInstanceEquipped(instanceId),\n      effectiveStatsResolver: this.#effectiveStatsResolver,\n    });"),
  ] },
  { path: "src/config/config.js", replacements: [drop("  itemProgression: ITEM_PROGRESSION_CONFIG,\n",
    "  itemProgression: ITEM_PROGRESSION_CONFIG,\n  itemStatOverrides: ITEM_STAT_OVERRIDE_CONFIG,\n")] },
  { path: "src/app/bootstrap.js", replacements: [
    drop("    this.#validateRarityConfiguration();\n    this.#validateItemProgressionConfiguration();",
      "    // The item stat override table reaches the Domain policy only through composition.\n" +
      "    const itemStatOverridePolicy = new ItemStatOverridePolicy({ config: this.#config.itemStatOverrides });\n" +
      "    const effectiveItemStatsResolver = new EffectiveItemStatsResolver({ overridePolicy: itemStatOverridePolicy });\n" +
      "    this.#validateRarityConfiguration();\n    this.#validateItemProgressionConfiguration(effectiveItemStatsResolver);"),
    drop("      itemDb: typeof ITEM_DB !== \"undefined\" ? ITEM_DB : {},\n      strategyRegistry: itemMetricStrategyRegistry,\n    });",
      "      itemDb: typeof ITEM_DB !== \"undefined\" ? ITEM_DB : {},\n      strategyRegistry: itemMetricStrategyRegistry,\n      effectiveStatsResolver: effectiveItemStatsResolver,\n    });"),
    drop("      capacityResolver: new ItemCapacityResolver(),",
      "      capacityResolver: new ItemCapacityResolver({ effectiveStatsResolver: effectiveItemStatsResolver }),"),
    drop("      baselineRegistry: itemCatalogBaselineRegistry,\n    });\n    const itemProgressionVisualResolver",
      "      baselineRegistry: itemCatalogBaselineRegistry,\n      effectiveStatsResolver: effectiveItemStatsResolver,\n    });\n    const itemProgressionVisualResolver"),
    drop("        progressionResolver: itemProgressionResolver,\n      });",
      "        progressionResolver: itemProgressionResolver,\n        effectiveStatsResolver: effectiveItemStatsResolver,\n      });"),
    drop("      baitEffectivenessCatalogResolver,\n    );\n    const eq = inventory.getEquipped();",
      "      baitEffectivenessCatalogResolver,\n      effectiveItemStatsResolver,\n      itemStatOverridePolicy,\n    );\n    const eq = inventory.getEquipped();"),
    drop("    const bootstrapStatsResolver = new EffectiveItemStatsResolver();",
      "    const bootstrapStatsResolver = effectiveItemStatsResolver;"),
    drop("  #validateItemProgressionConfiguration() {", "  #validateItemProgressionConfiguration(effectiveStatsResolver) {"),
    drop("    new ItemProgressionConfigValidator().assertValid({",
      "    new ItemProgressionConfigValidator({ effectiveStatsResolver }).assertValid({"),
  ] },
].map(edit => Object.freeze({ path: edit.path, replacements: Object.freeze(edit.replacements) })));

// Loads classic sources into one context; later sources may read earlier globals.
const contextOf = (read, sources) => {
  const context = vm.createContext({ console });
  for (const [file, source] of sources) vm.runInContext(source ?? read(file), context, { filename: file });
  return context;
};

module.exports = Object.freeze({
  sequence: 2,
  slug: "item-stat-override-policy-config-injection",
  afterBatch: "034",
  backlogTaskId: "stage-3.22.prerequisite.item-stat-override-policy-config-injection",
  intent: "The raw ITEM_STAT_OVERRIDE_CONFIG global is read only by the CONFIG aggregate; GameCompositionRoot composes the policy and one effective-stats resolver and injects them into every former default-parameter call site.",
  sourceEdits: SOURCE_EDITS,
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-1574a55baa04", "debt-boundary-dependency-ca543a3a2f54",
    "debt-boundary-dependency-fa219c513214", "debt-boundary-dependency-fc41ef897dd2", "debt-qualified-role-72ddffb8ccc5"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([
      ["src/application/inventory/inventory_v2_item_hydrator.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/config/validation/item_progression_config_validator.js", RESOLVER, "EffectiveItemStatsResolver"],
      [RESOLVER, POLICY, "ItemStatOverridePolicy"],
      [POLICY, CONFIG, "ITEM_STAT_OVERRIDE_CONFIG"],
      ["src/core/items/progression/item_capacity_resolver.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/core/items/progression/item_catalog_baseline_registry.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/core/items/progression/item_progression_resolver.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/core/line/line_inventory_controller.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/debug/services/item_progression_debug_snapshot_provider.js", RESOLVER, "EffectiveItemStatsResolver"],
      [MAPPER, POLICY, "ItemStatOverridePolicy"],
      ["src/infrastructure/storage/inventory_v2_legacy_migration.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/infrastructure/storage/inventory_v2_legacy_migration.js", MAPPER, "InventoryItemSnapshotMapper"],
      ["src/infrastructure/storage/inventory_v2_legacy_migration.js", LEGACY_STATE, "LegacyItemStateMigration"],
      ["src/infrastructure/storage/inventory_v2_snapshot_migration.js", MAPPER, "InventoryItemSnapshotMapper"],
      ["src/infrastructure/storage/inventory_v2_snapshot_migration.js", LEGACY_STATE, "LegacyItemStateMigration"],
      [LEGACY_STATE, POLICY, "ItemStatOverridePolicy"],
      ["src/systems/inventory_item_view_factory.js", RESOLVER, "EffectiveItemStatsResolver"],
      ["src/systems/inventory_system.js", RESOLVER, "EffectiveItemStatsResolver"],
    ].map(edge => edge.join("\u0000"))),
    added: Object.freeze([
      ["src/app/bootstrap.js", POLICY, "ItemStatOverridePolicy"],
      [root, LEGACY_STATE, "LegacyItemStateMigration"],
      ["src/config/config.js", CONFIG, "ITEM_STAT_OVERRIDE_CONFIG"],
    ].map(edge => edge.join("\u0000"))),
  }),
  // Focused parity: effective stats of every catalog item, override normalization and legacy item
  // migration give identical results through the old defaults and the injected policy.
  parity({ read, before, after }) {
    const load = pick => contextOf(read, [[RUNTIME], [CONFIG], [ITEM_DB], [FRESHNESS_STATE], [POLICY, pick(POLICY)],
      [RESOLVER, pick(RESOLVER)], [LEGACY_STATE, pick(LEGACY_STATE)]]);
    const old = load(before), next = load(after);
    const run = (context, compose) => vm.runInContext(`(() => {
      const compose = ${compose};
      const { resolver, migration, policy } = compose();
      const items = [];
      for (const group of Object.values(ITEM_DB)) {
        if (!group || typeof group !== "object") continue;
        for (const definition of Object.values(group)) {
          if (definition && typeof definition === "object" && definition.id) items.push(definition);
        }
      }
      items.sort((left, right) => String(left.id).localeCompare(String(right.id)));
      return JSON.stringify({
        stats: items.map(definition => [definition.id, resolver.resolve({ definition })]),
        overrides: items.slice(0, 20).map(definition => {
          try { return policy.normalize({ definition, overrides: {} }); } catch (error) { return error.name; }
        }),
        migrated: items.slice(0, 20).map(definition => {
          try { return migration.migrate({ itemId: definition.id, quantity: 1 }, definition); } catch (error) { return error.name; }
        }),
      });
    })()`, context);
    const baseline = run(old, "() => ({ resolver: new EffectiveItemStatsResolver(), migration: new LegacyItemStateMigration(), policy: new ItemStatOverridePolicy() })");
    const injected = run(next, "() => { const policy = new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG }); " +
      "return { policy, resolver: new EffectiveItemStatsResolver({ overridePolicy: policy }), migration: new LegacyItemStateMigration({ overridePolicy: policy }) }; }");
    assert.equal(injected, baseline, "injected policy differs from the old global default");
    assert.throws(() => vm.runInContext("new ItemStatOverridePolicy()", next), /requires override config/u);
    return { cases: 3, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
