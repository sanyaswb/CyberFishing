"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { buildPrerequisiteRuntime } = require("../../lifecycle/prerequisite_runtime_build");
const { ActivationShimRenderer } = require("../../../../build/compat_runtime/activation_shim");
const { CanonicalActivationIdentity, EXACT_TRANSPORT_GLOBAL } = require("../../../../build/compat_runtime/cumulative_runtime_contract");
const { CanonicalBridgeIdentity } = require("../../../../build/legacy_bridge_build_config");

const UTILS = "src/app/utils.js";
const NORMALIZE = "src/core/math/normalize_distance.js";
const ENGINE = "src/engine/math/normalize_distance.js";
const GAME_CYCLE = "utils/game-cycle-check.js";
const INDEX = "index.html";
const MANIFEST = "architecture/migration/module_migration_manifest.json";
const CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";
const BRIDGES = "architecture/guards/migration_bridge_registry.json";
const PACKAGE = "architecture/build/package_contract.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/029_normalize-distance-engine-activation.json";
const OUTPUT = "dist/stage-3-compat-runtime/";
const RUNTIME = `${OUTPUT}compat_runtime.iife.js`;
const SLOT = 390;
const OWNER = "stage-3.22.prerequisite.entities-world-rules-decomposition";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
const DECLARATION = "function normalizeDistance(raw, fallback = Infinity) {\r\n" +
  "  if (raw === \"max\") return Infinity;\r\n" +
  "  if (raw == null) return fallback;\r\n\r\n" +
  "  const value = Number(raw);\r\n" +
  "  return Number.isFinite(value) ? Math.max(1, value) : fallback;\r\n" +
  "}\r\n";
// Keep the declaration and function object semantics intact. A trailing named-export statement is
// used because the legacy provider observer deliberately rejects `export function` as an Annex-B
// shaped nested declaration when it scans the whole source corpus in script mode.
const ENGINE_SOURCE = `${DECLARATION}\r\nexport { normalizeDistance };\r\n`;
const ACTIVATION_FIELDS = Object.freeze({ owner: OWNER, sourceProvider: NORMALIZE, targetModule: ENGINE,
  exportName: "normalizeDistance", legacySymbol: "normalizeDistance", legacyScriptIndex: SLOT,
  shimFile: "activations/390_normalizedistance.js",
  reason: "Expose the Engine normalizeDistance function to its unmigrated classic consumer through the shared cumulative runtime.",
  removalStage: "stage-5" });
const ACTIVATION = Object.freeze({ id: CanonicalActivationIdentity.id(ACTIVATION_FIELDS), ...ACTIVATION_FIELDS });
const SHIM = new ActivationShimRenderer().render(ACTIVATION, EXACT_TRANSPORT_GLOBAL);
const SHIM_PATH = `${OUTPUT}${ACTIVATION.shimFile}`;
const consumersOf = manifest => manifest.modules.flatMap(module => module.analysis.dependencies.items
  .filter(edge => edge.resolution === "confirmed" && edge.target === NORMALIZE)
  .map(edge => ({ source: module.currentPath, edge }))).sort((left, right) => compare(left.source, right.source));
const SCENARIOS = `((normalizeDistance) => JSON.stringify([
  ...[undefined, null, "max", 0, 0.5, 1, 12.5, "7", "x", NaN, Infinity, -5]
    .map(value => [String(value), normalizeDistance(value), normalizeDistance(value, 17)]),
  ["arity", normalizeDistance.length],
]))`;

