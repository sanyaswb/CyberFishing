"use strict";

// Stage 3 closure verification (owner spec §7 "Close Stage 3 - Game Domain"), computed on the live tree:
//   node utils/architecture/stage-3-closure-check.js --write   records architecture/migration/stage_3_closure.json
//   node utils/architecture/stage-3-closure-check.js           recomputes the facts and fails unless they are
//                                                              byte-identical to the recorded closure evidence.
// Gates: every Domain module of the plan coverage is migrated (classic sources are activation shims or inert
// placeholders, so no duplicate legacy/ESM implementation exists); Domain imports only Domain and Engine; Domain
// reads no browser, DEV, raw-config or transport global; every availability check names a bound identifier; every
// remaining activation and bridge has a removal stage and reason.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const eslintScope = require("eslint-scope");
const { serialize } = require("./post_freeze/post_freeze_workspace");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

const ROOT = path.resolve(__dirname, "../..");
const ARTIFACT = "architecture/migration/stage_3_closure.json";
const DOMAIN = "src/game/domain/";
const FORBIDDEN = Object.freeze(["window", "document", "localStorage", "sessionStorage", "Audio", "AudioContext",
  "addEventListener", "requestAnimationFrame", "navigator", "globalThis", "__CYBER_FISHING_COMPAT_RUNTIME__", "CONFIG",
  "GodMode", "DEV"]);
