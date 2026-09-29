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
const MIXED = "mixed-responsibility-requires-decomposition";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Every rule class composed as GameCompositionRoot composes it (bootstrap.js 546-552), over equipment,
// boat and cast inputs; `compose()` returns the seven rule objects.
const SCENARIOS = `((compose) => {
  const { equipmentRules, baitRules, castRules, biteRules, chumRules, boatRules, playerCastRules } = compose();
  const facts = [];
  const record = (label, value) => facts.push([label, JSON.stringify(value, (key, item) =>
    typeof item === "number" && !Number.isFinite(item) ? String(item) : item)]);
  const rods = [undefined, { variant: "spinning", effectiveStats: { lengthMeters: 2.4 } },
    { variant: "feeder", effectiveStats: { lengthMeters: 3.6 } }, { variant: "float", effectiveStats: { hasReel: true } },
    { variant: "float" }, { variant: "pole", effectiveStats: { lengthMeters: 5 } }, { variant: "carp" }];
  const extras = [{}, { line: { effectiveStats: { lengthMeters: 30 } } }, { reel: { effectiveStats: { lineCapacityMeters: 100 } },
    line: { effectiveStats: { lengthMeters: 12 } }, baits: [{ type: "worm", effectiveStats: { hookSizeGrade: 4 } }],
    hooks: [{ effectiveStats: { hookSizeGrade: 6 } }], float: { effectiveStats: { maxDepth: 2 } } },
    { reel: {}, line: { effectiveStats: { lengthMeters: 8 } }, delivery: { effectiveStats: { manualControl: false } },
      deliveryChums: [null, { id: "c" }] }];
  const boats = [null, { state: "idle", remainingSections: 0, pos: { y: 0 } }, { state: "waiting", remainingSections: 2, pos: { y: 900 } },
    { state: "drifting", remainingSections: 1, pos: { y: 10 } }, { state: "returning", remainingSections: 0, pos: { y: 950 } }];
  const bounds = { top: 0, bottom: 1000, left: 0, right: 800 };
  for (const rod of rods) {
    for (const extra of extras) {
      const equipment = { rod, ...extra };
      for (const method of ["getRodKind", "getRodDisplayName", "requiresReel", "hasEquippedLine", "canSelectDepth"]) {
        record(method, equipmentRules[method](equipment));
      }
      for (const [vx, vy] of [[400, 950], [400, 600], [100, 100], [400, -50]]) {
        record("canCastAt", [castRules.canCastAt(vx, vy, equipment, bounds, { x: 400, y: 1000 }),
          castRules.canCastAt(vx, vy, equipment, bounds, null, 1.5)]);
      }
      record("hookSize", biteRules.getHookSize(equipment));
      record("chum", [chumRules.getDeliveryMethod(equipment), chumRules.hasLoadedDeliveryChum(equipment)]);
      for (const boat of boats) record("canPlayerCast", playerCastRules.canPlayerCast(equipment, boat));
    }
  }
  const template = { biteMechanics: { active: { id: "active" }, passive: { id: "passive" } } };
  for (const types of [[], ["worm"], ["spinner"], ["float", "jig"]]) {
    record("biteSequence", [biteRules.selectBiteSequence(template, types), biteRules.selectBiteSequence({}, types)]);
  }
  for (const boat of boats) {
    for (const item of [undefined, { effectiveStats: { manualControl: true, hasAutoReturn: true } }]) {
      record("boat", [boatRules.isBusy(boat), boatRules.canBeRemovedNearShore(boat, bounds), boatRules.canAcceptManualTarget(boat),
        boatRules.canDropManualChum(boat, item), boatRules.canAutoReturn(item), boatRules.canPlayerCastWithBoat(boat, item)]);
    }
  }
  record("bait", [baitRules.isActiveLure({ itemType: "lure" }), baitRules.getPhysicsType({ variant: "jig" }), baitRules.getSinkRate({})]);
  record("identity", [castRules.equipmentRules === equipmentRules, playerCastRules.equipmentRules === equipmentRules,
    playerCastRules.boatRules === boatRules, biteRules.baitRules === baitRules]);
  return JSON.stringify(facts);
})`;

