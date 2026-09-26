"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CUTOVER } = require("./stage_three_batch_025_cutover");
const { PREBUILD } = require("./stage_three_batch_025_prebuild");
const { OUTPUT: SOURCE_BUILD } = require("./stage_three_batch_025_source_build");
const { BATCH_025_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_025_preflight_profile");
const { PATHS } = require("./stage_three_live_preflight");
const { sha } = require("./stage_three_batch_025_planning");

class Batch025CutoverHistory {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  artifact() {
    const cutover = JSON.parse(this.bytes(CUTOVER));
    const prebuild = JSON.parse(this.bytes(PREBUILD));
    const sourceBuild = JSON.parse(this.bytes(SOURCE_BUILD));
    assert.equal(cutover.schemaVersion, 3);
    assert.equal(cutover.batchId, PROFILE.batchId);
    assert.equal(cutover.releaseVersion, PROFILE.executionProfile.targetReleaseVersion);
    assert.equal(cutover.evidence.prebuild.path, PREBUILD);
    assert.equal(cutover.evidence.prebuild.sha256, sha(this.bytes(PREBUILD)));
    assert.equal(cutover.evidence.sourceBuild.path, SOURCE_BUILD);
    assert.equal(cutover.evidence.sourceBuild.sha256, sha(this.bytes(SOURCE_BUILD)));
    assert.deepEqual(cutover.topology, prebuild.plannedTopology);
    assert.deepEqual(cutover.build, sourceBuild.report);
    assert.equal(new Set(cutover.writes.map(item => item.path)).size, cutover.writes.length);
    const newFiles = [...PROFILE.executionProfile.expectedTargets.map(target => target.targetPath),
      ...prebuild.preliminaryMetadata.plannedActivationPositions
      .map(item => `dist/stage-3-compat-runtime/${item.shimFile}`)];
    // Only the generated shims of this batch's retired activations may be removed.
    const retiredShims = PROFILE.executionProfile.expectedRetiredActivationIds.map(id => {
      const ledger = (JSON.parse(this.bytes(PATHS.runtimeContract)).retiredActivations || [])
        .find(item => item.activation.id === id && item.retiredBy === PROFILE.batchId);
      assert(ledger, `Retired activation ledger entry missing: ${id}`);
      return `dist/stage-3-compat-runtime/${ledger.activation.shimFile}`;
    });
    assert.deepEqual(cutover.writes.filter(record => record.afterBase64 === null).map(record => record.path).sort(),
      [...retiredShims].sort(), "Cutover removals differ from the retired activation shims");
    for (const record of cutover.writes) {
      assert(!path.isAbsolute(record.path) && !record.path.includes("\\") &&
        record.path.split("/").every(part => part && part !== "." && part !== ".."));
      if (record.afterBase64 === null) {
        assert.equal(record.afterSha256, null);
        assert(record.beforeBase64 !== null, `Removal without before-image: ${record.path}`);
      } else assert.equal(sha(Buffer.from(record.afterBase64, "base64")), record.afterSha256);
      if (record.beforeSha256 === null) {
        assert.equal(record.beforeBase64, null);
        assert(newFiles.includes(record.path), `Unexpected new cutover file: ${record.path}`);
      } else {
        assert.equal(sha(Buffer.from(record.beforeBase64, "base64")), record.beforeSha256);
        if (record.path === PATHS.executionState) {
          assert.equal(record.beforeSha256, prebuild.stateTransition.afterSha256);
        }
      }
    }
    return cutover;
  }
}

module.exports = { Batch025CutoverHistory };
