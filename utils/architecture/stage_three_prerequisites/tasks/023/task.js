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
const SLOT_PRESENTATION = "src/config/inventory/equipment_slot_presentation_config.js";
const RULE_MESSAGES = "src/config/inventory/inventory_rule_messages.js";
const RULES = "src/app/rules.js";
const BOOTSTRAP = "src/app/bootstrap.js";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// EquipmentRules scenarios over every public method (as in 019) plus rod kinds outside the label
// table; `rules` is built the way each world composes it.
const SCENARIOS = `((rules) => {
  const facts = [];
  const record = (label, value) => facts.push([label, JSON.stringify(value, (key, item) =>
    typeof item === "number" && !Number.isFinite(item) ? String(item) : item)]);
  const rods = [undefined, null, { variant: "spinning", effectiveStats: { lengthMeters: 2.4 } },
    { variant: "feeder", effectiveStats: { lengthMeters: 3.6 } }, { variant: "float", effectiveStats: { hasReel: true } },
    { variant: "float" }, { variant: "pole", effectiveStats: { lengthMeters: 5 } }, { variant: "bolognese" },
    { variant: "unknown" }, { variant: "" }, {}, { variant: "carp" }];
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
  record("noEquipment", [rules.getRodKind(null), rules.getRodDisplayName(null), rules.getRodDisplayName(undefined)]);
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 6 (owner
// decision 2026-09-29, round 4 point 3): the player-facing rod kind names leave EquipmentRules for a
// separate, explicitly named `rodKinds` section of the presentation INVENTORY_RULE_MESSAGES (kept apart
// so it can move to its own catalog at the ESM migration); GameCompositionRoot injects the catalog.
module.exports = Object.freeze({
  sequence: 23,
  slug: "rod-kind-labels-injection",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 6: EquipmentRules.getRodDisplayName reads the rod kind names from the rodKinds section of the injected presentation INVENTORY_RULE_MESSAGES (GameCompositionRoot passes it) instead of holding UI text; identical names.",
  sourceEdits: Object.freeze([
    edit(RULE_MESSAGES, [[
      "    lineCapacityEquippedDetail: \"На котушці\",\n  });\n",
      "    lineCapacityEquippedDetail: \"На котушці\",\n" +
      "    // Rod kind names shown for the equipped rod (EquipmentRules.getRodKind ids). A separate section,\n" +
      "    // moved to its own catalog when the catalogs become ESM modules.\n" +
      "    rodKinds: Object.freeze({\n" +
      "      bolognese: \"Болонська\",\n" +
      "      feeder: \"Фідер\",\n" +
      "      none: \"Не споряджена\",\n" +
      "      pole: \"Махова\",\n" +
      "      spinning: \"Спінінг\",\n" +
      "      unknown: \"Невідомий тип\",\n" +
      "    }),\n" +
      "  });\n",
    ]]),
    edit(RULES, [
      ["  #castDistanceCalculator;\n  #config;\n\n  constructor(castDistanceCalculator = null, config = null) {\n",
        "  #castDistanceCalculator;\n  #config;\n  #messages;\n\n  // Composition injects the presentation rule messages (INVENTORY_RULE_MESSAGES) for the rod kind names.\n" +
        "  constructor(castDistanceCalculator = null, config = null, messages = null) {\n"],
      ["    this.#config = config || {};\n    this.#castDistanceCalculator =\n",
        "    this.#config = config || {};\n    this.#messages = messages;\n    this.#castDistanceCalculator =\n"],
      ["  getRodDisplayName(equipment) {\n    const labels = {\n      bolognese: \"Болонська\",\n      feeder: \"Фідер\",\n" +
        "      none: \"Не споряджена\",\n      pole: \"Махова\",\n      spinning: \"Спінінг\",\n    };\n" +
        "    return labels[this.getRodKind(equipment)] || \"Невідомий тип\";\n  }\n",
        "  getRodDisplayName(equipment) {\n    const labels = this.#messages.rodKinds;\n" +
        "    return labels[this.getRodKind(equipment)] || labels.unknown;\n  }\n"],
    ]),
    edit(BOOTSTRAP, [[
      "    const equipmentRules = new EquipmentRules(castDistanceCalculator, this.#config);",
      "    const equipmentRules = new EquipmentRules(castDistanceCalculator, this.#config, INVENTORY_RULE_MESSAGES);",
    ]]),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity: every EquipmentRules method (as in 019, with rod kinds outside the table and no
  // equipment) gives identical results with the old inline labels and with the injected catalog; the
  // existing catalog entries are unchanged; rules.js holds no Cyrillic text.
  parity({ read, before, after }) {
    const world = (rules, messages) => {
      const context = vm.createContext({ console });
      for (const file of PHYSICS_FILES) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(`var CONFIG = { physics: PHYSICS_CONFIG, casting: { powerCoefficient: 0.7, floatDepth: {} } };
        Object.defineProperty(CONFIG, "fightPhysicsConfig", { value: new FightPhysicsConfigAdapter(CONFIG) });`, context);
      for (const file of [UTILS, CONVERTER, CASTING, SLOT_PRESENTATION]) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(messages, context, { filename: RULE_MESSAGES });
      vm.runInContext(rules, context, { filename: RULES });
      return context;
    };
    const oldWorld = world(before(RULES), before(RULE_MESSAGES));
    const newWorld = world(after(RULES), after(RULE_MESSAGES));
    const baseline = vm.runInContext(`${SCENARIOS}(new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG))`, oldWorld);
    const injected = vm.runInContext(
      `${SCENARIOS}(new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG, INVENTORY_RULE_MESSAGES))`, newWorld);
    assert.equal(injected, baseline, "EquipmentRules results changed");
    const catalog = context => JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries(Object.entries(INVENTORY_RULE_MESSAGES)
      .filter(([key]) => key !== "rodKinds").map(([key, value]) => [key, typeof value === "function" ? value(7.25, 12) : value])))`, context));
    assert.deepEqual(catalog(newWorld), catalog(oldWorld), "existing rule messages changed");
    assert.equal(vm.runInContext("Object.isFrozen(INVENTORY_RULE_MESSAGES.rodKinds)", newWorld), true, "rodKinds is not frozen");
    const names = JSON.parse(baseline).filter(([label]) => label === "getRodDisplayName").map(([, value]) => JSON.parse(value));
    assert.deepEqual([...new Set(names)].sort(), ["Болонська", "Махова", "Невідомий тип", "Не споряджена", "Спінінг", "Фідер"].sort(),
      "every rod kind name is exercised");
    assert(!/[А-Яа-яІіЇїЄєҐґ]/u.test(after(RULES)), "rules.js still holds UI text");
    assert(/new EquipmentRules\(castDistanceCalculator, this\.#config, INVENTORY_RULE_MESSAGES\)/u.test(after(BOOTSTRAP)),
      "GameCompositionRoot injects the rule messages");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
