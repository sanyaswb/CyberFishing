"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const SLOT_CONFIG = "src/config/inventory/equipment_slot_config.js";
const SLOT_PRESENTATION = "src/config/inventory/equipment_slot_presentation_config.js";
const RULE_MESSAGES = "src/config/inventory/inventory_rule_messages.js";
const ROD_CAPABILITY = "src/core/equipment/rod_capability_resolver.js";
const VISIBILITY = "src/core/equipment/equipment_slot_visibility_policy.js";
const TERMINAL_LINE = "src/core/equipment/terminal_line_slot_resolver.js";
const AVAILABILITY = "src/core/equipment/equipment_slot_availability_policy.js";
const PLANNER = "src/core/equipment/equipment_transition_planner.js";
const READINESS = "src/core/equipment/fishing_readiness_policy.js";
const COMPATIBILITY = "src/core/equipment/equipment_compatibility_policy.js";
const VIEW_MODEL = "src/application/inventory/inventory_v2_view_model_factory.js";
const COMPOSITION = "src/application/inventory/inventory_v2_composition_root.js";
const INDEX = "index.html";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/007_equipment-presentation-text-boundary.json";
const SLOT = 30;
const MIXED = "mixed-responsibility-requires-decomposition";
const DOMAIN_SOURCES = Object.freeze([SLOT_CONFIG, COMPATIBILITY, READINESS, PLANNER]);
const lines = values => `${values.join("\n")}\n`;

// Created presentation files (LF like their slot-30 neighbour). Both catalogs are deep-frozen.
const SLOT_PRESENTATION_SOURCE = lines([
  "/**",
  " * Inventory-v2 equipment slot presentation: UI labels, hints and locked-slot",
  " * warnings keyed by the stable slot ids of EQUIPMENT_SLOT_CONFIG (EquipmentSlotId).",
  " */",
  "const EQUIPMENT_SLOT_PRESENTATION = Object.freeze({",
  "  rod: Object.freeze({ label: \"Вудилище\" }),",
  "  reel: Object.freeze({ label: \"Котушка\" }),",
  "  terminalLine: Object.freeze({",
  "    label: \"Поводок / ліска\",",
  "    presentation: \"terminalLine\",",
  "  }),",
  "  tackle: Object.freeze({ label: \"Снасть\" }),",
  "  float: Object.freeze({ label: \"Поплавок\" }),",
  "  handChum: Object.freeze({ label: \"Прикормка\" }),",
  "  net: Object.freeze({ label: \"Підсака\" }),",
  "  delivery: Object.freeze({ label: \"Кораблик\" }),",
  "  gasMask: Object.freeze({",
  "    label: \"Протигаз\",",
  "    lockedWarning: \"Протигаз ще не розблоковано.\",",
  "  }),",
  "});",
]);

