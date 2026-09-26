"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PostFreezeReleaseTransition, PROFILE, VERSION_FILE, STATE } =
  require("./post_freeze/post_freeze_release_transition");
const { replay } = require("./stage-3-22-post-freeze-review");
const { ARTIFACTS, INPUTS, HISTORICAL } = require("./post_freeze/post_freeze_paths");
const { sha256 } = require("./post_freeze/post_freeze_workspace");

const LEFTOVER = /^\..+\.(stage|backup)-\d+-\d+$/u;

// Verifies the v0.24.59 audit-only release: exact reversible metadata, the unchanged completed
// prefix and runtime topology, and a byte-identical Stage 3.22 replay at its original checkpoint.
class Stage322ReleaseCheck {
  // Inside the release transaction backups still exist; leftovers are checked after commit.
  run(root = path.resolve(__dirname, "../.."), { transactionComplete = true } = {}) {
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    const transition = new PostFreezeReleaseTransition(root);
    const record = transition.artifact();
    for (const item of record.records) transition.reverse(read(item.path), item);
    const state = json(STATE);
    const approved = json(HISTORICAL.approvedPlan);
    assert.equal(state.releaseVersion, PROFILE.toRelease);
    assert.equal(state.status, "migration-active");
    assert.equal(state.approvedPlanSha256, sha256(read(HISTORICAL.approvedPlan)));
    assert.deepEqual(state.completedBatchIds, approved.batches.map(batch => batch.id));
    assert.equal(state.completedBatchIds.length, 21);
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(state.compatibilityRuntimeActivated, true);
    const pkg = json("package.json"), lock = json("package-lock.json");
    assert.equal(pkg.version, PROFILE.toRelease);
    assert.equal(lock.version, PROFILE.toRelease);
    assert.equal(lock.packages[""].version, PROFILE.toRelease);
    const version = read(VERSION_FILE).toString();
    assert(version.includes(`const CURRENT_PROJECT_VERSION = "${PROFILE.toRelease}";`));
    assert(version.includes(`codename: "${PROFILE.codename}"`));
    assert.equal(read("index.html").toString().split(`${VERSION_FILE}?v=${PROFILE.toRelease}`).length - 1, 1);
    assert(read("CHANGELOG.md").toString().startsWith(
      `# CyberFishing changelog\n\n## v${PROFILE.toRelease} - ${PROFILE.title}\n`));
    const runtime = json(INPUTS.runtimeContract);
    const registry = json(INPUTS.bridgeRegistry);
    const topology = { modules: new Set(runtime.activationPositions.map(item => item.targetModule)).size,
      activations: runtime.activationPositions.length, bridges: registry.bridges.length };
    assert.deepEqual(topology, { modules: 78, activations: 87, bridges: 139 });
    const acceptance = json(ARTIFACTS.acceptance);
    for (const item of acceptance.artifacts) {
      assert.equal(sha256(read(item.path)), item.sha256, `Stage 3.22 artifact changed after acceptance: ${item.path}`);
    }
    const { mismatches } = replay({ root });
    assert.deepEqual(mismatches, [], "Stage 3.22 review no longer replays at its checkpoint");
    const leftovers = !transactionComplete ? [] : [...new Set(record.records.map(item => path.dirname(item.path)).concat(
      path.dirname(ARTIFACTS.releaseTransition)))]
      .flatMap(directory => fs.readdirSync(path.join(root, directory)).filter(name => LEFTOVER.test(name)));
    assert.deepEqual(leftovers, [], "Release transaction left staging or backup files");
    return { status: "passed", topology, releaseFiles: record.records.length,
      transactionLeftovers: transactionComplete ? 0 : "checked-after-commit" };
  }
}

if (require.main === module) {
  try {
    const result = new Stage322ReleaseCheck().run();
    console.log(`Stage 3.22 release check PASS: ${result.releaseFiles} reversible files, prefix 001–021, 78/87/139, replay exact.`);
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Stage322ReleaseCheck };
