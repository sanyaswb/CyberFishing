"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CUTOVER } = require("./stage_three_batch_012_cutover");
const { PREBUILD } = require("./stage_three_batch_012_prebuild");
const { OUTPUT: SOURCE_BUILD } = require("./stage_three_batch_012_source_build");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_012_preflight_profile");
const { PATHS } = require("./stage_three_live_preflight");
const { sha } = require("./stage_three_batch_012_planning");

class Batch012CutoverHistory {
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
    for (const record of cutover.writes) {
      assert(!path.isAbsolute(record.path) && !record.path.includes("\\") &&
        record.path.split("/").every(part => part && part !== "." && part !== ".."));
      assert.equal(sha(Buffer.from(record.afterBase64, "base64")), record.afterSha256);
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

module.exports = { Batch012CutoverHistory };
