"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const RESOLVER = "src/core/items/freshness/item_freshness_resolver.js";
const DESCRIPTOR = "src/core/items/freshness/item_freshness_descriptor.js";
const DECAY = "src/core/items/freshness/bait_freshness_decay_policy.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const BASE = "src/core/items/metrics/item_bounded_metric_resolver.js";

const PROFILE = { minimum: 0, maximum: 100, defaultCurrent: 100, instanceStatePath: "instanceState.freshness",
  statPath: "gameplayStats.freshness", metricLabel: "Свіжість", lossPerMinute: 2, minimumMultiplier: 0.5 };
const ITEMS = [{}, { instanceState: { freshness: 60 } }, { gameplayStats: { freshness: 120 } },
  { instanceState: { freshness: "x" } }];
const CONFIGS = [PROFILE, { ...PROFILE, lossPerMinute: 0 }, { minimum: 3, maximum: 1 }, null];
const EXPOSURES = [0, 30000, 3600000];

// Stage 3.22 backlog task: ItemFreshnessResolver stops constructing the presentation descriptor. It
// receives the descriptor factory from composition, hands it to ItemBoundedMetricResolver and uses
// it for the projected descriptor, so every consumer keeps receiving identical descriptors.
module.exports = Object.freeze({
  sequence: 4,
  slug: "item-freshness-descriptor-boundary",
  afterBatch: "034",
  backlogTaskId: "stage-3.22.prerequisite.item-freshness-descriptor-boundary",
  intent: "The Domain ItemFreshnessResolver no longer depends on the presentation ItemFreshnessDescriptor; GameCompositionRoot injects the descriptor factory (dependency inversion), so consumers receive identical descriptors.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: RESOLVER, replacements: Object.freeze([
      Object.freeze(["  #profileProvider;\n  #decayPolicy;\n", "  #profileProvider;\n  #decayPolicy;\n  #descriptorFactory;\n"]),
      Object.freeze(["  constructor({\n    profileProvider,\n    decayPolicy = new BaitFreshnessDecayPolicy(),\n  } = {}) {",
        "  // The presentation descriptor factory is injected by composition.\n" +
          "  constructor({\n    profileProvider,\n    decayPolicy = new BaitFreshnessDecayPolicy(),\n    descriptorFactory,\n  } = {}) {"]),
      Object.freeze(["      descriptorFactory: (values) => new ItemFreshnessDescriptor(values),\n    });\n" +
          "    this.#profileProvider = profileProvider;",
        "      descriptorFactory,\n    });\n    this.#descriptorFactory = descriptorFactory;\n    this.#profileProvider = profileProvider;"]),
      Object.freeze(["    return new ItemFreshnessDescriptor({\n", "    return this.#descriptorFactory({\n"]),
    ]) }),
    Object.freeze({ path: BOOTSTRAP, replacements: Object.freeze([Object.freeze([
      "      profileProvider: metricCapabilityProvider(\"freshness\"),\n    });",
      "      profileProvider: metricCapabilityProvider(\"freshness\"),\n" +
        "      descriptorFactory: (values) => new ItemFreshnessDescriptor(values),\n    });",
    ])]) }),
  ]),
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-f634d3d2e71b"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[RESOLVER, DESCRIPTOR, "ItemFreshnessDescriptor"].join("\u0000")]),
    added: Object.freeze([[BOOTSTRAP, DESCRIPTOR, "ItemFreshnessDescriptor"].join("\u0000")]),
  }),
  // Focused parity: old and injected resolvers return descriptors of the same class with identical
  // fields for every profile, item and exposure (including the projected decay path).
  parity({ read, before, after }) {
    const facts = (resolverSource, compose) => {
      const context = vm.createContext({ console });
      for (const [file, source] of [[RUNTIME], [BASE], [DECAY], [DESCRIPTOR], [RESOLVER, resolverSource]]) {
        vm.runInContext(source ?? read(file), context, { filename: file });
      }
      return vm.runInContext(`(() => {
        const resolver = ${compose};
        const configs = ${JSON.stringify(CONFIGS)};
        return JSON.stringify(${JSON.stringify(ITEMS)}.flatMap(item => configs.flatMap(config =>
          ${JSON.stringify(EXPOSURES)}.map(exposureMs => {
            const descriptor = resolver.resolve(item, config, { exposureMs });
            return descriptor === null ? null : { type: descriptor.constructor.name, frozen: Object.isFrozen(descriptor),
              fields: descriptor };
          }))));
      })()`, context);
    };
    const baseline = facts(before(RESOLVER), "new ItemFreshnessResolver({ profileProvider: () => null })");
    const injected = facts(after(RESOLVER), "new ItemFreshnessResolver({ profileProvider: () => null, " +
      "descriptorFactory: (values) => new ItemFreshnessDescriptor(values) })");
    assert.equal(injected, baseline, "injected descriptor factory changes freshness descriptors");
    return { cases: ITEMS.length * CONFIGS.length * EXPOSURES.length,
      factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
