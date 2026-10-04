"use strict";

// Stage 4 cluster records (owner decision 0.3: one data-driven check for every cluster record). Every
// applied record still holds on the live tree: its ESM targets export exactly the recorded names, import
// only the recorded modules inside boundaries the policy allows, read no global other than a language
// built-in (or the record's allowed platform globals) and outside Platform name no browser, DEV, raw-config
// or transport global; the Manifest, the classic shims or placeholders, the runtime contract and the bridge
// registry carry the recorded facts (or a later record retired them). Negative fixtures prove the projector
// rejects source deltas, free globals and forbidden names.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const eslintScope = require("eslint-scope");
const { StageFourClusterLedger, recordStage } = require("./stage_four/cluster_ledger");
const { LANGUAGE_BUILTINS, StageFourEsmTargetProjector } = require("./stage_four/esm_target_projector");
const { ActivationShimRenderer } = require("../build/compat_runtime/activation_shim");
const { ActivationRetirementProjection, MigratedSourcePlaceholder, RetiredActivationPlaceholder } =
  require("../build/compat_runtime/activation_retirement");
const { CanonicalActivationIdentity } = require("../build/compat_runtime/cumulative_runtime_contract");
const { PATHS, StageFourClusterApply, StageFourClusterPlan, resolveImportSource } = require("./stage_four/cluster_path");
const { StageFourTierAEvidence } = require("./stage_four/tier_a_evidence");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");
const { StageThreePatchReleaseTransition } = require("./domain_batches/stage_three_patch_release_transition");
const { FILES: RELEASE_FILES, StageFourRelease } = require("./stage_four/release_path");

const ROOT = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (file) => JSON.parse(read(file));
const policy = json("architecture/module_architecture.json");
const manifest = new Map(json("architecture/migration/module_migration_manifest.json").modules
  .map((entry) => [entry.currentPath, entry]));
const contract = json("architecture/migration/stage_3_compatibility_runtime.json");
const bridges = new Set(json("architecture/guards/migration_bridge_registry.json").bridges.map((item) => item.id));
for (const bridge of json("architecture/guards/migration_bridge_registry.json").bridges) {
  assert(Number(bridge.removalStage.slice(-1)) >= Number(bridge.introducedStage.slice(-1)),
    `${bridge.id}: retirement cannot precede introduction`);
}
const boundaryOf = (file) => policy.targetBoundaries
  .flatMap((boundary) => boundary.pathPrefixes.filter((prefix) => file.startsWith(prefix)).map((prefix) => ({ boundary, prefix })))
  .sort((left, right) => right.prefix.length - left.prefix.length)[0]?.boundary;
const FORBIDDEN = ["window", "globalThis", "self", "document", "localStorage", "sessionStorage", "navigator", "CONFIG",
  "__CYBER_FISHING_COMPAT_RUNTIME__"];

// Every stage's records are validated by this one gate (Stage 5 reuses the Stage 4 mechanism); the Stage 4 closure
// pins below keep reading the Stage 4 ledger and preparations only.
const ledger = StageFourClusterLedger.cumulative(ROOT);
const stageFourLedger = StageFourClusterLedger.read(ROOT);
const stageTwoProvider = {currentPath:"src/engine/compat/stage_2/test.js",architecture:{migrationStatus:"esm"}};
const stageTwoTarget = {currentPath:"src/engine/test.js",architecture:{migrationStatus:"esm"}};
const importFacts = {provider:stageTwoProvider,symbol:"Test",consumer:"src/test.js",memberTargets:new Map(),
  entries:new Map([[stageTwoTarget.currentPath,stageTwoTarget]]),registry:{bridges:[{source:"src/test.js",
    bridge:stageTwoProvider.currentPath,target:stageTwoTarget.currentPath,globalProviders:[{symbol:"Test"}]}]}};
assert.equal(resolveImportSource(importFacts),stageTwoTarget.currentPath);
assert.throws(()=>resolveImportSource({...importFacts,symbol:"Other"}),/one exact registered/u);
assert.throws(()=>resolveImportSource({...importFacts,registry:{bridges:[]}}),/one exact registered/u);
assert.throws(()=>resolveImportSource({...importFacts,registry:{bridges:[...importFacts.registry.bridges,...importFacts.registry.bridges]}}),/one exact registered/u);
assert.throws(()=>resolveImportSource({...importFacts,entries:new Map()}),/not ESM/u);
// GameConfig facades are identity aliases, not an exception for arbitrary factories or raw imports.
const rawPath = "src/game/config/raw/items/item_database.js", facadePath = "src/game/config/databases/item_catalog.js";
const rawProvider = { currentPath: "src/config/databases/item_db.js", architecture: { roles: ["compatibility-bridge"], targetPath: rawPath } };
const rawEntry = { currentPath: rawPath, architecture: { targetBoundary: "game-config-raw", migrationStatus: "verified", targetPath: rawPath } };
const facadeEntry = { currentPath: facadePath, architecture: { targetBoundary: "game-config", migrationStatus: "verified", targetPath: facadePath } };
const aliasSource = 'import { ITEM_DB as catalog } from "../raw/items/item_database.js"; export const ITEM_DB = catalog;';
const aliasFacts = { provider: rawProvider, symbol: "ITEM_DB", consumer: "src/app/bootstrap.js", memberTargets: new Map(),
  entries: new Map([[rawPath, rawEntry], [facadePath, facadeEntry]]), registry: { bridges: [] }, candidate: facadePath, readSource: () => aliasSource };
