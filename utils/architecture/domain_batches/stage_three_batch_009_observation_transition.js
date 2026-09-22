"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeObservationManifestTransition } = require("./stage_three_observation_manifest_transition");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { BATCH_009_EXECUTION_PROFILE } = require("./stage_three_batch_009_execution_profile");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const OUTPUT = "architecture/migration/stage_3_batch_009_observation_reconciliation.json";
const CUTOVER = "architecture/migration/stage_3_batch_009_runtime_cutover.json";
const PREBUILD = "architecture/migration/stage_3_batch_009_prebuild_contract.json";
const RUNTIME = "architecture/migration/stage_3_compatibility_runtime.json";
const KIND = "cyber-fishing-stage-3-batch-009-observation-reconciliation";
const NEXT = "stage-3.9.8-full-acceptance-and-browser-smoke";

function observationProfile(prebuild) {
  assert.equal(prebuild.batchId, BATCH_009_EXECUTION_PROFILE.batchId);
  return { batchId: prebuild.batchId, completedPrefix: prebuild.lifecycle.completedBatchIds,
    executionProfile: BATCH_009_EXECUTION_PROFILE };
}

class Batch009ObservationManifestTransition extends StageThreeObservationManifestTransition {
  constructor({ prebuild, cutover, runtime }) {
    const record = cutover.writes.find(item => item.path === MANIFEST);
    const historical = Buffer.from(record.beforeBase64, "base64");
    assert.equal(fingerprint(historical), record.beforeSha256);
    assert.equal(record.beforeSha256, prebuild.evidence.manifestBefore.sha256);
    const paths = new Set(prebuild.preliminaryMetadata.targets.map(item => item.currentPath));
    const previousProviders = JSON.parse(historical).modules.filter(item => paths.has(item.currentPath));
    assert.equal(previousProviders.length, paths.size);
    // An in-memory adapter only: the historical cutover document is immutable.
    super({ prebuild, runtime, profile: observationProfile(prebuild), kind: KIND,
      cutover: { ...cutover, manifestTransition: { ...cutover.manifestTransition, previousProviders } } });
  }
}

// Exact projection for older gates. Live scanners always use actual sources and
// the real current Manifest. Unknown bytes are left for their caller to reject.
function beforeBatch009Observations(bytes, root) {
  const file = path.join(root, OUTPUT);
  if (!fs.existsSync(file)) return Buffer.from(bytes);
  const artifact = JSON.parse(fs.readFileSync(file));
  if (fingerprint(bytes) !== artifact.manifestTransition.afterSha256) return Buffer.from(bytes);
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative)));
  return new Batch009ObservationManifestTransition({ prebuild: read(PREBUILD),
    cutover: read(CUTOVER), runtime: read(RUNTIME) }).reverse(Buffer.from(bytes), artifact);
}

module.exports = { Batch009ObservationManifestTransition, beforeBatch009Observations,
  observationProfile, MANIFEST, OUTPUT, CUTOVER, PREBUILD, RUNTIME, KIND, NEXT };
