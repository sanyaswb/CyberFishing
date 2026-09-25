"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { BATCH_020_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_020_preflight_profile");
const { PATHS } = require("./domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./domain_batches/stage_three_batch_020_planning");

const AUTOMATED = "architecture/migration/stage_3_batch_020_automated_acceptance.json";
const ACCEPTANCE = "architecture/migration/stage_3_batch_020_acceptance_pass.json";
const BROWSER = "architecture/migration/stage_3_batch_020_browser_confirmation.json";

const USER_BASIS = Object.freeze({
  performedBy: "user", smokeStatus: "passed-user-reported",
  evidenceType: "manual-test-summary-in-conversation",
  confirmationType: "user-confirmation-in-conversation",
  context: "Response to the Stage 3.20.8 Fishing checklist: casting, fish direction and response, rod control, pressure, fatigue and stamina during a catch.",
  acceptanceBasis: "User-reported PASS for the batch-specific checklist; individual steps were not independently instrumented.",
  gate: "passed-user-confirmation-with-explicit-zero-console-counts",
  consoleInstrumented: false,
});

class Batch020BrowserAcceptanceRecorder {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  // basis records who performed the smoke. The default is the historical user-performed manual
  // smoke; an owner-authorized automated substitute must quote the owner's authorization verbatim.
  run({ sessionStatement, consoleStatement, errors, warnings, basis = USER_BASIS }) {
    assert.equal(typeof sessionStatement, "string");
    assert.equal(typeof consoleStatement, "string");
    assert(sessionStatement.includes("PASS"), "Batch 020 browser smoke must be a recorded PASS");
    for (const field of ["performedBy", "smokeStatus", "evidenceType", "confirmationType", "context",
      "acceptanceBasis", "gate"]) assert.equal(typeof basis[field], "string", `basis.${field} is required`);
    assert.equal(typeof basis.consoleInstrumented, "boolean");
    if (basis.performedBy !== "user") {
      assert(typeof basis.ownerAuthorization === "string" && basis.ownerAuthorization.length > 0,
        "An automated substitute requires the owner's verbatim authorization");
    }
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
      "architecture/migration/stage_3_batch_020_live_runtime_validation.json",
      "architecture/migration/stage_3_batch_020_observation_reconciliation.json",
      PATHS.executionState, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.manifest, PATHS.index,
    ];
    const acceptance = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-020-acceptance",
      stage: "3.20.8", batchId: PROFILE.batchId,
      releaseVersion: state.releaseVersion,
      plannedReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      recordedAt, status: "accepted", acceptanceOutcome: "PASS",
      verdict: "eligible-for-release-closure", releaseClosureAllowed: true,
      completes: { path: AUTOMATED, sha256: sha(this.bytes(AUTOMATED)),
        previousStatus: automated.status, previousAttemptPreserved: true },
      automatedEvidence: automated.suites,
      browserSmoke: {
        status: basis.smokeStatus, performedBy: basis.performedBy,
        evidenceType: basis.evidenceType,
        userStatement: sessionStatement,
        context: basis.context,
        acceptanceBasis: basis.acceptanceBasis,
        ...(basis.ownerAuthorization ? { ownerAuthorization: basis.ownerAuthorization } : {}),
        perCheckResults: basis.perCheckResults || null,
        consoleCounts: { errors, warnings, userStatement: consoleStatement },
      },
      protectedEvidence: protectedPaths.map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      lifecycle: {
        batchCompleted: false, activeBatchId: state.activeBatchId,
        activeBatchPhase: state.activeBatchPhase,
        releaseMetadataChanged: false, runtimeChanged: false,
      },
      nextStage: "Stage 3.20.9 — Release Closure v0.24.57",
    };
    const acceptanceBytes = serialize(acceptance);
    const browser = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-020-browser-confirmation",
      batchId: PROFILE.batchId, releaseVersion: state.releaseVersion,
      status: "passed", performedBy: basis.performedBy, recordedAt,
      evidenceType: basis.confirmationType, gate: basis.gate,
      browserSummary: {
        userStatement: sessionStatement,
        context: basis.context,
        individualResultsProvided: Boolean(basis.perCheckResults),
        independentlyInstrumented: basis.consoleInstrumented,
      },
      console: { errors, warnings, userStatement: consoleStatement,
        independentlyInstrumented: basis.consoleInstrumented },
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

module.exports = { Batch020BrowserAcceptanceRecorder, USER_BASIS, AUTOMATED, ACCEPTANCE, BROWSER };