const RULE_MESSAGES_SOURCE = lines([
  "/**",
  " * Inventory-v2 rule messages shown to the player. Domain rules never hold these",
  " * texts: composition injects this catalog, so every result keeps its exact text.",
  " * Context-dependent entries are functions returning the exact strings.",
  " */",
  "const INVENTORY_RULE_MESSAGES = Object.freeze({",
  "  // Equipment compatibility.",
  "  itemOrSlotMissing: \"Предмет або слот не знайдено.\",",
  "  equipmentSlotLocked: Object.freeze(",
  "    (slotId) =>",
  "      EQUIPMENT_SLOT_PRESENTATION[slotId]?.lockedWarning ||",
  "      \"Цей слот ще не розблоковано.\",",
  "  ),",
  "  slotUnsupportedByRod: \"Цей слот не підтримується обраним вудилищем.\",",
  "  itemNotAcceptedBySlot: \"Предмет не підходить до цієї комірки.\",",
  "  tackleIncompatibleWithRod: \"Ця снасть не сумісна з обраним вудилищем.\",",
  "  // Fishing readiness.",
  "  leaderRequiresReelLine:",
  "    \"Поводок можна спорядити лише після котушки з установленою ліскою.\",",
  "  rodRequired: \"Спочатку спорядіть вудилище.\",",
  "  reelRequired: \"Для цієї вудки потрібна котушка.\",",
  "  reelLineRequired: \"У котушку потрібно встановити ліску.\",",
  "  terminalLineRequired: \"Для закидання потрібно спорядити ліску.\",",
  "  feederHookMissing: \"Снасть споряджена без гачків, тому клювання не буде.\",",
  "  chumBonusMissing: \"Прикормка відсутня: бонус прикормки не діє.\",",
  "  // Equipment transitions.",
  "  inventoryCapacityExceeded: \"Недостатньо місця в інвентарі.\",",
  "});",
]);

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Parity scenarios, evaluated in the old and in the new classic world. `inject` carries what
// composition injects in the new world; `label` reads the slot label where the view model reads it.
const SCENARIOS = `((inject, label) => {
  const facts = [];
  const plain = (value) => value && typeof value === "object"
    ? { frozen: Object.isFrozen(value), value: JSON.parse(JSON.stringify(value)) } : value;
  const items = new Map();
  const add = (instanceId, itemType, extra = {}) => {
    const item = { instanceId, itemType, quantity: 1, location: { kind: "INVENTORY" }, ...extra };
    items.set(instanceId, item);
    return item;
  };
  const rods = {
    pole: add("pole", "rod", { equipmentCapabilities: { supportsReel: false, supportsFloat: true } }),
    feeder: add("feeder", "rod", { equipmentCapabilities: { supportsReel: true, supportsFeederRig: true } }),
    spinning: add("spinning", "rod", { equipmentCapabilities: { supportsReel: true, supportsLures: true } }),
    bolognese: add("bolognese", "rod", { equipmentCapabilities: { supportsReel: true, supportsFloat: true } }),
    bare: add("bare", "rod", { equipmentCapabilities: {} }),
  };
  for (const id of ["reel", "reel-lined", "reel-line"]) add(id, id === "reel-line" ? "fishing_line" : "reel");
  add("line", "fishing_line");
  add("leader", "leader_line");
  add("rig", "feeder_rig");
  add("rig-hooked", "feeder_rig");
  add("rig-hook", "hook");
  add("rig-chum", "chum_mix");
  add("hook", "hook");
  const children = new Map([
    ["reel-lined|line|0", "reel-line"],
    ["rig-hooked|hook|0", "rig-hook"],
    ["rig-hooked|chum|0", "rig-chum"],
  ]);
  const assemblyReader = {
    getChild: (parent, slot, index) => children.get(parent + "|" + slot + "|" + index) || null,
    getChildren: (parent, slot) => [...children].filter(([key]) => key.startsWith(parent + "|" + slot + "|"))
      .map(([, child]) => child),
  };
  const itemReader = (instanceId) => items.get(instanceId) || null;
  const states = [
    {},
    { rod: "feeder" },
    { rod: "feeder", reel: "reel" },
    { rod: "feeder", reel: "reel-lined", tackle: "rig" },
    { rod: "feeder", reel: "reel-lined", terminalLine: "leader", tackle: "rig-hooked", handChum: "hook" },
    { rod: "pole" },
    { rod: "pole", terminalLine: "line", tackle: "hook", float: "hook" },
    { rod: "spinning", reel: "reel-lined", tackle: "hook" },
    { rod: "missing-rod", reel: "reel", terminalLine: "line", net: "hook", delivery: "rig", gasMask: "hook" },
  ].map((roots) => ({ rootInstanceIds: roots }));
  const itemTypes = ["rod", "reel", "fishing_line", "leader_line", "hook", "feeder_rig", "spring", "feeder_tackle",
    "lure", "spinner", "wobbler", "jig", "float", "chum_mix", "net", "boat", "chum_delivery", "gas_mask", "unknown"];
  const slotIds = [...EQUIPMENT_ALL_SLOT_IDS, "missing"];
  const readiness = new FishingReadinessPolicy({ itemReader, assemblyReader, ...inject.messages });
  const compatibility = new EquipmentCompatibilityPolicy({ slotConfig: EQUIPMENT_SLOT_CONFIG, readinessPolicy: readiness,
    ...inject.messages });
  for (const state of states) {
    for (const slotId of slotIds) {
      for (const item of [null, ...itemTypes.map((itemType) => ({ instanceId: "candidate-" + itemType, itemType })),
        items.get("leader"), items.get("line")]) {
        for (const rod of [null, ...Object.values(rods)]) {
          for (const enforceReadiness of [true, false]) {
            facts.push(["validate", plain(compatibility.validate({ slotId, item, equipmentState: state, rod,
              enforceReadiness }))]);
          }
        }
      }
    }
    for (const slotId of ["reel", "terminalLine", "tackle", "rod"]) {
      for (const id of ["leader", "line", "reel", "hook"]) {
        facts.push(["equip", plain(readiness.validateEquip({ slotId, item: items.get(id), equipmentState: state }))]);
      }
    }
    facts.push(["cast", plain(readiness.evaluateCast({ equipmentState: state }))]);
    facts.push(["bite", plain(readiness.evaluateBite({ equipmentState: state }))]);
    facts.push(["chum", plain(readiness.evaluateChumBonus({ equipmentState: state }))]);
  }
  const capacities = [
    null,
    { evaluateTransition: () => ({ allowed: true }) },
    { evaluateTransition: (context) => ({ allowed: false, seen: context.incomingRootInstanceIds.length }) },
    { evaluateTransition: () => ({ allowed: false, warning: "full" }) },
  ];
  for (const capacityPolicy of capacities) {
    const planner = new ManualRodChangePlanner({ capacityPolicy, ...inject.messages });
    for (const state of states) {
      for (const nextRodInstanceId of [null, "rod-next", state.rootInstanceIds.rod || null]) {
        const plan = planner.plan({ equipmentState: state, nextRodInstanceId });
        facts.push(["plan", plan.constructor.name, plan.isNoop, plain(plan)]);
      }
    }
  }
  const availability = new EquipmentSlotAvailabilityPolicy({ slotConfig: EQUIPMENT_SLOT_CONFIG,
    ...inject.slotPresentation });
  const candidates = [[], [...items.values()], itemTypes.map((itemType) => add("free-" + itemType, itemType))];
  for (const state of states) {
    for (const slotId of slotIds) {
      for (const rod of [null, ...Object.values(rods)]) {
        for (const inventoryItems of candidates) {
          const resolution = availability.resolve({ slotId, equipmentState: state, rod, inventoryItems });
          facts.push(["availability", plain(resolution), availability.getClickWarning(resolution)]);
        }
      }
    }
  }
  for (const slotId of slotIds) facts.push(["label", slotId, label(slotId)]);
  return JSON.stringify(facts);
})`;

