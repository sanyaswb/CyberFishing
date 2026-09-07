"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeExecutionStateValidator,
} = require("./domain_approved_prefix");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./stage_three_batch_prebuild_contract");
const {
  StageThreeBatchPrebuildProjector,
} = require("./stage_three_batch_prebuild_projector");
const {
  ControlledMetadataTransaction,
} = require("./controlled_metadata_transaction");

class StageThreeBatchPrebuildApplication {
  #failureInjector;
  #paths;
  #profile;
  #projectRoot;
  #readRuntimeFacts;

  constructor({ projectRoot, profile, paths, readRuntimeFacts, failureInjector = null }) {
    if (!profile) throw new Error("Stage 3 prebuild application requires a batch profile");
    if (typeof readRuntimeFacts !== "function") {
      throw new Error("Stage 3 prebuild application requires a runtime-facts reader");
    }
    this.#projectRoot = path.resolve(projectRoot);
    this.#profile = profile;
    this.#paths = Object.freeze({ ...paths });
    this.#readRuntimeFacts = readRuntimeFacts;
    this.#failureInjector = failureInjector;
  }

  run() {
    const projector = new StageThreeBatchPrebuildProjector({
      projectRoot: this.#projectRoot,
      profile: this.#profile,
      paths: this.#paths,
    });
    const projected = projector.build();
    const nextState = Object.freeze({
      ...projected.inputs.executionState.document,
      activeBatchId: this.#profile.batchId,
      activeBatchPhase: "prebuild",
    });
    this.#validateFutureState(projected.artifact, nextState, projected.inputs);
    const protectedBefore = this.#protectedHashes();
    new ControlledMetadataTransaction({
      projectRoot: this.#projectRoot,
      failureInjector: this.#failureInjector,
    }).commit([
      { relativePath: this.#paths.output, bytes: projector.serialize(projected.artifact) },
      { relativePath: this.#paths.executionState, bytes: projector.serialize(nextState) },
    ], () => this.#validatePersisted(projected.artifact, nextState, protectedBefore));
    return Object.freeze({ artifact: projected.artifact, state: nextState });
  }

  #validateFutureState(artifact, state, inputs) {
    new StageThreeBatchPrebuildContractValidator(this.#profile).validate(artifact);
    const approvedBytes = this.#bytes(this.#paths.approvedPlan);
    new StageThreeExecutionStateValidator().validate({
      approvedPlan: JSON.parse(approvedBytes.toString("utf8")),
      approvedPlanSha256: this.#sha256(approvedBytes),
      state,
      runtimeFacts: this.#readRuntimeFacts(),
    });
    assert.equal(inputs.manifest.document.preliminaryMigration, undefined,
      "Manifest must not retain preliminary target metadata");
    assert.equal(inputs.runtimeContract.document.plannedActivationPositions, undefined,
      "Active runtime contract must not contain planned activations");
    assert.equal(inputs.bridgeRegistry.document.plannedBridges, undefined,
      "Active bridge registry must not contain planned bridges");
  }

  #validatePersisted(artifact, state, protectedBefore) {
    assert.deepEqual(this.#json(this.#paths.output), artifact);
    assert.deepEqual(this.#json(this.#paths.executionState), state);
    assert.deepEqual(this.#protectedHashes(), protectedBefore,
      "Prebuild open changed executable or active-runtime truth");
  }

  #protectedHashes() {
    const files = [
      this.#paths.manifest,
      this.#paths.runtimeContract,
      this.#paths.bridgeRegistry,
      "index.html",
      ...this.#profile.executionProfile.expectedTargets.map((item) => item.currentPath),
      ...this.#walkFiles("dist/stage-3-compat-runtime"),
    ].sort();
    return Object.freeze(Object.fromEntries(files.map((relativePath) => [
      relativePath,
      this.#sha256(this.#bytes(relativePath)),
    ])));
  }

  #walkFiles(relativeRoot) {
    const absoluteRoot = this.#absolute(relativeRoot);
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    return walk(absoluteRoot)
      .map((absolutePath) => path.relative(this.#projectRoot, absolutePath).replaceAll("\\", "/"));
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #absolute(relativePath) {
    const normalized = relativePath.replaceAll("\\", "/");
    if (normalized.split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new Error(`Invalid prebuild project path: ${relativePath}`);
    }
    const resolved = path.resolve(this.#projectRoot, ...normalized.split("/"));
    if (path.dirname(resolved) === this.#projectRoot ||
        resolved.startsWith(`${this.#projectRoot}${path.sep}`)) return resolved;
    throw new Error(`Prebuild project path escapes repository: ${relativePath}`);
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

module.exports = { StageThreeBatchPrebuildApplication };
