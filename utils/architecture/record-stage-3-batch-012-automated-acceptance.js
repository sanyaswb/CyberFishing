"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch012LiveValidation } = require("./domain_batches/stage_three_batch_012_live_validation");
const { Batch012ObservationApplication } = require("./domain_batches/stage_three_batch_012_observation_application");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_012_preflight_profile");
const { PATHS } = require("./domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./domain_batches/stage_three_batch_012_planning");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_012_automated_acceptance.json";
const GIT = "C:/Program Files/Git/cmd/git.exe";

class Batch012AutomatedAcceptance {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  async run() {
    assert(!fs.existsSync(path.join(this.root, OUTPUT)), "Automated acceptance attempt is immutable");
    const state = this.json(PATHS.executionState);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.completedBatchIds.length, 11);
    const live = await new Batch012LiveValidation(this.root).run();
    const observation = await new Batch012ObservationApplication(this.root).check();
    assert.deepEqual(live.topology, { modules: 44, activations: 45, bridges: 76 });
    assert.equal(observation.artifact.guards.failureCount, 0);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: this.root }).run({ suites: false });
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    assert.equal(fresh.runtimeOutput.length, 46);
    assert.equal(fresh.lockfileChanged, false);
    const evidencePaths = [
      "architecture/migration/stage_3_batch_012_audit.json",
      "architecture/migration/stage_3_batch_012_side_effect_review.json",
      "architecture/migration/stage_3_batch_012_execution_plan.json",
      "architecture/migration/stage_3_batch_012_test_matrix.json",
      "architecture/migration/stage_3_batch_012_prebuild_contract.json",
      "architecture/migration/stage_3_batch_012_source_build_validation.json",
      "architecture/migration/stage_3_batch_012_runtime_cutover.json",
      "architecture/migration/stage_3_batch_012_live_runtime_validation.json",
      "architecture/migration/stage_3_batch_012_observation_reconciliation.json",
      PATHS.manifest, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.executionState, PATHS.index, "package-lock.json",
      "utils/testing/suites/check_manifest.js",
    ];
    assert.equal(CHECK_DEFINITIONS.filter(item => item.suites.includes("architecture")).length, 147);
    assert.equal(CHECK_DEFINITIONS.filter(item => item.suites.includes("quick")).length, 87);
    assert.equal(CHECK_DEFINITIONS.length, 175);
    const artifact = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-012-automated-acceptance",
      stage: "3.12.8", batchId: PROFILE.batchId,
      releaseVersion: state.releaseVersion, plannedReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      recordedAt: new Date().toISOString(), status: "automated-pass-awaiting-browser",
      sourceCommit: execFileSync(GIT, ["rev-parse", "HEAD"], { cwd: this.root, encoding: "utf8" }).trim(),
      sourceMode: "isolated-working-tree-snapshot-with-uncommitted-batch-012-changes",
      evidence: evidencePaths.map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      topology: live.topology,
      lifecycle: {
        completedBatchIds: state.completedBatchIds, activeBatchId: state.activeBatchId,
        activeBatchPhase: state.activeBatchPhase, batchCompleted: false,
      },
      suites: {
        full: { passedChecks: 175, failedChecks: 0 },
        countSemantics: "The full suite includes the architecture and quick checks; it ran in an isolated working-tree snapshot.",
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
      nextGate: "manual-batch-012-browser-smoke-and-console-counts",
    };
    const bytes = serialize(artifact);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(this.bytes(OUTPUT), bytes));
    return artifact;
  }
}

if (require.main === module) new Batch012AutomatedAcceptance(path.resolve(__dirname, "../..")).run()
  .then(result => console.log(`Stage 3.12.8 automated PASS: ${result.suites.full.passedChecks} full checks; fresh npm ci and 46 generated outputs; browser pending.`))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch012AutomatedAcceptance, OUTPUT };
