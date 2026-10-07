const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ViteFixtureContractValidator } = require("./esm_infrastructure/vite_fixture_contract_validator");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

const { NativeDevelopmentRetirement } = require("./stage_six/native_development_retirement");
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CONTRACT_PATH = path.join(PROJECT_ROOT, "architecture/build/vite_fixture_contract.json");
const FIXTURE_ROOT = path.join(__dirname, "esm-fixtures");

class ViteFixtureBuildCheck {
  async run() {
    const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));
    const packageJson = require(path.join(PROJECT_ROOT, "package.json"));
    const installedVite = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "node_modules/vite/package.json"), "utf8"));
    new ViteFixtureContractValidator(PROJECT_ROOT).validate({ contract, packageJson, installedVite });
    this.#runContractFixtures(contract, packageJson, installedVite);
    const entryPath = path.resolve(PROJECT_ROOT, contract.fixture.entry);
    const indexPath = path.join(PROJECT_ROOT, "index.html");
    const indexBefore = fs.readFileSync(indexPath, "utf8");
    const policy = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "architecture/module_architecture.json"), "utf8"));
    const legacyPath = LegacyScriptOrderReader.sourcePath(PROJECT_ROOT, policy);
    const legacyBefore = fs.readFileSync(legacyPath, "utf8");
    const runtime = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "architecture/migration/stage_3_compatibility_runtime.json"), "utf8"));
    const runtimePath = runtime.output.directory + runtime.output.runtimeFile;
    const nativeDevelopment=NativeDevelopmentRetirement.read(PROJECT_ROOT)!==null;
    const topologyValidator = new ViteFixtureContractValidator(PROJECT_ROOT);
    topologyValidator.validateRuntimeTopology({ nativeDevelopment, legacySource: policy.migrationManifest.legacyLoadOrder.source,
      indexHtml: indexBefore, legacyHtml: legacyBefore, version: packageJson.version, runtimePath,
      gameEntrypointExists: fs.existsSync(path.join(PROJECT_ROOT, "src/entrypoints/game.entry.js")),
      devEntrypointExists: fs.existsSync(path.join(PROJECT_ROOT, "src/entrypoints/dev.entry.js")) });
    this.#runRuntimeFixtures(topologyValidator, runtimePath);
    const nativeGraph = policy.migrationManifest.legacyLoadOrder.source === "dev.html"
      ? topologyValidator.validateProductionGraph({ manifest: JSON.parse(fs.readFileSync(
        path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"), "utf8")) }) : [];
    if(nativeDevelopment) topologyValidator.validateDevelopmentGraph({manifest:JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT,"architecture/migration/module_migration_manifest.json"),"utf8"))});
    const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logicalScripts = new LegacyScriptOrderReader(legacyPath, { scriptAliases }).read();
    assert.equal(LegacyScriptOrderReader.logicalSlotCount(logicalScripts) + require("./stage_four/cluster_ledger").StageFourClusterLedger.cleanupRecords(PROJECT_ROOT).flatMap(record => record.removedLegacySlots).length, 424, "Vite fixture infrastructure must preserve the 424-position logical legacy runtime");
    assert.equal(logicalScripts.filter((script) => script.type === "module").length, nativeDevelopment ? 1 : 0, "Vite fixture infrastructure must not activate module scripts");
    if (nativeGraph.length === 0) for (const forbidden of contract.forbiddenEntrypoints)
      assert(!fs.existsSync(path.resolve(PROJECT_ROOT, forbidden)), `Classic runtime cannot create ${forbidden}`);
    const repositorySnapshot = new RepositoryContentSnapshot(PROJECT_ROOT);
    const before = repositorySnapshot.capture();
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-vite-fixture-"));
    try {
      const outputDirectory = path.join(temporaryRoot, "output");
      const { build } = await import("vite");
      const buildResult = await build({
        configFile: false,
        root: FIXTURE_ROOT,
        publicDir: false,
        logLevel: "silent",
        build: {
          outDir: outputDirectory,
          emptyOutDir: true,
          minify: false,
          sourcemap: false,
          lib: { entry: entryPath, formats: ["es"], fileName: () => "fixture-entry.js" },
          rollupOptions: { output: { chunkFileNames: "chunks/[name]-[hash].js" } },
        },
      });
      const outputs = Array.isArray(buildResult) ? buildResult : [buildResult];
      const chunks = outputs.flatMap((result) => result.output || []).filter((item) => item.type === "chunk");
      assert(chunks.length > 0, "Vite fixture build produced no JavaScript chunks");
      const concreteModules = new Set();
      for (const chunk of chunks) for (const modulePath of Object.keys(chunk.modules || {})) {
        if (modulePath.startsWith("\u0000")) continue;
        const absolute = path.resolve(modulePath);
        const relativeToFixture = path.relative(FIXTURE_ROOT, absolute);
        assert(!relativeToFixture.startsWith("..") && !path.isAbsolute(relativeToFixture), `Vite graph escaped fixture boundary: ${modulePath}`);
        concreteModules.add(absolute);
      }
      assert(concreteModules.has(entryPath), "Vite graph does not contain the synthetic fixture entry");
      assert(fs.existsSync(path.join(outputDirectory, "fixture-entry.js")), "Vite fixture output is missing");
      assert(![...concreteModules].some((modulePath) => modulePath === indexPath || modulePath.startsWith(path.join(PROJECT_ROOT, "src") + path.sep) || modulePath.startsWith(path.join(PROJECT_ROOT, "assets") + path.sep)), "Vite fixture graph contains game runtime/assets");
    } finally {
      this.#removeVerifiedTemporaryRoot(temporaryRoot);
    }
    repositorySnapshot.assertEqual(before, repositorySnapshot.capture());
    assert.equal(fs.readFileSync(indexPath, "utf8"), indexBefore, "Vite fixture build changed index.html");
    assert.equal(fs.readFileSync(legacyPath, "utf8"), legacyBefore, "Vite fixture build changed the selected legacy document");
    console.log(`Vite fixture build passed: exact Vite 8.2.1, synthetic ESM graph only, temporary output cleaned, 424 preserved historical positions (including exact recorded removals) and game runtime/assets untouched; 4 contract + 20 runtime topology/graph fixtures; ${nativeGraph.length} native production modules.`);
  }

  #runRuntimeFixtures(validator, runtimePath) {
    const tag = source => '<script src="' + source + '"></script>';
    const valid = { legacySource: "dev.html", version: "1.0.0", runtimePath,
      indexHtml: '<script type="module" src="src/entrypoints/game.entry.js?v=1.0.0"></script>',
      legacyHtml: tag(runtimePath) + tag("src/a.js"), gameEntrypointExists: true, devEntrypointExists: false };
    validator.validateRuntimeTopology(valid);
    for (const delta of [
      { indexHtml: valid.indexHtml + tag("src/a.js") }, { indexHtml: valid.indexHtml.repeat(2) },
      { indexHtml: valid.indexHtml.replace('</script>', 'run()</script>') },
      { indexHtml: valid.indexHtml.replace('type="module"', '') }, { indexHtml: valid.indexHtml.replace("1.0.0", "9.9.9") },
      { gameEntrypointExists: false }, { devEntrypointExists: true },
      { legacyHtml: tag("src/a.js") }, { legacyHtml: valid.legacyHtml + tag(runtimePath) },
      { legacyHtml: valid.legacyHtml + valid.indexHtml },
    ]) assert.throws(() => validator.validateRuntimeTopology({ ...valid, ...delta }), /Runtime entrypoint topology/u);
    const temporaryRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-native-graph-"));
    try {
      const files = [["src/entrypoints/game.entry.js", "entrypoint-game"],
        ["src/bootstrap/production/main.js", "bootstrap-production"], ["src/engine/leaf.js", "engine"],
        ["src/bootstrap/development/dev.js", "bootstrap-development"], ["src/engine/compat/bridge.js", "engine"]];
      const manifest = { modules: files.map(([currentPath, targetBoundary]) => ({ currentPath,
        architecture: { targetBoundary, migrationStatus: "verified", roles: currentPath.includes("/compat/") ? ["compatibility-bridge"] : [] } })) };
      const write = (file, text) => { const absolute = path.join(temporaryRoot, file); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, text); };
      for (const [file] of files) write(file, 'export class A {}');
      const entry = 'import { start } from "../bootstrap/production/main.js"; start();';
      const bootstrap = 'import { A } from "../../engine/leaf.js"; export function start() { return new A(); }';
      write(files[0][0], entry); write(files[1][0], bootstrap);
      const graphValidator = new ViteFixtureContractValidator(temporaryRoot);
      assert.equal(graphValidator.validateProductionGraph({ manifest }).length, 3);
      for (const source of [
        'import "../development/dev.js"; export function start() {}',
        'export { A } from "../development/dev.js";',
        'import "../../engine/compat/bridge.js"; export function start() {}',
        'export function start() { return import("../development/dev.js"); }',
        'export function start(path) { return import(path); }',
        'import "unreviewed-package"; export function start() {}',
        'import "./missing.js"; export function start() {}',
        'import "../../engine/leaf"; export function start() {}',
        'export function start() { return globalThis["__CYBER_FISHING_COMPAT_RUNTIME__"]; }',
        'export function start() { return globalThis.GodMode; }',
      ]) {
        write(files[1][0], source);
        assert.throws(() => graphValidator.validateProductionGraph({ manifest }), /Native production graph/u);
      }
    } finally {
      assert.equal(path.dirname(temporaryRoot), fs.realpathSync(os.tmpdir()));
      assert(path.basename(temporaryRoot).startsWith("cyber-native-graph-"));
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }

  #runContractFixtures(contract, packageJson, installedVite) {
    const validator = new ViteFixtureContractValidator(PROJECT_ROOT);
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const wrongVersion = clone(contract); wrongVersion.vite.version = "0.0.0";
    assert.throws(() => validator.validate({ contract: wrongVersion, packageJson, installedVite }), /Vite version/u);
    const productionDependency = clone(packageJson); productionDependency.dependencies.vite = contract.vite.version;
    assert.throws(() => validator.validate({ contract, packageJson: productionDependency, installedVite }), /production dependency/u);
    const discoveredConfig = clone(contract); discoveredConfig.viteBuild.configFile = true;
    assert.throws(() => validator.validate({ contract: discoveredConfig, packageJson, installedVite }), /config-file discovery/u);
    const missingForbiddenInput = clone(contract); missingForbiddenInput.forbiddenInputs = ["index.html", "src/"];
    assert.throws(() => validator.validate({ contract: missingForbiddenInput, packageJson, installedVite }), /forbidden Vite inputs/u);
  }

  #removeVerifiedTemporaryRoot(temporaryRoot) {
    const resolved = path.resolve(temporaryRoot);
    const allowedParent = path.resolve(os.tmpdir());
    if (path.dirname(resolved) !== allowedParent || !path.basename(resolved).startsWith("cyber-fishing-vite-fixture-")) throw new Error(`Refusing to remove unverified Vite output: ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

new ViteFixtureBuildCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
