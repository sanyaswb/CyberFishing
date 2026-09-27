"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const RESOLVER = "src/core/items/bait/bait_effectiveness_resolver.js";
const DESCRIPTOR = "src/core/items/bait/bait_effectiveness_descriptor.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const COLLABORATORS = [
  "src/core/items/bait/bait_effectiveness_match.js",
  "src/core/items/bait/bait_effectiveness_grade_policy.js",
  "src/core/items/bait/bait_effectiveness_knowledge_policy.js",
  "src/core/items/freshness/bait_freshness_modifier.js",
];

const FISH = [{ id: "carp", name: "Короп", baitMultipliers: { worm: 1.5, corn: 0.8, dough: 2 } },
  { id: "pike", name: "Щука", baitMultipliers: { minnow: 3 } }, { id: "", name: "Nobody" }, null];
const BAITS = ["worm", "corn", "minnow", "none", "", { baitId: "dough", freshnessPercent: 40 }, { itemId: "worm" }];

// Stage 3.22 backlog task: BaitEffectivenessResolver stops constructing the presentation descriptor;
// GameCompositionRoot injects the descriptor factory, so every consumer keeps receiving identical
// BaitEffectivenessDescriptor objects.
module.exports = Object.freeze({
  sequence: 5,
  slug: "bait-effectiveness-descriptor-boundary",
  afterBatch: "034",
  backlogTaskId: "stage-3.22.prerequisite.bait-effectiveness-descriptor-boundary",
  intent: "The Domain BaitEffectivenessResolver no longer depends on the presentation BaitEffectivenessDescriptor; GameCompositionRoot injects the descriptor factory (dependency inversion), so consumers receive identical descriptors.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: RESOLVER, replacements: Object.freeze([
      Object.freeze(["  #freshnessModifier;\n\n  constructor({\n", "  #freshnessModifier;\n  #descriptorFactory;\n\n" +
        "  // The presentation descriptor factory is injected by composition.\n  constructor({\n"]),
      Object.freeze(["    freshnessModifier = new BaitFreshnessModifier(),\n  } = {}) {",
        "    freshnessModifier = new BaitFreshnessModifier(),\n    descriptorFactory,\n  } = {}) {"]),
      Object.freeze(["    this.#freshnessModifier = freshnessModifier;\n  }",
        "    this.#freshnessModifier = freshnessModifier;\n    this.#descriptorFactory = descriptorFactory;\n  }"]),
      Object.freeze(["new BaitEffectivenessDescriptor({", "this.#descriptorFactory({", 3]),
    ]) }),
    Object.freeze({ path: BOOTSTRAP, replacements: Object.freeze([Object.freeze([
      "      freshnessModifier: new BaitFreshnessModifier(),\n    });",
      "      freshnessModifier: new BaitFreshnessModifier(),\n" +
        "      descriptorFactory: (values) => new BaitEffectivenessDescriptor(values),\n    });",
    ])]) }),
  ]),
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-154f09248d8f"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[RESOLVER, DESCRIPTOR, "BaitEffectivenessDescriptor"].join("\u0000")]),
    added: Object.freeze([[BOOTSTRAP, DESCRIPTOR, "BaitEffectivenessDescriptor"].join("\u0000")]),
  }),
  // Focused parity: descriptors, best matches and multipliers are identical for every fish/bait pair.
  parity({ read, before, after }) {
    const facts = (resolverSource, compose) => {
      const context = vm.createContext({ console });
      for (const [file, source] of [[RUNTIME], ...COLLABORATORS.map(file => [file]), [DESCRIPTOR], [RESOLVER, resolverSource]]) {
        vm.runInContext(source ?? read(file), context, { filename: file });
      }
      return vm.runInContext(`(() => {
        const resolver = ${compose};
        const fish = ${JSON.stringify(FISH)}, baits = ${JSON.stringify(BAITS)};
        return JSON.stringify(fish.flatMap(entry => baits.map(bait => {
          const descriptor = resolver.resolve(entry, bait);
          return { type: descriptor.constructor.name, frozen: Object.isFrozen(descriptor), fields: descriptor,
            multiplier: resolver.resolveMultiplier(entry, typeof bait === "string" ? bait : bait.baitId),
            best: resolver.resolveBestMatch(entry, baits) };
        })));
      })()`, context);
    };
    const baseline = facts(before(RESOLVER), "new BaitEffectivenessResolver()");
    const injected = facts(after(RESOLVER),
      "new BaitEffectivenessResolver({ descriptorFactory: (values) => new BaitEffectivenessDescriptor(values) })");
    assert.equal(injected, baseline, "injected descriptor factory changes bait effectiveness descriptors");
    return { cases: FISH.length * BAITS.length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
