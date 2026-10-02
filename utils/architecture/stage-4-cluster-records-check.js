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
const { StageFourClusterLedger } = require("./stage_four/cluster_ledger");
const { LANGUAGE_BUILTINS, StageFourEsmTargetProjector } = require("./stage_four/esm_target_projector");
const { ActivationShimRenderer } = require("../build/compat_runtime/activation_shim");
const { MigratedSourcePlaceholder } = require("../build/compat_runtime/activation_retirement");

const ROOT = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (file) => JSON.parse(read(file));
const policy = json("architecture/module_architecture.json");
const manifest = new Map(json("architecture/migration/module_migration_manifest.json").modules
  .map((entry) => [entry.currentPath, entry]));
const contract = json("architecture/migration/stage_3_compatibility_runtime.json");
const bridges = new Set(json("architecture/guards/migration_bridge_registry.json").bridges.map((item) => item.id));
const boundaryOf = (file) => policy.targetBoundaries
  .flatMap((boundary) => boundary.pathPrefixes.filter((prefix) => file.startsWith(prefix)).map((prefix) => ({ boundary, prefix })))
  .sort((left, right) => right.prefix.length - left.prefix.length)[0]?.boundary;
const FORBIDDEN = ["window", "globalThis", "self", "document", "localStorage", "sessionStorage", "navigator", "CONFIG",
  "__CYBER_FISHING_COMPAT_RUNTIME__"];

const ledger = StageFourClusterLedger.read(ROOT);
const active = new Map(contract.activationPositions.map((item) => [item.id, item]));
const retiredActivations = new Set((contract.retiredActivations || []).map((item) => item.activation.id));
const inert = new Set((contract.inertModules || []).map((item) => item.targetModule));
const laterRetiredBridges = (index) => new Set(ledger.records.slice(index + 1)
  .flatMap((record) => record.output?.bridgesRetired || []));
let targets = 0;
ledger.records.forEach((record, index) => {
  assert.equal(record.schemaVersion, 1, `${record.file}: schemaVersion`);
  assert(policy.targetBoundaries.some((item) => item.id === record.boundary), `${record.file}: unknown boundary`);
  assert(["A", "B", "C"].includes(record.tier) && record.tierEvidence, `${record.file}: tier and tierEvidence`);
  assert(/^M\d$/u.test(record.milestone), `${record.file}: milestone`);
  if (record.output === null) return;
  assert.equal(record.output.status, "applied", `${record.file}: output status`);
  const boundary = policy.targetBoundaries.find((item) => item.id === record.boundary);
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
        FORBIDDEN.includes(token.value) && tree.tokens[position - 1]?.value !== ".");
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
        targetPath: file, exports: module.exports, stage: "Stage 4" });
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
});

// Negative fixtures: the projector accepts only export tokens plus the import header.
const projector = new StageFourEsmTargetProjector();
const fixture = (source, extra = {}) => projector.project({ source, currentPath: "src/a.js",
  targetPath: "src/game/config/a.js", boundary: "game-config", exports: ["A"], ...extra });
assert.equal(fixture("class A {}\n").targetSource, "export class A {}\n");
assert.throws(() => fixture("class A { run() { return ITEM_DB; } }\n"), /reads classic or browser globals: ITEM_DB/u);
assert.throws(() => fixture("class A { run() { return typeof window; } }\n"), /window/u);
assert.throws(() => fixture("class A {}\nglobalThis.A = A;\n"), /top-level ExpressionStatement/u);
assert.throws(() => fixture("const A = 1, B = 2;\n"), /exactly one top-level declaration/u);
assert.equal(fixture("class A { b() { return new B(); } }\n", { imports: [{ symbol: "B", from: "src/game/config/b/b.js" }] })
  .targetSource, "import { B } from \"./b/b.js\";\n\nexport class A { b() { return new B(); } }\n");

console.log(`Stage 4 cluster records passed: ${ledger.records.length} record(s), ${ledger.applied.length} applied, ` +
  `${targets} ESM target(s) inside their boundaries; 6 projector fixtures.`);
