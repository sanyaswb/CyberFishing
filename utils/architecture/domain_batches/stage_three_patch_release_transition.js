"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

const STATE = "architecture/migration/stage_3_execution_state.json";
const RELEASE_PATHS = Object.freeze([
  "CHANGELOG.md", STATE, "index.html", "package-lock.json", "package.json",
  "refactor_Task.txt", "src/config/project_version.js",
].sort());

class StageThreePatchReleaseTransition {
  constructor(root, profile) {
    this.root = path.resolve(root);
    this.profile = Object.freeze({ ...profile });
  }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }

  static replace(text, from, to, count) {
    assert(typeof from === "string" && from.length > 0 && from !== to);
    assert(Number.isInteger(count) && count > 0);
    assert.equal(text.split(from).length - 1, count, `Non-exact release replacement: ${from}`);
    return text.split(from).join(to);
  }

  validate(record) {
    const profile = this.profile;
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.kind, `cyber-fishing-stage-3-batch-${profile.batchNumber}-release-transition`);
    assert.equal(record.batchId, profile.batchId);
    assert.equal(record.fromRelease, profile.fromRelease);
    assert.equal(record.toRelease, profile.toRelease);
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    for (const reference of [record.acceptance, record.browserProof]) {
      assert.match(reference.sha256, /^[a-f0-9]{64}$/u);
      assert.equal(sha(this.bytes(reference.path)), reference.sha256,
        `Stale release prerequisite: ${reference.path}`);
    }
    const accepted = JSON.parse(this.bytes(record.acceptance.path));
    const browser = JSON.parse(this.bytes(record.browserProof.path));
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(accepted.batchId, profile.batchId);
    assert.equal(browser.batchId, profile.batchId);
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
    const profile = this.profile;
    if (file === STATE) {
      const old = JSON.parse(before), next = JSON.parse(after);
      assert.equal(old.releaseVersion, profile.fromRelease);
      assert.equal(old.activeBatchId, profile.batchId);
      assert.equal(old.activeBatchPhase, "runtime-active");
      const approved = JSON.parse(this.bytes("architecture/migration/stage_3_approved_batches.json"));
      assert.deepEqual(old.completedBatchIds,
        approved.batches.slice(0, profile.completedBefore).map(item => item.id));
      const expected = { ...old, releaseVersion: profile.toRelease,
        completedBatchIds: approved.batches.slice(0, profile.completedBefore + 1).map(item => item.id),
        activeBatchId: null };
      delete expected.activeBatchPhase;
      assert.deepEqual(next, expected, "Release changed unrelated execution state");
    } else if (file === "package.json" || file === "package-lock.json") {
      const old = JSON.parse(before), next = JSON.parse(after);
      assert.equal(old.version, profile.fromRelease);
      assert.equal(next.version, profile.toRelease);
      next.version = old.version;
      if (file === "package-lock.json") {
        assert.equal(old.packages[""].version, profile.fromRelease);
        assert.equal(next.packages[""].version, profile.toRelease);
        next.packages[""].version = old.packages[""].version;
      }
      assert.deepEqual(next, old, "Release changed package dependency graph or scripts");
    } else if (file === "index.html") {
      assert.equal(StageThreePatchReleaseTransition.replace(after.toString(),
        `src/config/project_version.js?v=${profile.toRelease}`,
        `src/config/project_version.js?v=${profile.fromRelease}`, 1), before.toString());
    } else if (file === "CHANGELOG.md") {
      const old = before.toString(), next = after.toString();
      const historical = `## v${profile.fromRelease} - `;
      assert(old.includes(historical));
      assert(next.includes(historical));
      assert.equal(next.slice(next.indexOf(historical)), old.slice(old.indexOf(historical)),
        "Historical changelog changed");
      assert(next.startsWith(`# CyberFishing changelog\n\n## v${profile.toRelease} - ${profile.title}\n`));
    }
  }

  reverse(bytes, item) {
    assert.equal(sha(bytes), item.afterSha256, `Release metadata drift: ${item.path}`);
    let text = bytes.toString("utf8");
    for (const edit of [...item.edits].reverse()) {
      text = StageThreePatchReleaseTransition.replace(text, edit.to, edit.from, edit.count);
    }
    const restored = Buffer.from(text);
    assert.equal(sha(restored), item.beforeSha256, `Release reverse SHA mismatch: ${item.path}`);
    this.validateDelta(item.path, restored, bytes);
    return restored;
  }

  before(file, bytes = this.bytes(file)) {
    if (!RELEASE_PATHS.includes(file) || !fs.existsSync(path.join(this.root, this.profile.transitionPath))) {
      return Buffer.from(bytes);
    }
    const transition = this.validate(JSON.parse(this.bytes(this.profile.transitionPath)));
    const item = transition.records.find(record => record.path === file);
    if (sha(bytes) === item.beforeSha256) return Buffer.from(bytes);
    return this.reverse(Buffer.from(bytes), item);
  }
}

module.exports = { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS };
