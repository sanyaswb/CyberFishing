const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  StageThreeCompatibilityTestLoader,
} = require("../runtime/stage_three_compatibility_test_loader");

const DEFAULT_ROOT = path.resolve(__dirname, "../../..");

class SourceRuntime {
  #rootDir;
  #context;
  #compatibilityLoader;

  constructor({ rootDir = DEFAULT_ROOT, globals = {}, moduleStubs = {} } = {}) {
    this.#rootDir = rootDir;
    this.#context = vm.createContext({ console, ...globals });
    const contractPath = path.join(
      this.#rootDir,
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    this.#compatibilityLoader = fs.existsSync(contractPath)
      ? new StageThreeCompatibilityTestLoader({
        projectRoot: this.#rootDir,
        context: this.#context,
        moduleStubs,
      })
      : null;
  }

  get context() {
    return this.#context;
  }

  read(relativePath) {
    const sourcePath = fs.existsSync(path.join(this.#rootDir, relativePath)) ? relativePath :
      this.#compatibilityLoader?.resolveSource(relativePath) || relativePath;
    return fs.readFileSync(path.join(this.#rootDir, sourcePath), "utf8");
  }

  readAuthoredSource(relativePath) {
    const sourcePath = this.#compatibilityLoader?.resolveSource(relativePath) || relativePath;
    return this.read(sourcePath);
  }

  importModule(relativePath) {
    return this.#compatibilityLoader.getExports(relativePath);
  }

  get moduleNamespaces() { return this.#compatibilityLoader.namespaces; }

  load(relativePath, { expose = [] } = {}) {
    if (this.#compatibilityLoader?.hasActivation(relativePath)) {
      this.#compatibilityLoader.load(relativePath, expose);
      return this;
    }
    const exports = expose
      .map((name) => `globalThis.${name} = ${name};`)
      .join("\n");
    return this.run(`${this.read(relativePath)}\n${exports}`, relativePath);
  }

  loadMany(definitions) {
    for (const definition of definitions) {
      if (typeof definition === "string") {
        this.load(definition);
        continue;
      }
      this.load(definition.path, { expose: definition.expose || [] });
    }
    return this;
  }

  expose(bindings) {
    const source = Object.entries(bindings)
      .map(([globalName, expression]) => `globalThis.${globalName} = ${expression};`)
      .join("\n");
    this.run(source, "test-runtime-exports.js");
    return this;
  }

  run(source, filename = "test-runtime.js") {
    return vm.runInContext(source, this.#context, { filename });
  }
}

module.exports = { SourceRuntime };