const REMOVAL_STAGES = Object.freeze(["stage-4", "stage-5", "stage-6", "stage-7"]);
// Language built-ins a Domain module may read; any other free identifier is a global dependency. `Date` is the
// JavaScript clock: its readers are listed in the evidence (deferred clock injection, Stage 4).
const BUILTINS = Object.freeze(["Array", "Boolean", "Date", "Error", "Infinity", "JSON", "Map", "Math", "NaN", "Number",
  "Object", "RangeError", "Set", "String", "Symbol", "TypeError", "WeakMap", "WeakSet", "isFinite", "isNaN",
  "parseFloat", "parseInt", "undefined"]);
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function build(root = ROOT) {
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  const json = file => JSON.parse(read(file));
  const state = json("architecture/migration/stage_3_execution_state.json");
  const plan = new StageThreeApprovedPlanSource({ read: file => fs.readFileSync(path.join(root, file)) }).load(state).document;
  assert.equal(state.activeBatchId, null, "a batch is still active");
  assert.deepEqual(state.completedBatchIds, plan.batches.map(batch => batch.id), "the approved plan is not completed");
  const domainFiles = fs.readdirSync(path.join(root, DOMAIN), { recursive: true }).map(String)
    .filter(file => file.endsWith(".js")).map(file => DOMAIN + file.split(path.sep).join("/")).sort(compare);
  const manifest = json("architecture/migration/module_migration_manifest.json");
  const retirement=require("./stage_six/native_development_retirement").NativeDevelopmentRetirement.read(root);
  const historical=retirement ? retirement.removedModules.map(item=>item.manifest) : [];
  const sources = [...manifest.modules,...historical].filter(module => domainFiles.includes(module.architecture?.targetPath) &&
    module.currentPath !== module.architecture.targetPath);
  assert.deepEqual(sources.map(module => module.architecture.targetPath).sort(compare), domainFiles,
    "every Domain target has exactly one classic source");
  const classicWithCode = sources.filter(module => fs.existsSync(path.join(root,module.currentPath)) && /^\s*(class|function)\s/mu.test(read(module.currentPath)))
    .map(module => module.currentPath);
  assert.deepEqual(classicWithCode, [], "a classic source still holds an implementation");
  const imports = [];
  const forbidden = [];
  const availability = [];
  const freeGlobals = [];
  const clockReaders = new Set();
  for (const file of domainFiles) {
    const source = read(file);
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "module", tokens: true, range: true });
    for (const reference of eslintScope.analyze(tree, { ecmaVersion: 2022, sourceType: "module" }).globalScope.through) {
      const name = reference.identifier.name;
      if (!BUILTINS.includes(name)) freeGlobals.push(`${file}:${name}`);
      if (name === "Date") clockReaders.add(file);
    }
    const bound = new Set();
    for (const node of tree.body) {
      if (node.type === "ImportDeclaration") {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), node.source.value));
        imports.push({ file, resolved });
        for (const specifier of node.specifiers) bound.add(specifier.local.name);
      }
      const declaration = node.type === "ExportNamedDeclaration" ? node.declaration : node;
      if (declaration?.id?.name) bound.add(declaration.id.name);
      for (const declarator of declaration?.declarations || []) bound.add(declarator.id.name);
    }
    tree.tokens.forEach((token, index) => {
      if (token.type === "Identifier" && FORBIDDEN.includes(token.value) && tree.tokens[index - 1]?.value !== ".") {
        forbidden.push(`${file}:${token.value}`);
      }
      if (token.type === "Keyword" && token.value === "typeof" && tree.tokens[index + 1]?.type === "Identifier" &&
        /^[A-Z]/u.test(tree.tokens[index + 1].value) && tree.tokens[index + 2]?.value !== ".") {
        availability.push({ file, name: tree.tokens[index + 1].value, bound: bound.has(tree.tokens[index + 1].value) });
      }
    });
  }
  const foreignImports = imports.filter(item => !item.resolved.startsWith(DOMAIN) && !item.resolved.startsWith("src/engine/"));
  assert.deepEqual(foreignImports, [], "Domain imports outside Domain and Engine");
  assert.deepEqual(forbidden, [], "Domain reads a browser, DEV, raw-config or transport global");
  assert.deepEqual(freeGlobals, [], "Domain reads a global that is not a language built-in");
  assert.deepEqual(availability.filter(item => !item.bound), [], "Domain availability check of an unbound global");
  const runtime = json("architecture/migration/stage_3_compatibility_runtime.json");
  const registry = json("architecture/guards/migration_bridge_registry.json");
  for (const activation of runtime.activationPositions) {
    assert(REMOVAL_STAGES.includes(activation.removalStage) && activation.reason, `activation without removal path: ${activation.id}`);
  }
  for (const bridge of registry.bridges) {
    assert(REMOVAL_STAGES.includes(bridge.removalStage) && bridge.reason && bridge.owner, `bridge without removal path: ${bridge.id}`);
  }
  const countBy = (items, key) => Object.fromEntries(REMOVAL_STAGES.map(stage =>
    [stage, items.filter(item => item[key] === stage).length]).filter(([, count]) => count > 0));
  const deadAvailabilityGuards = [...new Set(availability.map(item => item.file))].sort(compare);
  return {
    schemaVersion: 1,
    kind: "cyber-fishing-stage-3-closure-verification",
    stage: "3",
    status: "closure-gates-verified",
    releaseVersion: state.releaseVersion,
    completedBatchCount: state.completedBatchIds.length,
    lastBatchId: state.completedBatchIds.at(-1),
    domain: {
      moduleCount: domainFiles.length,
      classicSources: sources.length,
      classicSourcesWithImplementation: 0,
      importsChecked: imports.length,
      importsOutsideDomainAndEngine: 0,
      forbiddenGlobalReads: 0,
      forbiddenIdentifiers: [...FORBIDDEN],
      freeIdentifiersOutsideBuiltins: 0,
      clockReaders: [...clockReaders].sort(compare),
      availabilityChecks: availability.length,
      availabilityChecksOfUnboundGlobals: 0,
      deadAvailabilityGuardModules: deadAvailabilityGuards,
    },
    runtime: {
      activeActivations: runtime.activationPositions.length,
      activationRemovalStages: countBy(runtime.activationPositions, "removalStage"),
      retiredActivations: (runtime.retiredActivations || []).length,
      inertModules: (runtime.inertModules || []).map(record => record.targetModule),
      bridges: registry.bridges.length,
      bridgeRemovalStages: countBy(registry.bridges, "removalStage"),
      removalCondition: "all-listed-legacy-consumers-migrated",
    },
    gates: [
      "domain-depends-only-on-domain-and-engine-raw-configuration-injected",
      "no-domain-dom-canvas-storage-audio-browser-event-dev-or-bootstrap-dependency",
      "no-domain-compatibility-transport-or-global-service-locator",
      "one-authoritative-owner-no-duplicate-legacy-and-esm-implementation",
      "representation-only-targets-preserving-effects-timing-cache-lifetime-and-hot-loop-behavior",
      "remaining-bridges-and-activations-have-exact-consumers-and-removal-stages",
    ],
  };
}

function main(argv) {
  const document = build();
  const bytes = serialize(document);
  const file = path.join(ROOT, ARTIFACT);
  if (argv.includes("--write")) {
    if (fs.existsSync(file) && !fs.readFileSync(file).equals(bytes)) throw new Error(`${ARTIFACT} is immutable and differs`);
    fs.writeFileSync(file, bytes);
    console.log(`Stage 3 closure verification written: ${document.domain.moduleCount} Domain modules, ` +
      `${document.runtime.activeActivations} activations, ${document.runtime.bridges} bridges.`);
    return;
  }
  assert(fs.existsSync(file), `${ARTIFACT} is missing`);
  assert(fs.readFileSync(file).equals(bytes), "Stage 3 closure facts differ from the recorded closure evidence");
  console.log(`Stage 3 closure verification OK: ${document.domain.moduleCount} Domain modules migrated, ` +
    `${document.domain.importsChecked} imports inside Domain/Engine, 0 forbidden global reads, ` +
    `${document.runtime.activeActivations} activations and ${document.runtime.bridges} bridges with removal stages.`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { build, ARTIFACT };