// The composition of bootstrap.js (lines 546-552), unchanged by this transition.
const COMPOSE = `() => {
  const castDistanceCalculator = new CastDistanceCalculator(CONFIG);
  const equipmentRules = new EquipmentRules(castDistanceCalculator, CONFIG, INVENTORY_RULE_MESSAGES);
  const baitRules = new BaitRules();
  const castRules = new CastRules(equipmentRules);
  const biteRules = new BiteRules(baitRules);
  const chumRules = new ChumRules();
  const boatRules = new BoatRules();
  const playerCastRules = new PlayerCastRules(boatRules, equipmentRules);
  return { equipmentRules, baitRules, castRules, biteRules, chumRules, boatRules, playerCastRules };
}`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 7 (owner
// decision 2026-09-29): the gameplay rules no longer compose their own collaborators. The default
// parameters `= new EquipmentRules()`, `= new BaitRules()`, `= new BoatRules()` and EquipmentRules'
// `|| new CastDistanceCalculator(...)` fallback (the same hidden composition; framework question 4) are
// removed; every production construction site (GameCompositionRoot, bootstrap.js 546-552) and every check
// harness (game-cycle, float-depth-cast) already passes them. No new throws or validation. With UI text
// (023), the raw config read (019) and self-composition gone, rules.js holds seven cohesive gameplay rule
// classes with one engine dependency: it is reclassified without a split (framework question 9).
module.exports = Object.freeze({
  sequence: 24,
  slug: "gameplay-rules-self-composition-removal",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 7: the gameplay rule classes stop composing their own collaborators (EquipmentRules, BaitRules, BoatRules defaults and the CastDistanceCalculator fallback removed; composition already passes them all); rules.js is reclassified as cohesive without a split; identical rules.",
  sourceEdits: Object.freeze([
    edit(RULES, [
      ["    this.#castDistanceCalculator =\n      castDistanceCalculator || new CastDistanceCalculator(this.#config);\n",
        "    this.#castDistanceCalculator = castDistanceCalculator;\n"],
      ["  constructor(equipmentRules = new EquipmentRules()) {", "  constructor(equipmentRules) {"],
      ["  constructor(baitRules = new BaitRules()) {", "  constructor(baitRules) {"],
      ["  constructor(boatRules = new BoatRules(), equipmentRules = new EquipmentRules()) {",
        "  constructor(boatRules, equipmentRules) {"],
    ]),
  ]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: RULES, removedBlockers: Object.freeze([
      Object.freeze({ blocker: "high-level-self-composition",
        reason: "No rule class constructs a collaborator any more: the EquipmentRules/BaitRules/BoatRules defaults and the CastDistanceCalculator fallback are removed; GameCompositionRoot (bootstrap.js 546-552) passes every collaborator, as do the game-cycle and float-depth-cast harnesses." }),
      Object.freeze({ blocker: MIXED,
        reason: "Seven cohesive gameplay rule classes (equipment, bait, cast, bite, chum, boat, player cast). Since 019 no raw config read, since 023 no UI text (rod kind names injected), since 024 no self-composition; the only confirmed dependency is the engine normalizeDistance (app/utils.js); no DEV, browser API or known debt. Reclassified without a split (not split for size)." }),
    ]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[RULES, CASTING, "CastDistanceCalculator"].join("\u0000")]),
    added: Object.freeze([]),
  }),
  // Focused parity: every rule class composed exactly as bootstrap composes it gives identical results and
  // identical collaborator identity before and after; rules.js constructs no collaborator; the production
  // composition passes every collaborator.
  parity({ read, before, after }) {
    const world = rules => {
      const context = vm.createContext({ console });
      for (const file of PHYSICS_FILES) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(`var CONFIG = { physics: PHYSICS_CONFIG, casting: { powerCoefficient: 0.7, floatDepth: {} } };
        Object.defineProperty(CONFIG, "fightPhysicsConfig", { value: new FightPhysicsConfigAdapter(CONFIG) });`, context);
      for (const file of [UTILS, CONVERTER, CASTING, SLOT_PRESENTATION, RULE_MESSAGES]) {
        vm.runInContext(read(file), context, { filename: file });
      }
      vm.runInContext(rules, context, { filename: RULES });
      return context;
    };
    const baseline = vm.runInContext(`${SCENARIOS}(${COMPOSE})`, world(before(RULES)));
    assert.equal(vm.runInContext(`${SCENARIOS}(${COMPOSE})`, world(after(RULES))), baseline, "rule results changed");
    assert(!/\bnew\s+[A-Z]\w*\s*\(/u.test(after(RULES)), "rules.js still constructs a collaborator");
    const composition = /const equipmentRules = new EquipmentRules\(castDistanceCalculator, this\.#config, INVENTORY_RULE_MESSAGES\);\s+const baitRules = new BaitRules\(\);\s+const castRules = new CastRules\(equipmentRules\);\s+const biteRules = new BiteRules\(baitRules\);\s+const chumRules = new ChumRules\(\);\s+const boatRules = new BoatRules\(\);\s+const playerCastRules = new PlayerCastRules\(boatRules, equipmentRules\);/u;
    assert(composition.test(read(BOOTSTRAP)), "GameCompositionRoot passes every rule collaborator");
    assert.equal((read(BOOTSTRAP).match(/new (?:Equipment|Cast|Bite|PlayerCast)Rules\(/gu) || []).length, 4,
      "one production construction site per composed rule class");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
