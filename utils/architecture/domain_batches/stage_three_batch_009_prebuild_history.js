"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const STATE = "architecture/migration/stage_3_execution_state.json";
const PREBUILD = "architecture/migration/stage_3_batch_009_prebuild_contract.json";
const PLAN = "architecture/migration/stage_3_batch_009_execution_plan.json";
const BATCH = "stage-3.candidate-009-fish-444e8034";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// A single exact state transition, only for historical readers. No runtime
// topology, Manifest, registry or source bytes are projected by this adapter.
class Batch009PrebuildHistory {
  constructor(root) { this.root = path.resolve(root); }
  read(file) { return fs.readFileSync(path.join(this.root, file)); }
  validate(record) {
    assert.equal(record.path, STATE);
    const before = Buffer.from(record.beforeBase64, "base64"), after = Buffer.from(record.afterBase64, "base64");
    assert.equal(hash(before), record.beforeSha256, "prebuild before SHA differs");
    assert.equal(hash(after), record.afterSha256, "prebuild after SHA differs");
    const plan = JSON.parse(this.read(PLAN));
    assert.equal(record.beforeSha256, plan.sourceEvidence.executionState.sha256, "before state is not approved checkpoint");
    assert.equal(plan.batchId, BATCH);
    const a = JSON.parse(before), b = JSON.parse(after);
    assert.equal(a.releaseVersion, "0.24.45");
    assert.equal(a.activeBatchId, null);
    assert(!Object.hasOwn(a, "activeBatchPhase"));
    const approved = JSON.parse(this.read("architecture/migration/stage_3_approved_batches.json"));
    assert.equal(approved.batches[8].id, BATCH);
    assert.deepEqual(a.completedBatchIds, approved.batches.slice(0, 8).map(x => x.id));
    assert.deepEqual(b, { ...a, activeBatchId: BATCH, activeBatchPhase: "prebuild" }, "unapproved prebuild delta");
    return { before, after };
  }
  before(file, provided) {
    const bytes = Buffer.from(provided);
    if (file !== STATE || !fs.existsSync(path.join(this.root, PREBUILD))) return bytes;
    const artifact = JSON.parse(this.read(PREBUILD));
    assert.equal(artifact.batchId, BATCH);
    const { before, after } = this.validate(artifact.stateTransition);
    const live = new (require("./stage_three_batch_009_cutover_history").Batch009CutoverHistory)(this.root).before(STATE, this.read(STATE));
    assert(live.equals(before) || live.equals(after), "unknown batch-009 live state; historical projection forbidden");
    return bytes.equals(after) ? before : bytes;
  }
}
function beforeBatch009Prebuild(file, bytes, root) {
  const before = new (require("./stage_three_batch_009_cutover_history").Batch009CutoverHistory)(root).before(file, bytes);
  return new Batch009PrebuildHistory(root).before(file, before);
}
module.exports = { Batch009PrebuildHistory, beforeBatch009Prebuild, STATE, PREBUILD, PLAN, BATCH, hash };
