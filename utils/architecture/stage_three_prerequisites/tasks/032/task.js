"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const RESOLVER = "src/ui/inventory/inventory_v2_balance_parameter_resolver.js";
const CALCULATOR = "src/core/casting_distance.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const INDEX = "index.html";
const ASSIGNMENT = "    this.#castDistanceCalculator =\n      castDistanceCalculator || this.#createCastDistanceCalculator();\n";
const FALLBACK = "  #createCastDistanceCalculator() {\n    return typeof globalThis.CastDistanceCalculator === \"function\"\n" +
  "      ? new globalThis.CastDistanceCalculator(globalThis.CONFIG || {})\n      : null;\n  }\n\n";

// Owner decision framework 2026-09-29 item 4 (hidden composition), surfaced by batch 043: the inventory
// balance resolver kept a `typeof globalThis.CastDistanceCalculator` fallback. CastDistanceCalculator is a
// classic top-level class declaration, which never becomes a globalThis property, so the fallback always
// returned null; the only production construction (bootstrap) passes the calculator. Once batch 043's
// activation exposes the class on globalThis the dead fallback would start constructing a calculator, a
// silent behaviour change. The fallback is replaced by the null it always produced.
module.exports = Object.freeze({
  sequence: 32,
  slug: "balance-resolver-dead-cast-distance-fallback",
  afterBatch: "042",
  backlogTaskId: "stage-3.22.prerequisite.inventory-decomposition",
  intent: "Replace the inventory balance resolver's typeof globalThis.CastDistanceCalculator fallback, which always returned null (a classic class declaration is not a globalThis property) and is unused in production (bootstrap injects the calculator), by that null, so batch 043's activation cannot revive it.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: RESOLVER, replacements: Object.freeze([
      Object.freeze([ASSIGNMENT, "    this.#castDistanceCalculator = castDistanceCalculator || null;\n"]),
      Object.freeze([FALLBACK, ""]),
    ]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity: the removed fallback was dead (the class declaration adds no globalThis property and no
  // loaded script assigns one), bootstrap injects the calculator, and resolve() is identical with and
  // without an injected calculator in the classic load order.
  parity({ read, before, after }) {
    assert(read(BOOTSTRAP).includes("new InventoryV2BalanceParameterResolver({\n        castDistanceCalculator,") ||
      read(BOOTSTRAP).includes("new InventoryV2BalanceParameterResolver({\r\n        castDistanceCalculator,"),
    "bootstrap injects the calculator");
    const loaded = [...read(INDEX).matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/giu)]
      .map(match => match[1].split("?")[0]).filter(file => file.startsWith("src/"));
    const assigners = loaded.filter(file => /(globalThis|window)\.CastDistanceCalculator\s*=(?!=)/u.test(read(file)));
    assert.deepEqual(assigners, [], "a loaded script assigns globalThis.CastDistanceCalculator");
    const world = resolverSource => {
      const context = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
      vm.runInContext(read(CALCULATOR), context, { filename: CALCULATOR });
      vm.runInContext(resolverSource, context, { filename: RESOLVER });
      assert.equal(vm.runInContext("typeof globalThis.CastDistanceCalculator", context), "undefined");
      return vm.runInContext(`(() => {
        const rod = { itemType: "rod", id: "rod_1", effectiveStats: { lengthMeters: 3, maxLoadKg: 8 } };
        const facts = [];
        for (const injected of [undefined, null, { describe: () => ({ maxCastDistanceMeters: 7 }),
          getBuildCastPowerCoefficient: () => 0.5 }]) {
          const resolver = new InventoryV2BalanceParameterResolver({ castDistanceCalculator: injected, config: {} });
          for (const item of [rod, { itemType: "reel", id: "reel_1" }, null]) {
            try { facts.push(resolver.resolve(item, {})); } catch (error) { facts.push(error.name); }
          }
        }
        return JSON.stringify(facts);
      })()`, context);
    };
    assert(before(RESOLVER).includes(FALLBACK) && !after(RESOLVER).includes("#createCastDistanceCalculator"));
    const baseline = world(before(RESOLVER));
    assert.equal(world(after(RESOLVER)), baseline, "balance resolver behaviour changed");
    return { scenarios: JSON.parse(baseline).length, loadedScripts: loaded.length };
  },
});
