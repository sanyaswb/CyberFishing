"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const LANDING = "src/core/fishing/landing_policy.js";
const RETRIEVE = "src/core/fishing/retrieve_policy.js";
// The copy prerequisite 015 placed in retrieve_policy.js, byte-identical (CRLF) to the one in landing_policy.js.
const DUPLICATE = "// Composition passes a config carrying its FightPhysicsConfigAdapter (CONFIG or ConfigProvider);\r\n" +
  "// it is read on every call, so DEV overrides stay live.\r\n" +
  "function resolveFightPhysicsConfig(config) {\r\n" +
  "  if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\r\n  return null;\r\n}\r\n\r\n";

// Parity scenarios: every retrieve policy and the resolver over adapter-less, partial and complete fight
// physics configs (CONFIG carries the adapter as a non-enumerable property, ConfigProvider as a getter),
// a live adapter replacement reaching an existing policy, and the landing policies reading the same helper.
const SCENARIOS = `(() => {
  const adapter = (passive, pole, pixelsPerMeter, catchZone) => ({ getPassiveRetrieveConfig: () => passive,
    getPoleIdleRetrieveConfig: () => pole, getPixelsPerMeter: () => pixelsPerMeter, getCatchZoneConfig: () => catchZone });
  const hidden = value => { const config = {}; Object.defineProperty(config, "fightPhysicsConfig", { value }); return config; };
  const getter = value => ({ get fightPhysicsConfig() { return value; } });
  const configs = [undefined, null, {}, { fightPhysicsConfig: null }, hidden(adapter()), getter(adapter({}, {}, 0, {})),
    hidden(adapter({ passiveRetrievePowerRatio: 0.4, multiplier: 20, waterFriction: 0.5 },
      { speedMetersPerSecond: 2, waterFrictionMultiplier: 0.3 }, 60, { landingDistanceMeters: 3 })),
    getter(adapter({ power: 0.7, multiplier: 0 }, { speedMetersPerSecond: -1 }, "x",
      { reel: { landingDistanceMeters: 2 }, pole: { landingDistanceByRodLength: 0.5 } }))];
  const facts = [];
  const passive = new PassiveLureRetrievePolicy();
  const pole = new PoleIdleRetrievePolicy();
  for (const config of configs) {
    facts.push(["passive", passive.getRetrieveParams({ config })], ["pole", pole.getRetrieveParams({ config })],
      ["base", new RetrievePolicy().getRetrieveParams({ config })],
      ["reel-landing", new ReelLandingPolicy().getLandingDistanceMeters({ config })],
      ["pole-landing", new PoleLandingPolicy().getLandingDistanceMeters({ rod: { getLengthMeters: () => 4 }, config })]);
  }
  const resolver = new IdleRetrievePolicyResolver();
  for (const [rod, reel] of [[undefined, undefined], [{ hasReel: () => false }, {}], [{}, { hasReel: () => true }],
    [{ effectiveStats: { hasReel: true } }, { effectiveStats: { basePower: 2 } }], [{}, { effectiveStats: {} }]]) {
    const policy = resolver.resolve({ rod, reel });
    facts.push(["resolve", policy === resolver.defaultPolicy ? "default" : "pole", policy.getRetrieveParams({ config: configs[6] })]);
  }
  // A live adapter replacement (DEV override) reaches the existing policy on its next call.
  const live = { fightPhysicsConfig: adapter({ multiplier: 1 }) };
  facts.push(["live-before", passive.getRetrieveParams({ config: live })]);
  live.fightPhysicsConfig = adapter({ multiplier: 2 });
  facts.push(["live-after", passive.getRetrieveParams({ config: live })]);
  facts.push(["helper", typeof resolveFightPhysicsConfig, resolveFightPhysicsConfig.name, resolveFightPhysicsConfig.length]);
  return JSON.stringify(facts, (key, value) => value === undefined ? "#undefined" :
    typeof value === "number" && !Number.isFinite(value) ? String(value) : value);
})()`;

// Stage 3.41 batch 041 prerequisite (owner decision 2026-09-30, "Видалити дублікат"): landing_policy.js
// and retrieve_policy.js both declared the identical global helper resolveFightPhysicsConfig (prerequisite
// 015). As ESM targets of one cumulative runtime the two same-named functions cannot both keep their name
// (the bundler renames one, and the source-build identity guard rejects it). The copy in retrieve_policy.js
// is removed; the retrieve policies read the one global function that landing_policy.js (legacy slot 120)
// declares before retrieve_policy.js (slot 121) evaluates. Identical behaviour: the helpers were byte-identical
// and are read only at call time.
module.exports = Object.freeze({
  sequence: 30,
  slug: "retrieve-policy-duplicate-helper-removal",
  afterBatch: "040",
  backlogTaskId: "stage-3.22.prerequisite.fishing-systems-decomposition",
  intent: "Remove the duplicate resolveFightPhysicsConfig declaration from retrieve_policy.js (recorded global-provider removal); the retrieve policies read the byte-identical helper declared by landing_policy.js at the earlier legacy slot, so both policy families share one helper with identical behaviour.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: RETRIEVE, replacements: Object.freeze([Object.freeze([DUPLICATE, ""])]) }),
  ]),
  globalProviderRemovals: Object.freeze([Object.freeze({ currentPath: RETRIEVE, symbol: "resolveFightPhysicsConfig",
    mechanism: "global-function",
    reason: "A byte-identical duplicate of the landing_policy.js helper; the retrieve policies read that declaration." })]),
  resolvedDebtIds: Object.freeze([]),
  // One Domain-to-Domain edge: the retrieve policies now read the landing_policy.js helper.
  expectedEdges: Object.freeze({ removed: Object.freeze([]),
    added: Object.freeze([`${RETRIEVE}\u0000${LANDING}\u0000resolveFightPhysicsConfig`]) }),
  // Focused parity: the removed text is exactly the duplicate, landing_policy.js still declares the same
  // bytes, and every retrieve and landing scenario is identical with both classic files loaded in slot order.
  parity({ read, before, after }) {
    assert(read(LANDING).includes(DUPLICATE), "landing_policy.js keeps the identical helper");
    assert.equal(before(RETRIEVE).replace(DUPLICATE, ""), after(RETRIEVE), "only the duplicate is removed");
    assert(!after(RETRIEVE).includes("function resolveFightPhysicsConfig"), "retrieve_policy.js declares no helper");
    const world = retrieve => {
      const context = vm.createContext({});
      vm.runInContext(read(LANDING), context, { filename: LANDING });
      vm.runInContext(retrieve, context, { filename: RETRIEVE });
      return vm.runInContext(SCENARIOS, context);
    };
    const baseline = world(before(RETRIEVE));
    assert.equal(world(after(RETRIEVE)), baseline, "retrieve or landing behaviour changed");
    return { scenarios: JSON.parse(baseline).length, baselineLength: baseline.length };
  },
});
