"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { ControlledMetadataTransaction } = require("../../../domain_batches/controlled_metadata_transaction");
const { buildPrerequisiteRuntime } = require("../../lifecycle/prerequisite_runtime_build");
const { ActivationShimRenderer } = require("../../../../build/compat_runtime/activation_shim");
const { CanonicalActivationIdentity, EXACT_TRANSPORT_GLOBAL } = require("../../../../build/compat_runtime/cumulative_runtime_contract");
const { CanonicalBridgeIdentity } = require("../../../../build/legacy_bridge_build_config");

const CORE = "src/core/core.js";
const VECTOR2 = "src/core/math/vector2.js";
const ENGINE = "src/engine/math/vector2.js";
const INDEX = "index.html";
const POLICY = "architecture/module_architecture.json";
const MANIFEST = "architecture/migration/module_migration_manifest.json";
const CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";
const BRIDGES = "architecture/guards/migration_bridge_registry.json";
const PACKAGE = "architecture/build/package_contract.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/027_vector2-engine-activation.json";
const OUTPUT = "dist/stage-3-compat-runtime/";
const RUNTIME = `${OUTPUT}compat_runtime.iife.js`;
const SLOT = 41;
const OWNER = "stage-3.22.prerequisite.vector2-extraction";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = text => crypto.createHash("sha256").update(text).digest("hex");

// The exact classic Vector2 declaration extracted by prerequisite 006 (CRLF, as in the file).
const DECLARATION = "class Vector2 {\r\n  constructor(x = 0, y = 0) {\r\n    this.x = x;\r\n    this.y = y;\r\n  }\r\n\r\n  // ДОДАНО: Потрібен для скидання або встановлення значень без створення нового об'єкта\r\n  set(x, y) {\r\n    this.x = x;\r\n    this.y = y;\r\n    return this;\r\n  }\r\n\r\n  // ДОДАНО: Копіювання значень з іншого вектора (дуже корисно для оптимізації)\r\n  copy(v) {\r\n    this.x = v.x;\r\n    this.y = v.y;\r\n    return this;\r\n  }\r\n\r\n  add(v) {\r\n    this.x += v.x;\r\n    this.y += v.y;\r\n    return this;\r\n  }\r\n\r\n  // ДОДАНО: Віднімання (часто потрібне у фізиці)\r\n  sub(v) {\r\n    this.x -= v.x;\r\n    this.y -= v.y;\r\n    return this;\r\n  }\r\n\r\n  multiplyScalar(s) {\r\n    this.x *= s;\r\n    this.y *= s;\r\n    return this;\r\n  }\r\n\r\n  normalize() {\r\n    const length = Math.hypot(this.x, this.y);\r\n    if (length > 0) {\r\n      this.x /= length;\r\n      this.y /= length;\r\n    }\r\n    return this;\r\n  }\r\n\r\n  length() {\r\n    return Math.hypot(this.x, this.y);\r\n  }\r\n\r\n  clone() {\r\n    return new Vector2(this.x, this.y);\r\n  }\r\n}\r\n";
// The Engine module: the same class with a named export and nothing else.
const ENGINE_SOURCE = `export ${DECLARATION}`;

// The standard activation of the Engine export at logical slot 41 (canonical id).
const ACTIVATION_FIELDS = Object.freeze({ owner: OWNER, sourceProvider: VECTOR2, targetModule: ENGINE, exportName: "Vector2",
  legacySymbol: "Vector2", legacyScriptIndex: SLOT, shimFile: "activations/041_vector2.js",
  reason: "Expose the Engine Vector2 constructor to its unmigrated classic consumers through the shared cumulative runtime.",
  removalStage: "stage-5" });
const ACTIVATION = Object.freeze({ id: CanonicalActivationIdentity.id(ACTIVATION_FIELDS), ...ACTIVATION_FIELDS });
const SHIM = new ActivationShimRenderer().render(ACTIVATION, EXACT_TRANSPORT_GLOBAL);
const SHIM_PATH = `${OUTPUT}${ACTIVATION.shimFile}`;

