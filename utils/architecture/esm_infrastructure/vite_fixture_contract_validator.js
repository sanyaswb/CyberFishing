const fs = require("node:fs");
const path = require("node:path");

class ViteFixtureContractValidator {
  constructor(projectRoot) { this.projectRoot = projectRoot; }

  validate({ contract, packageJson, installedVite }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(contract?.schemaVersion === 1, "Vite fixture contract schemaVersion must equal 1");
    require(contract?.kind === "cyber-fishing-vite-fixture-build-contract", "Vite fixture contract kind is invalid");
    require(contract?.vite?.dependencyType === "exact-dev-dependency", "Vite must use an exact devDependency");
    require(packageJson.devDependencies?.vite === contract?.vite?.version, "package.json must pin the contracted Vite version exactly");
    require(packageJson.dependencies?.vite === undefined, "Vite must not be a production dependency");
    require(installedVite?.version === contract?.vite?.version, "installed Vite version differs from contract");
    require(installedVite?.engines?.node === contract?.vite?.nodeEngines, "Vite Node engine differs from reviewed contract");
    require(contract?.vite?.usage === "synthetic-fixture-build-only", "Vite usage must remain fixture-only");
    require(contract?.fixture?.moduleType === "module", "ESM fixture requires local module semantics");
    require(contract?.viteBuild?.configFile === false, "Vite fixture build must disable config-file discovery");
    require(contract?.viteBuild?.publicDir === false, "Vite fixture build must disable publicDir");
    require(contract?.viteBuild?.output === "operating-system-temporary-directory", "Vite output must use an OS temporary directory");
    require(contract?.viteBuild?.cleanup === "required", "Vite temporary output cleanup is required");
    require(contract?.viteBuild?.repositoryMutation === "forbidden", "Vite build cannot mutate the repository");
    require(this.#sameValues(contract?.forbiddenInputs, ["index.html", "src/", "assets/"]), "forbidden Vite inputs are incomplete");
    require(this.#sameValues(contract?.forbiddenEntrypoints, ["src/entrypoints/game.entry.js", "src/entrypoints/dev.entry.js"]), "forbidden entrypoints are incomplete");
    const localPackagePath = path.resolve(this.projectRoot, contract.fixture.localPackage);
    const entryPath = path.resolve(this.projectRoot, contract.fixture.entry);
    require(fs.existsSync(localPackagePath), "local ESM fixture package.json is missing");
    require(fs.existsSync(entryPath), "ESM fixture entry is missing");
    if (fs.existsSync(localPackagePath)) {
      const localPackage = JSON.parse(fs.readFileSync(localPackagePath, "utf8"));
      require(localPackage.type === "module", "ESM fixture local package must set type=module");
      require(localPackage.private === true, "ESM fixture local package must remain private");
    }
    if (errors.length) throw new Error(`Vite fixture contract is invalid:\n- ${errors.join("\n- ")}`);
  }

  #sameValues(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => actual[index] === value);
  }
}

module.exports = { ViteFixtureContractValidator };
