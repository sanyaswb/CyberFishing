"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const OUTPUT = "architecture/migration/stage_3_batch_008_observation_reconciliation.json";
const CUTOVER = "architecture/migration/stage_3_batch_008_runtime_cutover.json";
const { StageThreeObservationManifestTransition } = require("./stage_three_observation_manifest_transition");

class Batch008ObservationManifestTransition extends StageThreeObservationManifestTransition {
  constructor(inputs) {
    super({ ...inputs, profile: PROFILE, kind: "cyber-fishing-stage-3-batch-008-observation-reconciliation" });
  }
}

// Historical validators call this exact view; live scanners never do. No facts
// are suppressed in the current Manifest or in the new reconciliation check.
function beforeBatch008Observations(bytes, root) {
  bytes = new (require("./stage_three_batch_009_cutover_history").Batch009CutoverHistory)(root).before(MANIFEST,bytes);
  const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative)));
  const cutover = read(CUTOVER);
  if (fingerprint(bytes) === cutover.writes.find((item) => item.path === MANIFEST).afterSha256) return Buffer.from(bytes);
  assert(fs.existsSync(path.join(root, OUTPUT)), "Missing exact observation transition evidence");
  const { StageThreeBatch008ReleaseTransition } = require("./stage_three_batch_008_release_transition");
  const state = new StageThreeBatch008ReleaseTransition(root).runtimeState();
  assert.equal(state.activeBatchId, PROFILE.batchId);
  assert.equal(state.activeBatchPhase, "runtime-active");
  assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
  return new Batch008ObservationManifestTransition({ cutover, prebuild: read(PROFILE.artifactPath),
    runtime: read("architecture/migration/stage_3_compatibility_runtime.json") }).reverse(Buffer.from(bytes), read(OUTPUT));
}

module.exports = { Batch008ObservationManifestTransition, beforeBatch008Observations, MANIFEST, OUTPUT };
