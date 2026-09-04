"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ACCEPTED_PATH = "architecture/migration/stage_3_batch_007_acceptance_pass.json";
const BATCH_ID = "stage-3.candidate-007-fishing-bb8b3939";

class StageThreeBatch007AcceptanceCheck {
  run() {
    const accepted = this.#json(ACCEPTED_PATH);
    const failed = this.#json(accepted.supersedes.path);
    const hydration = this.#json(accepted.hydrationRepair.path);
    const state = this.#json("architecture/migration/stage_3_execution_state.json");

    this.#verifyContract(accepted);
    this.#verifySupersededAttempt(accepted, failed);
    this.#verifyHydrationRepair(accepted, hydration);
    this.#verifyFreshAcceptance(accepted);
    this.#verifyBrowserEvidence(accepted.browserSmoke);
    this.#verifyLifecycle(state);

    console.log(
      "Stage 3.7.8 acceptance passed: prior FAIL remains immutable, hydration repair " +
        "and real reel/retrieve recovery are verified, fresh Architecture/Quick/Full are green; " +
        "batch 007 is eligible for release closure.",
    );
  }

  #verifyContract(record) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.kind, "cyber-fishing-stage-3-batch-007-acceptance");
    assert.equal(record.stage, "3.7.8");
    assert.equal(record.batchId, BATCH_ID);
    assert.equal(record.releaseVersion, "0.24.43");
    assert.equal(record.status, "verified");
    assert.equal(record.acceptanceOutcome, "PASS");
    assert.equal(record.verdict, "eligible-for-release-closure");
    assert.equal(record.releaseClosureAllowed, true);
    assert.match(record.sourceCommit, /^[a-f0-9]{40}$/u);
    assert.equal(record.sourceRepositoryClean, true);
    assert.equal(record.nextStage, "Stage 3.7.9 — Release Closure v0.24.44");
    assert.deepEqual(record.runtimeTopology, {
      projectModules: 31,
      activations: 32,
      bridgeRecords: 57,
      physicalClassicScripts: 426,
      logicalLegacyPositions: 424,
      moduleScripts: 0,
      cumulativeRuntimes: 1,
      isolatedIifeScripts: 0,
      bundleSha256: "2bb747e4c4bbd2b3c45bf65563e64a10ec5617319c9cbda7d2c13486a5bb95d0",
    });
    assert(Object.values(record.protectedInvariants).every((value) => value === false));
  }

  #verifySupersededAttempt(accepted, failed) {
    assert.equal(this.#sha256(accepted.supersedes.path), accepted.supersedes.sha256);
    assert.equal(
      this.#sha256(accepted.supersedes.immutableCapture.path),
      accepted.supersedes.immutableCapture.sha256,
    );
    assert.equal(failed.acceptanceOutcome, "FAIL");
    assert.equal(failed.verdict, "not-eligible-for-release-closure");
    assert.equal(failed.releaseClosureAllowed, false);
    assert.equal(accepted.supersedes.acceptanceOutcome, "FAIL");
  }

  #verifyHydrationRepair(accepted, hydration) {
    assert.equal(this.#sha256(accepted.hydrationRepair.path), accepted.hydrationRepair.sha256);
    assert.equal(hydration.status, "verified");
    assert.equal(hydration.rootCause.classification, "raw-assembly-child-hydration-bypass");
    assert.equal(hydration.repair.downstreamFallbacksAdded, false);
    assert.equal(hydration.invariants.stage3TopologyChanged, false);
    assert.equal(hydration.acceptance.browserPositiveRetrieve.status, "passed");
    assert.equal(hydration.acceptance.browserPositiveRetrieve.manualCapture.verdict, "PASS");
    assert.equal(hydration.acceptance.stage3_7_8Accepted, true);
    assert.equal(hydration.acceptance.stage3_7_9ReleaseClosureAllowed, true);
  }

  #verifyFreshAcceptance(record) {
    assert.equal(record.freshInstall.status, "passed");
    assert.equal(record.freshInstall.exitCode, 0);
    assert.equal(record.freshInstall.lockfileChanged, false);
    assert.equal(record.freshInstall.dependencyUpdates, false);
    for (const name of ["architecture", "quick", "full"]) {
      assert.equal(record.suites[name].status, "passed");
      assert.equal(record.suites[name].failedChecks, 0);
      assert(Number.isInteger(record.suites[name].passedChecks));
      assert(record.suites[name].passedChecks > 0);
      assert.match(record.suites[name].logSha256, /^[a-f0-9]{64}$/u);
    }
  }

  #verifyBrowserEvidence(browser) {
    assert.equal(browser.status, "passed");
    assert.equal(browser.performedBy, "user");
    assert.equal(browser.before.available, true);
    assert.equal(browser.after.available, true);
    assert.equal(browser.before.hasReel, true);
    assert.equal(browser.after.hasReel, true);
    assert(browser.before.lineTotalMeters > 0);
    assert.equal(browser.after.lineTotalMeters, browser.before.lineTotalMeters);
    assert(browser.before.lineReleasedMeters > browser.after.lineReleasedMeters);
    assert(browser.before.rodStrokeWonMeters > browser.after.rodStrokeWonMeters);
    assert(browser.after.autoRecoveredMeters > 0 || browser.after.holdRecoveredMeters > 0);
    assert.notEqual(browser.after.autoRecoverBlockedReason, "stroke_line_desync");
    assert.equal(browser.recoveryEvidence.frameRecovery, true);
    assert.equal(browser.recoveryEvidence.lineReleasedMetersReduced, true);
    assert.equal(browser.recoveryEvidence.rodStrokeWonMetersReduced, true);
    assert.equal(browser.recoveryEvidence.strokeLineDesync, false);
    assert.equal(browser.console.errors, 0);
    assert.equal(browser.console.warnings, 0);
    assert.equal(browser.blockerClassification, "none");
    assert.equal(browser.verdict, "PASS");
  }

  #verifyLifecycle(state) {
    assert.equal(state.compatibilityRuntimeActivated, true);
    const completedIndex = state.completedBatchIds.indexOf(BATCH_ID);
    if (completedIndex !== -1) {
      assert.equal(completedIndex, 6, "batch 007 must remain the seventh completed batch");
      return;
    }
    assert.equal(state.activeBatchId, BATCH_ID);
    assert.equal(state.activeBatchPhase, "runtime-active");
  }

  #json(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"));
  }

  #sha256(relativePath) {
    return crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(PROJECT_ROOT, relativePath)))
      .digest("hex");
  }
}

new StageThreeBatch007AcceptanceCheck().run();