// Checkpoint B gives the extracted generic function one Engine ESM owner. Its classic source becomes
// the standard compatibility shim at the unchanged logical slot, and the single classic consumer is
// tracked by one bridge until gameplay_rules imports the Engine export in the re-frozen batch 040.
module.exports = Object.freeze({
  sequence: 29,
  slug: "normalize-distance-engine-activation",
  afterBatch: "039",
  backlogTaskId: OWNER,
  intent: "Checkpoint B: make src/engine/math/normalize_distance.js the single named ESM implementation, expose its exact function identity through the cumulative runtime at logical slot 390, and record one removable bridge for src/app/rules.js before the repeated graph review.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: NORMALIZE, replacements: Object.freeze([Object.freeze([DECLARATION, SHIM])]) }),
    Object.freeze({ path: GAME_CYCLE, replacements: Object.freeze([
      Object.freeze([
        "  \"src/app/utils.js\",\n",
        "  \"src/core/math/normalize_distance.js\",\n  \"src/app/utils.js\",\n",
      ]),
      Object.freeze([
        "// Prerequisites 006 and 017 extracted Vector2 and DistanceUnitConverter into their own classic files;\n" +
          "// replays of trees recorded before them still declare the classes in core.js / casting_distance.js.\n" +
          "const EXTRACTED_PROVIDERS = [\"src/core/math/vector2.js\", \"src/core/distance_unit_converter.js\"];",
        "// Prerequisites 006, 017 and 028 extracted providers into their own classic files; replays of\n" +
          "// trees recorded before them still declare the symbols in their original source files.\n" +
          "const EXTRACTED_PROVIDERS = [\"src/core/math/vector2.js\", \"src/core/distance_unit_converter.js\",\n" +
          "  \"src/core/math/normalize_distance.js\"];",
      ]),
    ]) }),
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      `    <script src="${NORMALIZE}" data-legacy-slot="${SLOT}"></script>\n`,
      `    <script src="${SHIM_PATH}" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: ENGINE, bytes({ read }) {
    assert.equal(read(NORMALIZE), DECLARATION, "the classic normalizeDistance provider is not checkpoint A");
    return ENGINE_SOURCE;
  } })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: ENGINE, currentArea: "engine/math", legacyLoadOrder: null,
    architecture: Object.freeze({ migrationStatus: "esm", roles: Object.freeze(["engine-utility"]),
      targetBoundary: "engine", targetPath: ENGINE, migrationWave: 1 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze([]) }) })]),
  manifestUpdates: Object.freeze([Object.freeze({ currentPath: NORMALIZE,
    architecture: Object.freeze({ roles: Object.freeze(["compatibility-bridge"]) }),
    removedBlockers: Object.freeze([Object.freeze({ blocker: "legacy-global-contract",
      reason: "The classic surface is now the standard activation shim of the one Engine normalizeDistance export at its exact historical logical position." })]) })]),
  metadataWrites({ read, after, root }) {
    const contract = JSON.parse(read(CONTRACT));
    assert(contract.approvedInfrastructureModules.includes("src/engine/math/vector2.js"),
      "the approved Vector2 infrastructure module is missing");
    assert(!contract.approvedInfrastructureModules.includes(ENGINE), "normalizeDistance infrastructure is already approved");
    assert(!contract.activationPositions.some(item => item.legacySymbol === "normalizeDistance"),
      "normalizeDistance is already activated");
    const nextContract = { ...contract,
      approvedInfrastructureModules: [...contract.approvedInfrastructureModules, ENGINE].sort(compare),
      activationPositions: [...contract.activationPositions, { ...ACTIVATION }].sort((a, b) => a.id.localeCompare(b.id)) };
    const manifest = JSON.parse(read(MANIFEST));
    const consumers = consumersOf(manifest);
    assert.deepEqual(consumers.map(item => item.source), ["src/app/rules.js"],
      "normalizeDistance classic consumer set differs");
    const registry = JSON.parse(read(BRIDGES));
    const bridges = consumers.map(({ source }) => {
      const identity = { bridge: NORMALIZE, owner: OWNER, source, target: ENGINE };
      return { id: CanonicalBridgeIdentity.id(identity), bridge: NORMALIZE, source, target: ENGINE,
        reason: "Preserve the exact normalizeDistance consumer until gameplay rules import the Engine module directly.",
        owner: OWNER, introducedStage: "stage-3", removalStage: "stage-5",
        globalProviders: [{ symbol: "normalizeDistance", mechanism: "global-this-property" }] };
    });
    assert(!registry.bridges.some(bridge => bridge.target === ENGINE), "normalizeDistance bridges already exist");
    const nextRegistry = { ...registry, bridges: [...registry.bridges, ...bridges].sort((a, b) => a.id.localeCompare(b.id)) };
    const contractPackage = JSON.parse(read(PACKAGE));
    const build = contractPackage.stage.cumulativeRuntimeBuild;
    const nextPackage = { ...contractPackage, stage: { ...contractPackage.stage, cumulativeRuntimeBuild: { ...build,
      runtimeInputs: build.runtimeInputs + 1, activationInputs: build.activationInputs + 1 } } };
    const splits = JSON.parse(read(SPLITS));
    const slot = splits.splits.find(split => split.slot === SLOT);
    assert.deepEqual(slot?.members, [NORMALIZE, UTILS], "slot 390 differs from checkpoint A");
    const nextSplits = { ...splits, splits: splits.splits.map(split => (split.slot === SLOT
      ? { slot: SLOT, members: [NORMALIZE, UTILS], transition: RECORD } : split)) };
    const overlay = new Map([[ENGINE, Buffer.from(after(ENGINE), "utf8")],
      [NORMALIZE, Buffer.from(after(NORMALIZE), "utf8")], [INDEX, Buffer.from(after(INDEX), "utf8")],
      [CONTRACT, Buffer.from(serialize(nextContract), "utf8")]]);
    const built = buildPrerequisiteRuntime({ root, overlay });
    assert.equal(built.files.size, nextContract.activationPositions.length + 1,
      "one runtime and one shim per activation");
    for (const [file, bytes] of built.files) {
      if (file === RUNTIME || file === SHIM_PATH) continue;
      assert.equal(bytes.toString("utf8"), read(file), `an unrelated generated output changed: ${file}`);
    }
    assert.equal(built.files.get(SHIM_PATH).toString("utf8"), SHIM,
      "the generated normalizeDistance activation differs from the shim");
    return new Map([
      [CONTRACT, serialize(nextContract)], [BRIDGES, serialize(nextRegistry)], [PACKAGE, serialize(nextPackage)],
      [SPLITS, serialize(nextSplits)], [RUNTIME, built.files.get(RUNTIME).toString("utf8")], [SHIM_PATH, SHIM],
    ]);
  },
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  parity({ read, before, after }) {
    assert.equal(after(ENGINE), `${before(NORMALIZE)}\r\nexport { normalizeDistance };\r\n`,
      "the Engine normalizeDistance implementation differs from checkpoint A");
    assert.equal(after(NORMALIZE), SHIM, "the classic provider is not the standard activation shim");
    const classic = vm.createContext({});
    vm.runInContext(before(NORMALIZE), classic, { filename: NORMALIZE });
    const baseline = vm.runInContext(`${SCENARIOS}(normalizeDistance)`, classic);
    const runtime = vm.createContext({});
    vm.runInContext(after(RUNTIME), runtime, { filename: RUNTIME });
    vm.runInContext(after(SHIM_PATH), runtime, { filename: SHIM_PATH });
    const exported = vm.runInContext(`globalThis.${EXACT_TRANSPORT_GLOBAL}.modules[${JSON.stringify(ENGINE)}].normalizeDistance`, runtime);
    assert.equal(vm.runInContext("globalThis.normalizeDistance", runtime), exported,
      "the activation does not expose the Engine export identity");
    assert.equal(vm.runInContext(`${SCENARIOS}(globalThis.normalizeDistance)`, runtime), baseline,
      "normalizeDistance behavior changed");
    assert.equal((after(RUNTIME).match(/\bfunction normalizeDistance\b/gu) || []).length, 1,
      "the runtime does not hold exactly one normalizeDistance implementation");
    const manifest = JSON.parse(read(MANIFEST));
    const consumers = consumersOf(manifest);
    for (const { source, edge } of consumers) {
      assert.notEqual(edge.executionPhase, "eager", `eager normalizeDistance read before activation: ${source}`);
    }
    const registry = JSON.parse(after(BRIDGES));
    assert.deepEqual(registry.bridges.filter(bridge => bridge.target === ENGINE).map(bridge => bridge.source).sort(),
      consumers.map(({ source }) => source), "one bridge per classic normalizeDistance consumer");
    const index = after(INDEX);
    const order = [SHIM_PATH, UTILS].map(file => index.indexOf(`src="${file}"`));
    assert(order.every((at, position) => at > 0 && (position === 0 || at > order[position - 1])),
      "slot 390 activation must remain before the residual SeededRng provider");
    assert(!index.includes(`src="${NORMALIZE}"`), "the direct classic normalizeDistance tag remains");
    const facts = JSON.stringify([baseline, consumers.map(({ source }) => source), ACTIVATION.id, sha(after(RUNTIME))]);
    return { cases: JSON.parse(baseline).length + consumers.length + 4, factsSha256: sha(facts) };
  },
});
