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
const LABEL = "src/ui/inventory/terminal_line_slot_label_resolver.js";
const AVAILABILITY = "src/core/equipment/equipment_slot_availability_policy.js";
const READINESS = "src/core/equipment/fishing_readiness_policy.js";
const COMPATIBILITY = "src/core/equipment/equipment_compatibility_policy.js";
const VIEW_MODEL = "src/application/inventory/inventory_v2_view_model_factory.js";
const COMPOSITION = "src/application/inventory/inventory_v2_composition_root.js";
const INDEX = "index.html";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/008_equipment-slot-rule-reclassification.json";
const SLOT = 159;
const lines = values => `${values.join("\n")}\n`;

// Created presentation file (LF like its slot-159 neighbour). It never reads the RodCapabilityResolver
// global: composition injects the capability resolver, so the bridge consumer set stays unchanged.
const LABEL_SOURCE = lines([
  "/**",
  " * Inventory-v2 terminal-line slot label: a reel rod takes a leader, any other",
  " * rod a main line; without a rod the slot names both. Composition injects the",
  " * rod capability resolver.",
  " */",
  "class TerminalLineSlotLabelResolver {",
  "  #capabilityResolver;",
  "",
  "  constructor({ capabilityResolver = null } = {}) {",
  "    this.#capabilityResolver = capabilityResolver;",
  "  }",
  "",
  "  resolve(rod) {",
  "    if (!rod) return \"Поводок / ліска\";",
  "    const supportsReel =",
  "      this.#capabilityResolver?.resolve?.(rod)?.supportsReel === true;",
  "    return supportsReel ? \"Поводок\" : \"Ліска\";",
  "  }",
  "}",
]);

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

const sortedKeys = value => (value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedKeys(value[key])])) : value);

// Parity scenarios, evaluated in the old and in the new classic world. `terminal(resolver, rod)`
// reads the old combined result or the new Domain result plus the presentation label.
const SCENARIOS = `((compose) => {
  const facts = [];
  const plain = (value) => value && typeof value === "object"
    ? { frozen: Object.isFrozen(value), value: JSON.parse(JSON.stringify(value)) } : value;
  const capabilityResolver = new RodCapabilityResolver();
  const { terminalLineResolver, terminal, label } = compose(capabilityResolver);
  const rods = [null, undefined, {}, { itemType: "rod" },
    { itemType: "rod", equipmentCapabilities: { supportsReel: false, supportsFloat: true } },
    { itemType: "rod", equipmentCapabilities: { supportsReel: true, supportsFeederRig: true } },
    { itemType: "rod", equipmentCapabilities: { supportsReel: true, supportsLures: true } },
    { itemType: "rod", equipmentCapabilities: { supportsReel: true, supportsFloat: true } },
    { itemType: "rod", capabilities: ["reel"] }, { itemType: "rod", capabilities: { reel: true, float: true } },
    { itemType: "rod", capabilities: ["float"] }, { itemType: "rod", equipmentCapabilities: { supportsReel: "yes" } }];
  for (const rod of rods) {
    facts.push(["terminal", terminal(terminalLineResolver, rod)]);
    facts.push(["terminal-default", terminal(new TerminalLineSlotResolver(), rod)]);
    facts.push(["label", label(rod)]);
  }
  const visibilityPolicy = new EquipmentSlotVisibilityPolicy({ slotConfig: EQUIPMENT_SLOT_CONFIG, capabilityResolver });
  const readinessPolicy = new FishingReadinessPolicy({ itemReader: () => null, assemblyReader: {}, capabilityResolver,
    messages: INVENTORY_RULE_MESSAGES });
  const compatibility = new EquipmentCompatibilityPolicy({ slotConfig: EQUIPMENT_SLOT_CONFIG, visibilityPolicy,
    terminalLineResolver, capabilityResolver, readinessPolicy, messages: INVENTORY_RULE_MESSAGES });
  const availability = new EquipmentSlotAvailabilityPolicy({ slotConfig: EQUIPMENT_SLOT_CONFIG,
    slotPresentation: EQUIPMENT_SLOT_PRESENTATION, visibilityPolicy, terminalLineResolver });
  const itemTypes = ["rod", "reel", "fishing_line", "leader_line", "hook", "feeder_rig", "lure", "float", "chum_mix",
    "net", "boat", "gas_mask", "unknown"];
  const inventoryItems = itemTypes.map((itemType) => ({ instanceId: "free-" + itemType, itemType, quantity: 1,
    location: { kind: "INVENTORY" } }));
  const states = [{}, { rootInstanceIds: { rod: "rod", reel: "reel" } }, { rootInstanceIds: { terminalLine: "line" } }];
  for (const slotId of [...EQUIPMENT_ALL_SLOT_IDS, "missing"]) {
    for (const rod of rods) {
      for (const equipmentState of states) {
        for (const item of [null, ...inventoryItems]) {
          for (const enforceReadiness of [true, false]) {
            facts.push(["validate", plain(compatibility.validate({ slotId, item, equipmentState, rod, enforceReadiness }))]);
          }
        }
        for (const candidates of [[], inventoryItems]) {
          facts.push(["availability", plain(availability.resolve({ slotId, equipmentState, rod,
            inventoryItems: candidates }))]);
        }
      }
    }
  }
  return JSON.stringify(facts);
})`;