assert.equal(resolveImportSource(aliasFacts), facadePath);
assert.equal(resolveImportSource({ ...aliasFacts, candidate: null }), rawPath);
for (const source of [
  aliasSource.replace("= catalog", "= { ...catalog }"),
  aliasSource.replace("const ITEM_DB", "let ITEM_DB"),
  aliasSource.replace("= catalog", "= other"),
  aliasSource.replace("../raw/items/item_database.js", "../raw/items/other.js"),
  aliasSource.replace("import { ITEM_DB", "import { OTHER"),
  aliasSource.replace("export const ITEM_DB", "export const OTHER"),
  aliasSource + " export const OTHER = catalog;",
  aliasSource + " catalog.changed = true;",
  aliasSource.replace("= catalog", "= Object.assign({}, catalog)"),
]) assert.throws(() => resolveImportSource({ ...aliasFacts, readSource: () => source }), /config facade/u);
for (const change of [{ targetBoundary: "platform" }, { migrationStatus: "classified" }, { targetPath: rawPath }]) {
  assert.throws(() => resolveImportSource({ ...aliasFacts, entries: new Map([[rawPath, rawEntry],
    [facadePath, { ...facadeEntry, architecture: { ...facadeEntry.architecture, ...change } }]]) }), /verified GameConfig/u);
}
assert.throws(() => resolveImportSource({ ...aliasFacts, entries: new Map([[rawPath, rawEntry]]) }), /verified GameConfig/u);

const stageTwoPlanFixture = {batches:[{id:"stage-2.fixture",bridgeStrategy:{bridges:[{wrapperPath:stageTwoProvider.currentPath,
  targetModule:stageTwoTarget.currentPath,legacyConsumers:["src/test.js"]}]}}]};
const { CanonicalBridgeIdentity } = require("../build/legacy_bridge_build_config");
const stageTwoRetiredId = CanonicalBridgeIdentity.id({owner:"stage-2.fixture",bridge:stageTwoProvider.currentPath,
  target:stageTwoTarget.currentPath,source:"src/test.js"});
const stageTwoRetirementFixture = {modules:[{currentPath:"src/test.js"}],output:{status:"applied",bridgesRetired:[stageTwoRetiredId]}};
assert.deepEqual(new StageFourClusterLedger([]).stageTwoPlan(stageTwoPlanFixture),stageTwoPlanFixture);
assert.deepEqual(new StageFourClusterLedger([stageTwoRetirementFixture]).stageTwoPlan(stageTwoPlanFixture)
  .batches[0].bridgeStrategy.bridges[0].legacyConsumers,[]);
assert.throws(()=>new StageFourClusterLedger([{...stageTwoRetirementFixture,modules:[]}]).stageTwoPlan(stageTwoPlanFixture),/no migrated consumer/u);
const { CumulativeGraphPlanner } = require("../build/compat_runtime/cumulative_graph_planner");
const assetTransition = contract.previousRuntimeTransitions.find(item => item.module === "src/engine/assets/asset_manifest.js");
const assetActivation = [...contract.activationPositions, ...contract.retiredActivations.map(item => item.activation)]
  .find(item => assetTransition.activationIds.includes(item.id));
const assetGraphFixture = {targetModules:[assetTransition.module],previousStageModules:[{source:assetTransition.module,
  previousRuntime:assetTransition.previousRuntime,previousOutputs:assetTransition.previousOutputs}],
  previousRuntimeTransitions:[assetTransition],activations:[]};
const assetPlanner = new CumulativeGraphPlanner({projectRoot:ROOT});
assert.equal(assetPlanner.plan({...assetGraphFixture,retiredActivations:[assetActivation]}).issues.length,0);
assert.equal(assetPlanner.plan(assetGraphFixture).issues.length,1);
assert.equal(assetPlanner.plan({...assetGraphFixture,retiredActivations:[{...assetActivation,id:"wrong"}]}).issues.length,1);
const preparations = StageFourClusterLedger.cumulativePreparations(ROOT);
const stageFourPreparations = StageFourClusterLedger.preparations(ROOT);
// Exact preparation imports: reject an unrecorded source, implicit paths, duplicates or missing review.
const preparationImport = {files:[{path:"src/app/bootstrap.js"}],importEdges:[{
  source:"src/app/bootstrap.js",target:"src/platform/browser/inventory/random_inventory_id.js",reason:"UUID port"}]};
assert.doesNotThrow(()=>StageFourClusterLedger.validatePreparationImports(preparationImport));
for(const change of [{source:"src/app/unrecorded.js"},{target:"../escape.js"},{reason:""}])
  assert.throws(()=>StageFourClusterLedger.validatePreparationImports({...preparationImport,
    importEdges:[{...preparationImport.importEdges[0],...change}]}),/preparation import/u);
assert.throws(()=>StageFourClusterLedger.validatePreparationImports({...preparationImport,
  importEdges:[preparationImport.importEdges[0],preparationImport.importEdges[0]]}),/duplicate/u);
const preparationRetired = new Set(preparations.flatMap(record => [
  ...(record.replacedBridges || []).map(pair => pair.before.id), ...(record.mergedBridges || []).map(merge => merge.from.id)]));
const active = new Map(contract.activationPositions.map((item) => [item.id, item]));
const retiredActivations = new Set((contract.retiredActivations || []).map((item) => item.activation.id));
const inert = new Set((contract.inertModules || []).map((item) => item.targetModule));
// Apply order follows the graph review, not the record id (018 applies after 020): a bridge may be retired by any
// other applied record, never by its own.
const laterRetiredBridges = (index) => new Set([...preparationRetired, ...ledger.records.filter((_, other) => other !== index)
  .flatMap((record) => record.output?.bridgesRetired || [])]);
