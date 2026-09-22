"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./stage_three_pending_target_manifest");

const TRANSITION = "architecture/migration/stage_3_batch_009_release_transition.json";
const STATE = "architecture/migration/stage_3_execution_state.json";
const BATCH = "stage-3.candidate-009-fish-444e8034";
const RELEASE_PATHS = Object.freeze([
  "CHANGELOG.md", STATE, "index.html", "package-lock.json", "package.json",
  "refactor_Task.txt", "src/config/project_version.js",
].sort());

class StageThreeBatch009ReleaseTransition {
  constructor(root) { this.root = path.resolve(root); }
  read(file) { return fs.readFileSync(path.join(this.root, file)); }

  static replace(text, from, to, count) {
    assert(typeof from === "string" && from.length > 0 && from !== to);
    assert(Number.isInteger(count) && count > 0);
    assert.equal(text.split(from).length - 1, count, "Non-exact release replacement");
    return text.split(from).join(to);
  }

  validate(record) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.kind, "cyber-fishing-stage-3-batch-009-release-transition");
    assert.equal(record.batchId, BATCH);
    assert.equal(record.fromRelease, "0.24.45");
    assert.equal(record.toRelease, "0.24.46");
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    for (const reference of [record.acceptance, record.browserProof]) {
      assert.match(reference.sha256, /^[a-f0-9]{64}$/u);
      assert.equal(fingerprint(this.read(reference.path)), reference.sha256,
        `Stale release prerequisite: ${reference.path}`);
    }
    const accepted = JSON.parse(this.read(record.acceptance.path));
    const browser = JSON.parse(this.read(record.browserProof.path));
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(accepted.batchId, BATCH);
    assert.equal(browser.batchId, BATCH);
    assert.equal(browser.status, "passed");
    assert.equal(browser.console.errors, 0);
    assert.equal(browser.console.warnings, 0);
    assert.equal(browser.supplements.sha256, record.acceptance.sha256);
    for (const item of record.records) {
      assert.match(item.beforeSha256, /^[a-f0-9]{64}$/u);
      assert.match(item.afterSha256, /^[a-f0-9]{64}$/u);
      assert(item.edits.length > 0);
    }
    return record;
  }

  validateDelta(file, before, after) {
    if (file === STATE) {
      const old = JSON.parse(before), next = JSON.parse(after);
      assert.equal(old.releaseVersion, "0.24.45");
      assert.equal(old.activeBatchId, BATCH);
      assert.equal(old.activeBatchPhase, "runtime-active");
      const approved = JSON.parse(this.read("architecture/migration/stage_3_approved_batches.json"));
      assert.deepEqual(old.completedBatchIds, approved.batches.slice(0, 8).map(item => item.id));
      const expected = { ...old, releaseVersion: "0.24.46",
        completedBatchIds: approved.batches.slice(0, 9).map(item => item.id), activeBatchId: null };
      delete expected.activeBatchPhase;
      assert.deepEqual(next, expected, "Release changed unrelated execution state");
    } else if (file === "package.json" || file === "package-lock.json") {
      const old = JSON.parse(before), next = JSON.parse(after);
      assert.equal(old.version, "0.24.45");
      assert.equal(next.version, "0.24.46");
      next.version = old.version;
      if (file === "package-lock.json") {
        assert.equal(old.packages[""].version, "0.24.45");
        assert.equal(next.packages[""].version, "0.24.46");
        next.packages[""].version = old.packages[""].version;
      }
      assert.deepEqual(next, old, "Release changed package dependency graph or scripts");
    } else if (file === "index.html") {
      assert.equal(StageThreeBatch009ReleaseTransition.replace(after.toString(),
        "src/config/project_version.js?v=0.24.46", "src/config/project_version.js?v=0.24.45", 1), before.toString());
    } else if (file === "CHANGELOG.md") {
      const old = before.toString(), next = after.toString();
      const historical = "## v0.24.45 - Line Spool, Stroke Distance and Reel Hold";
      assert(old.includes(historical));
      assert.equal(next.slice(next.indexOf(historical)), old.slice(old.indexOf(historical)),
        "Historical changelog changed");
      assert(next.startsWith("# CyberFishing changelog\n\n## v0.24.46 - Fish Rarity and Anomaly Domain\n"));
    }
  }

  reverse(bytes, item) {
    assert.equal(fingerprint(bytes), item.afterSha256, `Release metadata drift: ${item.path}`);
    let text = bytes.toString("utf8");
    for (const edit of [...item.edits].reverse()) {
      text = StageThreeBatch009ReleaseTransition.replace(text, edit.to, edit.from, edit.count);
    }
    const restored = Buffer.from(text);
    assert.equal(fingerprint(restored), item.beforeSha256, `Release reverse SHA mismatch: ${item.path}`);
    this.validateDelta(item.path, restored, bytes);
    return restored;
  }

  before(file, bytes = this.read(file)) {
    if (!RELEASE_PATHS.includes(file) || !fs.existsSync(path.join(this.root, TRANSITION))) return Buffer.from(bytes);
    const transition = this.validate(JSON.parse(this.read(TRANSITION)));
    const item = transition.records.find(record => record.path === file);
    if (fingerprint(bytes) === item.beforeSha256) return Buffer.from(bytes);
    return this.reverse(Buffer.from(bytes), item);
  }
}

module.exports = { StageThreeBatch009ReleaseTransition, TRANSITION, STATE, BATCH, RELEASE_PATHS };