// Old world: one resolver returns the slot id, label and accepted types. New world: the Domain
// resolver returns the slot id and accepted types, the presentation resolver the label.
const OLD_COMPOSE = `(capabilityResolver) => {
  const terminalLineResolver = new TerminalLineSlotResolver({ capabilityResolver });
  const terminal = (resolver, rod) => {
    const result = resolver.resolve(rod);
    return { frozen: Object.isFrozen(result), acceptFrozen: Object.isFrozen(result.acceptTypes),
      keys: Object.keys(result).sort(), value: Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(result)))
        .sort(([left], [right]) => (left < right ? -1 : 1))) };
  };
  return { terminalLineResolver, terminal, label: (rod) => terminalLineResolver.resolve(rod).label };
}`;
const NEW_COMPOSE = `(capabilityResolver) => {
  const terminalLineResolver = new TerminalLineSlotResolver({ capabilityResolver });
  const labelResolver = new TerminalLineSlotLabelResolver({ capabilityResolver });
  const terminal = (resolver, rod) => {
    const result = resolver.resolve(rod);
    if ("label" in result) throw new Error("the Domain terminal-line result still carries a label");
    const combined = { ...result, label: labelResolver.resolve(rod) };
    return { frozen: Object.isFrozen(result), acceptFrozen: Object.isFrozen(result.acceptTypes),
      keys: Object.keys(combined).sort(), value: Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(combined)))
        .sort(([left], [right]) => (left < right ? -1 : 1))) };
  };
  return { terminalLineResolver, terminal, label: (rod) => labelResolver.resolve(rod) };
}`;

