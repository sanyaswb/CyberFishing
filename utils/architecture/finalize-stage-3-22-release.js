"use strict";

// Closes the v0.24.59 audit-only release after publication:
//   node utils/architecture/finalize-stage-3-22-release.js
// Replays batch 021 at its historical checkpoint, runs the post-release Quick, Architecture and
// History suites, repeats the fresh npm ci/build regression and records the release closure.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch021ArchitectureCheck } = require("./stage-3-batch-021-architecture-check");
const { Stage322ReleaseCheck } = require("./stage-3-22-release-check");
const { REVIEW_ARTIFACTS } = require("./stage-3-22-post-freeze-review");
const { PostFreezeReleaseTransition, PROFILE, RELEASE_PATHS, STATE } =
  require("./post_freeze/post_freeze_release_transition");
const { ARTIFACTS, INPUTS, HISTORICAL } = require("./post_freeze/post_freeze_paths");
const { sha256, serialize } = require("./post_freeze/post_freeze_workspace");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";

class Stage322ReleaseFinalizer {
  async run(root = PROJECT_ROOT) {
    assert(!fs.existsSync(path.join(root, ARTIFACTS.releaseClosure)), "Stage 3.22 release closure is immutable");
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    const reference = file => ({ path: file, sha256: sha256(read(file)) });
    const verified = new Stage322ReleaseCheck().run(root);
    await new Batch021ArchitectureCheck().run(root);
    const suites = ["quick", "architecture", "history"].map(suite => this.#suite(root, suite));
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run({ suites: false });
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    assert(fresh.steps.every(step => step.exitCode === 0));
    assert.equal(fresh.lockfileChanged, false);
    const diff = spawnSync(GIT, ["diff", "--check"], { cwd: root, encoding: "utf8" });
    assert.equal(diff.status, 0, `git diff --check failed:\n${diff.stdout}`);
    const baseline = json(ARTIFACTS.baseline);
    const transition = new PostFreezeReleaseTransition(root).artifact();
    const state = json(STATE);
    const acceptance = json(ARTIFACTS.acceptance);
    const closure = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-22-release-closure",
      stage: "3.22",
      status: "verified",
      releaseVersion: PROFILE.toRelease,
      previousReleaseVersion: PROFILE.fromRelease,
      codename: PROFILE.codename,
      completesBatch: false,
      runtimeMigrationAllowed: false,
      originalBaseline: {
        artifact: reference(ARTIFACTS.baseline),
        commit: baseline.commit,
        releaseVersion: baseline.releaseVersion,
        executionState: { path: baseline.executionState.path, sha256: baseline.executionState.sha256 },
        releaseFiles: transition.records.map(item => ({ path: item.path, sha256: item.beforeSha256 })),
      },
      continuationCheckpoint: {
        releaseVersion: state.releaseVersion,
        releaseFiles: RELEASE_PATHS.map(reference),
        releaseTransition: reference(ARTIFACTS.releaseTransition),
        acceptance: reference(ARTIFACTS.acceptance),
        reviewArtifacts: REVIEW_ARTIFACTS.map(reference),
      },
      finalCheckpoint: {
        activeBatchId: state.activeBatchId,
        activeBatchPhase: Object.hasOwn(state, "activeBatchPhase") ? state.activeBatchPhase : "absent",
        status: state.status,
        completedBatchIds: state.completedBatchIds,
        approvedPlan: reference(HISTORICAL.approvedPlan),
        compatibilityRuntimeActivated: state.compatibilityRuntimeActivated,
        topology: verified.topology,
        runtimeContract: reference(INPUTS.runtimeContract),
        bridgeRegistry: reference(INPUTS.bridgeRegistry),
        manifest: reference(INPUTS.manifest),
        transactionLeftovers: verified.transactionLeftovers,
      },
      acceptedResults: acceptance.automatedResults.suites,
      postRelease: {
        releaseCheck: "passed",
        stage322Replay: "byte-identical-at-original-checkpoint",
        batch021HistoricalReplay: "passed-at-v0.24.58-checkpoint",
        suites,
        freshInstall: { node: fresh.node, npm: fresh.npm, lockfileSha256: fresh.lockfileSha256,
          lockfileChanged: false, runtimeOutputCount: fresh.runtimeOutput.length,
          steps: fresh.steps.map(step => ({ id: step.id, exitCode: step.exitCode, durationMs: step.durationMs })) },
        diffCheck: { exitCode: 0 },
      },
      rollback: {
        mechanism: "exact-reversible-edits-with-before-images",
        transition: reference(ARTIFACTS.releaseTransition),
        rehearsal: transition.rollbackRehearsal,
        restores: "v0.24.58 release metadata; Stage 3.22 artifacts are additive and removable",
      },
      nextStage: "Stage 3.23.0 — Batch 022 Preflight from the Stage 3.22 Approved Prefix",
    };
    assert.equal(closure.finalCheckpoint.activeBatchId, null);
    assert.equal(closure.finalCheckpoint.activeBatchPhase, "absent");
    assert.equal(closure.finalCheckpoint.completedBatchIds.length, 21);
    const bytes = serialize(closure);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: ARTIFACTS.releaseClosure, bytes },
    ], () => assert.deepEqual(read(ARTIFACTS.releaseClosure), bytes));
    new Stage322ReleaseCheck().run(root);
    return closure;
  }

  #suite(root, suite) {
    const started = Date.now();
    const result = spawnSync(process.execPath, ["utils/run-checks.js", "--suite", suite],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    const summary = output.match(/Passed (\d+) checks in ([\d.]+)s\./u);
    if (result.status !== 0 || !summary) {
      console.error(output.split(/\r?\n/u).slice(-60).join("\n"));
      throw new Error(`Post-release ${suite} suite failed`);
    }
    const expected = CHECK_DEFINITIONS.filter(item => item.suites.includes(suite)).length;
    assert.equal(Number(summary[1]), expected, `Post-release ${suite} suite ran an incomplete catalog`);
    return { suite, passedChecks: expected, failedChecks: 0, durationMs: Date.now() - started };
  }
}

if (require.main === module) {
  new Stage322ReleaseFinalizer().run()
    .then(closure => console.log(`Stage 3.22 release closure verified: v${closure.releaseVersion}; ` +
      `${closure.postRelease.suites.map(item => `${item.suite} ${item.passedChecks}/${item.passedChecks}`).join(", ")}.`))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Stage322ReleaseFinalizer };
