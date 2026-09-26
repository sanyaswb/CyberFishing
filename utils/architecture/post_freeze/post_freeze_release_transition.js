"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } =
  require("../domain_batches/stage_three_patch_release_transition");
const { ARTIFACTS } = require("./post_freeze_paths");
const { sha256 } = require("./post_freeze_workspace");

const PROFILE = Object.freeze({
  stage: "3.22",
  fromRelease: "0.24.58",
  toRelease: "0.24.59",
  codename: "post-freeze-domain-graph-review",
  title: "Post-Freeze Domain Graph Review",
});
const KIND = "cyber-fishing-stage-3-22-release-transition";
const VERSION_FILE = "src/config/project_version.js";
const REFACTOR_TASK = "refactor_Task.txt";
const CHECKLIST_START = "## Completed batches 001–021 checklist";
const CHECKLIST_END = "**Checkpoint `v0.24.58`:**";

// Audit-only release transition of Stage 3.22. Unlike a batch release it completes no batch: the
// execution state changes only its releaseVersion. Every record keeps the exact before-image, both
// hashes and reversible exact edits, so the pre-release checkpoint is always reconstructible.
class PostFreezeReleaseTransition {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  exists() { return fs.existsSync(path.join(this.root, ARTIFACTS.releaseTransition)); }
  artifact() { return this.validate(JSON.parse(this.bytes(ARTIFACTS.releaseTransition))); }

  validate(record) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.kind, KIND);
    assert.equal(record.stage, PROFILE.stage);
    assert.equal(record.fromRelease, PROFILE.fromRelease);
    assert.equal(record.toRelease, PROFILE.toRelease);
    assert.equal(record.codename, PROFILE.codename);
    assert.equal(record.completesBatch, false);
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    assert.equal(record.acceptance.path, ARTIFACTS.acceptance);
    assert.equal(sha256(this.bytes(record.acceptance.path)), record.acceptance.sha256,
      "Stale Stage 3.22 acceptance");
    const acceptance = JSON.parse(this.bytes(record.acceptance.path));
    assert.equal(acceptance.status, "accepted");
    assert.equal(acceptance.releaseClosureAllowed, true);
    for (const item of record.records) {
      assert.match(item.beforeSha256, /^[a-f0-9]{64}$/u);
      assert.match(item.afterSha256, /^[a-f0-9]{64}$/u);
      assert.equal(sha256(Buffer.from(item.beforeBase64, "base64")), item.beforeSha256,
        `Before-image differs from its hash: ${item.path}`);
      assert(item.edits.length > 0);
    }
    return record;
  }

  validateDelta(file, before, after) {
    if (file === STATE) {
      const old = JSON.parse(before), next = JSON.parse(after);
      assert.equal(old.releaseVersion, PROFILE.fromRelease);
      assert.equal(old.activeBatchId, null);
      assert(!Object.hasOwn(old, "activeBatchPhase"));
      assert.deepEqual(next, { ...old, releaseVersion: PROFILE.toRelease },
        "Audit-only release changed execution state beyond releaseVersion");
    } else if (file === "package.json" || file === "package-lock.json") {
      const old = JSON.parse(before), next = JSON.parse(after);
      assert.equal(old.version, PROFILE.fromRelease);
      assert.equal(next.version, PROFILE.toRelease);
      next.version = old.version;
      if (file === "package-lock.json") {
        assert.equal(old.packages[""].version, PROFILE.fromRelease);
        assert.equal(next.packages[""].version, PROFILE.toRelease);
        next.packages[""].version = old.packages[""].version;
      }
      assert.deepEqual(next, old, "Release changed package scripts or dependency graph");
    } else if (file === "index.html") {
      assert.equal(StageThreePatchReleaseTransition.replace(after.toString(),
        `${VERSION_FILE}?v=${PROFILE.toRelease}`, `${VERSION_FILE}?v=${PROFILE.fromRelease}`, 1),
      before.toString(), "Release changed index.html beyond the project-version cache key");
    } else if (file === "CHANGELOG.md") {
      const old = before.toString(), next = after.toString();
      const historical = `## v${PROFILE.fromRelease} - `;
      assert.equal(next.slice(next.indexOf(historical)), old.slice(old.indexOf(historical)),
        "Historical changelog changed");
      assert(next.startsWith(`# CyberFishing changelog\n\n## v${PROFILE.toRelease} - ${PROFILE.title}\n`));
    } else if (file === REFACTOR_TASK) {
      const checklist = text => text.slice(text.indexOf(CHECKLIST_START), text.indexOf(CHECKLIST_END));
      assert(before.toString().includes(CHECKLIST_START) && after.toString().includes(CHECKLIST_START));
      assert.equal(checklist(after.toString()), checklist(before.toString()), "Completed checklist changed");
    } else if (file === VERSION_FILE) {
      const text = after.toString();
      assert(text.includes(`const CURRENT_PROJECT_VERSION = "${PROFILE.toRelease}";`));
      assert(text.includes(`  codename: "${PROFILE.codename}",`));
    } else {
      assert.fail(`Unexpected release file: ${file}`);
    }
  }

  reverse(bytes, item) {
    assert.equal(sha256(bytes), item.afterSha256, `Release metadata drift: ${item.path}`);
    let text = bytes.toString("utf8");
    for (const edit of [...item.edits].reverse()) {
      text = StageThreePatchReleaseTransition.replace(text, edit.to, edit.from, edit.count);
    }
    const restored = Buffer.from(text);
    assert.equal(sha256(restored), item.beforeSha256, `Release reverse SHA mismatch: ${item.path}`);
    assert(restored.equals(Buffer.from(item.beforeBase64, "base64")), `Release before-image differs: ${item.path}`);
    this.validateDelta(item.path, restored, bytes);
    return restored;
  }

  // Returns the pre-release bytes of a release metadata file; other files are returned unchanged.
  before(file, bytes = this.bytes(file)) {
    if (!RELEASE_PATHS.includes(file) || !this.exists()) return Buffer.from(bytes);
    const item = this.artifact().records.find(record => record.path === file);
    if (sha256(bytes) === item.beforeSha256) return Buffer.from(bytes);
    return this.reverse(Buffer.from(bytes), item);
  }
}

module.exports = { PostFreezeReleaseTransition, PROFILE, KIND, VERSION_FILE, REFACTOR_TASK, RELEASE_PATHS, STATE };
