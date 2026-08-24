class PackageContractValidator {
  validate(contract, expectedStage) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(contract?.schemaVersion === 1, "package contract schemaVersion must equal 1");
    require(contract?.kind === "cyber-fishing-root-package-contract", "package contract kind is invalid");
    require(contract?.package?.name === "cyber-fishing", "package name contract must be cyber-fishing");
    require(contract?.package?.private === true, "root package must remain private");
    require(contract?.package?.versionSource === "src/config/project_version.js", "versionSource must remain project_version.js");
    require(contract?.package?.moduleTypePolicy === "root-type-field-absent-commonjs-tooling-preserved", "root module type policy must preserve CommonJS tooling");
    require(typeof contract?.runtime?.node === "string" && contract.runtime.node.length > 0, "Node range is required");
    require(typeof contract?.runtime?.npm === "string" && contract.runtime.npm.length > 0, "npm range is required");
    require(/^npm@\d+\.\d+\.\d+$/.test(contract?.runtime?.packageManager || ""), "packageManager must pin an exact npm version");
    require(contract?.lockfile?.path === "package-lock.json", "npm lockfile path must be package-lock.json");
    require(contract?.lockfile?.lockfileVersion === 3, "npm lockfileVersion must equal 3");
    require(contract?.lockfile?.installCommand === "npm ci", "reproducible install command must be npm ci");
    require(contract?.lockfile?.requiresIntegrity === true, "lockfile integrity hashes are required");
    require(contract?.lockfile?.gitPolicy === "required-not-ignored", "lockfile must not be ignored");
    require(this.#sameValues(contract?.dependencyPolicy?.directSections, ["dependencies", "devDependencies"]), "direct dependency sections are incomplete");
    require(
      contract?.stage?.current === expectedStage?.current,
      `package contract must record Stage ${expectedStage?.current}`,
    );
    require(contract?.stage?.vite === "fixture-bridge-and-cumulative-runtime-infrastructure", "Vite usage must be limited to fixtures and approved compatibility infrastructure");
    require(contract?.stage?.productionEntrypoint === "unchanged-index-html", "production entrypoint must remain index.html");
    require(contract?.stage?.sourceRuntime === "classic-scripts-with-cumulative-iife-runtime", "classic source runtime must identify the cumulative IIFE runtime");
    require(contract?.stage?.commonJsTooling === "preserved", "CommonJS tooling must remain preserved");
    require(contract?.stage?.bridgeBuild?.status === "transitioned-to-cumulative-runtime", "isolated legacy bridge runtime must be transitioned");
    require(contract?.stage?.bridgeBuild?.registry === "architecture/guards/migration_bridge_registry.json", "legacy bridge registry path is invalid");
    require(contract?.stage?.bridgeBuild?.inputs === "stage-2-bridges-exposed-through-stage-3-cumulative-runtime", "legacy bridge transition inputs are invalid");
    require(contract?.stage?.bridgeBuild?.output === "dist/legacy-bridges/", "legacy bridge output path is invalid");
    require(contract?.stage?.bridgeBuild?.runtimeInputs === 0, "isolated bridge runtime must have zero active inputs");
    require(contract?.stage?.cumulativeRuntimeBuild?.status === "runtime-integration-active", "cumulative runtime integration must be active");
    require(contract?.stage?.cumulativeRuntimeBuild?.contract === "architecture/migration/stage_3_compatibility_runtime.json", "cumulative runtime contract path is invalid");
    require(contract?.stage?.cumulativeRuntimeBuild?.executionState === "architecture/migration/stage_3_execution_state.json", "Stage 3 execution state path is invalid");
    require(contract?.stage?.cumulativeRuntimeBuild?.output === "dist/stage-3-compat-runtime/", "cumulative runtime output path is invalid");
    require(
      contract?.stage?.cumulativeRuntimeBuild?.runtimeInputs === expectedStage?.runtimeInputs,
      "package contract cumulative runtime input count differs from selected Stage 3 batches",
    );
    require(
      contract?.stage?.cumulativeRuntimeBuild?.activationInputs === expectedStage?.activationInputs,
      "package contract activation input count differs from selected Stage 3 batches",
    );
    if (errors.length) throw new Error(`Package contract is invalid:\n- ${errors.join("\n- ")}`);
  }

  #sameValues(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => actual[index] === value);
  }
}

module.exports = { PackageContractValidator };
