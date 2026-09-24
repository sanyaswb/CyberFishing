"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeObservationManifestTransition } = require("./stage_three_observation_manifest_transition");
const { fingerprint } = require("./stage_three_pending_target_manifest");
const { PROFILE } = require("./stage_three_batch_010_preflight");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const OUTPUT = "architecture/migration/stage_3_batch_010_observation_reconciliation.json";
const CUTOVER = "architecture/migration/stage_3_batch_010_runtime_cutover.json";
const PREBUILD = "architecture/migration/stage_3_batch_010_prebuild_contract.json";
const RUNTIME = "architecture/migration/stage_3_compatibility_runtime.json";
const KIND = "cyber-fishing-stage-3-batch-010-observation-reconciliation";
const NEXT = "stage-3.10.8-full-acceptance-and-browser-smoke";

function observationProfile(prebuild) {
  assert.equal(prebuild.batchId, PROFILE.batchId);
  return {
    batchId: prebuild.batchId,
    completedPrefix: prebuild.lifecycle.completedBatchIds,
    executionProfile: PROFILE.executionProfile,
  };
}

class Batch010ObservationManifestTransition extends StageThreeObservationManifestTransition {
  constructor({ prebuild, cutover, runtime }) {
    const record = cutover.writes.find(item => item.path === MANIFEST);
    assert(record && record.beforeBase64);
    const historical = Buffer.from(record.beforeBase64, "base64");
    assert.equal(fingerprint(historical), record.beforeSha256);
    assert.equal(record.beforeSha256, prebuild.evidence.manifestBefore.sha256);
    const paths = new Set(prebuild.preliminaryMetadata.targets.map(item => item.currentPath));
    const previousProviders = JSON.parse(historical).modules.filter(item => paths.has(item.currentPath));
    assert.equal(previousProviders.length, paths.size);
    super({
      prebuild, runtime, profile: observationProfile(prebuild), kind: KIND,
      cutover: { ...cutover, manifestTransition: { ...cutover.manifestTransition, previousProviders } },
    });
  }
}

function beforeBatch010Observations(bytes, root) {
  const file = path.join(root, OUTPUT);
  if (!fs.existsSync(file)) return Buffer.from(bytes);
  const artifact = JSON.parse(fs.readFileSync(file));
  if (fingerprint(bytes) !== artifact.manifestTransition.afterSha256) return Buffer.from(bytes);
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative)));
  return new Batch010ObservationManifestTransition({
    prebuild: read(PREBUILD), cutover: read(CUTOVER), runtime: read(RUNTIME),
  }).reverse(Buffer.from(bytes), artifact);
}

module.exports = {
  Batch010ObservationManifestTransition, beforeBatch010Observations,
  observationProfile, MANIFEST, OUTPUT, CUTOVER, PREBUILD, RUNTIME, KIND, NEXT,
};
