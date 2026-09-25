"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./domain_batches/stage_three_batch_019_planning");
const { BATCH_019_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_019_preflight_profile");
const { Batch019ReleaseTransition, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_019_release_transition");

class Batch019ReleaseCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    const transition = new Batch019ReleaseTransition(root);
    const record = transition.validate(json(TRANSITION));
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    for (const item of record.records) transition.reverse(read(item.path), item);
    const state = json(STATE);
    const approved = json("architecture/migration/stage_3_approved_batches.json");
    assert.equal(state.releaseVersion, "0.24.56");
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 19).map(item => item.id));
    assert.equal(state.completedBatchIds[18], PROFILE.batchId);
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(state.compatibilityRuntimeActivated, true);
    const pkg = json("package.json"), lock = json("package-lock.json");
    assert.equal(pkg.version, "0.24.56");
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[""].version, pkg.version);
    const version = read("src/config/project_version.js").toString();
    assert(version.includes('const CURRENT_PROJECT_VERSION = "0.24.56";'));
    assert(version.includes('codename: "items-bait-grade-decay-quality-domain"'));
    assert.equal(read("index.html").toString().split("src/config/project_version.js?v=0.24.56").length - 1, 1);
    assert(read("CHANGELOG.md").toString()
      .startsWith("# CyberFishing changelog\n\n## v0.24.56 - Items Bait Grade Decay and Quality Domain\n"));
    const runtime = json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = json("architecture/guards/migration_bridge_registry.json");
    assert.equal(new Set(runtime.activationPositions.map(item => item.targetModule)).size, 73);
    assert.equal(runtime.activationPositions.length, 77);
    assert.equal(registry.bridges.length, 130);
    const browserPath = "architecture/migration/stage_3_batch_019_browser_confirmation.json";
    const acceptancePath = "architecture/migration/stage_3_batch_019_acceptance_pass.json";
    const browser = json(browserPath), acceptance = json(acceptancePath);
    assert.equal(browser.status, "passed");
    assert.deepEqual([browser.console.errors, browser.console.warnings], [0, 0]);
    assert.equal(browser.supplements.sha256, sha(read(acceptancePath)));
    assert.equal(acceptance.verdict, "eligible-for-release-closure");
    for (const item of acceptance.protectedEvidence) {
      if (item.path !== STATE && item.path !== "index.html") {
        assert.equal(sha(read(item.path)), item.sha256, `Release altered evidence: ${item.path}`);
      }
    }
    return { status: "passed", topology: { modules: 73, activations: 77, bridges: 130 },
      releaseFiles: record.records.length };
  }
}

if (require.main === module) {
  try {
    const result = new Batch019ReleaseCheck().run();
    console.log(`Stage 3.19.9 release check PASS: ${result.releaseFiles} reversible files, prefix 001–019, 73/77/130.`);
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch019ReleaseCheck };
