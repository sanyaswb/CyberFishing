"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class StageThreeCompatibilityTestLoader {
  #projectRoot;
  #context;
  #contract;
  #activationBySource;
  #runtimeLoaded = false;

  constructor({ projectRoot, context }) {
    this.#projectRoot = path.resolve(projectRoot);
    this.#context = context;
    this.#contract = this.#readJson(
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    this.#activationBySource = new Map();
    for (const activation of this.#contract.activationPositions) {
      if (!this.#activationBySource.has(activation.sourceProvider)) {
        this.#activationBySource.set(activation.sourceProvider, []);
      }
      this.#activationBySource.get(activation.sourceProvider).push(activation);
    }
    for (const activations of this.#activationBySource.values()) {
      activations.sort((left, right) => left.id.localeCompare(right.id));
    }
  }

  hasActivation(relativePath) {
    return this.#activationBySource.has(relativePath);
  }

  loadRuntime() {
    this.#loadRuntime();
  }

  load(relativePath, exposedNames = []) {
    const activations = this.#activationBySource.get(relativePath) || [];
    if (activations.length > 0) this.#loadRuntime();
    const resolvedPaths = activations.length > 0
      ? activations.map((activation) =>
        `${this.#contract.output.directory}${activation.shimFile}`)
      : [relativePath];
    const expose = exposedNames.length > 0
      ? `\nObject.assign(globalThis,{${exposedNames.map((name) =>
        `${name}: typeof ${name} === "undefined" ? undefined : ${name}`).join(",")}});`
      : "";
    resolvedPaths.forEach((resolvedPath, index) => {
      const suffix = index === resolvedPaths.length - 1 ? expose : "";
      vm.runInContext(`${this.#read(resolvedPath)}${suffix}`, this.#context, {
        filename: resolvedPath,
      });
    });
    return resolvedPaths.length === 1 ? resolvedPaths[0] : [...resolvedPaths];
  }

  loadAll(relativePaths) {
    for (const relativePath of relativePaths) this.load(relativePath);
  }

  #loadRuntime() {
    if (this.#runtimeLoaded) return;
    const runtimePath =
      `${this.#contract.output.directory}${this.#contract.output.runtimeFile}`;
    vm.runInContext(this.#read(runtimePath), this.#context, {
      filename: runtimePath,
    });
    this.#runtimeLoaded = true;
  }

  #readJson(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.#projectRoot, relativePath), "utf8");
  }
}

module.exports = { StageThreeCompatibilityTestLoader };