for (const preparation of preparations) {
  for (const merge of preparation.mergedBridges || []) {
    assert(ledger.applied.some(record=>record.output.bridgesAdded.includes(merge.from.id)), "merged bridge has no original owner");
    assert(!bridges.has(merge.from.id), "merged consumer bridge remains");
    assert(bridges.has(merge.after.id) || ledger.applied.some(record=>record.output.bridgesRetired.includes(merge.after.id)),
      "merged bridge is missing without retirement");
    assert.throws(()=>StageFourClusterLedger.validateBridgeMerge({...merge,after:{...merge.after,globalProviders:[]}}),/exact existing surfaces/u);
    assert.throws(()=>StageFourClusterLedger.validateBridgeMerge({...merge,from:{...merge.from,target:"src/other.js"}}),/identity/u);
    assert.throws(()=>StageFourClusterLedger.validateBridgeMerge({...merge,after:{...merge.after,reason:"changed"}}),/exact existing surfaces/u);
  }
  for (const id of preparation.resolvedDebts) assert(!json("architecture/guards/known_debt_registry.json").debts.some(debt=>debt.id===id),
    `preparation ${preparation.id}: resolved debt remains ${id}`);
  assert.equal(preparation.verification.globalsBefore, preparation.verification.globalsAfter, "provider relocation cannot add globals");
  for (const pair of preparation.replacedBridges || []) {
    assert(ledger.applied.some(record=>record.output.bridgesAdded.includes(pair.before.id)), "original bridge has no applied owner record");
    assert(!bridges.has(pair.before.id), "original consumer bridge remains active");
    assert(bridges.has(pair.after.id) || ledger.applied.some(record=>record.output.bridgesRetired.includes(pair.after.id)),
      "relocated bridge is missing without a retirement record");
  }
}
let targets = 0;
ledger.records.forEach((record, index) => {
  assert.equal(record.schemaVersion, 1, `${record.file}: schemaVersion`);
  assert(policy.targetBoundaries.some((item) => item.id === record.boundary), `${record.file}: unknown boundary`);
  assert(["A", "B", "C"].includes(record.tier) && record.tierEvidence, `${record.file}: tier and tierEvidence`);
  assert(/^M\d$/u.test(record.milestone), `${record.file}: milestone`);
  // A deferred record names a later stage that owns its modules now; it can never be applied in its own stage.
  const recordStageNumber = recordStage(record);
  if (record.deferred) {
    assert(record.output === null && /^stage-[5-7]$/u.test(record.deferred.stage) &&
      Number(record.deferred.stage.slice(6)) > recordStageNumber && record.deferred.reason,
      `${record.file}: deferred record needs output null, a later stage and a reason`);
    for (const module of record.modules) {
      assert.notEqual(manifest.get(module.currentPath)?.architecture.targetBoundary, record.boundary,
        `${module.currentPath}: deferred module is still in ${record.boundary}`);
    }
    return;
  }
  if (record.output === null) return;
  assert.equal(record.output.status, "applied", `${record.file}: output status`);
  for (const id of record.output.resolvedDebts || []) assert(!json("architecture/guards/known_debt_registry.json").debts.some(debt => debt.id === id),
    `${record.file}: resolved debt remains ${id}`);
  const boundary = policy.targetBoundaries.find((item) => item.id === record.boundary);
  for (const wrapper of record.output.retiredStageTwoWrappers || []) {
    assert(wrapper.file.startsWith("src/engine/compat/stage_2/"), "retired wrapper outside Stage 2");
    assert(wrapper.activationIds.every(id => record.output.activationsRetired.includes(id)), "wrapper has no exact retirement");
    const activations = contract.retiredActivations.filter(item => wrapper.activationIds.includes(item.activation.id)).map(item => item.activation);
    assert.equal(read(wrapper.file), new RetiredActivationPlaceholder().renderProvider(activations));
  }
  for (const module of record.modules) {
    targets += 1;
    const file = module.targetPath;
    assert.equal(boundaryOf(file)?.id, record.boundary, `${file}: path outside ${record.boundary}`);
    const tree = espree.parse(read(file), { ecmaVersion: "latest", sourceType: "module", tokens: true, range: true });
    const exported = tree.body.filter((node) => node.type === "ExportNamedDeclaration").flatMap((node) =>
      node.declaration.id ? [node.declaration.id.name] : node.declaration.declarations.map((item) => item.id.name));
    assert.deepEqual(exported.sort(), [...module.exports].sort(), `${file}: exports differ from the record`);
    const imports = tree.body.filter((node) => node.type === "ImportDeclaration").flatMap((node) =>
      node.specifiers.map((specifier) => `${specifier.imported.name}<-${path.posix.normalize(
        path.posix.join(path.posix.dirname(file), node.source.value))}`)).sort();
    assert.deepEqual(imports, (module.imports || []).map((item) => `${item.symbol}<-${item.from}`).sort(),
      `${file}: imports differ from the record`);
    for (const item of module.imports || []) {
      assert(boundary.allowedDependencies.includes(boundaryOf(item.from)?.id), `${file}: forbidden import ${item.from}`);
    }
    const allowed = new Set([...LANGUAGE_BUILTINS, ...(module.allowedGlobals || [])]);
    const free = eslintScope.analyze(tree, { ecmaVersion: 2022, sourceType: "module" }).globalScope.through
      .map((reference) => reference.identifier.name).filter((name) => !allowed.has(name));
    assert.deepEqual([...new Set(free)], [], `${file}: reads globals`);
    if (record.boundary !== "platform") {
      const named = tree.tokens.filter((token, position) => token.type === "Identifier" &&
        FORBIDDEN.includes(token.value) && tree.tokens[position - 1]?.value !== "." &&
        !(token.value === "CONFIG" && record.boundary === "game-config" && module.exports.includes("CONFIG")));
      assert.deepEqual(named.map((token) => token.value), [], `${file}: names a forbidden global`);
    }
    const entry = manifest.get(file);
    assert(entry?.architecture.migrationStatus === "verified" && entry.architecture.targetBoundary === record.boundary,
      `${file}: Manifest entry is not a verified ${record.boundary} module`);
    assert(manifest.get(module.currentPath)?.architecture.roles.includes("compatibility-bridge"),
      `${module.currentPath}: classic entry is not a compatibility bridge`);
    const shims = contract.activationPositions.filter((item) => item.sourceProvider === module.currentPath);
    if (shims.length > 0) {
      assert.equal(read(module.currentPath), shims.sort((left, right) => left.id.localeCompare(right.id))
        .map((item) => new ActivationShimRenderer().render(item, contract.transport.symbol)).join(""),
      `${module.currentPath}: classic source is not its activation shims`);
    } else if (inert.has(file)) {
      new MigratedSourcePlaceholder().validate({ code: read(module.currentPath), currentPath: module.currentPath,
        targetPath: file, exports: module.exports, stage: `Stage ${recordStageNumber}` });
    } else {
      const retired = (contract.retiredActivations || []).filter((item) =>
        item.activation.sourceProvider === module.currentPath).map((item) => item.activation);
      assert(retired.length > 0, `${module.currentPath}: no active, inert or retired contract`);
      new RetiredActivationPlaceholder().validateProvider({ code: read(module.currentPath), activations: retired });
    }
  }
  for (const id of record.output.activations) {
    assert(active.has(id) || retiredActivations.has(id), `${record.file}: activation ${id} is missing`);
  }
  const retiredLater = laterRetiredBridges(index);
  for (const id of record.output.bridgesAdded) {
    assert(bridges.has(id) || retiredLater.has(id), `${record.file}: bridge ${id} is missing`);
  }
  for (const id of record.output.bridgesRetired) assert(!bridges.has(id), `${record.file}: bridge ${id} is still active`);
  for (const id of record.output.activationsRetired || []) {
    const retired = contract.retiredActivations.find((item) => item.activation.id === id);
    assert(retired && retired.retiredBy === record.output.owner && !active.has(id),
      `${record.file}: activation ${id} is not retired by this cluster`);
  }
});

