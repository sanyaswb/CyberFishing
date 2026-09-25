"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch020LiveValidation } = require("./domain_batches/stage_three_batch_020_live_validation");
const { Batch020ObservationApplication } = require("./domain_batches/stage_three_batch_020_observation_application");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { BATCH_020_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_020_preflight_profile");
const { PATHS } = require("./domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./domain_batches/stage_three_batch_020_planning");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_020_automated_acceptance.json";
const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";

class Batch020AutomatedAcceptance {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  // suiteEvidence: { full: { passedChecks, failedChecks, platform, source }, supplementary?, summary }.
  // The full-suite result must be a real run of the complete CHECK_DEFINITIONS catalog.
  async run({ suiteEvidence } = {}) {
    assert(!fs.existsSync(path.join(this.root, OUTPUT)), "Automated acceptance attempt is immutable");
    const state = this.json(PATHS.executionState);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.completedBatchIds.length, 19);
    const live = await new Batch020LiveValidation(this.root).run();
    const observation = await new Batch020ObservationApplication(this.root).check();
    assert.deepEqual(live.topology, { modules: 76, activations: 81, bridges: 135 });
    assert.equal(observation.artifact.guards.failureCount, 0);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: this.root }).run({ suites: false });
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    assert.equal(fresh.runtimeOutput.length, 82);
    assert.equal(fresh.lockfileChanged, false);
    const evidencePaths = [
      "architecture/migration/stage_3_batch_020_audit.json",
      "architecture/migration/stage_3_batch_020_side_effect_review.json",
      "architecture/migration/stage_3_batch_020_execution_plan.json",
      "architecture/migration/stage_3_batch_020_test_matrix.json",
      "architecture/migration/stage_3_batch_020_prebuild_contract.json",
      "architecture/migration/stage_3_batch_020_source_build_validation.json",
      "architecture/migration/stage_3_batch_020_runtime_cutover.json",
      "architecture/migration/stage_3_batch_020_live_runtime_validation.json",
      "architecture/migration/stage_3_batch_020_observation_reconciliation.json",
      PATHS.manifest, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.executionState, PATHS.index, "package-lock.json",
      "utils/testing/suites/check_manifest.js",
    ];
    assert.equal(CHECK_DEFINITIONS.filter(item => item.suites.includes("architecture")).length, 65);
    assert.equal(CHECK_DEFINITIONS.filter(item => item.suites.includes("quick")).length, 41);
    assert.equal(CHECK_DEFINITIONS.length, 183);
    assert.deepEqual([suiteEvidence?.full?.passedChecks, suiteEvidence?.full?.failedChecks],
      [CHECK_DEFINITIONS.length, 0], "Automated acceptance requires a complete passing Full suite");
    assert.equal(typeof suiteEvidence.full.platform, "string");
    assert.equal(typeof suiteEvidence.full.source, "string");
    assert.equal(typeof suiteEvidence.summary, "string");
    const artifact = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-020-automated-acceptance",
      stage: "3.20.8", batchId: PROFILE.batchId,
      releaseVersion: state.releaseVersion, plannedReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      recordedAt: new Date().toISOString(), status: "automated-pass-awaiting-browser",
      sourceCommit: execFileSync(GIT, ["rev-parse", "HEAD"], { cwd: this.root, encoding: "utf8" }).trim(),
      sourceMode: "working-tree-with-uncommitted-batch-020-changes",
      evidence: evidencePaths.map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      topology: live.topology,
      lifecycle: {
        completedBatchIds: state.completedBatchIds, activeBatchId: state.activeBatchId,
        activeBatchPhase: state.activeBatchPhase, batchCompleted: false,
      },
      suites: {
        full: { passedChecks: suiteEvidence.full.passedChecks, failedChecks: suiteEvidence.full.failedChecks },
        fullRun: { platform: suiteEvidence.full.platform, source: suiteEvidence.full.source },
        ...(suiteEvidence.supplementary ? { supplementary: suiteEvidence.supplementary } : {}),
        summary: suiteEvidence.summary,
        countSemantics: "The full suite includes the architecture and quick checks.",
      },
      freshInstall: {
        status: fresh.status, node: fresh.node, npm: fresh.npm,
        lockfileSha256: fresh.lockfileSha256, lockfileChanged: fresh.lockfileChanged,
        sourceBytesUnchanged: fresh.sourceCopy.sourceBytesUnchanged,
        temporaryWorkspaceRemoved: fresh.temporaryWorkspaceRemoved,
        generatedOutputCopied: fresh.generatedOutputCopied,
        runtimeOutput: fresh.runtimeOutput,
        steps: fresh.steps.map(step => ({ id: step.id, exitCode: step.exitCode })),
      },
      browserSmoke: { status: "pending-user-verification" },
      releaseClosureAllowed: false,
      nextGate: "manual-batch-020-browser-smoke-and-console-counts",
    };
    const bytes = serialize(artifact);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(this.bytes(OUTPUT), bytes));
    return artifact;
  }
}

if (require.main === module) new Batch020AutomatedAcceptance(path.resolve(__dirname, "../..")).run({
  suiteEvidence: JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf("--suite-evidence") + 1], "utf8")),
})
  .then(result => console.log(`Stage 3.20.8 automated PASS: ${result.suites.full.passedChecks} full checks; fresh npm ci and 82 generated outputs; browser pending.`))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch020AutomatedAcceptance, OUTPUT };
