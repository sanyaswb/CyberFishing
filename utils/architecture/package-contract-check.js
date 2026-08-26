const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PackageContractValidator } = require("./package_contract/package_contract_validator");
const { RootPackageValidator } = require("./package_contract/root_package_validator");
const { PackageLockValidator } = require("./package_contract/package_lock_validator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const paths = {
  packageJson: path.join(PROJECT_ROOT, "package.json"),
  packageLock: path.join(PROJECT_ROOT, "package-lock.json"),
  contract: path.join(PROJECT_ROOT, "architecture/build/package_contract.json"),
  version: path.join(PROJECT_ROOT, "src/config/project_version.js"),
  gitignore: path.join(PROJECT_ROOT, ".gitignore"),
  index: path.join(PROJECT_ROOT, "index.html"),
  stageThreeState: path.join(
    PROJECT_ROOT,
    "architecture/migration/stage_3_execution_state.json",
  ),
  stageThreeRuntime: path.join(
    PROJECT_ROOT,
    "architecture/migration/stage_3_compatibility_runtime.json",
  ),
};

class PackageContractCheck {
  constructor({ contractValidator, packageValidator, lockValidator }) {
    this.contractValidator = contractValidator;
    this.packageValidator = packageValidator;
    this.lockValidator = lockValidator;
  }

  run() {
    const bytes = new Map(Object.entries(paths).map(([name, filePath]) => [name, fs.readFileSync(filePath)]));
    const contract = JSON.parse(bytes.get("contract").toString("utf8"));
    const packageJson = JSON.parse(bytes.get("packageJson").toString("utf8"));
    const packageLock = JSON.parse(bytes.get("packageLock").toString("utf8"));
    const stageThreeState = JSON.parse(
      bytes.get("stageThreeState").toString("utf8"),
    );
    const stageThreeRuntime = JSON.parse(
      bytes.get("stageThreeRuntime").toString("utf8"),
    );
    const selectedBatchCount = stageThreeState.completedBatchIds.length +
      (stageThreeState.activeBatchId &&
        stageThreeState.activeBatchPhase !== "prebuild" ? 1 : 0);
    const expectedStage = {
      current: `3.${selectedBatchCount}`,
      runtimeInputs: new Set(
        stageThreeRuntime.activationPositions.map(
          (activation) => activation.targetModule,
        ),
      ).size,
      activationInputs: stageThreeRuntime.activationPositions.length,
    };
    const projectVersion = this.#readProjectVersion(bytes.get("version").toString("utf8"));
    this.contractValidator.validate(contract, expectedStage);
    this.packageValidator.validate({ packageJson, contract, projectVersion });
    this.lockValidator.validate({ packageJson, packageLock, contract });
    this.#validateCanonicalJson(bytes, contract, packageJson, packageLock);
    this.#validateGitPolicy(bytes.get("gitignore").toString("utf8"), contract);
    this.#runFixtures({
      contract,
      packageJson,
      packageLock,
      projectVersion,
      expectedStage,
    });
    for (const [name, before] of bytes) assert(before.equals(fs.readFileSync(paths[name])), `Package contract check mutated ${name}`);
    const directCount = contract.dependencyPolicy.directSections.reduce((total, section) => total + Object.keys(packageJson[section]).length, 0);
    console.log(`Root package contract passed: ${packageJson.name}@${packageJson.version}, ${directCount} direct dependencies, ${Object.keys(packageLock.packages).length - 1} locked packages, npm lockfile v${packageLock.lockfileVersion}; 9 fixtures; read-only.`);
  }

  #readProjectVersion(source) {
    const match = source.match(/CURRENT_PROJECT_VERSION\s*=\s*["']([^"']+)["']/u);
    if (!match) throw new Error("CURRENT_PROJECT_VERSION was not found");
    return match[1];
  }

  #validateCanonicalJson(bytes, contract, packageJson, packageLock) {
    const normalize = (value) => value.toString("utf8").replaceAll("\r\n", "\n");
    assert.equal(normalize(bytes.get("contract")), `${JSON.stringify(contract, null, 2)}\n`, "package contract JSON must be canonical");
    assert.equal(normalize(bytes.get("packageJson")), `${JSON.stringify(packageJson, null, 2)}\n`, "package.json must be canonical");
    assert.equal(normalize(bytes.get("packageLock")), `${JSON.stringify(packageLock, null, 2)}\n`, "package-lock.json must be canonical");
  }

  #validateGitPolicy(gitignore, contract) {
    if (contract.lockfile.gitPolicy !== "required-not-ignored") return;
    const ignored = gitignore.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
    assert(!ignored.includes("package-lock.json"), "package-lock.json must not be ignored");
  }

  #runFixtures(actual) {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    assert.throws(() => this.contractValidator.validate(
      { ...clone(actual.contract), schemaVersion: 99 },
      actual.expectedStage,
    ), /schemaVersion/u);
    assert.throws(() => this.contractValidator.validate(
      { ...clone(actual.contract), runtime: { ...actual.contract.runtime, packageManager: "npm@latest" } },
      actual.expectedStage,
    ), /packageManager/u);
    assert.throws(() => this.packageValidator.validate({ ...actual, packageJson: { ...clone(actual.packageJson), name: "stale" } }), /name differs/u);
    assert.throws(() => this.packageValidator.validate({ ...actual, packageJson: { ...clone(actual.packageJson), version: "0.0.0" } }), /version differs/u);
    assert.throws(() => this.packageValidator.validate({ ...actual, packageJson: { ...clone(actual.packageJson), type: "module" } }), /must not set type/u);
    assert.throws(() => this.packageValidator.validate({ ...actual, packageJson: { ...clone(actual.packageJson), dependencies: { ...actual.packageJson.dependencies, vite: "8.2.1" } } }), /production dependency/u);
    const staleRoot = clone(actual.packageLock); staleRoot.packages[""].devDependencies.espree = "^0.0.1";
    assert.throws(() => this.lockValidator.validate({ ...actual, packageLock: staleRoot }), /devDependencies differs/u);
    const missingPackage = clone(actual.packageLock); delete missingPackage.packages["node_modules/espree"];
    assert.throws(() => this.lockValidator.validate({ ...actual, packageLock: missingPackage }), /missing direct package espree/u);
    const missingIntegrity = clone(actual.packageLock); delete missingIntegrity.packages["node_modules/espree"].integrity;
    assert.throws(() => this.lockValidator.validate({ ...actual, packageLock: missingIntegrity }), /requires sha512 integrity/u);
  }
}

new PackageContractCheck({
  contractValidator: new PackageContractValidator(),
  packageValidator: new RootPackageValidator(),
  lockValidator: new PackageLockValidator(),
}).run();
