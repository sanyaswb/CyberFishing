"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./stage_three_batch_025_planning");
const { Batch025CutoverHistory } = require("./stage_three_batch_025_cutover_history");
const { PREBUILD } = require("./stage_three_batch_025_prebuild");
const { CUTOVER } = require("./stage_three_batch_025_cutover");
const { MANIFEST, beforeBatch025Observations } = require("./stage_three_batch_025_observation_transition");
const { Batch025ReleaseTransition } = require("./stage_three_batch_025_release_transition");

const STATE = "architecture/migration/stage_3_execution_state.json";

class Batch025History {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  exists() { return fs.existsSync(path.join(this.root, PREBUILD)); }

  before(file, provided = this.bytes(file)) {
    // Shared continuation batches (026+) are peeled first by their own history.
    const { StageThreeBatchRegistry } = require("../stage_three_batches/core/batch_definition");
    let bytes = Buffer.from(provided);
    if (StageThreeBatchRegistry.has("026")) {
      const { StageThreeBatchHistory } = require("../stage_three_batches/lifecycle/history");
      bytes = new StageThreeBatchHistory(this.root, StageThreeBatchRegistry.load("026"), StageThreeBatchRegistry)
        .before(file, bytes);
    }
    if (!this.exists()) return bytes;
    bytes = new Batch025ReleaseTransition(this.root).before(file, bytes);
    if (file === MANIFEST) bytes = beforeBatch025Observations(bytes, this.root);
    if (file === "architecture/guards/known_debt_registry.json") {
      const resolutionPath = "architecture/migration/stage_3_batch_025_known_debt_resolution.json";
      if (fs.existsSync(path.join(this.root, resolutionPath))) {
        const transition = JSON.parse(this.bytes(resolutionPath)).registry;
        if (sha(bytes) === transition.afterSha256) {
          bytes = Buffer.from(transition.beforeBase64, "base64");
          assert.equal(sha(bytes), transition.beforeSha256);
        }
      }
    }
    const prebuild = JSON.parse(this.bytes(PREBUILD));
    if (fs.existsSync(path.join(this.root, CUTOVER))) {
      const cutover = new Batch025CutoverHistory(this.root).artifact();
      const record = cutover.writes.find(item => item.path === file);
      if (record && sha(bytes) === record.afterSha256) {
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

module.exports = { Batch025History };
