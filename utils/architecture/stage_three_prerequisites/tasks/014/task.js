"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const BASELINES = "src/core/items/progression/item_catalog_baseline_registry.js";
const LOGGER = "src/infrastructure/diagnostics/console_warning_logger.js";
const COMPOSITE = "src/core/items/progression/composite_metric_strategy.js";
const RATING = "src/core/items/progression/item_rating_resolver.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const INDEX = "index.html";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/014_item-progression-logger-and-review.json";
const SLOT = 79;
const MIXED = "mixed-responsibility-requires-decomposition";
const lines = values => `${values.join("\n")}\n`;

// Created platform adapter (LF like its slot-79 neighbour): the only place that names the console.
const LOGGER_SOURCE = lines([
  "/**",
  " * Platform diagnostics: forwards non-fatal warnings to the browser console.",
  " * Composition injects it wherever a rule reports such a warning.",
  " */",
  "class ConsoleWarningLogger {",
  "  warn(...args) {",
  "    console.warn(...args);",
  "  }",
  "}",
]);

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });

// Catalog-baseline scenarios: fixed, catalog, fallback (the warning), cache identity and invalidation.
const SCENARIOS = `((inject) => {
  const facts = [];
  const plain = (value) => value && typeof value === "object"
    ? { frozen: Object.isFrozen(value), value: JSON.parse(JSON.stringify(value)) } : value;
  const strategy = { id: "s", evaluate: ({ item }) => item.metric };
  const itemDb = {
    builds: { skip: { progressionProfile: { groupId: "g" }, metric: { available: true, rawValue: 99 } } },
    rods: { a: { progressionProfile: { groupId: "g" }, effectiveStats: {}, metric: { available: true, rawValue: 3 } },
      b: { progressionProfile: { groupId: "g" }, metric: { available: true, rawValue: 9 } },
      c: { progressionProfile: { groupId: "single" }, metric: { available: true, rawValue: 5 } } },
  };
  const registry = new ItemCatalogBaselineRegistry({ itemDb, strategyRegistry: { get: () => strategy },
    effectiveStatsResolver: { resolve: () => ({}) }, ...inject() });
  const configs = [undefined, { baseline: { mode: "fixed", minimum: 1, maximum: 4 } }, { baseline: { mode: "other" } },
    { baseline: { mode: "catalog" }, statPath: "p" },
    { baseline: { mode: "catalog", fallback: { minimum: 0, maximum: 10 } }, statPath: "q" }];
  for (const groupId of ["g", "single", "none"]) {
    for (const ratingConfig of configs) {
      const first = registry.resolve({ groupId, ratingConfig, strategy });
      facts.push(["baseline", plain(first), first === registry.resolve({ groupId, ratingConfig, strategy })]);
    }
  }
  registry.invalidate();
  facts.push(["after-invalidate", plain(registry.resolve({ groupId: "single", ratingConfig: configs[4], strategy }))]);
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.item-progression-decomposition, transition 2 (owner
// decisions 2026-09-28, points 1 and 4): ItemCatalogBaselineRegistry no longer defaults its logger to the
// platform console; bootstrap injects the new platform ConsoleWarningLogger (EventLogger in core.js posts
// events over HTTP and cannot reproduce console.warn). CompositeMetricStrategy and ItemRatingResolver hold
// no text and pass config-named labels through like migrated Domain modules: their blockers are removed
// without a source edit on recorded evidence.
module.exports = Object.freeze({
  sequence: 14,
  slug: "item-progression-logger-and-review",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.item-progression-decomposition",
  intent: "Item-progression decomposition 2: ItemCatalogBaselineRegistry receives its logger only by injection (bootstrap passes the new platform ConsoleWarningLogger, reviewed split member of legacy slot 79); evidence-backed removal of the mixed-responsibility blocker from the unchanged CompositeMetricStrategy and ItemRatingResolver.",
  sourceEdits: Object.freeze([
    edit(BASELINES, [
      ["class ItemCatalogBaselineRegistry {\n",
        "// Composition injects the logger (a platform adapter in production).\nclass ItemCatalogBaselineRegistry {\n"],
      ["    logger = console,\n", "    logger = null,\n"],
    ]),
    // bootstrap.js is CRLF.
    edit(BOOTSTRAP, [
      ["      strategyRegistry: itemMetricStrategyRegistry,\n      effectiveStatsResolver: effectiveItemStatsResolver,\n",
        "      strategyRegistry: itemMetricStrategyRegistry,\n      effectiveStatsResolver: effectiveItemStatsResolver,\n" +
          "      logger: new ConsoleWarningLogger(),\n"],
    ]),
    edit(INDEX, [
      [`    <script src="${BASELINES}"></script>\n`,
        `    <script src="${BASELINES}" data-legacy-slot="${SLOT}"></script>\n` +
          `    <script src="${LOGGER}" data-legacy-slot="${SLOT}"></script>\n`],
    ]),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: LOGGER, bytes: () => LOGGER_SOURCE })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: LOGGER, currentArea: "infrastructure/diagnostics",
    legacyLoadOrder: SLOT, architecture: Object.freeze({ migrationStatus: "classified",
      roles: Object.freeze(["platform-adapter"]), targetBoundary: "platform",
      targetPath: "src/platform/browser/diagnostics/console_warning_logger.js", migrationWave: 5 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  reviewedWithoutEdit: Object.freeze([COMPOSITE, RATING]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: BASELINES, removedBlockers: Object.freeze([Object.freeze({ blocker: "browser-api-coupling",
      reason: "The platform console default is gone: composition injects the logger (bootstrap passes the platform ConsoleWarningLogger); the registry never names a browser global." })]) }),
    Object.freeze({ currentPath: COMPOSITE, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "A composite metric rule over component strategies and baselines; it holds no player-facing text and passes config-named component labels through, like the migrated ItemBoundedMetricResolver (recorded evidence)." })]) }),
    Object.freeze({ currentPath: RATING, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The rating rule (strategy metric, catalog baseline, normalisation, out-of-range); it holds no player-facing text and passes config-named labels and suffixes through, like the migrated ItemBoundedMetricResolver (recorded evidence)." })]) }),
  ]),
  globalProviderAdditions: Object.freeze([
    Object.freeze({ currentPath: LOGGER, symbol: "ConsoleWarningLogger", mechanism: "global-lexical",
      availability: "program-init",
      removalCondition: "Removed when its classic consumer bootstrap.js migrates to ESM (Stage 5); production composition then imports the platform adapter. No Domain module reads it." }),
  ]),
  // Slot 79 splits into the Domain registry followed by its platform logger.
  metadataWrites({ read }) {
    const registry = JSON.parse(read(SPLITS));
    assert(!registry.splits.some(split => split.slot === SLOT), "slot 79 is not split yet");
    const splits = [...registry.splits, { slot: SLOT, members: [BASELINES, LOGGER], transition: RECORD }]
      .sort((left, right) => left.slot - right.slot);
    return new Map([[SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`]]);
  },
  resolvedDebtIds: Object.freeze(["debt-browser-capability-62ab68bab1b1"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([]),
    added: Object.freeze([[BOOTSTRAP, LOGGER, "ConsoleWarningLogger"].join("\u0000")]),
  }),
  // Focused parity: catalog baselines (including the fallback warning, cache identity and invalidation)
  // and the console warnings they emit are identical with the old console default and with the injected
  // platform logger; the registry never names console and only the platform adapter does.
  parity({ read, before, after }) {
    const run = (files, inject) => {
      const warnings = [];
      const context = vm.createContext({ console: { warn: (...args) => warnings.push(args) } });
      for (const [file, source] of files) vm.runInContext(source, context, { filename: file });
      const facts = vm.runInContext(`${SCENARIOS}(${inject})`, context);
      return { facts, warnings: JSON.stringify(warnings) };
    };
    const old = run([[BASELINES, before(BASELINES)]], "() => ({})");
    const next = run([[BASELINES, after(BASELINES)], [LOGGER, after(LOGGER)]],
      "() => ({ logger: new ConsoleWarningLogger() })");
    assert.equal(next.facts, old.facts, "catalog baselines changed");
    assert.equal(next.warnings, old.warnings, "console warnings changed");
    assert(JSON.parse(old.warnings).length > 0, "the scenarios exercise the fallback warning");
    assert(!/\bconsole\b/u.test(after(BASELINES)), "the registry names console");
    assert(/logger: new ConsoleWarningLogger\(\),/u.test(after(BOOTSTRAP)), "bootstrap injects the platform logger");
    for (const file of [COMPOSITE, RATING]) {
      assert(!/[Ѐ-ӿ]/u.test(read(file)), `reviewed source holds player-facing text: ${file}`);
    }
    const facts = `${old.facts}${old.warnings}`;
    return { cases: JSON.parse(old.facts).length, factsSha256: crypto.createHash("sha256").update(facts).digest("hex") };
  },
});
