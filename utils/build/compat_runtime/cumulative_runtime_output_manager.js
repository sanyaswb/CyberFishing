"use strict";

const fs = require("node:fs");
const path = require("node:path");

class CumulativeRuntimeOutputManager {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
    this.distPath = path.resolve(this.projectRoot, "dist");
    this.outputPath = path.resolve(this.distPath, "stage-3-compat-runtime");
    this.previousPath = path.resolve(this.distPath, ".stage-3-compat-runtime-previous");
  }

  cleanupInactiveOutput() {
    this.#recoverPreviousOutput();
    this.#removeExact(this.outputPath, "output");
    this.#removeExact(this.previousPath, "previous");
    this.#cleanupStagingDirectories();
    this.#removeEmptyDist();
  }

  createStagingDirectory() {
    fs.mkdirSync(this.distPath, { recursive: true });
    this.#recoverPreviousOutput();
    this.#cleanupStagingDirectories();
    const stagingPath = fs.mkdtempSync(
      path.join(this.distPath, ".stage-3-compat-runtime-stage-"),
    );
    this.#assertStaging(stagingPath);
    return stagingPath;
  }

  publish(stagingPath) {
    this.#assertStaging(stagingPath);
    this.#assertOutput(this.outputPath);
    this.#assertPrevious(this.previousPath);
    if (fs.existsSync(this.previousPath)) {
      fs.rmSync(this.previousPath, { recursive: true, force: true });
    }
    const hadPrevious = fs.existsSync(this.outputPath);
    if (hadPrevious) fs.renameSync(this.outputPath, this.previousPath);
    try {
      fs.renameSync(stagingPath, this.outputPath);
    } catch (error) {
      if (hadPrevious && fs.existsSync(this.previousPath) && !fs.existsSync(this.outputPath)) {
        fs.renameSync(this.previousPath, this.outputPath);
      }
      throw error;
    }
    if (hadPrevious && fs.existsSync(this.previousPath)) {
      try {
        fs.rmSync(this.previousPath, { recursive: true, force: true });
      } catch {
        // A validated output is already active. Recovery is deterministic next run.
      }
    }
  }

  discard(stagingPath) {
    if (!stagingPath || !fs.existsSync(stagingPath)) return;
    this.#assertStaging(stagingPath);
    fs.rmSync(stagingPath, { recursive: true, force: true });
    this.#removeEmptyDist();
  }

  assertControlledChild(stagingPath, candidate, expectedName) {
    this.#assertStaging(stagingPath);
    const resolved = path.resolve(candidate);
    const expected = path.resolve(stagingPath, expectedName);
    if (
      resolved !== expected ||
      path.dirname(resolved) !== path.resolve(stagingPath) ||
      path.basename(resolved) !== expectedName
    ) {
      throw new Error(`Refusing unsafe cumulative runtime child operation: ${resolved}`);
    }
    return resolved;
  }

  #cleanupStagingDirectories() {
    if (!fs.existsSync(this.distPath)) return;
    for (const entry of fs.readdirSync(this.distPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(".stage-3-compat-runtime-stage-")) {
        continue;
      }
      const stagingPath = path.resolve(this.distPath, entry.name);
      this.#assertStaging(stagingPath);
      fs.rmSync(stagingPath, { recursive: true, force: true });
    }
  }

  #recoverPreviousOutput() {
    if (!fs.existsSync(this.previousPath)) return;
    this.#assertPrevious(this.previousPath);
    if (fs.existsSync(this.outputPath)) {
      fs.rmSync(this.previousPath, { recursive: true, force: true });
      return;
    }
    fs.renameSync(this.previousPath, this.outputPath);
  }

  #removeExact(candidate, kind) {
    if (!fs.existsSync(candidate)) return;
    if (kind === "output") this.#assertOutput(candidate);
    else this.#assertPrevious(candidate);
    fs.rmSync(candidate, { recursive: true, force: true });
  }

  #removeEmptyDist() {
    if (fs.existsSync(this.distPath) && fs.readdirSync(this.distPath).length === 0) {
      fs.rmdirSync(this.distPath);
    }
  }

  #assertOutput(candidate) {
    const resolved = path.resolve(candidate);
    if (
      resolved !== this.outputPath ||
      path.dirname(resolved) !== this.distPath ||
      path.basename(resolved) !== "stage-3-compat-runtime" ||
      resolved === this.projectRoot ||
      resolved === this.distPath
    ) {
      throw new Error(`Refusing unsafe cumulative runtime output operation: ${resolved}`);
    }
  }

  #assertPrevious(candidate) {
    const resolved = path.resolve(candidate);
    if (
      resolved !== this.previousPath ||
      path.dirname(resolved) !== this.distPath ||
      path.basename(resolved) !== ".stage-3-compat-runtime-previous"
    ) {
      throw new Error(`Refusing unsafe cumulative runtime previous operation: ${resolved}`);
    }
  }

  #assertStaging(candidate) {
    const resolved = path.resolve(candidate);
    const basename = path.basename(resolved);
    if (
      path.dirname(resolved) !== this.distPath ||
      !basename.startsWith(".stage-3-compat-runtime-stage-") ||
      basename === ".stage-3-compat-runtime-stage-" ||
      resolved === this.projectRoot ||
      resolved === this.distPath ||
      resolved === this.outputPath
    ) {
      throw new Error(`Refusing unsafe cumulative runtime staging operation: ${resolved}`);
    }
  }
}

module.exports = { CumulativeRuntimeOutputManager };
