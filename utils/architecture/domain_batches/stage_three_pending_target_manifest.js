"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ManifestEntryFactory } = require("../migration/manifest_entry_factory");
const { CurrentAreaResolver } = require("../migration/current_area_resolver");

const canonicalBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const fingerprint = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// A source/build transition adds real source records, but no observation facts.
// Removing only these exact records must reproduce the complete prebuild hash.
class PendingTargetManifestTransition {
  constructor({ policy, prebuild, approvedBatch }) {
    this.prebuild = prebuild;
    assert.equal(approvedBatch.id, prebuild.batchId);
    assert.equal(approvedBatch.status, "approved-frozen");
    const factory = new ManifestEntryFactory({
      manifestPolicy: policy.migrationManifest,
      currentAreaResolver: new CurrentAreaResolver({ rootValue: policy.migrationManifest.currentArea.rootValue }),
    });
    this.records = prebuild.preliminaryMetadata.targets.map((target) => {
      const approved = approvedBatch.modules.find((item) => item.currentPath === target.currentPath);
      assert.equal(approved?.targetPath, target.targetPath, "Pending target is not approved");
      const entry = factory.create({ currentPath: target.targetPath }, null);
      entry.architecture = { migrationStatus: "migrating", roles: [...target.roles],
        targetBoundary: target.targetBoundary, targetPath: target.targetPath, migrationWave: 1 };
      entry.analysis.blockers = { status: "verified", items: [] };
      return entry;
    }).sort((a, b) => a.currentPath.localeCompare(b.currentPath));
  }

  add(bytes) {
    assert.equal(fingerprint(bytes), this.prebuild.evidence.manifestBefore.sha256,
      "Pending target transition requires exact prebuild Manifest");
    const manifest = JSON.parse(bytes);
    assert(canonicalBytes(manifest).equals(bytes), "Manifest JSON must be canonical");
    const existing = new Set(manifest.modules.map((entry) => entry.currentPath));
    for (const record of this.records) assert(!existing.has(record.currentPath), "Target already recorded");
    manifest.modules.push(...structuredClone(this.records));
    manifest.modules.sort((a, b) => a.currentPath < b.currentPath ? -1 : a.currentPath > b.currentPath ? 1 : 0);
    return canonicalBytes(manifest);
  }

  reverse(bytes) {
    if (fingerprint(bytes) === this.prebuild.evidence.manifestBefore.sha256) return Buffer.from(bytes);
    const manifest = JSON.parse(bytes);
    assert(canonicalBytes(manifest).equals(bytes), "Manifest JSON must be canonical");
    const paths = new Set(this.records.map((entry) => entry.currentPath));
    assert.deepEqual(manifest.modules.filter((entry) => paths.has(entry.currentPath)), this.records,
      "Pending target records differ from the exact approved source/build delta");
    manifest.modules = manifest.modules.filter((entry) => !paths.has(entry.currentPath));
    const restored = canonicalBytes(manifest);
    assert.equal(fingerprint(restored), this.prebuild.evidence.manifestBefore.sha256,
      "Manifest differs beyond the exact pending target addition");
    return restored;
  }
}

// Explicit lifecycle registration: no general permission for pending modules.
function readPendingTargetTransition(projectRoot) {
  const read = (relative) => JSON.parse(fs.readFileSync(path.join(projectRoot, relative), "utf8"));
  const { Batch008CutoverHistory } = require("./stage_three_batch_008_cutover_history");
  const state = JSON.parse(new Batch008CutoverHistory(projectRoot).before("architecture/migration/stage_3_execution_state.json"));
  const { BATCH_008_PREBUILD_PROFILE: profile } = require("./stage_three_batch_prebuild_profile");
  if (state.activeBatchId !== profile.batchId || state.activeBatchPhase !== "prebuild") return null;
  const prebuild = read(profile.artifactPath);
  const { StageThreeBatchPrebuildContractValidator } = require("./stage_three_batch_prebuild_contract");
  new StageThreeBatchPrebuildContractValidator(profile).validate(prebuild);
  assert.deepEqual(state.completedBatchIds, profile.completedPrefix);
  const approved = read("architecture/migration/stage_3_approved_batches.json");
  assert.equal(fingerprint(canonicalBytes(approved)), state.approvedPlanSha256);
  return new PendingTargetManifestTransition({ policy: read("architecture/module_architecture.json"),
    prebuild, approvedBatch: approved.batches.find((batch) => batch.id === profile.batchId) });
}

function historicalManifestBytes(bytes, projectRoot = path.resolve(__dirname, "../../..")) {
  const { historicalCutoverBytes } = require("./stage_three_batch_008_cutover_history");
  const { BATCH_008_PREBUILD_PROFILE: profile } = require("./stage_three_batch_prebuild_profile");
  const targets = new Set(profile.executionProfile.expectedTargets.map((item) => item.targetPath));
  if (JSON.parse(bytes).modules.some((item) => targets.has(item.currentPath))) {
    bytes = historicalCutoverBytes("architecture/migration/module_migration_manifest.json", bytes, projectRoot);
  }
  const transition = readPendingTargetTransition(projectRoot);
  if (!transition) return Buffer.from(bytes);
  const paths = new Set(transition.records.map((entry) => entry.currentPath));
  const hasTargets = JSON.parse(bytes).modules.some((entry) => paths.has(entry.currentPath));
  return hasTargets ? transition.reverse(Buffer.from(bytes)) : Buffer.from(bytes);
}

module.exports = { PendingTargetManifestTransition, readPendingTargetTransition,
  historicalManifestBytes, canonicalBytes, fingerprint };
