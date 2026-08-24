const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ViteFixtureContractValidator } = require("./esm_infrastructure/vite_fixture_contract_validator");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

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
    const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logicalScripts = new LegacyScriptOrderReader(indexPath, { scriptAliases }).read();
    assert.equal(logicalScripts.length, 424, "Vite fixture infrastructure must preserve the 424-position logical legacy runtime");
    assert.equal(logicalScripts.filter((script) => script.type === "module").length, 0, "Vite fixture infrastructure must not activate module scripts");
    for (const forbidden of contract.forbiddenEntrypoints) assert(!fs.existsSync(path.resolve(PROJECT_ROOT, forbidden)), `Stage 1.8.2 cannot create ${forbidden}`);
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
    console.log("Vite fixture build passed: exact Vite 8.2.1, synthetic ESM graph only, temporary output cleaned, 424 logical classic positions and game runtime/assets untouched; 4 contract fixtures.");
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
