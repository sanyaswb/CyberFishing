"use strict";

const fs = require("node:fs");
const path = require("node:path");

class StageThreeCandidateOutputManager {
  constructor(projectRoot, batchNumber) {
    this.projectRoot = path.resolve(projectRoot);
    this.distPath = path.resolve(this.projectRoot, "dist");
    this.name = `.stage-3-batch-${batchNumber}-candidate`;
    this.outputPath = path.resolve(this.distPath, this.name);
    this.stagingPrefix = `${this.name}-stage-`;
  }

  cleanupInactiveOutput() {
    this.cleanup();
  }

  createStagingDirectory() {
    this.cleanup();
    fs.mkdirSync(this.distPath, { recursive: true });
    const staging = fs.mkdtempSync(path.join(this.distPath, this.stagingPrefix));
    this.#assertStaging(staging);
    return staging;
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
      throw new Error(`Unsafe Stage 3 candidate child path: ${resolved}`);
    }
    return resolved;
  }

  publish(stagingPath) {
    this.#assertStaging(stagingPath);
    this.#assertOutput(this.outputPath);
    if (fs.existsSync(this.outputPath)) {
      fs.rmSync(this.outputPath, { recursive: true, force: true });
    }
    fs.renameSync(stagingPath, this.outputPath);
  }

  discard(stagingPath) {
    if (!stagingPath || !fs.existsSync(stagingPath)) return;
    this.#assertStaging(stagingPath);
    fs.rmSync(stagingPath, { recursive: true, force: true });
    this.#removeEmptyDist();
  }

  cleanup() {
    if (fs.existsSync(this.outputPath)) {
      this.#assertOutput(this.outputPath);
      fs.rmSync(this.outputPath, { recursive: true, force: true });
    }
    if (fs.existsSync(this.distPath)) {
      for (const entry of fs.readdirSync(this.distPath, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith(this.stagingPrefix)) continue;
        const staging = path.resolve(this.distPath, entry.name);
        this.#assertStaging(staging);
        fs.rmSync(staging, { recursive: true, force: true });
      }
    }
    this.#removeEmptyDist();
  }

  candidatePath(relativeOutputPath) {
    const basename = path.basename(relativeOutputPath);
    const isActivation = relativeOutputPath.includes("/activations/");
    const candidate = isActivation
      ? path.resolve(this.outputPath, "activations", basename)
      : path.resolve(this.outputPath, basename);
    const expectedParent = isActivation
      ? path.resolve(this.outputPath, "activations")
      : this.outputPath;
    if (path.dirname(candidate) !== expectedParent) {
      throw new Error(`Unsafe Stage 3 candidate report path: ${relativeOutputPath}`);
    }
    return candidate;
  }

  #assertOutput(candidate) {
    const resolved = path.resolve(candidate);
    if (
      resolved !== this.outputPath ||
      path.dirname(resolved) !== this.distPath ||
      path.basename(resolved) !== this.name ||
      resolved === this.projectRoot ||
      resolved === this.distPath
    ) {
      throw new Error(`Unsafe Stage 3 candidate output path: ${resolved}`);
    }
  }

  #assertStaging(candidate) {
    const resolved = path.resolve(candidate);
    const basename = path.basename(resolved);
    if (
      path.dirname(resolved) !== this.distPath ||
      !basename.startsWith(this.stagingPrefix) ||
      basename === this.stagingPrefix ||
      resolved === this.outputPath ||
      resolved === this.projectRoot ||
      resolved === this.distPath
    ) {
      throw new Error(`Unsafe Stage 3 candidate staging path: ${resolved}`);
    }
  }

  #removeEmptyDist() {
    if (fs.existsSync(this.distPath) && fs.readdirSync(this.distPath).length === 0) {
      fs.rmdirSync(this.distPath);
    }
  }
}

module.exports = { StageThreeCandidateOutputManager };