// Stage 3.22 backlog task stage-3.22.prerequisite.equipment-decomposition, transition 2 of 2 (owner
// decisions 2026-09-28): TerminalLineSlotResolver keeps the Domain rule (slot id and accepted terminal
// line types per rod) while its UI labels move to the presentation TerminalLineSlotLabelResolver, which
// composition injects into the view model. TerminalLineSlotResolver and EquipmentSlotVisibilityPolicy
// (a pure rod-capability slot-support rule, unchanged source) are reclassified to game-domain; their
// migration wave derives from the boundary. EquipmentCompatibilityPolicy's two forbidden Domain ->
// presentation edges become Domain -> Domain, resolving their known debts.
module.exports = Object.freeze({
  sequence: 8,
  slug: "equipment-slot-rule-reclassification",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.equipment-decomposition",
  intent: "Equipment decomposition 2/2: TerminalLineSlotResolver keeps the Domain accepted-type rule and its labels move to the presentation TerminalLineSlotLabelResolver (reviewed split member of legacy slot 159, capability resolver injected by InventoryV2CompositionRoot); TerminalLineSlotResolver and the unchanged EquipmentSlotVisibilityPolicy are reclassified to game-domain, so EquipmentCompatibilityPolicy depends only on Domain rules.",
  sourceEdits: Object.freeze([
    edit(TERMINAL_LINE, [
      ["class TerminalLineSlotResolver {\n",
        "// Domain rule: the terminal-line slot takes a leader on reel rods and a main line\n" +
          "// otherwise. Its UI labels are resolved in presentation.\nclass TerminalLineSlotResolver {\n"],
      ["        label: \"Поводок / ліска\",\n", ""],
      ["      label: supportsReel ? \"Поводок\" : \"Ліска\",\n", ""],
    ]),
    edit(VIEW_MODEL, [
      ["  #terminalLineResolver;\n", "  #terminalLineLabelResolver;\n"],
      ["    terminalLineResolver,\n", "    terminalLineLabelResolver,\n"],
      ["    this.#terminalLineResolver = terminalLineResolver;\n",
        "    this.#terminalLineLabelResolver = terminalLineLabelResolver;\n"],
      ["      return this.#terminalLineResolver.resolve(rod).label;\n",
        "      return this.#terminalLineLabelResolver.resolve(rod);\n"],
    ]),
    edit(COMPOSITION, [
      ["    const terminalLineResolver = new TerminalLineSlotResolver({\n      capabilityResolver,\n    });\n",
        "    const terminalLineResolver = new TerminalLineSlotResolver({\n      capabilityResolver,\n    });\n" +
          "    const terminalLineLabelResolver = new TerminalLineSlotLabelResolver({\n      capabilityResolver,\n    });\n"],
      ["      availabilityPolicy,\n      terminalLineResolver,\n      compatibilityPolicy,\n",
        "      availabilityPolicy,\n      terminalLineLabelResolver,\n      compatibilityPolicy,\n"],
    ]),
    edit(INDEX, [
      [`    <script src="${TERMINAL_LINE}"></script>\n`,
        `    <script src="${TERMINAL_LINE}" data-legacy-slot="${SLOT}"></script>\n` +
          `    <script src="${LABEL}" data-legacy-slot="${SLOT}"></script>\n`],
    ]),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: LABEL, bytes: () => LABEL_SOURCE })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: LABEL, currentArea: "ui/inventory", legacyLoadOrder: SLOT,
    architecture: Object.freeze({ migrationStatus: "classified", roles: Object.freeze(["presentation"]),
      targetBoundary: "game-presentation",
      targetPath: "src/game/presentation/inventory/terminal_line_slot_label_resolver.js", migrationWave: 6 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  reclassifiedWithoutEdit: Object.freeze([VISIBILITY]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: TERMINAL_LINE, architecture: Object.freeze({ roles: Object.freeze(["domain-behavior"]),
      targetBoundary: "game-domain", targetPath: "src/game/domain/equipment/terminal_line_slot_resolver.js" }) }),
    Object.freeze({ currentPath: VISIBILITY, architecture: Object.freeze({ roles: Object.freeze(["domain-behavior"]),
      targetBoundary: "game-domain", targetPath: "src/game/domain/equipment/equipment_slot_visibility_policy.js" }) }),
  ]),
  globalProviderAdditions: Object.freeze([
    Object.freeze({ currentPath: LABEL, symbol: "TerminalLineSlotLabelResolver", mechanism: "global-lexical",
      availability: "program-init",
      removalCondition: "Removed when its classic consumer InventoryV2CompositionRoot migrates to ESM (Stage 5); composition then imports the presentation resolver and injects it into the view model. No Domain module reads it." }),
  ]),
  // Slot 159 splits into the Domain terminal-line rule followed by its presentation label resolver.
  metadataWrites({ read }) {
    const registry = JSON.parse(read(SPLITS));
    assert(!registry.splits.some(split => split.slot === SLOT), "slot 159 is not split yet");
    const splits = [...registry.splits, { slot: SLOT, members: [TERMINAL_LINE, LABEL], transition: RECORD }]
      .sort((left, right) => left.slot - right.slot);
    return new Map([[SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`]]);
  },
  resolvedDebtIds: Object.freeze([
    "debt-boundary-dependency-e6ee565161e4",
    "debt-boundary-dependency-2882b596d7b6",
  ]),
  // Only composition names the presentation label resolver; the view model receives it by injection.
  expectedEdges: Object.freeze({
    removed: Object.freeze([]),
    added: Object.freeze([[COMPOSITION, LABEL, "TerminalLineSlotLabelResolver"].join("\u0000")]),
  }),
  // Focused parity: for every rod shape the Domain terminal-line result plus the presentation label
  // equal the old combined result (fields, frozenness), labels are identical, and compatibility and
  // slot availability over every slot, rod, state and item are identical; the Domain source holds no
  // player-facing text and the label resolver never reads the RodCapabilityResolver global.
  parity({ read, before, after }) {
    const shared = [SLOT_CONFIG, SLOT_PRESENTATION, RULE_MESSAGES, ROD_CAPABILITY, VISIBILITY];
    const rest = [AVAILABILITY, READINESS, COMPATIBILITY];
    const world = (files, source) => {
      const context = vm.createContext({ console });
      for (const file of [RUNTIME, ...files]) vm.runInContext(source(file), context, { filename: file });
      return context;
    };
    const old = world([...shared, TERMINAL_LINE, ...rest], file => (file === TERMINAL_LINE ? before(file) : read(file)));
    const next = world([...shared, TERMINAL_LINE, LABEL, ...rest], file => (file === TERMINAL_LINE || file === LABEL
      ? after(file) : read(file)));
    const baseline = vm.runInContext(`${SCENARIOS}(${OLD_COMPOSE})`, old);
    const split = vm.runInContext(`${SCENARIOS}(${NEW_COMPOSE})`, next);
    assert.equal(split, baseline, "terminal-line results, labels, compatibility or availability changed");
    assert(!/[Ѐ-ӿ]/u.test(after(TERMINAL_LINE)), "the Domain terminal-line rule still holds player-facing text");
    assert(!/\b(?:TerminalLineSlotLabelResolver|INVENTORY_RULE_MESSAGES|EQUIPMENT_SLOT_PRESENTATION)\b/u
      .test(after(TERMINAL_LINE)), "the Domain terminal-line rule names a presentation provider");
    assert(!/\bRodCapabilityResolver\b/u.test(after(LABEL)), "the label resolver reads the RodCapabilityResolver global");
    assert(/const terminalLineLabelResolver = new TerminalLineSlotLabelResolver\(\{\r?\n\s+capabilityResolver,/u
      .test(after(COMPOSITION)), "composition injects the capability resolver into the label resolver");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
