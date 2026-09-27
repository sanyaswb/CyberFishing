"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const REGISTRY = "src/core/assemblies/assembly_profile_registry.js";
const CONFIG = "src/config/inventory/item_assembly_profile_config.js";

// Loads the config script and one registry source into a fresh classic context.
const registryIn = (configSource, registrySource) => {
  const context = vm.createContext({});
  vm.runInContext(configSource, context, { filename: CONFIG });
  vm.runInContext(registrySource, context, { filename: REGISTRY });
  return { Registry: vm.runInContext("AssemblyProfileRegistry", context),
    config: vm.runInContext("ITEM_ASSEMBLY_PROFILE_CONFIG", context) };
};

// Observable registry facts for the configured profile table.
const facts = registry => {
  const items = [{ itemType: "reel" }, { itemType: "hook" }, { itemType: "feeder" }, { itemType: "bait_boat" },
    { itemType: "rod" }, { itemId: "unknown" }];
  const ids = ["reel_standard", "feeder_spring_basic", "hook_standard", "bait_boat", "missing"];
  return JSON.stringify({
    profiles: ids.map(id => registry.get(id)),
    resolved: items.map(item => registry.resolveProfileIdForItem(item)),
    explicit: registry.resolveProfileIdForItem({ itemType: "reel" }, "hook_standard"),
  });
};

// Stage 3.22 backlog task: deliver ITEM_ASSEMBLY_PROFILE_CONFIG to AssemblyProfileRegistry only
// through its constructor. Both composition call sites already pass the frozen table explicitly;
// the transition removes the default-parameter read of the raw config global from the Domain module.
module.exports = Object.freeze({
  sequence: 1,
  slug: "assembly-profile-registry-config-injection",
  afterBatch: "034",
  backlogTaskId: "stage-3.22.prerequisite.assembly-profile-registry-config-injection",
  intent: "The raw ITEM_ASSEMBLY_PROFILE_CONFIG global is read only by composition code; the registry receives it through its constructor.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: REGISTRY, replacements: Object.freeze([
      Object.freeze(["    profileConfig = ITEM_ASSEMBLY_PROFILE_CONFIG,\n", "    profileConfig,\n"]),
    ]) }),
  ]),
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-0bc38e6e1330"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([`${REGISTRY}\u0000${CONFIG}\u0000ITEM_ASSEMBLY_PROFILE_CONFIG`]),
    added: Object.freeze([]),
  }),
  // Focused parity: every composition call site passes the configured table, so the before source
  // (default parameter) and the after source (explicit table) expose identical registries.
  parity({ read, before, after }) {
    const configSource = read(CONFIG);
    const old = registryIn(configSource, before(REGISTRY));
    const next = registryIn(configSource, after(REGISTRY));
    const baseline = facts(new old.Registry());
    assert.equal(facts(new old.Registry(old.config)), baseline, "explicit table differs from the old default");
    assert.equal(facts(new next.Registry(next.config)), baseline, "injected registry differs from the old default");
    assert.equal(facts(new next.Registry(next.config, { itemDefinitionResolver: null })), baseline);
    assert.equal(new next.Registry().get("reel_standard"), null, "the Domain registry no longer reads the config global");
    return { cases: 4, factsSha256: require("node:crypto").createHash("sha256").update(baseline).digest("hex") };
  },
});
