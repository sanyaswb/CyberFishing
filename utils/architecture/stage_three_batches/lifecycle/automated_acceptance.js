"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("../../verify-fresh-package-install");
const { StageThreeBatchLiveValidation } = require("./live_validation");
const { StageThreeBatchObservationApplication } = require("./observation_application");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { PATHS } = require("../../domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./planning");
const { CHECK_DEFINITIONS } = require("../../../testing/suites/check_manifest");
const { applyCheckPolicies } = require("../../../testing/suites/check_policies");
const { CheckCatalog } = require("../../../testing/core/check_catalog");
const { AcceptanceReportValidator } = require("../../../testing/core/check_report");

const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";

// Stage 3.N.8: live and observation replay, fresh npm ci/build and a complete passing Full suite.
class StageThreeAutomatedAcceptance {
  constructor(root, definition, registry) {
    this.root = path.resolve(root);
    this.definition = definition;
    this.registry = registry;
  }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  // The full-suite result is the runner's own report of the complete catalog (--acceptance or
  // --release-gate), validated against the current tree before anything is recorded. The manually
  // composed suiteEvidence ({ full: { passedChecks, failedChecks, platform, source }, supplementary?,
  // summary }) is the legacy path of batches up to 038 and needs legacySuiteEvidence: true.
  static reportEvidence(root, checkReport) {
    const catalog = new CheckCatalog(applyCheckPolicies(CHECK_DEFINITIONS)).list();
    new AcceptanceReportValidator({ projectRoot: root, catalog })
      .assertValid(checkReport.report, { modes: ["acceptance", "release-gate"] });
    const { report } = checkReport;
    return {
      full: { passedChecks: report.totals.passed + report.totals.cached, failedChecks: report.totals.failed,
        platform: `${report.environment.platform}-${report.environment.arch} node ${report.environment.node}`,
        source: `check run report ${report.runId}` },
      summary: `${report.mode}: ${report.totals.executed} executed, ${report.totals.cached} reused history replays, ` +
        `${report.totals.failed} failed; source unchanged during the run`,
      report: { kind: report.kind, schemaVersion: report.schemaVersion, runId: report.runId, mode: report.mode,
        sha256: sha(checkReport.bytes), executed: report.totals.executed, cached: report.totals.cached,
        catalogSha256: report.catalog.sha256, sourceSha256: report.source.before, sourceCommit: report.source.commit },
    };
  }

  async run({ checkReport = null, suiteEvidence: legacyEvidence = null, legacySuiteEvidence = false } = {}) {
    assert(checkReport || (legacyEvidence && legacySuiteEvidence),
      "Automated acceptance requires the runner report (checkReport: { bytes, report })");
    const suiteEvidence = checkReport ? StageThreeAutomatedAcceptance.reportEvidence(this.root, checkReport) : legacyEvidence;
    const PROFILE = this.definition.profile;
    const context = this.definition.context;
    const topology = PROFILE.executionProfile.expectedTopology;
    const OUTPUT = context.paths.automatedAcceptance;
    assert(!fs.existsSync(path.join(this.root, OUTPUT)), "Automated acceptance attempt is immutable");
    const state = this.json(PATHS.executionState);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.completedBatchIds.length, context.completedBefore);
    const live = await new StageThreeBatchLiveValidation(this.root, this.definition, this.registry).run();
    const observation = await new StageThreeBatchObservationApplication(this.root, this.definition, this.registry).check();
    assert.deepEqual(live.topology, { modules: topology.afterProjectModuleCount,
      activations: topology.afterActivationCount, bridges: topology.afterBridgeCount });
    assert.equal(observation.artifact.guards.failureCount, 0);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: this.root }).run({ suites: false });
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    assert.equal(fresh.runtimeOutput.length, topology.afterActivationCount + 1);
    assert.equal(fresh.lockfileChanged, false);
    const evidencePaths = [
      context.paths.audit, context.paths.sideEffectReview, context.paths.executionPlan, context.paths.testMatrix,
      context.paths.prebuild, context.paths.sourceBuild, context.paths.cutover, context.paths.live,
      context.paths.observation,
      PATHS.manifest, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.executionState, PATHS.index, "package-lock.json",
      "utils/testing/suites/check_manifest.js",
    ];
    assert.deepEqual([suiteEvidence?.full?.passedChecks, suiteEvidence?.full?.failedChecks],
      [CHECK_DEFINITIONS.length, 0], "Automated acceptance requires a complete passing Full suite");
    assert.equal(typeof suiteEvidence.full.platform, "string");
    assert.equal(typeof suiteEvidence.full.source, "string");
    assert.equal(typeof suiteEvidence.summary, "string");
    const artifact = {
      schemaVersion: 1, kind: context.kind("automated-acceptance"),
      stage: context.step(8), batchId: PROFILE.batchId,
      releaseVersion: state.releaseVersion, plannedReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      recordedAt: new Date().toISOString(), status: "automated-pass-awaiting-browser",
      sourceCommit: execFileSync(GIT, ["rev-parse", "HEAD"], { cwd: this.root, encoding: "utf8" }).trim(),
      sourceMode: `working-tree-with-uncommitted-batch-${context.number}-changes`,
      evidence: evidencePaths.map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      topology: live.topology,
      lifecycle: {
        completedBatchIds: state.completedBatchIds, activeBatchId: state.activeBatchId,
        activeBatchPhase: state.activeBatchPhase, batchCompleted: false,
      },
      suites: {
        full: { passedChecks: suiteEvidence.full.passedChecks, failedChecks: suiteEvidence.full.failedChecks },
        fullRun: { platform: suiteEvidence.full.platform, source: suiteEvidence.full.source,
          ...(suiteEvidence.report ? { report: suiteEvidence.report } : {}) },
        ...(suiteEvidence.supplementary ? { supplementary: suiteEvidence.supplementary } : {}),
        summary: suiteEvidence.summary,
        countSemantics: "The full suite includes the architecture and quick checks.",
        catalog: { full: CHECK_DEFINITIONS.length,
          architecture: CHECK_DEFINITIONS.filter(item => item.suites.includes("architecture")).length,
          quick: CHECK_DEFINITIONS.filter(item => item.suites.includes("quick")).length },
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
      nextGate: `manual-batch-${context.number}-browser-smoke-and-console-counts`,
    };
    const bytes = serialize(artifact);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(this.bytes(OUTPUT), bytes));
    return artifact;
  }
}

module.exports = { StageThreeAutomatedAcceptance };
