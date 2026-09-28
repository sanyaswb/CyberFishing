"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const PHYSICS_FILES = Object.freeze([
  "src/config/physics/environment_physics_config.js",
  "src/config/physics/retrieve_physics_config.js",
  "src/config/physics/fight_physics_config.js",
  "src/config/physics/tackle_physics_config.js",
  "src/config/physics/tension_physics_config.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
]);
const UTILS = "src/app/utils.js";
const CONVERTER = "src/core/distance_unit_converter.js";
const CASTING = "src/core/casting_distance.js";
const RULES = "src/app/rules.js";
const BOOTSTRAP = "src/app/bootstrap.js";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// EquipmentRules scenarios over every public method; `rules` is built the way each world composes it.
const SCENARIOS = `((rules) => {
  const facts = [];
  const record = (label, value) => facts.push([label, JSON.stringify(value, (key, item) =>
    typeof item === "number" && !Number.isFinite(item) ? String(item) : item)]);
  const rods = [undefined, { variant: "spinning", effectiveStats: { lengthMeters: 2.4 } },
    { variant: "feeder", effectiveStats: { lengthMeters: 3.6 } }, { variant: "float", effectiveStats: { hasReel: true } },
    { variant: "pole", effectiveStats: { lengthMeters: 5 } }, { variant: "bolognese" }];
  const extras = [{}, { line: { effectiveStats: { lengthMeters: 30 } } }, { reel: { effectiveStats: { lineCapacityMeters: 100 } },
    line: { effectiveStats: { lengthMeters: 12 } }, baits: [{ type: "worm" }], float: { effectiveStats: { maxDepth: 2 } } }];
  for (const rod of rods) {
    for (const extra of extras) {
      const equipment = { rod, ...extra };
      for (const method of ["isSpinning", "isFeeder", "isFloatRod", "getRodKind", "getRodDisplayName", "requiresReel",
        "hasEquippedLine", "canSelectDepth"]) record(method, rules[method](equipment));
      record("castPower", [rules.getCastPowerCoefficient(equipment), rules.getCastPowerCoefficient(equipment, 0.4),
        rules.getCastPowerCoefficient(null)]);
      record("floatBudget", [rules.getFloatLineBudget(equipment), rules.getFloatLineBudget(equipment, 1.5)]);
      record("hookDepth", rules.getMaxHookDepth(equipment, CONFIG));
    }
  }
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 2 (owner
// decision 2026-09-29, point B): EquipmentRules no longer falls back to the raw CONFIG global; the
// production composition (GameCompositionRoot.create) passes the same runtime config it already holds.
module.exports = Object.freeze({
  sequence: 19,
  slug: "equipment-rules-config-injection",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 2: EquipmentRules receives the runtime config only by injection (GameCompositionRoot passes the CONFIG it holds) instead of defaulting to the raw CONFIG global; identical rules.",
  sourceEdits: Object.freeze([
    edit(RULES, [[
      "    this.#config = config || (typeof CONFIG !== \"undefined\" ? CONFIG : {});",
      "    // Composition injects the runtime config.\r\n    this.#config = config || {};",
    ]]),
    edit(BOOTSTRAP, [[
      "    const equipmentRules = new EquipmentRules(castDistanceCalculator);",
      "    const equipmentRules = new EquipmentRules(castDistanceCalculator, this.#config);",
    ]]),
  ]),
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-6c47bcdb972b"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[RULES, "src/config/config.js", "CONFIG"].join("\u0000")]),
    added: Object.freeze([]),
  }),
  // Focused parity: every EquipmentRules method gives identical results with the old CONFIG default and
  // with the injected config (the same object); rules.js never names the CONFIG global.
  parity({ read, before, after }) {
    const world = rules => {
      const context = vm.createContext({ console });
      for (const file of PHYSICS_FILES) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(`var CONFIG = { physics: PHYSICS_CONFIG, casting: { powerCoefficient: 0.7, floatDepth: {} } };
        Object.defineProperty(CONFIG, "fightPhysicsConfig", { value: new FightPhysicsConfigAdapter(CONFIG) });`, context);
      for (const file of [UTILS, CONVERTER, CASTING]) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(rules, context, { filename: RULES });
      return context;
    };
    const baseline = vm.runInContext(`${SCENARIOS}(new EquipmentRules(new CastDistanceCalculator(CONFIG)))`,
      world(before(RULES)));
    const injected = vm.runInContext(`${SCENARIOS}(new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG))`,
      world(after(RULES)));
    assert.equal(injected, baseline, "EquipmentRules results changed");
    assert(!/\bCONFIG\b/u.test(after(RULES)), "rules.js still names the CONFIG global");
    assert(/new EquipmentRules\(castDistanceCalculator, this\.#config\)/u.test(after(BOOTSTRAP)),
      "GameCompositionRoot injects the runtime config");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
