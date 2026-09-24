"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./stage_three_batch_010_planning");
const { Batch010CutoverHistory } = require("./stage_three_batch_010_cutover_history");
const { PREBUILD } = require("./stage_three_batch_010_prebuild");
const { CUTOVER } = require("./stage_three_batch_010_cutover");
const { MANIFEST, beforeBatch010Observations } = require("./stage_three_batch_010_observation_transition");

const STATE = "architecture/migration/stage_3_execution_state.json";

class Batch010History {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  exists() { return fs.existsSync(path.join(this.root, PREBUILD)); }

  before(file, provided = this.bytes(file)) {
    let bytes = new (require("./stage_three_batch_011_history").Batch011History)(this.root)
      .before(file, provided);
    if (!this.exists()) return bytes;
    bytes = new (require("./stage_three_batch_010_release_transition").Batch010ReleaseTransition)(this.root)
      .before(file, bytes);
    const prebuild = JSON.parse(this.bytes(PREBUILD));
    if (file === MANIFEST) bytes = beforeBatch010Observations(bytes, this.root);
    if (fs.existsSync(path.join(this.root, CUTOVER))) {
      const cutover = new Batch010CutoverHistory(this.root).artifact();
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

module.exports = { Batch010History };
