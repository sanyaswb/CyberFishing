"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const BASELINES = "src/core/items/progression/item_catalog_baseline_registry.js";
const OLD_LOGGER = "src/infrastructure/diagnostics/console_warning_logger.js";
const LOGGER = "src/infrastructure/diagnostics/console_logger.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const INDEX = "index.html";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/021_console-logger-generalization.json";
const SLOT = 79;
const lines = values => `${values.join("\n")}\n`;

// Created platform adapter (LF like the file it replaces): the only place that names the console.
const LOGGER_SOURCE = lines([
  "/**",
  " * Platform diagnostics: forwards log, warning and error output to the browser console.",
  " * Composition injects it wherever a rule or entity reports diagnostics.",
  " */",
  "class ConsoleLogger {",
  "  log(...args) {",
  "    console.log(...args);",
  "  }",
  "",
  "  warn(...args) {",
  "    console.warn(...args);",
  "  }",
  "",
  "  error(...args) {",
  "    console.error(...args);",
  "  }",
  "}",
]);

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Catalog-baseline scenarios exercising the fallback warning (see prerequisite 014).
const SCENARIOS = `((logger) => {
  const strategy = { id: "s", evaluate: ({ item }) => item.metric };
  const registry = new ItemCatalogBaselineRegistry({ itemDb: { rods: { c: { progressionProfile: { groupId: "single" },
    metric: { available: true, rawValue: 5 } } } }, strategyRegistry: { get: () => strategy },
    effectiveStatsResolver: { resolve: () => ({}) }, logger });
  const config = { baseline: { mode: "catalog", fallback: { minimum: 0, maximum: 10 } }, statPath: "q" };
  const first = registry.resolve({ groupId: "single", ratingConfig: config, strategy });
  registry.invalidate();
  const second = registry.resolve({ groupId: "single", ratingConfig: config, strategy });
  return JSON.stringify([first, second]);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 4 (owner
// decision 2026-09-29, point C): one platform logger with log/warn/error. The platform
// ConsoleWarningLogger (prerequisite 014) is replaced by ConsoleLogger: the old file is deleted (full
// before-image, rollback restores it byte-for-byte), the new file takes its place as the member of legacy
// slot 79, bootstrap (its only consumer) switches in the same transaction, and the global baseline changes
// by exactly the pair "remove ConsoleWarningLogger, add ConsoleLogger".
module.exports = Object.freeze({
  sequence: 21,
  slug: "console-logger-generalization",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 4: the platform ConsoleWarningLogger becomes the general ConsoleLogger (log/warn/error) in src/infrastructure/diagnostics/console_logger.js, the same member of legacy slot 79; the old file is deleted with its before-image, bootstrap switches, and the baseline changes by exactly the replacement pair; identical warnings.",
  sourceEdits: Object.freeze([
    edit(BOOTSTRAP, [["      logger: new ConsoleWarningLogger(),", "      logger: new ConsoleLogger(),"]]),
    edit(INDEX, [[`    <script src="${OLD_LOGGER}" data-legacy-slot="${SLOT}"></script>`,
      `    <script src="${LOGGER}" data-legacy-slot="${SLOT}"></script>`]]),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: LOGGER, bytes: () => LOGGER_SOURCE })]),
  deletedFiles: Object.freeze([OLD_LOGGER]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: LOGGER, currentArea: "infrastructure/diagnostics",
    legacyLoadOrder: SLOT, architecture: Object.freeze({ migrationStatus: "classified",
      roles: Object.freeze(["platform-adapter"]), targetBoundary: "platform",
      targetPath: "src/platform/browser/diagnostics/console_logger.js", migrationWave: 5 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  globalProviderReplacements: Object.freeze([Object.freeze({
    remove: Object.freeze({ currentPath: OLD_LOGGER, symbol: "ConsoleWarningLogger", mechanism: "global-lexical",
      reason: "Generalized into the platform ConsoleLogger (log/warn/error); its file is deleted." }),
    add: Object.freeze({ currentPath: LOGGER, symbol: "ConsoleLogger", mechanism: "global-lexical",
      availability: "program-init",
      removalCondition: "Removed when its classic consumers (bootstrap.js and the composition code that injects it) migrate to ESM (Stage 5); production composition then imports the platform adapter. No Domain module reads it." }),
  })]),
  // The slot-79 member is renamed; the registry now records this transition as the split's owner.
  metadataWrites({ read }) {
    const registry = JSON.parse(read(SPLITS));
    const split = registry.splits.find(item => item.slot === SLOT);
    assert.deepEqual(split?.members, [BASELINES, OLD_LOGGER], "slot 79 holds the registry and the old logger");
    const splits = registry.splits.map(item => (item.slot === SLOT
      ? { slot: SLOT, members: [BASELINES, LOGGER], transition: RECORD } : item));
    return new Map([[SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`]]);
  },
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[BOOTSTRAP, OLD_LOGGER, "ConsoleWarningLogger"].join("\u0000")]),
    added: Object.freeze([[BOOTSTRAP, LOGGER, "ConsoleLogger"].join("\u0000")]),
  }),
  // Focused parity: the registry's warnings through the new logger equal those through the old one;
  // ConsoleLogger forwards log/warn/error arguments unchanged; the new file is platform-classified.
  parity({ read, before }) {
    const run = (loggerSource, compose) => {
      const output = [];
      const console = Object.fromEntries(["log", "warn", "error"].map(level => [level, (...args) => output.push([level, args])]));
      const context = vm.createContext({ console });
      vm.runInContext(read(BASELINES), context, { filename: BASELINES });
      vm.runInContext(loggerSource, context, { filename: "logger" });
      const facts = vm.runInContext(`${SCENARIOS}(${compose})`, context);
      return { context, facts, output };
    };
    const old = run(before(OLD_LOGGER), "new ConsoleWarningLogger()");
    const next = run(LOGGER_SOURCE, "new ConsoleLogger()");
    assert.equal(next.facts, old.facts, "catalog baselines changed");
    assert.deepEqual(next.output, old.output, "warnings changed");
    assert(old.output.length > 0, "the fallback warning is exercised");
    vm.runInContext(`const logger = new ConsoleLogger(); logger.log("a", 1); logger.warn({ b: 2 }); logger.error("c", [3]);`,
      next.context);
    assert.deepEqual(JSON.parse(JSON.stringify(next.output.slice(-3))), [["log", ["a", 1]], ["warn", [{ b: 2 }]],
      ["error", ["c", [3]]]], "ConsoleLogger does not forward its arguments");
    assert(!/\bconsole\b/u.test(read(BASELINES)), "the registry names console");
    const entry = module.exports.manifestEntries[0];
    assert.equal(entry.architecture.targetBoundary, "platform", "src/infrastructure/diagnostics is platform-classified");
    const facts = JSON.stringify([old.facts, old.output]);
    return { cases: old.output.length + 3, factsSha256: crypto.createHash("sha256").update(facts).digest("hex") };
  },
});
