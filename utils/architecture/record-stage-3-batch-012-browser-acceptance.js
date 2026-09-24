"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_012_preflight_profile");
const { PATHS } = require("./domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./domain_batches/stage_three_batch_012_planning");

const AUTOMATED = "architecture/migration/stage_3_batch_012_automated_acceptance.json";
const ACCEPTANCE = "architecture/migration/stage_3_batch_012_acceptance_pass.json";
const BROWSER = "architecture/migration/stage_3_batch_012_browser_confirmation.json";

class Batch012BrowserAcceptanceRecorder {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  run({ sessionStatement, consoleStatement, errors, warnings }) {
    assert.equal(typeof sessionStatement, "string");
    assert.equal(typeof consoleStatement, "string");
    assert(sessionStatement.includes("PASS"), "Manual batch 012 browser smoke must be a user-reported PASS");
    assert.equal(errors, 0, "Console errors block release closure");
    assert.equal(warnings, 0, "Console warnings block release closure");
    assert(!fs.existsSync(path.join(this.root, ACCEPTANCE)));
    assert(!fs.existsSync(path.join(this.root, BROWSER)));
    const automated = this.json(AUTOMATED);
    const state = this.json(PATHS.executionState);
    assert.equal(automated.status, "automated-pass-awaiting-browser");
    assert.equal(automated.batchId, PROFILE.batchId);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    for (const evidence of automated.evidence) {
      assert.equal(sha(this.bytes(evidence.path)), evidence.sha256,
        `Automated acceptance input drift: ${evidence.path}`);
    }
    const recordedAt = new Date().toISOString();
    const protectedPaths = [
      "architecture/migration/stage_3_batch_012_live_runtime_validation.json",
      "architecture/migration/stage_3_batch_012_observation_reconciliation.json",
      PATHS.executionState, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.manifest, PATHS.index,
    ];
    const acceptance = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-012-acceptance",
      stage: "3.12.8", batchId: PROFILE.batchId,
      releaseVersion: state.releaseVersion,
      plannedReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      recordedAt, status: "accepted", acceptanceOutcome: "PASS",
      verdict: "eligible-for-release-closure", releaseClosureAllowed: true,
      completes: { path: AUTOMATED, sha256: sha(this.bytes(AUTOMATED)),
        previousStatus: automated.status, previousAttemptPreserved: true },
      automatedEvidence: automated.suites,
      browserSmoke: {
        status: "passed-user-reported", performedBy: "user",
        evidenceType: "manual-test-summary-in-conversation",
        userStatement: sessionStatement,
        context: "Response to the Stage 3.12.8 Assemblies checklist: attachment target selection, occupied and capacity slots, assembly completion, equipment and gameplay continuation.",
        acceptanceBasis: "User-reported PASS for the batch-specific checklist; individual steps were not independently instrumented.",
        perCheckResults: null,
        consoleCounts: { errors, warnings, userStatement: consoleStatement },
      },
      protectedEvidence: protectedPaths.map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      lifecycle: {
        batchCompleted: false, activeBatchId: state.activeBatchId,
        activeBatchPhase: state.activeBatchPhase,
        releaseMetadataChanged: false, runtimeChanged: false,
      },
      nextStage: "Stage 3.12.9 — Release Closure v0.24.49",
    };
    const acceptanceBytes = serialize(acceptance);
    const browser = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-012-browser-confirmation",
      batchId: PROFILE.batchId, releaseVersion: state.releaseVersion,
      status: "passed", performedBy: "user", recordedAt,
      evidenceType: "user-confirmation-in-conversation",
      browserSummary: {
        userStatement: sessionStatement,
        context: "User-reported PASS for the Stage 3.12.8 Assemblies checklist.",
        individualResultsProvided: false, independentlyInstrumented: false,
      },
      console: { errors, warnings, userStatement: consoleStatement,
        independentlyInstrumented: false },
      supplements: { path: ACCEPTANCE, sha256: sha(acceptanceBytes) },
      historicalSummaryPreserved: true,
    };
    const browserBytes = serialize(browser);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: ACCEPTANCE, bytes: acceptanceBytes },
      { relativePath: BROWSER, bytes: browserBytes },
    ], () => {
      assert.deepEqual(this.bytes(ACCEPTANCE), acceptanceBytes);
      assert.deepEqual(this.bytes(BROWSER), browserBytes);
    });
    return { acceptance, browser };
  }
}

module.exports = { Batch012BrowserAcceptanceRecorder, AUTOMATED, ACCEPTANCE, BROWSER };
