"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const SLOT_PRESENTATION = "src/config/inventory/equipment_slot_presentation_config.js";
const RULE_MESSAGES = "src/config/inventory/inventory_rule_messages.js";
const CAPACITY = "src/core/equipment/inventory_capacity_policy.js";
const LINE_POLICY = "src/core/line/line_allocation_policy.js";
const LINE_CONTROLLER = "src/core/line/line_inventory_controller.js";
const INVENTORY_SYSTEM = "src/systems/inventory_system.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const COMPOSITION = "src/application/inventory/inventory_v2_composition_root.js";
const MIXED = "mixed-responsibility-requires-decomposition";
const DOMAIN_SOURCES = Object.freeze([CAPACITY, LINE_POLICY]);
const lines = values => `${values.join("\n")}\n`;

// The rule-message catalog of prerequisite 007, extended with the inventory group's texts. Metres are
// formatted here exactly as LineAllocationPolicy formatted them before.
const OLD_RULE_MESSAGES = lines([
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
const NEW_RULE_MESSAGES = lines([
  "/**",
  " * Inventory-v2 rule messages shown to the player. Domain rules never hold these",
  " * texts: composition injects this catalog, so every result keeps its exact text.",
  " * Context-dependent entries are functions returning the exact strings.",
  " */",
  "const INVENTORY_RULE_MESSAGES = (() => {",
  "  // Metres as the rules report them: integers as is, other values with one decimal.",
  "  const meters = (value) => {",
  "    const number = Number(value);",
  "    if (!Number.isFinite(number)) return \"0\";",
  "    return Number.isInteger(number) ? String(number) : number.toFixed(1);",
  "  };",
  "  return Object.freeze({",
  "    // Equipment compatibility.",
  "    itemOrSlotMissing: \"Предмет або слот не знайдено.\",",
  "    equipmentSlotLocked: Object.freeze(",
  "      (slotId) =>",
  "        EQUIPMENT_SLOT_PRESENTATION[slotId]?.lockedWarning ||",
  "        \"Цей слот ще не розблоковано.\",",
  "    ),",
  "    slotUnsupportedByRod: \"Цей слот не підтримується обраним вудилищем.\",",
  "    itemNotAcceptedBySlot: \"Предмет не підходить до цієї комірки.\",",
  "    tackleIncompatibleWithRod: \"Ця снасть не сумісна з обраним вудилищем.\",",
  "    // Fishing readiness.",
  "    leaderRequiresReelLine:",
  "      \"Поводок можна спорядити лише після котушки з установленою ліскою.\",",
  "    rodRequired: \"Спочатку спорядіть вудилище.\",",
  "    reelRequired: \"Для цієї вудки потрібна котушка.\",",
  "    reelLineRequired: \"У котушку потрібно встановити ліску.\",",
  "    terminalLineRequired: \"Для закидання потрібно спорядити ліску.\",",
  "    feederHookMissing: \"Снасть споряджена без гачків, тому клювання не буде.\",",
  "    chumBonusMissing: \"Прикормка відсутня: бонус прикормки не діє.\",",
  "    // Equipment transitions and inventory capacity.",
  "    inventoryCapacityExceeded: \"Недостатньо місця в інвентарі.\",",
  "    // Line allocation.",
  "    lineRodRequired: \"Спочатку екіпіруйте вудку для ліски.\",",
  "    lineReelRequired: \"Для цієї вудки спочатку екіпіруйте котушку.\",",
  "    lineTooShortForRod: Object.freeze(",
  "      (minimum) =>",
  "        `Ліска закоротка: потрібно мінімум ${meters(minimum)}м для цієї вудки.`,",
  "    ),",
  "    reelTooSmallForLine: Object.freeze(",
  "      (minimum, maximum) =>",
  "        `Котушка замала: потрібно мінімум ${meters(minimum)}м, а вміщує ${meters(maximum)}м.`,",
  "    ),",
  "    lineWillBeCut: Object.freeze(",
  "      (length) => `Буде відрізано ${meters(length)}м ліски.`,",
  "    ),",
  "    windingReelMissing: \"Котушку для намотування ліски не знайдено.\",",
  "    lineLengthUnavailable: \"У вибраній лісці немає доступної довжини.\",",
  "    reelCapacityUnavailable: \"Котушка не має доступної місткості для ліски.\",",
  "    lineWillBeWound: Object.freeze(",
  "      (length) => `Буде намотано ${meters(length)}м ліски.`,",
  "    ),",
  "  });",
  "})();",
]);

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Serializes results exactly, keeping non-finite numbers and undefined visible.
const REPLACER = `(key, value) => (typeof value === "number" && !Number.isFinite(value)) ? "#" + String(value)
  : value === undefined ? "#undefined" : value`;

// Parity scenarios in the old and in the new classic world; `inject` carries what composition injects.
const SCENARIOS = `((inject) => {
  const facts = [];
  const record = (label, value) => facts.push([label, JSON.stringify(value, ${REPLACER})]);
  const rods = [null, undefined,
    { variant: "pole", effectiveStats: { lengthMeters: 4 } },
    { variant: "pole", effectiveStats: { lengthMeters: 3.25 } },
    { variant: "feeder", effectiveStats: { lengthMeters: 3.6 } },
    { variant: "spinning", effectiveStats: { lengthMeters: 2.1, hasReel: true } },
    { variant: "float", effectiveStats: { lengthMeters: 5, hasReel: false } },
    { variant: "pole", effectiveStats: { lengthMeters: "x" } }, { variant: "bolognese" }];
  const reels = [null, {}, { effectiveStats: { lineCapacityMeters: 0 } }, { effectiveStats: { lineCapacityMeters: -1 } },
    { effectiveStats: { lineCapacityMeters: 5 } }, { effectiveStats: { lineCapacityMeters: 12.5 } },
    { effectiveStats: { lineCapacityMeters: 150 } }, { effectiveStats: { lineCapacityMeters: "wide" } }];
  const lineItems = [null, {}, { effectiveStats: { lengthMeters: 0 } }, { effectiveStats: { lengthMeters: 5 } },
    { effectiveStats: { lengthMeters: 7.75 } }, { effectiveStats: { lengthMeters: 12.5 } },
    { effectiveStats: { lengthMeters: 100 } }, { effectiveStats: { lengthMeters: "long" } }];
  const configs = [undefined, null, {}, { rodLengthReserveMultiplier: 3, noReelMinRodLengthMultiplier: 1.5,
    noReelRodLengthMultiplier: 2.5, noReelExtraLengthMeters: 1.25 }, { rodLengthReserveMultiplier: "x",
    noReelExtraLengthMeters: "y" }];
  for (const config of configs) {
    const policy = new LineAllocationPolicy(config, ...inject.policy);
    const rules = new LineCompatibilityRules(config, ...inject.policy);
    const controller = new LineInventoryController({ lineConfig: config, ...inject.controller });
    for (const lineItem of lineItems) {
      record("length", policy.getLineLengthMeters(lineItem));
      for (const rod of rods) {
        record("minimum", policy.getMinimumLineLengthMeters(rod));
        record("requiresReel", policy.rodRequiresReel(rod));
        for (const reel of reels) {
          const equipment = rod === undefined ? undefined : { rod, reel };
          record("resolve", policy.resolve({ lineItem, equipment }));
          record("rules", rules.validateLine(lineItem, equipment));
          record("controller", controller.validateLine(lineItem, equipment));
          record("maximum", policy.getMaximumLineLengthMeters({ rod, reel }));
          record("rulesMaximum", rules.getMaximumLineLengthMeters(rod, reel));
        }
      }
      for (const reel of [undefined, ...reels]) record("reel", policy.resolveForReel({ lineItem, reel }));
    }
    record("rulesConfig", rules.config === (config || {}) || rules.config);
  }
  for (const result of [true, false, null, undefined, 0, { allowed: false }, { allowed: true, warning: "x", extra: 1 },
    { allowed: false, warning: "" }, { warning: "only" }]) {
    const capacity = new DelegatingInventoryCapacityPolicy(() => result, ...inject.policy);
    const evaluated = capacity.evaluateTransition({ incomingRootInstanceIds: ["a"] });
    record("capacity", { frozen: Object.isFrozen(evaluated), evaluated });
  }
  record("unlimited", new UnlimitedInventoryCapacityPolicy().evaluateTransition({ incomingRootInstanceIds: ["a", "a", null] }));
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.inventory-decomposition, transition 1 (owner decisions
// 2026-09-28, text policy of prerequisite 007): the player-facing texts of InventoryCapacityPolicy's
// delegating strategy and of LineAllocationPolicy (including their metre formatting) move to the shared
// presentation INVENTORY_RULE_MESSAGES. Composition injects it explicitly: bootstrap into
// LineCompatibilityRules (which hands it to LineInventoryController), InventoryV2CompositionRoot through a
// composed linePolicy of InventoryV2LineAllocationService. Results keep their exact texts.
module.exports = Object.freeze({
  sequence: 9,
  slug: "inventory-rule-text-boundary",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.inventory-decomposition",
  intent: "Inventory decomposition 1: DelegatingInventoryCapacityPolicy and LineAllocationPolicy report message keys of the presentation INVENTORY_RULE_MESSAGES (which now also formats the metres in line texts), injected explicitly by bootstrap (LineCompatibilityRules -> LineInventoryController) and by InventoryV2CompositionRoot (composed linePolicy); identical results.",
  sourceEdits: Object.freeze([
    edit(RULE_MESSAGES, [[OLD_RULE_MESSAGES, NEW_RULE_MESSAGES]]),
    edit(CAPACITY, [
      ["  #evaluator;\n\n  constructor(evaluator) {\n",
        "  #evaluator;\n  #messages;\n\n  // The capacity warning text is injected by composition.\n" +
          "  constructor(evaluator, { messages = null } = {}) {\n"],
      ["    this.#evaluator = evaluator;\n", "    this.#evaluator = evaluator;\n    this.#messages = messages;\n"],
      ["result ? null : \"Недостатньо місця в інвентарі.\"", "result ? null : this.#messages.inventoryCapacityExceeded"],
    ]),
    // Mixed line endings: single-line anchors keep every line's own ending (lines 1-7 are CRLF).
    edit(LINE_POLICY, [
      ["  #lineConfig;", "  #lineConfig;\r\n  #messages;"],
      ["  constructor(lineConfig = {}) {", "  // Player-facing texts are injected by composition.\r\n" +
        "  constructor(lineConfig = {}, { messages = null } = {}) {"],
      ["    this.#lineConfig = lineConfig || {};", "    this.#lineConfig = lineConfig || {};\r\n    this.#messages = messages;"],
      ["this.#invalid(\"Спочатку екіпіруйте вудку для ліски.\")", "this.#invalid(this.#messages.lineRodRequired)"],
      ["this.#invalid(\"Для цієї вудки спочатку екіпіруйте котушку.\")", "this.#invalid(this.#messages.lineReelRequired)"],
      ["`Ліска закоротка: потрібно мінімум ${this.#formatMeters(minimumLength)}м для цієї вудки.`",
        "this.#messages.lineTooShortForRod(minimumLength)"],
      ["`Котушка замала: потрібно мінімум ${this.#formatMeters(minimumLength)}м, а вміщує ${this.#formatMeters(maximumLength)}м.`",
        "this.#messages.reelTooSmallForLine(minimumLength, maximumLength)"],
      ["`Буде відрізано ${this.#formatMeters(equipLength)}м ліски.`", "this.#messages.lineWillBeCut(equipLength)"],
      ["this.#invalid(\"Котушку для намотування ліски не знайдено.\")", "this.#invalid(this.#messages.windingReelMissing)"],
      ["this.#invalid(\"У вибраній лісці немає доступної довжини.\")", "this.#invalid(this.#messages.lineLengthUnavailable)"],
      ["this.#invalid(\"Котушка не має доступної місткості для ліски.\")",
        "this.#invalid(this.#messages.reelCapacityUnavailable)"],
      ["`Буде намотано ${this.#formatMeters(equipLength)}м ліски.`", "this.#messages.lineWillBeWound(equipLength)"],
      // The metre formatting moved to the presentation catalog with the texts it served.
      ["  }\n\n  #formatMeters(value) {\n    const number = Number(value);\n    if (!Number.isFinite(number)) return \"0\";\n" +
        "    return Number.isInteger(number) ? String(number) : number.toFixed(1);\n  }\n}", "  }\n}"],
    ]),
    edit(INVENTORY_SYSTEM, [
      ["  #lineConfig;", "  #lineConfig;\r\n  #messages;"],
      ["  constructor(lineConfig = {}) {", "  constructor(lineConfig = {}, { messages = null } = {}) {"],
      ["    this.#policy = new LineAllocationPolicy(this.#lineConfig);",
        "    this.#messages = messages;\r\n    this.#policy = new LineAllocationPolicy(this.#lineConfig, { messages });"],
      ["  get config() {", "  get messages() {\r\n    return this.#messages;\r\n  }\r\n\r\n  get config() {"],
      ["      isEquipped: (instanceId) => this.#isInstanceEquipped(instanceId),",
        "      messages: this.#lineRules.messages,\r\n      isEquipped: (instanceId) => this.#isInstanceEquipped(instanceId),"],
    ]),
    edit(LINE_CONTROLLER, [
      ["    lineConfig,\n    isEquipped,\n", "    lineConfig,\n    messages = null,\n    isEquipped,\n"],
      ["    this.#policy = new LineAllocationPolicy(lineConfig || {});",
        "    this.#policy = new LineAllocationPolicy(lineConfig || {}, { messages });"],
    ]),
    edit(BOOTSTRAP, [
      ["      physicsConfig?.getLineConfig?.() || {},",
        "      physicsConfig?.getLineConfig?.() || {},\r\n      { messages: INVENTORY_RULE_MESSAGES },"],
    ]),
    edit(COMPOSITION, [
      ["    const lineAllocationService = new InventoryV2LineAllocationService({\n",
        "    const lineAllocationService = new InventoryV2LineAllocationService({\n" +
          "      linePolicy: new LineAllocationPolicy(lineConfig, {\n        messages: INVENTORY_RULE_MESSAGES,\n      }),\n"],
    ]),
  ]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: CAPACITY, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The delegating strategy's player-facing capacity warning moved to the injected presentation INVENTORY_RULE_MESSAGES; the file keeps the capacity contract and its unlimited and delegating strategies (one policy family)." })]) }),
    Object.freeze({ currentPath: LINE_POLICY, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "Its player-facing reasons and their metre formatting moved to the injected presentation INVENTORY_RULE_MESSAGES; it keeps only the line length, capacity and split rules." })]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  // Only the two composition roots gain edges: bootstrap reads the catalog, InventoryV2CompositionRoot
  // composes the line policy it injects.
  expectedEdges: Object.freeze({
    removed: Object.freeze([]),
    added: Object.freeze([
      [BOOTSTRAP, RULE_MESSAGES, "INVENTORY_RULE_MESSAGES"].join("\u0000"),
      [COMPOSITION, LINE_POLICY, "LineAllocationPolicy"].join("\u0000"),
    ]),
  }),
  // Focused parity: line allocation (policy, LineCompatibilityRules and LineInventoryController over every
  // config, line, rod and reel), reel winding and capacity strategies are identical in the old world and in
  // the new world with the composed injection; the catalog stays deep-frozen; Domain sources hold no
  // player-facing text and never name the catalog; composition injects it at both roots.
  parity({ read, before, after }) {
    const files = [SLOT_PRESENTATION, RULE_MESSAGES, CAPACITY, LINE_POLICY, LINE_CONTROLLER];
    // Only LineCompatibilityRules is taken from the large inventory system source.
    const rules = source => {
      const start = source.indexOf("class LineCompatibilityRules {");
      const end = source.indexOf("class EquipmentValidator {");
      assert(start > 0 && end > start, "LineCompatibilityRules is not where it is expected");
      return source.slice(start, end);
    };
    const world = source => {
      const context = vm.createContext({ console });
      for (const file of files) vm.runInContext(source(file), context, { filename: file });
      vm.runInContext(rules(source(INVENTORY_SYSTEM)), context, { filename: INVENTORY_SYSTEM });
      return context;
    };
    const old = world(file => (file === SLOT_PRESENTATION ? read(file) : before(file)));
    const next = world(file => (file === SLOT_PRESENTATION ? read(file) : after(file)));
    const baseline = vm.runInContext(`${SCENARIOS}({ policy: [], controller: {} })`, old);
    const injected = vm.runInContext(`${SCENARIOS}({ policy: [{ messages: INVENTORY_RULE_MESSAGES }],
      controller: { messages: INVENTORY_RULE_MESSAGES } })`, next);
    assert.equal(injected, baseline, "line allocation or capacity results changed");
    const deepFrozen = (value, seen = new Set()) => {
      if ((typeof value !== "object" && typeof value !== "function") || value === null || seen.has(value)) return true;
      seen.add(value);
      return Object.isFrozen(value) && Object.values(value).every(child => deepFrozen(child, seen));
    };
    assert(deepFrozen(vm.runInContext("INVENTORY_RULE_MESSAGES", next)), "INVENTORY_RULE_MESSAGES is not deep-frozen");
    for (const file of DOMAIN_SOURCES) {
      assert(!/[Ѐ-ӿ]/u.test(after(file)), `Domain source still holds player-facing text: ${file}`);
      assert(!/\b(?:INVENTORY_RULE_MESSAGES|EQUIPMENT_SLOT_PRESENTATION)\b/u.test(after(file)),
        `Domain source names a presentation catalog: ${file}`);
    }
    assert(/new LineCompatibilityRules\(\r?\n\s+physicsConfig\?\.getLineConfig\?\.\(\) \|\| \{\},\r?\n\s+\{ messages: INVENTORY_RULE_MESSAGES \},/u
      .test(after(BOOTSTRAP)), "bootstrap injects the rule messages into LineCompatibilityRules");
    assert(/linePolicy: new LineAllocationPolicy\(lineConfig, \{\r?\n\s+messages: INVENTORY_RULE_MESSAGES,/u
      .test(after(COMPOSITION)), "InventoryV2CompositionRoot injects the rule messages into the line policy");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