for (const entry of manifest.values()) {
  if (["bootstrap-production", "entrypoint-game"].includes(entry.architecture.targetBoundary) &&
      entry.architecture.roles.includes("compatibility-bridge")) {
    assert(ledger.applied.some(record => record.modules.some(module => module.currentPath === entry.currentPath)),
      `${entry.currentPath}: Bootstrap transport requires an applied exact cluster record`);
  }
}

// Negative fixtures: the projector accepts only export tokens plus the import header.
const projector = new StageFourEsmTargetProjector();
const fixture = (source, extra = {}) => projector.project({ source, currentPath: "src/a.js",
  targetPath: "src/game/config/a.js", boundary: "game-config", exports: ["A"], ...extra });
assert.equal(fixture("class A {}\n").targetSource, "export class A {}\n");
assert.equal(fixture("\uFEFFclass A {}\r\n").targetSource, "\uFEFFexport class A {}\r\n");
assert.deepEqual(fixture("function A() {}\n").providerMechanisms, ["A:global-function"]);
assert.deepEqual(fixture("const A = {};\n").providerMechanisms, ["A:global-lexical"]);
assert.equal(fixture("class A { points = new Float32Array(10); }\n").analysis.freeGlobals[0], "Float32Array");
assert.throws(() => fixture("class A { points = new Float32Array(10); run() { return document; } }\n"), /reads classic or browser globals: document/u);
assert.throws(() => fixture("class A { run() { return ITEM_DB; } }\n"), /reads classic or browser globals: ITEM_DB/u);
assert.equal(fixture("const CONFIG = {};\n", {exports:["CONFIG"]}).targetSource,"export const CONFIG = {};\n");
assert.throws(()=>fixture("const CONFIG = {};\n", {exports:["CONFIG"],boundary:"game-application"}),/names CONFIG/u);
assert.throws(()=>fixture("class A { run() { return CONFIG; } }\n"),/reads classic or browser globals: CONFIG/u);
if(preparations.length){
  const pair=preparations[0].replacedBridges[0];
  assert.throws(()=>StageFourClusterLedger.validateBridgeRelocation({before:pair.before,after:{...pair.after,id:pair.before.id}}),/relocated bridge identity/u);
  const changed={...pair.after,reason:"changed"};
  assert.throws(()=>StageFourClusterLedger.validateBridgeRelocation({before:pair.before,after:changed}),/only consumer path/u);
}
assert.throws(() => fixture("class A { run() { return typeof window; } }\n"), /window/u);
assert.throws(() => fixture("class A {}\nglobalThis.B = A;\n"), /top-level ExpressionStatement/u);
assert.equal(fixture("class A {}\n\nglobalThis.A = A;\n").targetSource, "export class A {}\n");
assert.deepEqual(fixture("class A {}\nif (typeof window !== \"undefined\") {\n  window.A = A;\n}\n").exposures,
  [{ symbol: "A", mechanism: "window-property", text: "window-guarded" }]);
assert.throws(() => fixture("const A = 1, B = 2;\n"), /exactly one top-level declaration/u);
assert.equal(fixture("class A { b() { return new B(); } }\n", { imports: [{ symbol: "B", from: "src/game/config/b/b.js" }] })
  .targetSource, "import { B } from \"./b/b.js\";\n\nexport class A { b() { return new B(); } }\n");

// Retirement uses the same Stage 3 projection: retire only when the last holding bridge disappears.
const activation = (symbol) => {
  const identity = { exportName: symbol, legacyScriptIndex: 1, legacySymbol: symbol,
    shimFile: `activations/001_${symbol.toLowerCase()}.js`, sourceProvider: "src/b.js",
    targetModule: "src/game/config/b.js" };
  return { ...identity, id: CanonicalActivationIdentity.id(identity), owner: "stage-4.cluster-002-fixture",
    reason: "fixture", removalStage: "stage-4" };
};
const b1 = activation("B1"), b2 = activation("B2");
const bridge = (source, symbol) => ({ id: `${source}:${symbol}`, source, target: b1.targetModule,
  globalProviders: [{ symbol, mechanism: "global-this-property" }] });
