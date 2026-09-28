"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const SLOT_PRESENTATION = "src/config/inventory/equipment_slot_presentation_config.js";
const RULE_MESSAGES = "src/config/inventory/inventory_rule_messages.js";
const CAPACITY = "src/core/items/progression/item_capacity_resolver.js";
const BASELINES = "src/core/items/progression/item_catalog_baseline_registry.js";
const BOOTSTRAP = "src/app/bootstrap.js";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Parity scenarios in the old and in the new classic world; `inject` carries what composition injects.
const SCENARIOS = `((inject) => {
  const facts = [];
  const plain = (value) => value && typeof value === "object"
    ? { frozen: Object.isFrozen(value), value: JSON.parse(JSON.stringify(value)) } : value;
  const effectiveStatsResolver = { resolve: ({ definition }) => ({ ...(definition.gameplayStats || {}) }) };
  const capacity = new ItemCapacityResolver({ effectiveStatsResolver, ...inject.capacity });
  const labelled = { strategyId: "line_capacity", statPath: "effectiveStats.lengthMeters", metricLabel: "L",
    metricSuffix: "S", inventoryDetailLabel: "I", equippedDetailLabel: "E" };
  const bare = { strategyId: "line_capacity", statPath: "effectiveStats.lengthMeters" };
  const configs = [undefined, null, "x", { strategyId: "other" }, labelled, bare, { ...bare, statPath: "missing.path" }];
  const items = [undefined, {}, { instanceId: "a", effectiveStats: { lengthMeters: 40 } },
    { instanceId: "b", effectiveStats: { lengthMeters: 12.5 } }, { instanceId: "c", effectiveStats: { lengthMeters: -3 } },
    { instanceId: "d", effectiveStats: { lengthMeters: "long" } }];
  const contexts = [undefined, {}, { catalogItem: { effectiveStats: { lengthMeters: 100 } } },
    { catalogItem: { gameplayStats: { lengthMeters: 60 } } },
    { lineCapacity: { equippedLineInstanceId: "a", reelCapacityMeters: 25 } },
    { lineCapacity: { equippedLineInstanceId: "b", reelCapacityMeters: 0 } },
    { lineCapacity: { equippedLineInstanceId: "a", reelCapacityMeters: 25,
      activeState: { lineInstanceId: "a", hasReel: true, remainingMeters: 7.5 } } },
    { lineCapacity: { equippedLineInstanceId: "a", reelCapacityMeters: 25,
      activeState: { lineInstanceId: "a", hasReel: false, remainingMeters: 7.5 } } }];
  for (const capacityConfig of configs) {
    for (const item of items) {
      for (const context of contexts) facts.push(["capacity", plain(capacity.resolve({ item, capacityConfig, context }))]);
    }
  }
  const warnings = [];
  const logged = { warn: (...args) => warnings.push(args) };
  const strategy = { id: "s", evaluate: ({ item }) => item.metric };
  const strategyRegistry = { get: () => strategy };
  const itemDb = {
    builds: { skip: { progressionProfile: { groupId: "g" }, metric: { available: true, rawValue: 99 } } },
    rods: { a: { progressionProfile: { groupId: "g" }, effectiveStats: {}, metric: { available: true, rawValue: 3 } },
      b: { progressionProfile: { groupId: "g" }, metric: { available: true, rawValue: 9 } },
      c: { progressionProfile: { groupId: "single" }, metric: { available: true, rawValue: 5 } } },
  };
  const registry = new ItemCatalogBaselineRegistry({ itemDb, strategyRegistry,
    effectiveStatsResolver, ...inject.baselines(logged) });
  const ratingConfigs = [undefined, { baseline: { mode: "fixed", minimum: 1, maximum: 4 } },
    { baseline: { mode: "fixed", minimum: 4, maximum: 4 } }, { baseline: { mode: "other" } },
    { baseline: { mode: "catalog" }, statPath: "p" },
    { baseline: { mode: "catalog", fallback: { minimum: 0, maximum: 10 } }, statPath: "q" }];
  for (const groupId of ["g", "single", "none"]) {
    for (const ratingConfig of ratingConfigs) {
      const first = registry.resolve({ groupId, ratingConfig, strategy });
      const second = registry.resolve({ groupId, ratingConfig, strategy });
      facts.push(["baseline", plain(first), first === second]);
    }
  }
  registry.invalidate();
  facts.push(["after-invalidate", plain(registry.resolve({ groupId: "single", ratingConfig: ratingConfigs[5], strategy }))]);
  facts.push(["warnings", warnings]);
  try { new ItemCatalogBaselineRegistry({}); } catch (error) { facts.push(["error", error.constructor.name, error.message]); }
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.item-progression-decomposition, transition 1:
// ItemCapacityResolver's default capacity labels (used when the progression config names none) move to
// the shared presentation INVENTORY_RULE_MESSAGES, which bootstrap.js injects explicitly. The console
// default of ItemCatalogBaselineRegistry needs a platform logger adapter (owner decision) and stays.
module.exports = Object.freeze({
  sequence: 11,
  slug: "item-capacity-text-boundary",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.item-progression-decomposition",
  intent: "Item-progression decomposition 1: ItemCapacityResolver takes its default capacity labels from the injected presentation INVENTORY_RULE_MESSAGES (bootstrap injects it explicitly); identical descriptors.",
  sourceEdits: Object.freeze([
    edit(RULE_MESSAGES, [[
      "    lineWillBeWound: Object.freeze(\n      (length) => `Буде намотано ${meters(length)}м ліски.`,\n    ),\n",
      "    lineWillBeWound: Object.freeze(\n      (length) => `Буде намотано ${meters(length)}м ліски.`,\n    ),\n" +
        "    // Line capacity metric labels used when the progression config names none.\n" +
        "    lineCapacityMetricLabel: \"Ємність\",\n    lineCapacityMetricSuffix: \"м\",\n" +
        "    lineCapacityInventoryDetail: \"Залишок ліски\",\n    lineCapacityEquippedDetail: \"На котушці\",\n",
    ]]),
    edit(CAPACITY, [
      ["  #effectiveStatsResolver;\n\n  constructor({ effectiveStatsResolver } = {}) {\n" +
        "    this.#effectiveStatsResolver = effectiveStatsResolver;\n",
      "  #effectiveStatsResolver;\n  #messages;\n\n  // Default player-facing labels are injected by composition.\n" +
        "  constructor({ effectiveStatsResolver, messages = null } = {}) {\n" +
        "    this.#effectiveStatsResolver = effectiveStatsResolver;\n    this.#messages = messages;\n"],
      ["capacityConfig.inventoryDetailLabel || \"Залишок ліски\"",
        "capacityConfig.inventoryDetailLabel || this.#messages.lineCapacityInventoryDetail"],
      ["capacityConfig.equippedDetailLabel || \"На котушці\"",
        "capacityConfig.equippedDetailLabel || this.#messages.lineCapacityEquippedDetail"],
      ["capacityConfig.metricLabel || \"Ємність\"", "capacityConfig.metricLabel || this.#messages.lineCapacityMetricLabel"],
      ["capacityConfig.metricSuffix || \"м\"", "capacityConfig.metricSuffix || this.#messages.lineCapacityMetricSuffix"],
    ]),
    // bootstrap.js is CRLF.
    edit(BOOTSTRAP, [
      ["      capacityResolver: new ItemCapacityResolver({ effectiveStatsResolver: effectiveItemStatsResolver }),",
        "      capacityResolver: new ItemCapacityResolver({\r\n        effectiveStatsResolver: effectiveItemStatsResolver,\r\n" +
          "        messages: INVENTORY_RULE_MESSAGES,\r\n      }),"],
    ]),
  ]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: CAPACITY, removedBlockers: Object.freeze([Object.freeze({
      blocker: "mixed-responsibility-requires-decomposition",
      reason: "Its default player-facing capacity labels moved to the injected presentation INVENTORY_RULE_MESSAGES; it keeps only the line capacity metric (labels named by the progression config still pass through, like ItemBoundedMetricResolver)." })]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity: capacity descriptors (every config, item and line context) and catalog baselines
  // (fixed, catalog, fallback, cache identity, invalidation, logged warnings) are identical in the old
  // world and in the new world with the composed injection; the capacity resolver holds no
  // player-facing text.
  parity({ read, before, after }) {
    const world = (source, warnings) => {
      const context = vm.createContext({ console: { warn: (...args) => warnings.push(args) } });
      for (const file of [SLOT_PRESENTATION, RULE_MESSAGES, CAPACITY, BASELINES]) {
        vm.runInContext(source(file), context, { filename: file });
      }
      return context;
    };
    const oldWarnings = [];
    const newWarnings = [];
    const edited = file => file === RULE_MESSAGES || file === CAPACITY;
    const old = world(file => (edited(file) ? before(file) : read(file)), oldWarnings);
    const next = world(file => (edited(file) ? after(file) : read(file)), newWarnings);
    // The unchanged registry runs in both worlds as a control of the catalog-baseline consumers.
    const baseline = vm.runInContext(`${SCENARIOS}({ capacity: {}, baselines: () => ({}) })`, old);
    const injected = vm.runInContext(`${SCENARIOS}({ capacity: { messages: INVENTORY_RULE_MESSAGES },
      baselines: () => ({}) })`, next);
    assert.equal(injected, baseline, "capacity descriptors or catalog baselines changed");
    assert.deepEqual(JSON.parse(JSON.stringify(newWarnings)), JSON.parse(JSON.stringify(oldWarnings)),
      "console warnings changed");
    assert(oldWarnings.length > 0, "the scenarios exercise the catalog fallback warning");
    assert(!/[Ѐ-ӿ]/u.test(after(CAPACITY)), "the capacity resolver still holds player-facing text");
    assert(!/\bINVENTORY_RULE_MESSAGES\b/u.test(after(CAPACITY)), "the capacity resolver names the catalog");
    assert(/new ItemCapacityResolver\(\{\r?\n\s+effectiveStatsResolver: effectiveItemStatsResolver,\r?\n\s+messages: INVENTORY_RULE_MESSAGES,/u
      .test(after(BOOTSTRAP)), "bootstrap injects the rule messages into ItemCapacityResolver");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