const deepFrozen = (value, seen = new Set()) => {
  if ((typeof value !== "object" && typeof value !== "function") || value === null || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every(child => deepFrozen(child, seen));
};
const sortedKeys = value => (value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedKeys(value[key])])) : value);

// Stage 3.22 backlog task stage-3.22.prerequisite.equipment-decomposition, transition 1 of 2 (owner
// decisions 2026-09-28): player-facing texts leave the equipment Domain rules. EQUIPMENT_SLOT_CONFIG
// keeps the Domain slot catalog (ids, groups, visibility rules, accepted types, lock flag); its UI
// labels, presentation hint and locked warning move to the presentation EQUIPMENT_SLOT_PRESENTATION.
// EquipmentCompatibilityPolicy, FishingReadinessPolicy and ManualRodChangePlanner report message keys
// of the presentation INVENTORY_RULE_MESSAGES, which InventoryV2CompositionRoot injects explicitly
// (no Domain default or global read), so every result keeps its exact text. Both catalogs are new
// split members of legacy slot 30; no other slot is renumbered.
module.exports = Object.freeze({
  sequence: 7,
  slug: "equipment-presentation-text-boundary",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.equipment-decomposition",
  intent: "Equipment decomposition 1/2: EQUIPMENT_SLOT_CONFIG keeps the Domain slot catalog while labels, the presentation hint and the locked warning move to the presentation EQUIPMENT_SLOT_PRESENTATION; EquipmentCompatibilityPolicy, FishingReadinessPolicy and ManualRodChangePlanner receive the presentation INVENTORY_RULE_MESSAGES from InventoryV2CompositionRoot (explicit injection, identical results); both catalogs are reviewed split members of legacy slot 30.",
  sourceEdits: Object.freeze([
    edit(SLOT_CONFIG, [
      ["    label: \"Вудилище\",\n", ""],
      ["    label: \"Котушка\",\n", ""],
      ["    label: \"Поводок / ліска\",\n", ""],
      ["    presentation: \"terminalLine\",\n", ""],
      ["    label: \"Снасть\",\n", ""],
      ["    label: \"Поплавок\",\n", ""],
      ["    label: \"Прикормка\",\n", ""],
      ["    label: \"Підсака\",\n", ""],
      ["    label: \"Кораблик\",\n", ""],
      ["    label: \"Протигаз\",\n", ""],
      ["    lockedWarning: \"Протигаз ще не розблоковано.\",\n", ""],
    ]),
    edit(COMPATIBILITY, [
      ["  #readinessPolicy;\n\n  constructor({",
        "  #readinessPolicy;\n  #messages;\n\n  // Player-facing texts are injected by composition.\n  constructor({"],
      ["    readinessPolicy = null,\n  } = {}) {", "    readinessPolicy = null,\n    messages = null,\n  } = {}) {"],
      ["    this.#readinessPolicy = readinessPolicy;\n", "    this.#readinessPolicy = readinessPolicy;\n    this.#messages = messages;\n"],
      ["this.#result(false, \"Предмет або слот не знайдено.\")", "this.#result(false, this.#messages.itemOrSlotMissing)"],
      ["      return this.#result(\n        false,\n        config.lockedWarning || \"Цей слот ще не розблоковано.\",\n      );\n",
        "      return this.#result(false, this.#messages.equipmentSlotLocked(slotId));\n"],
      ["this.#result(false, \"Цей слот не підтримується обраним вудилищем.\")",
        "this.#result(false, this.#messages.slotUnsupportedByRod)"],
      ["this.#result(false, \"Предмет не підходить до цієї комірки.\")",
        "this.#result(false, this.#messages.itemNotAcceptedBySlot)"],
      ["this.#result(false, \"Ця снасть не сумісна з обраним вудилищем.\")",
        "this.#result(false, this.#messages.tackleIncompatibleWithRod)"],
    ]),
    edit(READINESS, [
      ["  #capabilityResolver;\n\n  constructor({\n    itemReader = null,\n    assemblyReader = null,\n" +
        "    capabilityResolver = null,\n  } = {}) {\n    this.#itemReader = itemReader;\n    this.#assemblyReader = assemblyReader;\n",
      "  #capabilityResolver;\n  #messages;\n\n  // Player-facing texts are injected by composition.\n" +
        "  constructor({\n    itemReader = null,\n    assemblyReader = null,\n    capabilityResolver = null,\n" +
        "    messages = null,\n  } = {}) {\n    this.#itemReader = itemReader;\n    this.#assemblyReader = assemblyReader;\n" +
        "    this.#messages = messages;\n"],
      ["\"Поводок можна спорядити лише після котушки з установленою ліскою.\"", "this.#messages.leaderRequiresReelLine"],
      ["\"Спочатку спорядіть вудилище.\"", "this.#messages.rodRequired"],
      ["\"Для цієї вудки потрібна котушка.\"", "this.#messages.reelRequired"],
      ["\"У котушку потрібно встановити ліску.\"", "this.#messages.reelLineRequired"],
      ["\"Для закидання потрібно спорядити ліску.\"", "this.#messages.terminalLineRequired"],
      ["\"Снасть споряджена без гачків, тому клювання не буде.\"", "this.#messages.feederHookMissing"],
      ["\"Прикормка відсутня: бонус прикормки не діє.\"", "this.#messages.chumBonusMissing"],
    ]),
    edit(PLANNER, [
      ["  #mainSlotIds;\n\n  constructor({ capacityPolicy = null, mainSlotIds = null } = {}) {\n",
        "  #mainSlotIds;\n  #messages;\n\n  // The capacity warning text is injected by composition.\n" +
          "  constructor({ capacityPolicy = null, mainSlotIds = null, messages = null } = {}) {\n" +
          "    this.#messages = messages;\n"],
      ["capacity.warning || \"Недостатньо місця в інвентарі.\"", "capacity.warning || this.#messages.inventoryCapacityExceeded"],
    ]),
    edit(AVAILABILITY, [
      ["  #terminalLineResolver;\n\n  constructor({\n    slotConfig = null,\n",
        "  #terminalLineResolver;\n  #slotPresentation;\n\n  constructor({\n    slotConfig = null,\n    slotPresentation = null,\n"],
      ["      (typeof EQUIPMENT_SLOT_CONFIG !== \"undefined\" ? EQUIPMENT_SLOT_CONFIG : {});\n",
        "      (typeof EQUIPMENT_SLOT_CONFIG !== \"undefined\" ? EQUIPMENT_SLOT_CONFIG : {});\n" +
          "    this.#slotPresentation =\n      slotPresentation ||\n" +
          "      (typeof EQUIPMENT_SLOT_PRESENTATION !== \"undefined\"\n        ? EQUIPMENT_SLOT_PRESENTATION\n        : {});\n"],
      ["warning: config.lockedWarning || \"Цей слот ще не розблоковано.\"",
        "warning:\n          this.#slotPresentation[slotId]?.lockedWarning ||\n          \"Цей слот ще не розблоковано.\""],
    ]),
    edit(VIEW_MODEL, [
      ["    return EQUIPMENT_SLOT_CONFIG[slotId]?.label || slotId;\n",
        "    return EQUIPMENT_SLOT_PRESENTATION[slotId]?.label || slotId;\n"],
    ]),
    edit(COMPOSITION, [
      ["      assemblyReader,\n      capabilityResolver,\n    });\n    const compatibilityPolicy",
        "      assemblyReader,\n      capabilityResolver,\n      messages: INVENTORY_RULE_MESSAGES,\n    });\n" +
          "    const compatibilityPolicy"],
      ["      readinessPolicy,\n    });\n    const availabilityPolicy = new EquipmentSlotAvailabilityPolicy({\n" +
        "      slotConfig: EQUIPMENT_SLOT_CONFIG,\n",
      "      readinessPolicy,\n      messages: INVENTORY_RULE_MESSAGES,\n    });\n" +
        "    const availabilityPolicy = new EquipmentSlotAvailabilityPolicy({\n      slotConfig: EQUIPMENT_SLOT_CONFIG,\n" +
        "      slotPresentation: EQUIPMENT_SLOT_PRESENTATION,\n"],
      ["    const rodChangePlanner = new ManualRodChangePlanner({ capacityPolicy });\n",
        "    const rodChangePlanner = new ManualRodChangePlanner({\n      capacityPolicy,\n" +
          "      messages: INVENTORY_RULE_MESSAGES,\n    });\n"],
    ]),
    edit(INDEX, [
      [`    <script src="${SLOT_CONFIG}"></script>\n`,
        `    <script src="${SLOT_CONFIG}" data-legacy-slot="${SLOT}"></script>\n` +
          `    <script src="${SLOT_PRESENTATION}" data-legacy-slot="${SLOT}"></script>\n` +
          `    <script src="${RULE_MESSAGES}" data-legacy-slot="${SLOT}"></script>\n`],
    ]),
  ]),
  createdFiles: Object.freeze([
    Object.freeze({ path: SLOT_PRESENTATION, bytes: () => SLOT_PRESENTATION_SOURCE }),
    Object.freeze({ path: RULE_MESSAGES, bytes: () => RULE_MESSAGES_SOURCE }),
  ]),
  manifestEntries: Object.freeze([SLOT_PRESENTATION, RULE_MESSAGES].map(currentPath => Object.freeze({
    currentPath, currentArea: "config/inventory", legacyLoadOrder: SLOT,
    architecture: Object.freeze({ migrationStatus: "classified", roles: Object.freeze(["presentation"]),
      targetBoundary: "game-presentation",
      targetPath: currentPath === SLOT_PRESENTATION ? "src/game/presentation/inventory/equipment_slot_presentation.js"
        : "src/game/presentation/inventory/inventory_rule_messages.js", migrationWave: 6 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) }))),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: SLOT_CONFIG, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The UI labels, the presentation hint and the locked warning moved to the presentation EQUIPMENT_SLOT_PRESENTATION; the file keeps only the Domain slot catalog (ids, groups, visibility rules, accepted types, lock flag)." })]) }),
    Object.freeze({ currentPath: COMPATIBILITY, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "Its player-facing reasons (including the locked-slot warning) moved to the injected presentation INVENTORY_RULE_MESSAGES; it keeps only the compatibility rules. Its dependencies on the presentation-classified EquipmentSlotVisibilityPolicy and TerminalLineSlotResolver stay tracked by their own boundary-extraction prerequisites (transition 008)." })]) }),
    Object.freeze({ currentPath: PLANNER, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The fallback capacity warning moved to the injected presentation INVENTORY_RULE_MESSAGES; EquipmentTransitionPlan stays with ManualRodChangePlanner as its result type (owner decision 2026-09-28)." })]) }),
    Object.freeze({ currentPath: READINESS, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "Its player-facing warnings moved to the injected presentation INVENTORY_RULE_MESSAGES; the equip, cast, bite and chum readiness rules stay one policy with shouldOpenInventory (owner decision 2026-09-28)." })]) }),
  ]),
  globalProviderAdditions: Object.freeze([
    Object.freeze({ currentPath: SLOT_PRESENTATION, symbol: "EQUIPMENT_SLOT_PRESENTATION", mechanism: "global-lexical",
      availability: "program-init",
      removalCondition: "Removed when its classic consumers (InventoryV2CompositionRoot, InventoryV2ViewModelFactory, EquipmentSlotAvailabilityPolicy and INVENTORY_RULE_MESSAGES) migrate to ESM (Stage 5); it then becomes an ordinary presentation module import. No Domain module reads it." }),
    Object.freeze({ currentPath: RULE_MESSAGES, symbol: "INVENTORY_RULE_MESSAGES", mechanism: "global-lexical",
      availability: "program-init",
      removalCondition: "Removed when its classic consumer InventoryV2CompositionRoot migrates to ESM (Stage 5); composition then imports the presentation catalog and injects it. No Domain module reads it." }),
  ]),
  // Slot 30 splits into the Domain catalog followed by its two presentation catalogs.
  metadataWrites({ read }) {
    const registry = JSON.parse(read(SPLITS));
    assert(!registry.splits.some(split => split.slot === SLOT), "slot 30 is not split yet");
    const splits = [...registry.splits, { slot: SLOT, members: [SLOT_CONFIG, SLOT_PRESENTATION, RULE_MESSAGES],
      transition: RECORD }].sort((left, right) => left.slot - right.slot);
    return new Map([[SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`]]);
  },
  resolvedDebtIds: Object.freeze([]),
  // Only presentation and composition read the new catalogs; no Domain edge changes.
  expectedEdges: Object.freeze({
    removed: Object.freeze([]),
    added: Object.freeze([
      [COMPOSITION, SLOT_PRESENTATION, "EQUIPMENT_SLOT_PRESENTATION"].join("\u0000"),
      [COMPOSITION, RULE_MESSAGES, "INVENTORY_RULE_MESSAGES"].join("\u0000"),
      [VIEW_MODEL, SLOT_PRESENTATION, "EQUIPMENT_SLOT_PRESENTATION"].join("\u0000"),
      [RULE_MESSAGES, SLOT_PRESENTATION, "EQUIPMENT_SLOT_PRESENTATION"].join("\u0000"),
      [AVAILABILITY, SLOT_PRESENTATION, "EQUIPMENT_SLOT_PRESENTATION"].join("\u0000"),
    ]),
  }),
  // Focused parity: compatibility (every slot, item type, rod, state and readiness mode), readiness,
  // rod-change plans, slot availability and slot labels are identical in the old world and in the new
  // world with the composed injections; the catalogs are deep-frozen; merged slot entries equal the
  // old ones; the Domain sources hold no player-facing text and never name the presentation catalogs.
  parity({ read, before, after }) {
    const world = (files, source) => {
      const context = vm.createContext({ console });
      for (const file of [RUNTIME, ...files]) vm.runInContext(source(file), context, { filename: file });
      return context;
    };
    const shared = [ROD_CAPABILITY, VISIBILITY, TERMINAL_LINE];
    const old = world([SLOT_CONFIG, ...shared, AVAILABILITY, READINESS, COMPATIBILITY, PLANNER],
      file => (file === RUNTIME || shared.includes(file) ? read(file) : before(file)));
    const next = world([SLOT_CONFIG, SLOT_PRESENTATION, RULE_MESSAGES, ...shared, AVAILABILITY, READINESS, COMPATIBILITY,
      PLANNER], file => (file === RUNTIME || shared.includes(file) ? read(file) : after(file)));
    const baseline = vm.runInContext(`${SCENARIOS}({ messages: {}, slotPresentation: {} },
      (slotId) => EQUIPMENT_SLOT_CONFIG[slotId]?.label || slotId)`, old);
    const injected = vm.runInContext(`${SCENARIOS}({ messages: { messages: INVENTORY_RULE_MESSAGES },
      slotPresentation: { slotPresentation: EQUIPMENT_SLOT_PRESENTATION } },
      (slotId) => EQUIPMENT_SLOT_PRESENTATION[slotId]?.label || slotId)`, next);
    assert.equal(injected, baseline, "equipment rule results, texts or labels changed");
    const catalog = vm.runInContext("EQUIPMENT_SLOT_CONFIG", old);
    const merged = vm.runInContext(`Object.fromEntries(Object.entries(EQUIPMENT_SLOT_CONFIG).map(([slotId, entry]) =>
      [slotId, { ...entry, ...EQUIPMENT_SLOT_PRESENTATION[slotId] }]))`, next);
    assert.deepEqual(JSON.parse(JSON.stringify(sortedKeys(merged))), JSON.parse(JSON.stringify(sortedKeys(catalog))),
      "Domain catalog plus presentation differs from the old slot config");
    assert.equal(vm.runInContext("JSON.stringify(Object.keys(EQUIPMENT_SLOT_PRESENTATION))", next),
      vm.runInContext("JSON.stringify(EQUIPMENT_ALL_SLOT_IDS)", next), "presentation keys differ from the Domain slot ids");
    for (const name of ["EQUIPMENT_SLOT_CONFIG", "EQUIPMENT_SLOT_PRESENTATION", "INVENTORY_RULE_MESSAGES"]) {
      assert(deepFrozen(vm.runInContext(name, next)), `${name} is not deep-frozen`);
    }
    for (const file of DOMAIN_SOURCES) {
      assert(!/[Ѐ-ӿ]/u.test(after(file)), `Domain source still holds player-facing text: ${file}`);
      assert(!/\b(?:INVENTORY_RULE_MESSAGES|EQUIPMENT_SLOT_PRESENTATION)\b/u.test(after(file)),
        `Domain source names a presentation catalog: ${file}`);
    }
    assert.equal(after(COMPOSITION).split("messages: INVENTORY_RULE_MESSAGES,").length - 1, 3,
      "composition injects the rule messages into exactly the three Domain rules");
    const facts = JSON.parse(baseline);
    return { cases: facts.length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
