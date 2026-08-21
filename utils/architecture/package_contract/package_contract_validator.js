class PackageContractValidator {
  validate(contract) {
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
    require(contract?.stage?.current === "2.0", "package contract must record Stage 2.0");
    require(contract?.stage?.vite === "fixture-and-approved-bridge-build-infrastructure", "Vite usage must be limited to fixtures and approved bridge infrastructure");
    require(contract?.stage?.productionEntrypoint === "unchanged-index-html", "production entrypoint must remain index.html");
    require(contract?.stage?.sourceRuntime === "classic-scripts-unchanged", "classic source runtime must remain unchanged");
    require(contract?.stage?.commonJsTooling === "preserved", "CommonJS tooling must remain preserved");
    require(contract?.stage?.bridgeBuild?.status === "foundation-verified", "legacy bridge build foundation must be verified");
    require(contract?.stage?.bridgeBuild?.registry === "architecture/guards/migration_bridge_registry.json", "legacy bridge registry path is invalid");
    require(contract?.stage?.bridgeBuild?.inputs === "approved-active-wrappers-only", "legacy bridge inputs must be exact approved wrappers");
    require(contract?.stage?.bridgeBuild?.output === "dist/legacy-bridges/", "legacy bridge output path is invalid");
    require(contract?.stage?.bridgeBuild?.runtimeInputs === 0, "Stage 2.0 must have zero active runtime bridge inputs");
    if (errors.length) throw new Error(`Package contract is invalid:\n- ${errors.join("\n- ")}`);
  }

  #sameValues(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => actual[index] === value);
  }
}

module.exports = { PackageContractValidator };
