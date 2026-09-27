"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./planning");
const { StageThreeCutoverHistory } = require("./cutover_history");
const { MANIFEST, beforeBatchObservations } = require("./observation_transition");
const { StageThreeBatchReleaseTransition } = require("./release_transition");
const { StageThreePrerequisiteLedger } = require("../../stage_three_prerequisites/core/prerequisite_ledger");

const STATE = "architecture/migration/stage_3_execution_state.json";
const KNOWN_DEBT = "architecture/guards/known_debt_registry.json";

// Byte history of one continuation batch: before(file) peels this batch's release, observation,
// known-debt, cutover and prebuild records off the given bytes. Newer batches are peeled first,
// so every earlier checkpoint is reconstructed exactly from the current tree.
class StageThreeBatchHistory {
  constructor(root, definition, registry) {
    this.root = path.resolve(root);
    this.definition = definition;
    this.registry = registry;
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }

  exists() { return fs.existsSync(path.join(this.root, this.definition.context.paths.prebuild)); }

  newer() {
    const next = this.definition.context.next().number;
    return this.registry.has(next) ? new StageThreeBatchHistory(this.root, this.registry.load(next), this.registry) : null;
  }

  before(file, provided = this.bytes(file)) {
    const newer = this.newer();
    let bytes = newer ? newer.before(file, provided) : Buffer.from(provided);
    if (!this.exists()) return bytes;
    const paths = this.definition.context.paths;
    bytes = new StageThreePrerequisiteLedger(this.root).before(file, bytes, this.definition.context.number);
    bytes = new StageThreeBatchReleaseTransition(this.root, this.definition).before(file, bytes);
    if (file === MANIFEST) bytes = beforeBatchObservations(this.definition, bytes, this.root);
    if (file === KNOWN_DEBT && fs.existsSync(path.join(this.root, paths.knownDebt))) {
      const transition = JSON.parse(this.bytes(paths.knownDebt)).registry;
      if (sha(bytes) === transition.afterSha256) {
        bytes = Buffer.from(transition.beforeBase64, "base64");
        assert.equal(sha(bytes), transition.beforeSha256);
      }
    }
    const prebuild = JSON.parse(this.bytes(paths.prebuild));
    if (fs.existsSync(path.join(this.root, paths.cutover))) {
      const cutover = new StageThreeCutoverHistory(this.root, this.definition).artifact();
      const record = cutover.writes.find(item => item.path === file);
      if (record && record.afterSha256 !== null && sha(bytes) === record.afterSha256) {
        if (record.beforeBase64 === null) return bytes;
        bytes = Buffer.from(record.beforeBase64, "base64");
      }
    }
    if (file === STATE) {
      const transition = prebuild.stateTransition;
      const before = Buffer.from(transition.beforeBase64, "base64");
      const after = Buffer.from(transition.afterBase64, "base64");
      assert.equal(sha(before), transition.beforeSha256);
      assert.equal(sha(after), transition.afterSha256);
      if (bytes.equals(after)) bytes = before;
    }
    return bytes;
  }
}

module.exports = { StageThreeBatchHistory };
