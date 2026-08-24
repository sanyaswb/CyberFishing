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
    this.#activationBySource = new Map(
      this.#contract.activationPositions.map((activation) => [
        activation.sourceProvider,
        `${this.#contract.output.directory}${activation.shimFile}`,
      ]),
    );
  }

  load(relativePath, exposedNames = []) {
    this.#loadRuntime();
    const resolvedPath = this.#activationBySource.get(relativePath) || relativePath;
    const source = this.#read(resolvedPath);
    const expose = exposedNames.length > 0
      ? `\nObject.assign(globalThis,{${exposedNames.map((name) =>
        `${name}: typeof ${name} === "undefined" ? undefined : ${name}`).join(",")}});`
      : "";
    vm.runInContext(`${source}${expose}`, this.#context, {
      filename: resolvedPath,
    });
    return resolvedPath;
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
