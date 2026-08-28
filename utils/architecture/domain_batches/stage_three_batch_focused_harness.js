"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const espree = require("espree");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("../../build/compat_runtime/activation_shim");

class DomainBehaviorParityHarness {
  run({ exportName, classicClass, esmClass, cases }) {
    const results = [];
    for (const [caseName, execute] of Object.entries(cases)) {
      const classic = this.#normalize(execute(classicClass));
      const esm = this.#normalize(execute(esmClass));
      assert.deepEqual(esm, classic, `${exportName}/${caseName} ESM parity differs`);
      results.push(Object.freeze({ exportName, caseName, outcome: "equivalent" }));
    }
    return Object.freeze(results);
  }

  #normalize(value) {
    if (typeof value === "number") {
      if (Number.isNaN(value)) return "__NaN__";
      if (value === Infinity) return "__Infinity__";
      if (value === -Infinity) return "__-Infinity__";
      if (Object.is(value, -0)) return "__-0__";
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => this.#normalize(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, this.#normalize(value[key])]));
    }
    return value;
  }
}

class TemporaryEsmModuleFixtureBoundary {
  #root = null;

  async load(modules) {
    this.#root = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-stage-3-batch-007-esm-"));
    fs.writeFileSync(path.join(this.#root, "package.json"), '{"type":"module"}\n', "utf8");
    const loaded = new Map();
    for (const module of modules) {
      const persisted = module.absoluteTargetPath && fs.existsSync(module.absoluteTargetPath);
      const candidateSource = persisted
        ? fs.readFileSync(module.absoluteTargetPath, "utf8")
        : this.#asNamedEsm(fs.readFileSync(module.absoluteCurrentPath, "utf8"), module.exportName);
      const classicSource = persisted
        ? this.#asClassic(candidateSource, module.exportName)
        : fs.readFileSync(module.absoluteCurrentPath, "utf8");
      const outputPath = path.join(this.#root, path.basename(module.targetPath));
      fs.writeFileSync(outputPath, candidateSource, "utf8");
      const url = pathToFileURL(outputPath).href;
      const first = await import(url);
      const second = await import(url);
      assert.equal(first, second, `${module.exportName} module namespace was evaluated more than once`);
      assert.equal(first[module.exportName], second[module.exportName], `${module.exportName} class identity differs`);
      loaded.set(module.exportName, Object.freeze({
        namespace: first,
        candidateSource,
        classicSource,
        url,
      }));
    }
    return loaded;
  }

  cleanup() {
    if (!this.#root) return;
    const resolved = path.resolve(this.#root);
    const expectedParent = path.resolve(os.tmpdir());
    if (path.dirname(resolved) !== expectedParent ||
        !path.basename(resolved).startsWith("cyber-fishing-stage-3-batch-007-esm-")) {
      throw new Error(`Refusing to remove unverified ESM fixture directory: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
    this.#root = null;
  }

  #asNamedEsm(source, exportName) {
    const pattern = new RegExp(`(^|\\n)(class\\s+${exportName}\\b)`, "u");
    const matches = [...source.matchAll(new RegExp(pattern.source, "gu"))];
    if (matches.length !== 1) {
      throw new Error(`Expected one classic declaration for temporary ESM export: ${exportName}`);
    }
    return source.replace(pattern, "$1export $2");
  }

  #asClassic(source, exportName) {
    const marker = `export class ${exportName}`;
    if (source.split(marker).length - 1 !== 1) {
      throw new Error(`Expected one persisted named ESM export: ${exportName}`);
    }
    return source.replace(marker, `class ${exportName}`);
  }
}

class RepresentationEquivalenceGuard {
  validate({ classicSource, candidateSource, exportName, transportSymbol }) {
    const classicTree = this.#parse(classicSource, "script");
    const moduleTree = this.#parse(candidateSource, "module");
    moduleTree.body = moduleTree.body.flatMap((node) => {
      if (node.type !== "ExportNamedDeclaration") return [node];
      assert(node.declaration, `${exportName} must use a declaration export`);
      assert.deepEqual(node.specifiers, []);
      assert.equal(node.source, null);
      return [node.declaration];
    });
    // Parsing context is the intended representation delta; compare executable
    // structure only after the named export wrapper has been removed.
    moduleTree.sourceType = classicTree.sourceType;
    assert.deepEqual(this.#withoutLocations(moduleTree), this.#withoutLocations(classicTree),
      `${exportName} changed beyond ExportNamedDeclaration`);
    assert.equal(candidateSource.includes(transportSymbol), false,
      `${exportName} reads the compatibility transport`);
    return Object.freeze({
      exportName,
      equivalent: true,
      transportReads: 0,
    });
  }

  #parse(source, sourceType) {
    return espree.parse(source, { ecmaVersion: "latest", sourceType });
  }

  #withoutLocations(value) {
    if (Array.isArray(value)) return value.map((item) => this.#withoutLocations(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !["start", "end", "loc", "range"].includes(key))
      .map(([key, item]) => [key, this.#withoutLocations(item)]));
  }
}

class ActivationTimingHarness {
  run({ contract, activations, namespacesByTarget }) {
    const renderer = new ActivationShimRenderer();
    const validator = new ActivationShimContractValidator();
    const results = [];
    for (const activation of activations) {
      const namespace = namespacesByTarget.get(activation.targetModule);
      assert(namespace, `Temporary namespace missing: ${activation.targetModule}`);
      const moduleMap = { [activation.targetModule]: namespace };
      const accessedSurface = [];
      const transport = new Proxy({}, {
        get(_target, property) {
          accessedSurface.push(String(property));
          return moduleMap;
        },
      });
      const context = vm.createContext({ [contract.transport.symbol]: transport });
      assert.equal(context[activation.legacySymbol], undefined);
      const code = renderer.render(activation, contract.transport.symbol);
      validator.validate({ code, activation, transportSymbol: contract.transport.symbol });
      new vm.Script(code, { filename: activation.shimFile }).runInContext(context);
      assert.equal(
        context[activation.legacySymbol],
        namespace[activation.exportName],
        `${activation.id} exposed a non-canonical export`,
      );
      assert.equal(accessedSurface.length, 1);
      results.push(Object.freeze({
        activationId: activation.id,
        legacyScriptIndex: activation.legacyScriptIndex,
        transportSurfaceProperty: accessedSurface[0],
        exactExportIdentity: true,
        renderedCode: code,
      }));
    }
    assert.equal(new Set(results.map((record) => record.transportSurfaceProperty)).size, 1,
      "activation renderer used inconsistent transport surfaces");
    return Object.freeze(results);
  }
}

class ClassicClassLoader {
  load(source, exportName, filename) {
    const context = vm.createContext({});
    new vm.Script(`${source}\nglobalThis.__FOCUSED_CLASS__ = ${exportName};`, { filename })
      .runInContext(context);
    return context.__FOCUSED_CLASS__;
  }
}

module.exports = {
  ActivationTimingHarness,
  ClassicClassLoader,
  DomainBehaviorParityHarness,
  RepresentationEquivalenceGuard,
  TemporaryEsmModuleFixtureBoundary,
};
