"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const STAMINA = "src/systems/stamina_system.js";
const BUFFS = "src/systems/buff_manager.js";
const ROD_PULL = "src/core/fishing/rod_pull_calculator.js";
const INDEX = "index.html";
const BASELINE = "architecture/guards/global_provider_baseline.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/016_stamina-buff-split-and-review.json";
const SLOT = 207;
const MIXED = "mixed-responsibility-requires-decomposition";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
// The exact BuffManager declaration of stamina_system.js (CRLF, as in the file); it moves byte-for-byte.
const DECLARATION = "class BuffManager {\r\n  #activeBuffs;\r\n\r\n  constructor() {\r\n    this.#activeBuffs = [];\r\n  }\r\n\r\n" +
  "  addBuff(multiplier, duration) {\r\n    this.#activeBuffs.push({ multiplier, remainingMs: duration });\r\n  }\r\n\r\n" +
  "  update(dt) {\r\n    for (let i = this.#activeBuffs.length - 1; i >= 0; i--) {\r\n" +
  "      this.#activeBuffs[i].remainingMs -= dt;\r\n      if (this.#activeBuffs[i].remainingMs <= 0) {\r\n" +
  "        this.#activeBuffs.splice(i, 1);\r\n      }\r\n    }\r\n  }\r\n\r\n" +
  "  getTotalMultiplier() {\r\n    let multiplier = 1.0;\r\n    for (let i = 0; i < this.#activeBuffs.length; i++) {\r\n" +
  "      multiplier *= this.#activeBuffs[i].multiplier;\r\n    }\r\n    return multiplier;\r\n  }\r\n}\r\n";

const SCENARIOS = `(() => {
  const facts = [];
  const buffs = new BuffManager();
  facts.push(["empty", buffs.getTotalMultiplier()]);
  buffs.addBuff(1.5, 100); buffs.addBuff(0.5, 250); buffs.addBuff(2, 0); buffs.addBuff("3", 50);
  for (const dt of [0, 25, 50, 100, 150, 1000]) { buffs.update(dt); facts.push(["step", dt, buffs.getTotalMultiplier()]); }
  facts.push(["methods", Object.getOwnPropertyNames(BuffManager.prototype).sort()]);
  return JSON.stringify(facts);
})()`;

// Stage 3.22 backlog task stage-3.22.prerequisite.fishing-systems-decomposition, transition 2 (owner
// decision 2026-09-28, point 6): StaminaController and RodPullCalculator are reclassified as cohesive
// (no hot-loop split: no forbidden dependency, and splitting per-frame code risks performance without an
// architectural gain). The unrelated BuffManager leaves stamina_system.js byte-for-byte for its own file,
// a reviewed split member of legacy slot 207; its global provider moves with it (no new global).
module.exports = Object.freeze({
  sequence: 16,
  slug: "stamina-buff-split-and-review",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.fishing-systems-decomposition",
  intent: "Fishing-systems decomposition 2: the unrelated BuffManager moves byte-for-byte from stamina_system.js into src/systems/buff_manager.js (reviewed split member of legacy slot 207, provider moved, no new global); StaminaController (edited file) and the unchanged RodPullCalculator (recorded evidence) lose the mixed-responsibility blocker as cohesive hot-loop rules.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: STAMINA, replacements: Object.freeze([Object.freeze([`}\r\n\r\n${DECLARATION}`, "}\r\n"])]) }),
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      `    <script src="${STAMINA}"></script>\n`,
      `    <script src="${STAMINA}" data-legacy-slot="${SLOT}"></script>\n` +
        `    <script src="${BUFFS}" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: BUFFS, bytes({ read }) {
    assert(read(STAMINA).endsWith(`}\r\n\r\n${DECLARATION}`), "stamina_system.js no longer ends with the reviewed BuffManager");
    return DECLARATION;
  } })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: BUFFS, currentArea: "systems", legacyLoadOrder: SLOT,
    architecture: Object.freeze({ migrationStatus: "classified", roles: Object.freeze(["domain-behavior"]),
      targetBoundary: "game-domain", targetPath: "src/game/domain/fishing/buff_manager.js", migrationWave: 1 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  reviewedWithoutEdit: Object.freeze([ROD_PULL]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: STAMINA, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "StaminaController is one cohesive fight-stamina controller (stamina/endurance frames, mastery window, exhaustion debuff); reclassified as cohesive without a hot-loop split (owner decision 2026-09-28). The unrelated BuffManager moved byte-for-byte to its own file." })]) }),
    Object.freeze({ currentPath: ROD_PULL, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "One per-frame rod-pull rule (stroke capacity, force limit, next pull state) with no forbidden dependency (recorded evidence); reclassified as cohesive without a hot-loop split (owner decision 2026-09-28)." })]) }),
  ]),
  // The BuffManager provider moves with its declaration (same symbol and mechanism); slot 207 splits.
  metadataWrites({ read }) {
    const baseline = JSON.parse(read(BASELINE));
    const moved = baseline.providers.filter(provider => provider.currentPath === STAMINA && provider.symbol === "BuffManager");
    assert.equal(moved.length, 1, "exactly one BuffManager provider moves");
    const providers = baseline.providers.map(provider => (provider === moved[0] ? { ...provider, currentPath: BUFFS } : provider))
      .sort((left, right) => compare(left.currentPath, right.currentPath) || compare(left.symbol, right.symbol) ||
        compare(left.mechanism, right.mechanism));
    const registry = JSON.parse(read(SPLITS));
    assert(!registry.splits.some(split => split.slot === SLOT), "slot 207 is not split yet");
    const splits = [...registry.splits, { slot: SLOT, members: [STAMINA, BUFFS], transition: RECORD }]
      .sort((left, right) => left.slot - right.slot);
    return new Map([
      [BASELINE, `${JSON.stringify({ ...baseline, providers }, null, 2)}\n`],
      [SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`],
    ]);
  },
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity: the extracted class is textually identical to the old declaration and behaves
  // identically; StaminaController's source is otherwise unchanged; RodPullCalculator is pinned.
  parity({ read, before, after }) {
    const oldStamina = before(STAMINA);
    assert.equal(after(BUFFS), DECLARATION, "the extracted declaration differs");
    assert.equal(after(STAMINA), oldStamina.slice(0, oldStamina.length - DECLARATION.length - 2),
      "stamina_system.js changed beyond the extraction");
    assert(!/\bclass BuffManager\b/u.test(after(STAMINA)), "stamina_system.js still declares BuffManager");
    const facts = source => {
      const context = vm.createContext({});
      vm.runInContext(source, context, { filename: "buffs" });
      return vm.runInContext(SCENARIOS, context);
    };
    const baseline = facts(oldStamina);
    assert.equal(facts(after(BUFFS)), baseline, "BuffManager behaviour changed");
    const pinned = crypto.createHash("sha256").update(read(ROD_PULL)).digest("hex");
    const text = `${baseline}${pinned}`;
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(text).digest("hex") };
  },
});
