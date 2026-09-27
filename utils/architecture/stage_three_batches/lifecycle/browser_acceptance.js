"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { PATHS } = require("../../domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./planning");

// The default basis: the owner played the batch-specific checklist and reported console counts.
const userBasis = definition => Object.freeze({
  performedBy: "user", smokeStatus: "passed-user-reported",
  evidenceType: "manual-test-summary-in-conversation",
  confirmationType: "user-confirmation-in-conversation",
  context: definition.release.smokeContext,
  acceptanceBasis: "User-reported PASS for the batch-specific checklist; individual steps were not independently instrumented.",
  gate: "passed-user-confirmation-with-explicit-zero-console-counts",
  consoleInstrumented: false,
});

class StageThreeBrowserAcceptanceRecorder {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
  }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  // basis records who performed the smoke. The default is the historical user-performed manual
  // smoke; an owner-authorized automated substitute must quote the owner's authorization verbatim.
  run({ sessionStatement, consoleStatement, errors, warnings, basis = userBasis(this.definition) }) {
    const PROFILE = this.definition.profile;
    const context = this.definition.context;
    const { automatedAcceptance: AUTOMATED, acceptance: ACCEPTANCE, browser: BROWSER } = context.paths;
    assert.equal(typeof sessionStatement, "string");
    assert.equal(typeof consoleStatement, "string");
    assert(sessionStatement.includes("PASS"), "Browser smoke must be a recorded PASS");
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
      context.paths.live,
      context.paths.observation,
      PATHS.executionState, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.manifest, PATHS.index,
    ];
    const acceptance = {
      schemaVersion: 1, kind: context.kind("acceptance"),
      stage: context.step(8), batchId: PROFILE.batchId,
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
      nextStage: `${context.label(9)} — Release Closure v${context.toRelease}`,
    };
    const acceptanceBytes = serialize(acceptance);
    const browser = {
      schemaVersion: 1, kind: context.kind("browser-confirmation"),
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

module.exports = { StageThreeBrowserAcceptanceRecorder, userBasis };
