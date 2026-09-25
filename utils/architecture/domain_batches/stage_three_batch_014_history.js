"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./stage_three_batch_014_planning");
const { Batch014CutoverHistory } = require("./stage_three_batch_014_cutover_history");
const { PREBUILD } = require("./stage_three_batch_014_prebuild");
const { CUTOVER } = require("./stage_three_batch_014_cutover");
const { MANIFEST, beforeBatch014Observations } = require("./stage_three_batch_014_observation_transition");
const { Batch014ReleaseTransition } = require("./stage_three_batch_014_release_transition");

const STATE = "architecture/migration/stage_3_execution_state.json";

class Batch014History {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  exists() { return fs.existsSync(path.join(this.root, PREBUILD)); }

  before(file, provided = this.bytes(file)) {
    let bytes = Buffer.from(provided);
    if (!this.exists()) return bytes;
    bytes = new Batch014ReleaseTransition(this.root).before(file, bytes);
    if (file === MANIFEST) bytes = beforeBatch014Observations(bytes, this.root);
    if (file === "architecture/guards/known_debt_registry.json") {
      const resolutionPath = "architecture/migration/stage_3_batch_014_known_debt_resolution.json";
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
      const cutover = new Batch014CutoverHistory(this.root).artifact();
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

module.exports = { Batch014History };
