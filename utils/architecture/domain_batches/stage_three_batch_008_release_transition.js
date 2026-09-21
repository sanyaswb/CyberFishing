"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");

const TRANSITION = "architecture/migration/stage_3_batch_008_release_transition.json";
const STATE = "architecture/migration/stage_3_execution_state.json";
const RELEASE_PATHS = Object.freeze([
  "CHANGELOG.md", STATE, "index.html", "package-lock.json", "package.json", "refactor_Task.txt",
  "src/config/project_version.js",
].sort());

// Historical evidence only. The actual execution state remains the sole runtime
// truth. Reversal permits seven exact metadata files, never Domain or topology.
class StageThreeBatch008ReleaseTransition {
  constructor(root) { this.root = path.resolve(root); }
  read(file) { return fs.readFileSync(path.join(this.root, file)); }

  static replace(text, from, to, count) {
    assert(from.length > 0 && from !== to && Number.isInteger(count) && count > 0);
    assert.equal(text.split(from).length - 1, count, "Non-exact release metadata replacement");
    return text.split(from).join(to);
  }

  validate(record) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.kind, "cyber-fishing-stage-3-batch-008-release-transition");
    assert.equal(record.batchId, PROFILE.batchId);
    assert.equal(record.fromRelease, PROFILE.executionProfile.sourceReleaseVersion);
    assert.equal(record.toRelease, PROFILE.executionProfile.targetReleaseVersion);
    assert.deepEqual(record.records.map((item) => item.path), RELEASE_PATHS);
    for (const item of record.records) {
      assert.match(item.beforeSha256, /^[a-f0-9]{64}$/u);
      assert.match(item.afterSha256, /^[a-f0-9]{64}$/u);
      assert(item.edits.length > 0);
    }
    return record;
  }

  reverse(bytes, record) {
    assert.equal(fingerprint(bytes), record.afterSha256, `Release metadata changed: ${record.path}`);
    let text = bytes.toString("utf8");
    for (const edit of [...record.edits].reverse()) {
      text = StageThreeBatch008ReleaseTransition.replace(text, edit.to, edit.from, edit.count);
    }
    const restored = Buffer.from(text);
    assert.equal(fingerprint(restored), record.beforeSha256, `Non-exact release reversal: ${record.path}`);
    this.validateDelta(record.path, restored, bytes);
    return restored;
  }

  validateDelta(file, before, after) {
    if (file.endsWith(".json")) {
      const a = JSON.parse(before), b = JSON.parse(after);
      if (file === STATE) {
        assert.equal(a.activeBatchId, PROFILE.batchId);
        assert.equal(a.activeBatchPhase, "runtime-active");
        assert.deepEqual(a.completedBatchIds, PROFILE.completedPrefix);
        const expected = { ...a, releaseVersion: "0.24.45",
          completedBatchIds: [...a.completedBatchIds, PROFILE.batchId], activeBatchId: null };
        delete expected.activeBatchPhase;
        assert.deepEqual(b, expected, "Completion changed unrelated state");
        assert.equal(a.releaseVersion, "0.24.44");
      } else {
        assert.equal(a.version, "0.24.44");
        assert.equal(b.version, "0.24.45");
        b.version = a.version;
        if (file === "package-lock.json") {
          assert.equal(a.packages[""].version, "0.24.44");
          assert.equal(b.packages[""].version, "0.24.45");
          b.packages[""].version = a.packages[""].version;
        }
        assert.deepEqual(b, a, "Release changed dependencies/scripts/package graph");
      }
    } else if (file === "index.html") {
      assert.equal(StageThreeBatch008ReleaseTransition.replace(after.toString(),
        "src/config/project_version.js?v=0.24.45", "src/config/project_version.js?v=0.24.44", 1), before.toString());
    } else if (file === "CHANGELOG.md") {
      const old = before.toString(), next = after.toString();
      const heading = "## v0.24.44 - Fishing Domain State and Motion";
      assert.equal(next.slice(next.indexOf(heading)), old.slice(old.indexOf(heading)), "Historical changelog changed");
      assert(next.startsWith("# CyberFishing changelog\n\n## v0.24.45 - Line Spool, Stroke Distance and Reel Hold\n"));
    }
  }

  before(file, bytes = this.read(file)) {
    bytes = require("./stage_three_batch_009_prebuild_history").beforeBatch009Prebuild(file, bytes, this.root);
    if (!RELEASE_PATHS.includes(file) || !fs.existsSync(path.join(this.root, TRANSITION))) return Buffer.from(bytes);
    const transition = this.validate(JSON.parse(this.read(TRANSITION)));
    const item = transition.records.find((record) => record.path === file);
    if (fingerprint(bytes) === item.beforeSha256) return Buffer.from(bytes);
    return this.reverse(Buffer.from(bytes), item);
  }

  runtimeState() {
    const state = JSON.parse(this.before(STATE));
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
    return state;
  }
}

function beforeBatch008Release(file, bytes, root = path.resolve(__dirname, "../../..")) {
  return new StageThreeBatch008ReleaseTransition(root).before(file, bytes);
}
module.exports = { StageThreeBatch008ReleaseTransition, beforeBatch008Release, TRANSITION, STATE, RELEASE_PATHS };
