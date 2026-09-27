"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const RESOLVER = "src/core/items/condition/item_condition_resolver.js";
const DESCRIPTOR = "src/core/items/condition/item_condition_descriptor.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const BASE = "src/core/items/metrics/item_bounded_metric_resolver.js";

// Condition profiles and items covering available, clamped, default, missing and invalid values.
const PROFILE = { minimum: 0, maximum: 100, defaultCurrent: 100, statPath: "gameplayStats.condition",
  instanceStatePath: "instanceState.condition", metricLabel: "Стан" };
const ITEMS = [{}, { gameplayStats: { condition: 40 } }, { instanceState: { condition: 150 } },
  { instanceState: { condition: -5 } }, { instanceState: { condition: "x" } }];
const CONFIGS = [PROFILE, { ...PROFILE, metricLabel: undefined }, { minimum: 5, maximum: 5 }, "bad", null];

// Stage 3.22 backlog task: ItemConditionResolver stops constructing the presentation descriptor.
// Like ItemBoundedMetricResolver it receives the descriptor factory from composition, so every
// consumer keeps receiving identical ItemConditionDescriptor objects.
module.exports = Object.freeze({
  sequence: 3,
  slug: "item-condition-descriptor-boundary",
  afterBatch: "034",
  backlogTaskId: "stage-3.22.prerequisite.item-condition-descriptor-boundary",
  intent: "The Domain ItemConditionResolver no longer depends on the presentation ItemConditionDescriptor; GameCompositionRoot injects the descriptor factory (dependency inversion), so consumers receive identical descriptors.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: RESOLVER, replacements: Object.freeze([Object.freeze([
      "  constructor({ profileProvider } = {}) {\n    super({\n      capabilityId: \"condition\",\n      profileProvider,\n" +
        "      descriptorFactory: (values) => new ItemConditionDescriptor(values),\n    });",
      "  // The presentation descriptor factory is injected by composition.\n" +
        "  constructor({ profileProvider, descriptorFactory } = {}) {\n    super({\n      capabilityId: \"condition\",\n" +
        "      profileProvider,\n      descriptorFactory,\n    });",
    ])]) }),
    Object.freeze({ path: BOOTSTRAP, replacements: Object.freeze([Object.freeze([
      "      profileProvider: metricCapabilityProvider(\"condition\"),\n    });",
      "      profileProvider: metricCapabilityProvider(\"condition\"),\n" +
        "      descriptorFactory: (values) => new ItemConditionDescriptor(values),\n    });",
    ])]) }),
  ]),
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-00960a39c848"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[RESOLVER, DESCRIPTOR, "ItemConditionDescriptor"].join("\u0000")]),
    added: Object.freeze([[BOOTSTRAP, DESCRIPTOR, "ItemConditionDescriptor"].join("\u0000")]),
  }),
  // Focused parity: the old resolver and the injected one return descriptors of the same class
  // with identical fields for every profile and item.
  parity({ read, before, after }) {
    const facts = (resolverSource, compose) => {
      const context = vm.createContext({ console });
      for (const [file, source] of [[RUNTIME], [BASE], [DESCRIPTOR], [RESOLVER, resolverSource]]) {
        vm.runInContext(source ?? read(file), context, { filename: file });
      }
      return vm.runInContext(`(() => {
        const resolver = ${compose};
        const configs = ${JSON.stringify(CONFIGS)};
        return JSON.stringify(${JSON.stringify(ITEMS)}.flatMap(item => configs.map(config => {
          const descriptor = resolver.resolve(item, config);
          return descriptor === null ? null : { type: descriptor.constructor.name, frozen: Object.isFrozen(descriptor),
            fields: descriptor };
        })));
      })()`, context);
    };
    const baseline = facts(before(RESOLVER), "new ItemConditionResolver({ profileProvider: () => null })");
    const injected = facts(after(RESOLVER), "new ItemConditionResolver({ profileProvider: () => null, " +
      "descriptorFactory: (values) => new ItemConditionDescriptor(values) })");
    assert.equal(injected, baseline, "injected descriptor factory changes condition descriptors");
    return { cases: ITEMS.length * CONFIGS.length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