// Classic consumers of the Vector2 provider (exact confirmed edges of the Manifest), each held by one
// reviewed bridge until it migrates.
const consumersOf = manifest => manifest.modules.flatMap(module => module.analysis.dependencies.items
  .filter(edge => edge.resolution === "confirmed" && edge.target === VECTOR2).map(edge => ({ source: module.currentPath, edge })))
  .sort((left, right) => compare(left.source, right.source));

// Vector2 scenarios (spec §5): construction, every method, zero-length normalization, negative and
// coerced coordinates, chaining, unchanged arguments, clone independence and error behaviour.
const SCENARIOS = `((Vector2) => {
  const facts = [];
  const view = v => (v instanceof Vector2 ? ["V", v.x, v.y] : v);
  const run = (label, action) => {
    try { facts.push([label, view(action())]); } catch (error) { facts.push([label, "throws", error.name, error.message]); }
  };
  run("default", () => new Vector2());
  run("explicit", () => new Vector2(3, -4));
  run("coerced", () => { const v = new Vector2("3", null); return [v.x, v.y, typeof v.x]; });
  run("undefinedY", () => new Vector2(5, undefined));
  const base = new Vector2(3, -4);
  const other = new Vector2(-1.5, 2);
  run("set", () => { const v = new Vector2(1, 1); return [v.set(-2, 7) === v, v.x, v.y]; });
  run("copy", () => { const v = new Vector2(); return [v.copy(base) === v, v.x, v.y, base.x, base.y]; });
  run("add", () => { const v = new Vector2(1, 2); return [v.add(other) === v, v.x, v.y, other.x, other.y]; });
  run("sub", () => { const v = new Vector2(1, 2); return [v.sub(other) === v, v.x, v.y, other.x, other.y]; });
  run("multiplyScalar", () => { const v = new Vector2(1, -2); return [v.multiplyScalar(-2.5) === v, v.x, v.y]; });
  run("normalize", () => { const v = new Vector2(3, -4); return [v.normalize() === v, v.x, v.y, v.length()]; });
  run("normalizeZero", () => { const v = new Vector2(0, 0); return [v.normalize() === v, v.x, v.y]; });
  run("normalizeNegative", () => new Vector2(-6, -8).normalize());
  run("length", () => [new Vector2(3, -4).length(), new Vector2().length(), new Vector2(-1e308, 1e308).length()]);
  run("clone", () => { const v = new Vector2(2, 9); const c = v.clone(); c.x = 100; return [c !== v, c instanceof Vector2, v.x, c.x]; });
  run("chain", () => new Vector2(1, 1).add(new Vector2(2, 3)).sub(new Vector2(1, 1)).multiplyScalar(2).normalize());
  run("strings", () => { const v = new Vector2("1", "2"); v.add(new Vector2("3", "4")); return [v.x, v.y]; });
  run("copyNull", () => new Vector2().copy(null));
  run("addUndefined", () => new Vector2().add(undefined));
  run("setMissing", () => new Vector2(1, 2).set());
  run("nan", () => new Vector2(NaN, 1).normalize());
  run("methods", () => Object.getOwnPropertyNames(Vector2.prototype).sort());
  return JSON.stringify(facts, (key, value) => (typeof value === "number" && !Number.isFinite(value) ? String(value) : value));
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.vector2-extraction, checkpoint B (owner spec
// 2026-09-28 §4.2-4.3, §5): Vector2 gets Engine ESM ownership. src/engine/math/vector2.js exports the
// class (its implementation byte-identical to the checkpoint-A classic declaration); the cumulative
// runtime includes it as the one reviewed infrastructure module (no Domain module-count increase) and
// the standard activation exposes the same constructor to every unmigrated classic consumer. The classic
// file becomes the standard activation shim, its early slot-41 tag is removed and the activation tag
// follows the runtime tag: slot 41 = residual core.js, then the Vector2 activation, with the runtime tag
// between them. One reviewed bridge per classic consumer until it migrates (removal stage 5). The runtime
// is rebuilt from the proposed tree and recorded with before-images, so rollback and historical replays
// restore the v0.24.76 runtime bytes.
module.exports = Object.freeze({
  sequence: 27,
  slug: "vector2-engine-activation",
  afterBatch: "038",
  backlogTaskId: OWNER,
  intent: "Vector2 checkpoint B: Engine ESM ownership (src/engine/math/vector2.js named export, byte-identical implementation) through the single cumulative runtime (one reviewed infrastructure module) and a standard activation placed right after the runtime tag; the classic provider becomes the activation shim; one reviewed bridge per classic consumer; runtime rebuilt and recorded.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: VECTOR2, replacements: Object.freeze([Object.freeze([DECLARATION, SHIM])]) }),
    // Owner decision 2026-09-29: the Engine boundary admits the compatibility-bridge role (the exact
    // activation shim of an Engine export, like the migrated Domain providers). The derived policy
    // document and the executable policy check follow outside the recorded evidence.
    Object.freeze({ path: POLICY, replacements: Object.freeze([Object.freeze([
      "\"roleCompatibility\": {\n        \"engine\": [\n          \"engine-contract\",",
      "\"roleCompatibility\": {\n        \"engine\": [\n          \"compatibility-bridge\",\n          \"engine-contract\",",
    ])]) }),
    // Exact bytes: the two classic slot-41 tags end with CRLF, the runtime tag (and the generated
    // activation tags after it) with LF.
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      `    <script src="${VECTOR2}" data-legacy-slot="${SLOT}"></script>\r\n` +
        `    <script src="${CORE}" data-legacy-slot="${SLOT}"></script>\r\n` +
        `    <script src="${RUNTIME}"></script>\n`,
      `    <script src="${CORE}" data-legacy-slot="${SLOT}"></script>\r\n` +
        `    <script src="${RUNTIME}"></script>\n` +
        `    <script src="${SHIM_PATH}" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: ENGINE, bytes({ read }) {
    assert.equal(read(VECTOR2), DECLARATION, "the classic Vector2 provider is not the checkpoint-A declaration");
    return ENGINE_SOURCE;
  } })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: ENGINE, currentArea: "engine/math", legacyLoadOrder: null,
    architecture: Object.freeze({ migrationStatus: "esm", roles: Object.freeze(["engine-utility"]), targetBoundary: "engine",
      targetPath: ENGINE, migrationWave: 1 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze([]) }) })]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: VECTOR2,
      architecture: Object.freeze({ roles: Object.freeze(["compatibility-bridge"]) }),
      removedBlockers: Object.freeze([Object.freeze({ blocker: "legacy-global-contract",
        reason: "The classic surface is now the standard activation shim of the Engine export (exact legacy symbol and load position, reviewed bridges per consumer), like every migrated provider." })]) }),
  ]),
  // Runtime contract, bridges, package counts, the slot-41 member order and the rebuilt runtime output.
  metadataWrites({ read, after, root }) {
    const contract = JSON.parse(read(CONTRACT));
    assert.deepEqual(contract.approvedInfrastructureModules, [], "no infrastructure module is approved yet");
    assert(!contract.activationPositions.some(activation => activation.legacySymbol === "Vector2"), "Vector2 is already activated");
    const nextContract = { ...contract, approvedInfrastructureModules: [ENGINE],
      activationPositions: [...contract.activationPositions, { ...ACTIVATION }].sort((a, b) => a.id.localeCompare(b.id)) };
    const manifest = JSON.parse(read(MANIFEST));
    const consumers = consumersOf(manifest);
    const registry = JSON.parse(read(BRIDGES));
    const bridges = consumers.map(({ source }) => {
      const identity = { bridge: VECTOR2, owner: OWNER, source, target: ENGINE };
      return { id: CanonicalBridgeIdentity.id(identity), bridge: VECTOR2, source, target: ENGINE,
        reason: "Preserve the exact synchronous Vector2 consumer until it migrates and imports the Engine module directly.",
        owner: OWNER, introducedStage: "stage-3", removalStage: "stage-5",
        globalProviders: [{ symbol: "Vector2", mechanism: "global-this-property" }] };
    });
    assert(!registry.bridges.some(bridge => bridge.target === ENGINE), "Vector2 bridges already exist");
    const nextRegistry = { ...registry, bridges: [...registry.bridges, ...bridges].sort((a, b) => a.id.localeCompare(b.id)) };
    const contractPackage = JSON.parse(read(PACKAGE));
    const build = contractPackage.stage.cumulativeRuntimeBuild;
    const nextPackage = { ...contractPackage, stage: { ...contractPackage.stage, cumulativeRuntimeBuild: { ...build,
      runtimeInputs: build.runtimeInputs + 1, activationInputs: build.activationInputs + 1 } } };
    const splits = JSON.parse(read(SPLITS));
    const slot = splits.splits.find(split => split.slot === SLOT);
    assert.deepEqual(slot?.members, [VECTOR2, CORE], "slot 41 holds the classic Vector2 then core.js");
    const nextSplits = { ...splits, splits: splits.splits.map(split => (split.slot === SLOT
      ? { slot: SLOT, members: [CORE, VECTOR2], transition: RECORD } : split)) };
    // The runtime of the proposed tree; every other generated activation must stay byte-identical.
    const overlay = new Map([[ENGINE, Buffer.from(after(ENGINE), "utf8")], [VECTOR2, Buffer.from(after(VECTOR2), "utf8")],
      [INDEX, Buffer.from(after(INDEX), "utf8")], [CONTRACT, Buffer.from(serialize(nextContract), "utf8")]]);
    const built = buildPrerequisiteRuntime({ root, overlay });
    assert.equal(built.files.size, nextContract.activationPositions.length + 1, "one runtime and one shim per activation");
    for (const [file, bytes] of built.files) {
      if (file === RUNTIME || file === SHIM_PATH) continue;
      assert.equal(bytes.toString("utf8"), read(file), `an unrelated generated output changed: ${file}`);
    }
    assert.equal(built.files.get(SHIM_PATH).toString("utf8"), SHIM, "the generated Vector2 activation differs from the shim");
    return new Map([
      [CONTRACT, serialize(nextContract)],
      [BRIDGES, serialize(nextRegistry)],
      [PACKAGE, serialize(nextPackage)],
      [SPLITS, serialize(nextSplits)],
      [RUNTIME, built.files.get(RUNTIME).toString("utf8")],
      [SHIM_PATH, SHIM],
    ]);
  },
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity and identity (spec §5). The Engine module is the classic declaration plus `export`;
  // Vector2 behaves identically as the classic class and through the rebuilt runtime and its activation,
  // which exposes the very constructor of the cumulative Engine export (one class copy in the bundle);
  // no consumer reads Vector2 eagerly (core.js is the only classic script now loaded before the
  // activation that consumes it); the bridges cover exactly the Manifest consumers.
  parity({ read, before, after }) {
    assert.equal(after(ENGINE), `export ${before(VECTOR2)}`, "the Engine implementation differs from the classic declaration");
    assert.equal(after(VECTOR2), SHIM, "the classic provider is not the standard activation shim");
    const classic = vm.createContext({});
    vm.runInContext(before(VECTOR2), classic, { filename: VECTOR2 });
    const baseline = vm.runInContext(`${SCENARIOS}(Vector2)`, classic);
    const runtime = vm.createContext({});
    vm.runInContext(after(RUNTIME), runtime, { filename: RUNTIME });
    vm.runInContext(after(SHIM_PATH), runtime, { filename: SHIM_PATH });
    const exported = vm.runInContext(`globalThis.${EXACT_TRANSPORT_GLOBAL}.modules[${JSON.stringify(ENGINE)}].Vector2`, runtime);
    assert.equal(vm.runInContext("globalThis.Vector2", runtime), exported, "the activation does not expose the Engine export");
    assert.equal(vm.runInContext(`${SCENARIOS}(globalThis.Vector2)`, runtime), baseline, "Vector2 behaviour changed");
    assert.equal((after(RUNTIME).match(/\bclass Vector2\b/gu) || []).length, 1, "the runtime holds one Vector2 class");
    const manifest = JSON.parse(read(MANIFEST));
    const consumers = consumersOf(manifest);
    for (const { source, edge } of consumers) {
      assert.notEqual(edge.executionPhase, "eager", `eager Vector2 read before the activation: ${source}`);
    }
    assert(consumers.some(({ source }) => source === CORE), "core.js (InputManager) is an audited consumer");
    const registry = JSON.parse(after(BRIDGES));
    assert.deepEqual(registry.bridges.filter(bridge => bridge.target === ENGINE).map(bridge => bridge.source).sort(),
      consumers.map(({ source }) => source), "one bridge per classic consumer");
    const index = after(INDEX);
    const order = [CORE, RUNTIME, SHIM_PATH].map(file => index.indexOf(`src="${file}"`));
    assert(order.every((at, position) => at > 0 && (position === 0 || at > order[position - 1])),
      "slot 41 is core.js, the runtime tag, then the Vector2 activation");
    assert(!index.includes(`src="${VECTOR2}"`), "the early classic Vector2 tag remains");
    // Rollback fixtures (spec §5): a failure after staging, after a partial replacement and after the
    // final validation leaves the v0.24.76 bytes of the whole write set in place (new files absent).
    const writeSet = [VECTOR2, INDEX, POLICY, ENGINE, CONTRACT, BRIDGES, PACKAGE, SPLITS, RUNTIME, SHIM_PATH, MANIFEST];
    const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-vector2-rollback-"));
    try {
      const snapshot = () => writeSet.map(file => {
        const target = path.join(temporary, file);
        return [file, fs.existsSync(target) ? fs.readFileSync(target).toString("base64") : null];
      });
      for (const file of writeSet) {
        fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
        if (file !== ENGINE && file !== SHIM_PATH) fs.writeFileSync(path.join(temporary, file), Buffer.from(before(file), "utf8"));
      }
      const original = snapshot();
      const writes = writeSet.map(file => ({ relativePath: file, bytes: Buffer.from(after(file), "utf8") }));
      for (const boundary of ["after-staging:0", `after-replacement:${Math.floor(writeSet.length / 2)}`,
        `after-final-validation:${writeSet.length}`]) {
        assert.throws(() => new ControlledMetadataTransaction({ projectRoot: temporary,
          failureInjector: ({ phase, count }) => {
            if (`${phase}:${count}` === boundary) throw new Error("injected Vector2 rollback");
          } }).commit(writes, () => undefined), /injected Vector2 rollback/u);
        assert.deepEqual(snapshot(), original, `rollback after ${boundary} did not restore the v0.24.76 bytes`);
      }
      new ControlledMetadataTransaction({ projectRoot: temporary }).commit(writes, () => undefined);
      assert(writeSet.every(file => fs.readFileSync(path.join(temporary, file)).equals(Buffer.from(after(file), "utf8"))),
        "the committed write set differs");
    } finally {
      assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()));
      fs.rmSync(temporary, { recursive: true, force: true });
    }
    const facts = JSON.stringify([baseline, consumers.map(({ source }) => source), ACTIVATION.id, sha(after(RUNTIME))]);
    return { cases: JSON.parse(baseline).length + consumers.length + 3 + 4, factsSha256: sha(facts) };
  },
});
