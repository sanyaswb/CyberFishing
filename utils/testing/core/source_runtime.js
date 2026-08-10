const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DEFAULT_ROOT = path.resolve(__dirname, "../../..");

class SourceRuntime {
  #rootDir;
  #context;

  constructor({ rootDir = DEFAULT_ROOT, globals = {} } = {}) {
    this.#rootDir = rootDir;
    this.#context = vm.createContext({ console, ...globals });
  }

  get context() {
    return this.#context;
  }

  read(relativePath) {
    return fs.readFileSync(path.join(this.#rootDir, relativePath), "utf8");
  }

  load(relativePath, { expose = [] } = {}) {
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
