"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./stage_three_batch_012_planning");
const { Batch012CutoverHistory } = require("./stage_three_batch_012_cutover_history");
const { PREBUILD } = require("./stage_three_batch_012_prebuild");
const { CUTOVER } = require("./stage_three_batch_012_cutover");
const { MANIFEST, beforeBatch012Observations } = require("./stage_three_batch_012_observation_transition");
const { Batch012ReleaseTransition } = require("./stage_three_batch_012_release_transition");

const STATE = "architecture/migration/stage_3_execution_state.json";

class Batch012History {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  exists() { return fs.existsSync(path.join(this.root, PREBUILD)); }

  before(file, provided = this.bytes(file)) {
    let bytes = new (require("./stage_three_batch_013_history").Batch013History)(this.root)
      .before(file, provided);
    if (!this.exists()) return bytes;
    bytes = new Batch012ReleaseTransition(this.root).before(file, bytes);
    if (file === MANIFEST) bytes = beforeBatch012Observations(bytes, this.root);
    const prebuild = JSON.parse(this.bytes(PREBUILD));
    if (fs.existsSync(path.join(this.root, CUTOVER))) {
      const cutover = new Batch012CutoverHistory(this.root).artifact();
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

module.exports = { Batch012History };