const retirementPlan = (held, propertyReader = false, stage = 4) => {
  const entry = { currentPath: "src/a.js", architecture: { roles: ["config-factory"], targetBoundary: "game-config",
    targetPath: "src/game/config/a.js" }, observed: { legacyLoadOrder: 2,
    providers: { items: [{ symbol: "A", mechanism: "global-lexical" }] } },
    analysis: { blockers: { items: [] }, dependencies: { unresolved: [], ambiguous: [],
      items: [{ target: "src/b.js", symbols: ["B1"] }] } } };
  const runtime = { output: { directory: "dist/fixture/", runtimeFile: "runtime.js" }, activationPositions: [b1, b2] };
  const artifacts = new Map([[PATHS.manifest, { modules: [entry, { currentPath: "src/b.js",
    architecture: { roles: ["compatibility-bridge"], targetPath: b1.targetModule } }] }],
  [PATHS.contract, runtime], [PATHS.registry, { bridges: [bridge("src/a.js", "B1"), ...held] }]]);
  const workspace = { json: (file) => artifacts.get(file), exists: () => false, path: (file) => path.join(ROOT, file),
    text: (file) => file === PATHS.index
      ? '<script src="dist/fixture/runtime.js"></script>\n<script src="dist/fixture/activations/001_b1.js"></script>\n' +
        '<script src="dist/fixture/activations/001_b2.js"></script>\n<script src="src/a.js"></script>\n'
      : propertyReader && file === "src/config/project_version.js" ? "globalThis.B1;\n"
        : "class A { read() { return B1; } }\n" };
  return new StageFourClusterPlan(workspace, { kind: `cyber-fishing-stage-${stage}-cluster`, id: "003", slug: "fixture",
    boundary: "game-config", modules: [{
    currentPath: entry.currentPath, targetPath: entry.architecture.targetPath, exports: ["A"],
    imports: [{ symbol: "B1", from: b1.targetModule }] }] }).build();
};
assert.deepEqual(retirementPlan([bridge("src/other.js", "B1"), bridge("src/other.js", "B2")]).retiredActivations, []);
const partial = retirementPlan([bridge("src/other.js", "B2")]);
assert.deepEqual(partial.retiredActivations, [b1]);
assert.throws(() => retirementPlan([bridge("src/other.js", "B2")], true), /still has property readers/u);
assert.deepEqual(retirementPlan([]).retiredActivations.map((item) => item.id).sort(), [b1.id, b2.id].sort());
const projected = new ActivationRetirementProjection().contract({ activationPositions: [b1, b2] },
  partial.retiredActivations, partial.owner);
assert.deepEqual(projected.activationPositions, [b2]);
assert.equal(projected.retiredActivations[0].placeholder, "shared-source-line-removed");
const completed = new ActivationRetirementProjection().contract(projected, [b2], "stage-4.cluster-004-fixture");
assert(completed.retiredActivations.every(item => item.placeholder === "inert-classic-position"));
assert.equal(new RetiredActivationPlaceholder().renderProvider(completed.retiredActivations.map(item => item.activation))
  .split("\n").length - 1, 2);
const placeholder = new RetiredActivationPlaceholder();
assert(placeholder.render(b1).startsWith("// Retired Stage 4 activation "));
assert(placeholder.render({ ...b1, owner: "stage-3.002.fixture" }).startsWith("// Retired Stage 3 activation "));
assert.throws(() => placeholder.validateProvider({ code: placeholder.render(b1) + "globalThis.B1 = {};\n",
  activations: [b1] }), /differs from contract/u);
const state = json("architecture/migration/stage_3_execution_state.json");
const loadRetirement = (output) => new StageThreeApprovedPlanSource({ read: file => {
  if (file === PATHS.contract) return Buffer.from(JSON.stringify({retiredActivations: [{activation: b1,
    retiredBy: "stage-4.cluster-002-fixture"}]}));
  if (file === "architecture/migration/stage_4/clusters/002_fixture.json") return Buffer.from(JSON.stringify({
    kind: "cyber-fishing-stage-4-cluster", id: "002", slug: "fixture", output}));
  return Buffer.from(read(file));
} }).load(state);
const validOutput = {status: "applied", owner: "stage-4.cluster-002-fixture", activationsRetired: [b1.id]};
assert(loadRetirement(validOutput).document.batches.length > 0);
assert.throws(() => loadRetirement({...validOutput, activationsRetired: []}), /no exact applied Stage 4 cluster/u);
assert.throws(() => loadRetirement({...validOutput, status: "planned"}), /no exact applied Stage 4 cluster/u);
assert.throws(() => loadRetirement({...validOutput, owner: "other"}), /no exact applied Stage 4 cluster/u);

// Stage-qualified identities (Stage 5 tooling transition): records, preparations, owners, evidence and the package
// label carry their stage; a Stage 5 retirement resolves only to an exact applied Stage 5 record; Stage 4 stays frozen.
let stageCases = 0;
const stageCase = (condition, message) => { assert(condition, message); stageCases += 1; };
const stageThrows = (action, pattern, message) => { assert.throws(action, pattern, message); stageCases += 1; };
const loadStageFiveRetirement = (kind, output) => new StageThreeApprovedPlanSource({ read: file => {
  if (file === PATHS.contract) return Buffer.from(JSON.stringify({retiredActivations: [{activation: b1,
    retiredBy: "stage-5.cluster-001-fixture"}]}));
  if (file === "architecture/migration/stage_5/clusters/001_fixture.json") return Buffer.from(JSON.stringify({
    kind, id: "001", slug: "fixture", output}));
  return Buffer.from(read(file));
} }).load(state);
const stageFiveOutput = {status: "applied", owner: "stage-5.cluster-001-fixture", activationsRetired: [b1.id]};
stageCase(loadStageFiveRetirement("cyber-fishing-stage-5-cluster", stageFiveOutput).document.batches.length > 0,
  "a Stage 5 retirement resolves to its applied Stage 5 record");
stageThrows(() => loadStageFiveRetirement("cyber-fishing-stage-4-cluster", stageFiveOutput),
  /no exact applied Stage 5 cluster/u, "a Stage 5 owner never resolves to a Stage 4 kind");
const temporaryRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "stage-ledger-"));
try {
  const writeRecord = (relative, value) => {
    fs.mkdirSync(path.dirname(path.join(temporaryRoot, relative)), { recursive: true });
    fs.writeFileSync(path.join(temporaryRoot, relative), JSON.stringify(value));
  };
  writeRecord("architecture/migration/stage_5/clusters/001_fixture.json", { kind: "cyber-fishing-stage-4-cluster", id: "001" });
  stageThrows(() => StageFourClusterLedger.read(temporaryRoot, 5), /identity differs/u, "Stage 4 kind in the Stage 5 ledger");
  writeRecord("architecture/migration/stage_5/clusters/001_fixture.json", { kind: "cyber-fishing-stage-5-cluster", id: "001" });
  writeRecord("architecture/migration/stage_5/clusters/003_gap.json", { kind: "cyber-fishing-stage-5-cluster", id: "003" });
  stageThrows(() => StageFourClusterLedger.read(temporaryRoot, 5), /contiguous/u, "Stage 5 ids are contiguous per stage");
  fs.rmSync(path.join(temporaryRoot, "architecture/migration/stage_5/clusters/003_gap.json"));
  writeRecord("architecture/migration/stage_4/clusters/001_old.json", { kind: "cyber-fishing-stage-4-cluster", id: "001" });
  stageCase(StageFourClusterLedger.cumulative(temporaryRoot).records.map(recordStage).join(",") === "4,5",
    "the cumulative ledger lists Stage 4 then Stage 5 records, each numbered from 001");
  writeRecord("architecture/migration/stage_5/preparations/001_fixture.json", { schemaVersion: 1,
    kind: "cyber-fishing-stage-4-preparation" });
  stageThrows(() => StageFourClusterLedger.preparations(temporaryRoot, 5), /cyber-fishing-stage-5-preparation/u,
    "a Stage 5 preparation carries the Stage 5 kind");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
stageThrows(() => recordStage({ kind: "cyber-fishing-stage-6-cluster" }), /unknown cluster record kind/u, "no Stage 6 ledger yet");
const appliedFixture = (stage) => ({ kind: `cyber-fishing-stage-${stage}-cluster`, output: { status: "applied" } });
stageCase(new StageFourClusterLedger([appliedFixture(4), appliedFixture(4), appliedFixture(5)]).stageLabel("3.x") === "5.1",
  "the package label follows the latest stage with an applied record");
stageCase(new StageFourClusterLedger([appliedFixture(4), { kind: "cyber-fishing-stage-5-cluster", output: null }])
  .stageLabel("3.x") === "4.1", "a pending Stage 5 record leaves the Stage 4 label");
stageCase(stageFourLedger.records.every((record) => recordStage(record) === 4) &&
  JSON.stringify(ledger.records.slice(0, stageFourLedger.records.length)) === JSON.stringify(stageFourLedger.records),
  "Stage 4 records stay the frozen prefix of the cumulative ledger");
const stageFiveEvidence = new StageFourTierAEvidence({ root: ROOT, record: { kind: "cyber-fishing-stage-5-cluster", id: "001",
  modules: [] }, kind: "api-parity", classes: ["A"], scenarios: ["utils/x-check.js"] });
stageCase(stageFiveEvidence.file === "architecture/migration/stage_5/evidence/001_api-parity.json" &&
  stageFiveEvidence.evidenceKind === "cyber-fishing-stage-5-tier-a-evidence", "Stage 5 evidence has its own directory and kind");
const stageFivePlan = retirementPlan([], false, 5);
stageCase(stageFivePlan.owner === "stage-5.cluster-003-fixture" && stageFivePlan.stage === 5 &&
  stageFivePlan.retiredActivations.length === 2 && stageFivePlan.inert.every((item) => item.owner === stageFivePlan.owner),
  "a Stage 5 plan owns its retirements and inert modules as stage-5");
stageCase(new MigratedSourcePlaceholder().render({ currentPath: "src/a.js", targetPath: "src/game/presentation/a.js",
  exports: ["A"], stage: "Stage 5" }).startsWith("// Migrated Stage 5 source "), "a Stage 5 inert placeholder names its stage");

// Stage 4 releases: one chain from the last Stage 3 release; every version pin equals the latest applied release
// (the Stage 3 release until the first one) and the CHANGELOG holds its entry. Fixtures: a release delta changes
// only the version fields, the index query, the version statements and the new entry (plus a declared trim).
const releases = StageFourRelease.records(ROOT);
const latestRelease = releases.filter((record) => record.output).at(-1);
assert.equal(StageFourRelease.currentVersion(read), latestRelease?.toRelease || state.releaseVersion, "version pins");
for (const record of releases.filter((item) => item.output)) {
  assert.deepEqual(record.output.files.map((file) => file.path).sort(), Object.values(RELEASE_FILES).sort(), record.file);
  assert(record.output.files.every((file) => /^[0-9a-f]{64}$/u.test(file.before) && /^[0-9a-f]{64}$/u.test(file.after) &&
    file.edits.length > 0) && record.output.tag === `v${record.toRelease}`, `${record.file}: output`);
}
if (latestRelease) {
  assert(read("CHANGELOG.md").replace(/\r\n/gu, "\n").includes(StageFourRelease.changelogEntry(latestRelease, "\n")),
    "CHANGELOG lacks the latest release entry");
}
const releaseFixture = { milestone: "M1", fromRelease: "1.0.0", toRelease: "1.1.0", title: "New", codename: "new",
  updatedAt: "2026-01-02", notes: ["note"], changelog: ["line"], versionDecision: "fixture" };
const releaseHeader = "# CyberFishing changelog\r\n\r\n";
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const crlf = (...lines) => lines.join("\r\n");
const releaseTexts = (version, extra = null) => new Map([
  ["CHANGELOG.md", crlf("# CyberFishing changelog", "", "## v1.0.0 - Old", "", "### Changed", "", "- old", "",
    "## v0.9.0 - Older", "", "- older", "")],
  ["index.html", crlf(`<script src="src/config/project_version.js?v=${version}"></script>`, "<p>a</p>", "")],
  ["package-lock.json", canonicalJson({ version, packages: { "": { version, ...(extra ? { extra } : {}) } } })],
  ["package.json", canonicalJson({ version, scripts: extra ? { a: extra } : {} })],
  ["src/config/project_version.js", crlf(`const CURRENT_PROJECT_VERSION = "${version}";`, "const C = Object.freeze({",
    '  codename: "old",', '  updatedAt: "2026-01-01",', ["  notes: Object.freeze([", '    "a",', '    "b",', "  ]),"].join("\n"),
    "});", "")],
]);
const releaseDelta = (record, file, before, after) => () => StageFourRelease.validateDelta(record, file, before, after);
let releaseCases = 0;
for (const record of [releaseFixture, { ...releaseFixture, changelogTrimFrom: "0.9.0" }]) {
  const before = releaseTexts("1.0.0");
  for (const [file, edits] of new StageFourRelease(ROOT).edits(record, before)) {
    const after = edits.reduce((text, edit) => StageThreePatchReleaseTransition.replace(text, edit.from, edit.to, edit.count),
      before.get(file));
    assert.doesNotThrow(releaseDelta(record, file, before.get(file), after), file);
    releaseCases += 1;
    if (file === "CHANGELOG.md") assert.equal(after.includes("v0.9.0"), !record.changelogTrimFrom);
    if (file === "src/config/project_version.js") assert(after.includes('  codename: "new",\r\n') && after.includes('    "note",\n  ]),\r\n'));
  }
}
const [oldTexts, newTexts] = [releaseTexts("1.0.0"), releaseTexts("1.1.0", "b")];
for (const esm of [false, true]) {
  const texts = releaseTexts("1.0.0");
  texts.set(RELEASE_FILES.source, 'if (typeof window !== "undefined") window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;');
  texts.set("src/config/project_version_catalog.js", esm ? "globalThis.PROJECT_VERSION_CONFIG = runtimeExport;" : 'const CURRENT_PROJECT_VERSION = "1.0.0";');
  texts.set("src/game/presentation/version/project_version.js", 'export const CURRENT_PROJECT_VERSION = "1.0.0";');
  assert.equal(StageFourRelease.currentVersion(file => texts.get(file)), "1.0.0");
  texts.set("package.json", JSON.stringify({version:"9.9.9"}));
  assert.throws(() => StageFourRelease.currentVersion(file => texts.get(file)), /version pins disagree/u);
}

releaseCases += 4;
const rejectsRelease = (file, after, pattern) => {
  assert.throws(releaseDelta(releaseFixture, file, oldTexts.get(file), after), pattern, file);
  releaseCases += 1;
};
rejectsRelease("package.json", newTexts.get("package.json"), /more than the version/u);
rejectsRelease("package-lock.json", newTexts.get("package-lock.json"), /more than the version/u);
rejectsRelease("index.html", newTexts.get("index.html").replace("<p>a", "<p>b"), /version query/u);
rejectsRelease("CHANGELOG.md", oldTexts.get("CHANGELOG.md").replace(releaseHeader, releaseHeader +
  StageFourRelease.changelogEntry(releaseFixture, "\r\n")).replace("- old", "- edited"), /Historical changelog/u);
rejectsRelease("src/config/project_version.js", newTexts.get("src/config/project_version.js").replace("Object.freeze({", "Object.seal({"),
  /version statements/u);
rejectsRelease("src/config/project_version.js", oldTexts.get("src/config/project_version.js"), /version/u);
rejectsRelease("src/config/project_version.js", newTexts.get("src/config/project_version.js").replaceAll(",\n", ",\r\n")
  .replace("([\n", "([\r\n"), /line endings/u);
assert.throws(() => StageFourRelease.validateInput({ ...releaseFixture, changelog: ["a", "b", "c", "d"] }), /1-3 lines/u);
assert.throws(() => StageFourRelease.validateInput({ ...releaseFixture, toRelease: "1.0.0" }), /newer/u);
releaseCases += 2;

// Apply accepts an uncommitted Manifest only when it differs from HEAD by the record modules' classification.
const reclassHead = { schemaVersion: 1, modules: [{ currentPath: "src/a.js", architecture: { targetBoundary: "platform" },
  observed: 1 }, { currentPath: "src/b.js", architecture: { targetBoundary: "platform" } }] };
const reclassify = (mutate) => {
  const value = JSON.parse(JSON.stringify(reclassHead));
  mutate(value);
  return StageFourClusterApply.onlyReclassifies(reclassHead, value, { modules: [{ currentPath: "src/a.js" }] });
};
assert.equal(reclassify((value) => { value.modules[0].architecture.targetBoundary = "game-application"; }), true);
assert.equal(reclassify(() => {}), false, "an unchanged Manifest is not a reclassification");
assert.equal(reclassify((value) => { value.modules[1].architecture.targetBoundary = "game-application"; }), false);
assert.equal(reclassify((value) => { value.modules[0].architecture.targetBoundary = "game-application";
  value.modules[0].observed = 2; }), false, "observations must stay equal");
// Static tracing is opt-in: preserve instance-only evidence and the original static receiver/throws.
const traceDirectory = fs.mkdtempSync(path.join(fs.realpathSync(require("node:os").tmpdir()), "cyber-static-trace-"));
try {
  const output = path.join(traceDirectory, "trace.json");
  const scenario = 'const vm = require("node:vm"), assert = require("node:assert/strict");' +
    'const context = vm.createContext({assert}); vm.runInContext(' + JSON.stringify(
      'class StaticApiProbe { static #value = 7; static assert(value) { if (value < 0) throw new RangeError("negative"); return this.#value + value; } ' +
      'static get value() { return this.#value; } ping(value) { return value; } } globalThis.StaticApiProbe = StaticApiProbe;') +
    ', context); vm.runInContext(' + JSON.stringify(
      'assert.equal(StaticApiProbe.assert(2), 9); assert.throws(() => StaticApiProbe.assert(-1), /negative/); ' +
      'assert.equal(StaticApiProbe.value, 7); assert.equal(new StaticApiProbe().ping(3), 3);') + ', context);';
  const trace = (staticMethods, script = scenario) => {
    const result = require("node:child_process").spawnSync(process.execPath,
      ["--require", path.join(ROOT, "utils/architecture/stage_four/class_trace_probe.js"), "-e", script], {
        encoding: "utf8", env: {...process.env, CYBER_CLASS_TRACE_OUTPUT: output,
          CYBER_CLASS_TRACE_CLASSES: '["StaticApiProbe"]', CYBER_CLASS_TRACE_STATIC_METHODS: staticMethods ? "1" : "0"}});
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(fs.readFileSync(output, "utf8")).StaticApiProbe;
  };
  assert.deepEqual(Object.keys(trace(false).methods), ["ping"]);
  const enabled = trace(true);
  assert.deepEqual(Object.fromEntries(Object.entries(enabled.methods).map(([name, item]) => [name, item.calls])),
    {ping:1, "static assert":2, "static get value":1});
  assert.deepEqual(trace(true), enabled, "static traces must be deterministic");
  assert.notEqual(trace(true, scenario.replaceAll("negative", "invalid")).sha256, enabled.sha256, "throws affect the fingerprint");
} finally {
  fs.rmSync(traceDirectory, {recursive:true, force:true});
}
// Tier evidence: free identifiers and typeof lookups may only lose imported symbols.
const lookup = (name) => ({ name, member: "m" });
const imports = new Set(["A"]);
assert.equal(StageFourTierAEvidence.onlyLosesImports([lookup("A"), lookup("B")], [lookup("B")], imports), true);
assert.equal(StageFourTierAEvidence.onlyLosesImports([lookup("B")], [], imports), false, "lost a non-imported lookup");
assert.equal(StageFourTierAEvidence.onlyLosesImports([], [lookup("A")], imports), false, "gained a lookup");

// Closure uses the existing ledger gate: complete original scope and exact retirement metadata, no new check.
const validateClosure = (closure, baseline, entries, preparationRecords, liveBridges, runtime) => {
  assert(closure.schemaVersion === 1 && closure.kind === "cyber-fishing-stage-4-closure" && closure.status === "closed",
    "Stage 4 closure identity");
  assert.deepEqual(closure.modules.map(item=>item.source).sort(), baseline.slice().sort(), "Stage 4 closure scope");
  for (const item of closure.modules) {
    const current = entries.get(item.source)?.architecture;
    assert(current && current.targetPath === item.target, "Stage 4 closure target");
    if (item.status === "migrated") {
      assert((current.roles.includes("compatibility-bridge") || current.migrationStatus === "verified") &&
        entries.get(item.target)?.architecture.migrationStatus === "verified", "Stage 4 closure ESM target");
    } else {
      assert(item.status === "deferred" && /^stage-[5-7]$/u.test(item.stage) && item.reason,
        "Stage 4 closure deferred reason");
      assert(preparationRecords.some(record=>`architecture/migration/stage_4/preparations/${record.id}_${record.slug}.json` ===
        item.preparation && record.reclassified?.some(review=>
        review.currentPath === item.source && review.followUpStage === item.stage && review.reason === item.reason)),
      "Stage 4 closure deferred review");
    }
  }
  assert(!liveBridges.some(item=>item.removalStage === "stage-4") &&
    !runtime.activationPositions.some(item=>item.removalStage === "stage-4"), "Stage 4 retirement remains");
  const ids = new Set();
  for (const update of closure.retirementUpdates) {
    assert(!ids.has(update.id) && update.id === update.before.id && update.id === update.after.id && update.reason &&
      ["bridge", "activation"].includes(update.kind) && update.before.removalStage === "stage-4" &&
      /^stage-[5-6]$/u.test(update.after.removalStage) && update.after.reason, "Stage 4 retirement identity");
    ids.add(update.id);
    assert.deepEqual(update.after, {...update.before, removalStage:update.after.removalStage, reason:update.after.reason},
      "Stage 4 retirement changed surface");
    const actual = (update.kind === "bridge" ? liveBridges : runtime.activationPositions).find(item=>item.id === update.id);
    if (actual) assert.deepEqual(actual, update.after, "Stage 4 retirement metadata drift");
  }
};
const closureFile = "architecture/migration/stage_4_closure.json";
if (fs.existsSync(path.join(ROOT, closureFile))) {
  const historical = JSON.parse(require("node:child_process").execFileSync("git",
    ["show", "stage3-closed:architecture/migration/module_migration_manifest.json"], {cwd:ROOT,maxBuffer:20e6}));
  const original = historical.modules.filter(item=>["game-application","platform","game-config","game-config-raw"]
    .includes(item.architecture.targetBoundary)).map(item=>item.currentPath);
  const closure = json(closureFile), liveBridges = json("architecture/guards/migration_bridge_registry.json").bridges;
  validateClosure(closure, original, manifest, stageFourPreparations, liveBridges, contract);
  assert(!stageFourLedger.records.some(record=>!record.output && !record.deferred), "Stage 4 pending cluster");
  assert(releases.some(record=>record.output && record.toRelease === closure.release), "Stage 4 closure release");
  for (const changed of [{modules:closure.modules.slice(1)},
    {modules:closure.modules.map(item=>item.status === "deferred" ? {...item,reason:"unreviewed"} : item)},
    {retirementUpdates:closure.retirementUpdates.map((item,index)=>index ? item : {...item,after:{...item.after,owner:"wrong"}})}])
    assert.throws(()=>validateClosure({...closure,...changed},original,manifest,stageFourPreparations,liveBridges,contract),
      /Stage 4 closure scope|Stage 4 closure deferred review|Stage 4 retirement changed surface/u);
  assert.throws(()=>validateClosure(closure,original,manifest,stageFourPreparations,
    [...liveBridges,{removalStage:"stage-4"}],contract), /Stage 4 retirement remains/u);
}

console.log(`Stage 4 cluster records passed: ${ledger.records.length} record(s), ${ledger.applied.length} applied, ` +
  `${targets} ESM target(s) inside their boundaries; 16 projector, 15 retirement, 2 preparation relocation, 4 reclassification, 3 evidence, 4 static-trace and ${releaseCases} release fixtures, ${stageCases} stage-identity cases; ` +
  `${releases.length} release record(s), version ${StageFourRelease.currentVersion(read)}.`);
