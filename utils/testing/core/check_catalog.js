const fs = require("node:fs");
const path = require("node:path");

class CheckDefinition {
  constructor({ id, title, file, suites = [] }) {
    this.id = String(id || "").trim();
    this.title = String(title || "").trim();
    this.file = String(file || "").trim();
    this.suites = Object.freeze([...new Set(suites)]);
    Object.freeze(this);
  }
}

class CheckCatalog {
  #checks;
  #checksById;

  constructor(definitions) {
    this.#checks = Object.freeze(
      definitions.map((definition) => new CheckDefinition(definition)),
    );
    this.#checksById = new Map(this.#checks.map((check) => [check.id, check]));
    this.#validate();
  }

  list() {
    return this.#checks;
  }

  listSuites() {
    return [...new Set(this.#checks.flatMap((check) => check.suites))].sort();
  }

  findById(id) {
    const check = this.#checksById.get(id);
    if (!check) throw new Error(`Unknown check: ${id}`);
    return check;
  }

  findBySuite(suite) {
    const checks = suite === "all"
      ? this.#checks
      : this.#checks.filter((check) => check.suites.includes(suite));
    if (checks.length === 0) throw new Error(`Unknown or empty check suite: ${suite}`);
    return checks;
  }

  #validate() {
    const seen = new Set();
    for (const check of this.#checks) {
      if (!check.id || !check.title || !check.file) {
        throw new Error("Every check requires id, title and file");
      }
      if (seen.has(check.id)) throw new Error(`Duplicate check id: ${check.id}`);
      seen.add(check.id);
    }
  }
}

class CheckCatalogFileValidator {
  constructor({ projectRoot, checksDirectory = "utils" }) {
    this.projectRoot = projectRoot;
    this.checksDirectory = checksDirectory;
  }

  assertValid(catalog) {
    const registeredFiles = new Set(
      catalog.list().map((check) => path.normalize(check.file)),
    );
    for (const file of registeredFiles) {
      if (!fs.existsSync(path.join(this.projectRoot, file))) {
        throw new Error(`Registered check file does not exist: ${file}`);
      }
    }

    const absoluteChecksDirectory = path.join(
      this.projectRoot,
      this.checksDirectory,
    );
    for (const entry of fs.readdirSync(absoluteChecksDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !entry.name.endsWith("-check.js")) continue;
      const relativePath = path.join(this.checksDirectory, entry.name);
      if (!registeredFiles.has(relativePath)) {
        throw new Error(`Check is missing from the manifest: ${relativePath}`);
      }
    }
  }
}

module.exports = {
  CheckCatalog,
  CheckCatalogFileValidator,
  CheckDefinition,
};
