"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const SLOT_CONFIG = "src/config/inventory/equipment_slot_config.js";
const SLOT_PRESENTATION = "src/config/inventory/equipment_slot_presentation_config.js";
const RULE_MESSAGES = "src/config/inventory/inventory_rule_messages.js";
const CAPACITY = "src/core/equipment/inventory_capacity_policy.js";
const LOADOUT = "src/core/loadouts/equipment_loadout.js";
const PLANNER = "src/core/loadouts/loadout_equipment_transition_planner.js";
const COMPOSITION = "src/application/inventory/inventory_v2_composition_root.js";
const MIXED = "mixed-responsibility-requires-decomposition";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Parity scenarios in the old and in the new classic world; `inject` carries what composition injects.
const SCENARIOS = `((inject) => {
  const facts = [];
  const plain = (value) => value && typeof value === "object"
    ? { frozen: Object.isFrozen(value), value: JSON.parse(JSON.stringify(value)) } : value;
  const loadouts = [
    new EquipmentLoadout({ loadoutId: "full", createdAt: "t", rootInstanceIds: { rod: "rod-a", reel: "reel-a",
      terminalLine: "leader-a", tackle: "tackle-a", float: null } }),
    new EquipmentLoadout({ loadoutId: "partial", createdAt: "t", rootInstanceIds: { rod: "rod-b" } }),
    new EquipmentLoadout({ loadoutId: "empty", createdAt: "t" }),
    new EquipmentLoadout({ loadoutId: "same", createdAt: "t", rootInstanceIds: { rod: "rod-x", reel: "reel-x" } }),
  ];
  const states = [undefined, null, {}, { rod: "rod-x", reel: "reel-x", handChum: "chum", delivery: "boat" },
    { rod: "rod-x", reel: "reel-a", terminalLine: "old-line", tackle: "old-tackle", float: "old-float" },
    { snapshot: () => ({ rod: "rod-y", float: "float-y", net: "net-y" }) }];
  const owners = [null, () => ({ kind: "inventory" }), (id) => (id.startsWith("rod") ? { kind: "loadout",
    loadoutId: "other" } : { kind: "inventory" }), { getOwner: (id) => ({ kind: id.endsWith("a") ? "loadout" : "inventory" }) }];
  const capacities = [null,
    { evaluateTransition: (context) => ({ allowed: true, seen: context.incomingRootInstanceIds.length }) },
    { evaluateTransition: (context) => ({ allowed: false, reason: context.reason, loadout: context.loadoutId }) },
    { evaluateTransition: () => ({ allowed: false, warning: "full" }) },
    new DelegatingInventoryCapacityPolicy(() => false, inject.capacity)];
  for (const capacityPolicy of capacities) {
    for (const ownershipReader of owners) {
      const planner = new LoadoutEquipmentTransitionPlanner({ capacityPolicy, ownershipReader, ...inject.planner });
      for (const loadout of loadouts) {
        for (const equipmentState of states) {
          for (const capacityContext of [undefined, { extra: 1 }]) {
            facts.push(["plan", plain(planner.plan({ loadout, equipmentState, capacityContext }))]);
          }
        }
      }
    }
  }
  try { new LoadoutEquipmentTransitionPlanner(inject.planner).plan({}); } catch (error) {
    facts.push(["error", error.constructor.name, error.message]);
  }
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.loadouts-decomposition, transition 1 (text policy of
// prerequisite 007): LoadoutEquipmentTransitionPlanner's fallback capacity warning moves to the shared
// presentation INVENTORY_RULE_MESSAGES, injected explicitly by InventoryV2CompositionRoot, as for
// ManualRodChangePlanner. Plans keep their exact texts.
module.exports = Object.freeze({
  sequence: 10,
  slug: "loadout-transition-text-boundary",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.loadouts-decomposition",
  intent: "Loadouts decomposition 1: LoadoutEquipmentTransitionPlanner reports the capacity warning key of the presentation INVENTORY_RULE_MESSAGES, injected explicitly by InventoryV2CompositionRoot (as ManualRodChangePlanner since 007); identical plans.",
  sourceEdits: Object.freeze([
    edit(PLANNER, [
      ["  #mainSlotIds;\n\n  constructor({\n    capacityPolicy = null,\n    ownershipReader = null,\n    mainSlotIds = null,\n  } = {}) {\n",
        "  #mainSlotIds;\n  #messages;\n\n  // The capacity warning text is injected by composition.\n  constructor({\n" +
          "    capacityPolicy = null,\n    ownershipReader = null,\n    mainSlotIds = null,\n    messages = null,\n  } = {}) {\n" +
          "    this.#messages = messages;\n"],
      ["capacity.warning || \"Недостатньо місця в інвентарі.\"", "capacity.warning || this.#messages.inventoryCapacityExceeded"],
    ]),
    edit(COMPOSITION, [
      ["      ownershipReader: (instanceId) => loadoutPort.getRootOwner(instanceId),\n    });\n",
        "      ownershipReader: (instanceId) => loadoutPort.getRootOwner(instanceId),\n" +
          "      messages: INVENTORY_RULE_MESSAGES,\n    });\n"],
    ]),
  ]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: PLANNER, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The fallback capacity warning moved to the injected presentation INVENTORY_RULE_MESSAGES; it keeps only the loadout activation planning rule." })]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity: plans for every loadout, equipment state, ownership reader, capacity policy and
  // capacity context are identical in the old world and in the new world with the composed injection;
  // the Domain source holds no player-facing text and never names the catalog.
  parity({ read, before, after }) {
    const world = source => {
      const context = vm.createContext({ console });
      for (const file of [SLOT_CONFIG, SLOT_PRESENTATION, RULE_MESSAGES, CAPACITY, LOADOUT, PLANNER]) {
        vm.runInContext(source(file), context, { filename: file });
      }
      return context;
    };
    const old = world(file => (file === PLANNER ? before(file) : read(file)));
    const next = world(file => (file === PLANNER ? after(file) : read(file)));
    const inject = messages => `{ planner: ${messages}, capacity: { messages: INVENTORY_RULE_MESSAGES } }`;
    const baseline = vm.runInContext(`${SCENARIOS}(${inject("{}")})`, old);
    const injected = vm.runInContext(`${SCENARIOS}(${inject("{ messages: INVENTORY_RULE_MESSAGES }")})`, next);
    assert.equal(injected, baseline, "loadout transition plans changed");
    assert(!/[Ѐ-ӿ]/u.test(after(PLANNER)), "the planner still holds player-facing text");
    assert(!/\bINVENTORY_RULE_MESSAGES\b/u.test(after(PLANNER)), "the planner names the presentation catalog");
    assert(/new LoadoutEquipmentTransitionPlanner\(\{[\s\S]*?messages: INVENTORY_RULE_MESSAGES,\r?\n\s+\}\);/u
      .test(after(COMPOSITION)), "InventoryV2CompositionRoot injects the rule messages into the loadout planner");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
