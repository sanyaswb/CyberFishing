"use strict";

// Records the Stage 3.22 acceptance after the Architecture → Quick → Full runs:
//   node utils/architecture/record-stage-3-22-acceptance.js --suite-evidence <json>
// json = { architecture: { passedChecks, failedChecks }, quick: { … },
//          full: { passedChecks, failedChecks, platform, source }, summary }
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");
const { Stage322PostFreezeReviewCheck } = require("./stage-3-22-post-freeze-review-check");
const { REVIEW_ARTIFACTS } = require("./stage-3-22-post-freeze-review");
const { ARTIFACTS, INPUTS, HISTORICAL } = require("./post_freeze/post_freeze_paths");
const { sha256, serialize } = require("./post_freeze/post_freeze_workspace");

const GIT = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
const PROJECT_ROOT = path.resolve(__dirname, "../..");

class Stage322Acceptance {
  constructor(root = PROJECT_ROOT) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }
  git(args) {
    const result = spawnSync(GIT, args, { cwd: this.root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return { args, exitCode: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
  }

  run({ suiteEvidence }) {
    assert(!fs.existsSync(path.join(this.root, ARTIFACTS.acceptance)), "Stage 3.22 acceptance is immutable");
    assert(!fs.existsSync(path.join(this.root, ARTIFACTS.releaseTransition)), "Stage 3.22 is already released");
    const suites = this.#suites(suiteEvidence);
    const focused = new Stage322PostFreezeReviewCheck().run(this.root);
    const baseline = this.json(ARTIFACTS.baseline);
    const commitVerification = this.#commitVerification(baseline);
    const approved = this.json(ARTIFACTS.approvedPrefix);
    const candidates = this.json(ARTIFACTS.candidateBatches);
    const review = this.json(ARTIFACTS.reviewEvidence);
    const backlog = this.json(ARTIFACTS.prerequisiteBacklog);
    const graph = this.json(ARTIFACTS.graphReview);
    const audit = this.json(ARTIFACTS.domainAudit);
    const topology = this.#topology(baseline);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: this.root }).run({ suites: false });
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    assert(fresh.steps.every(step => step.exitCode === 0));
    assert.equal(fresh.lockfileChanged, false);
    assert.deepEqual(fresh.runtimeOutput, baseline.runtimeOutput.files.map(item => ({ path: item.path, sha256: item.sha256 })),
      "Fresh build output differs from the recorded compatibility runtime output");
    const whitespace = this.#whitespace();
    const artifact = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-22-acceptance",
      stage: "3.22",
      status: "accepted",
      recordedAt: new Date().toISOString(),
      releaseVersion: baseline.releaseVersion,
      plannedReleaseVersion: "0.24.59",
      baseline: { path: ARTIFACTS.baseline, sha256: sha256(this.bytes(ARTIFACTS.baseline)), commit: baseline.commit,
        commitVerification },
      artifacts: REVIEW_ARTIFACTS.map(file => ({ path: file, sha256: sha256(this.bytes(file)) })),
      coverage: {
        observationDrift: audit.observation.driftCount,
        domainModules: approved.summary.domainModuleCount,
        completed: approved.coverage.completed.length,
        frozen: approved.coverage.frozen.length,
        requiresEvidence: approved.coverage.requiresEvidence.length,
        prerequisiteBlocked: approved.coverage.prerequisiteBlocked.length,
        deferred: approved.coverage.deferred.length,
        unassigned: approved.coverage.unassigned.length,
        reassessment: graph.reassessment.summary,
        candidateBatches: candidates.summary.candidateBatchCount,
        backlogTasks: backlog.summary.taskCount,
      },
      freezeDecisions: review.batchDecisions.map(item => ({ batchId: item.batchId, decision: item.decision,
        reasons: item.reasons, evidenceTaskIds: item.evidenceTaskIds })),
      freezeBoundary: approved.freezeBoundary,
      topologyVerification: topology,
      historicalEvidence: { status: "unchanged", files: baseline.historicalArtifacts },
      automatedResults: {
        focused: { check: "stage-3-22-post-freeze-review", status: "passed", negativeFixtures: focused.fixtures,
          replay: "byte-identical", orderIndependence: "passed", staleFingerprintDetection: "passed" },
        suites,
        freshInstall: { status: fresh.status, node: fresh.node, npm: fresh.npm,
          lockfileSha256: fresh.lockfileSha256, lockfileChanged: fresh.lockfileChanged,
          sourceBytesUnchanged: fresh.sourceCopy.sourceBytesUnchanged,
          temporaryWorkspaceRemoved: fresh.temporaryWorkspaceRemoved,
          steps: fresh.steps.map(step => ({ id: step.id, exitCode: step.exitCode, durationMs: step.durationMs })),
          runtimeOutputCount: fresh.runtimeOutput.length, runtimeOutputByteIdentical: true },
        diffCheck: whitespace,
      },
      browserSmoke: { required: false, performed: false, syntheticConfirmation: "none",
        reason: "Stage 3.22 changes no runtime source, build output or gameplay behavior." },
      releaseClosureAllowed: true,
    };
    const bytes = serialize(artifact);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: ARTIFACTS.acceptance, bytes },
    ], () => assert.deepEqual(this.bytes(ARTIFACTS.acceptance), bytes));
    return artifact;
  }

  #suites(evidence) {
    const count = suite => CHECK_DEFINITIONS.filter(item => item.suites.includes(suite)).length;
    const expected = { architecture: count("architecture"), quick: count("quick"), full: CHECK_DEFINITIONS.length };
    for (const [suite, total] of Object.entries(expected)) {
      assert.deepEqual([evidence?.[suite]?.passedChecks, evidence?.[suite]?.failedChecks], [total, 0],
        `Acceptance requires a complete passing ${suite} suite (${total} checks)`);
    }
    assert.equal(typeof evidence.full.platform, "string");
    assert.equal(typeof evidence.full.source, "string");
    assert.equal(typeof evidence.summary, "string");
    return {
      architecture: { passedChecks: expected.architecture, failedChecks: 0 },
      quick: { passedChecks: expected.quick, failedChecks: 0 },
      full: { passedChecks: expected.full, failedChecks: 0, platform: evidence.full.platform,
        source: evidence.full.source },
      order: ["architecture", "quick", "full"],
      summary: evidence.summary,
      countSemantics: "The full suite includes the architecture, quick and history checks.",
    };
  }

  // Every recorded input, historical artifact and source file must equal the baseline commit.
  #commitVerification(baseline) {
    const scope = ["src", ...Object.values(INPUTS), ...Object.values(HISTORICAL)];
    const diff = this.git(["diff", "--quiet", baseline.commit, "--", ...scope]);
    assert.equal(diff.exitCode, 0, "Baseline inputs differ from the recorded commit");
    const untracked = this.git(["status", "--porcelain", "--untracked-files=all", "--", "src"]);
    assert.equal(untracked.exitCode, 0);
    assert.equal(untracked.stdout.trim(), "", "Untracked source files would bypass the baseline commit");
    return { command: `git diff --quiet ${baseline.commit} -- src <inputs> <historical>`, exitCode: 0,
      scopePaths: scope.length, untrackedSourceFiles: 0 };
  }

  #topology(baseline) {
    const runtime = this.json(INPUTS.runtimeContract);
    const registry = this.json(INPUTS.bridgeRegistry);
    const topology = { modules: new Set(runtime.activationPositions.map(item => item.targetModule)).size,
      activations: runtime.activationPositions.length, bridges: registry.bridges.length };
    assert.deepEqual(topology, baseline.topology);
    const recorded = new Map(baseline.inputs.map(item => [item.path, item.sha256]));
    for (const file of [INPUTS.runtimeContract, INPUTS.bridgeRegistry, INPUTS.manifest]) {
      assert.equal(sha256(this.bytes(file)), recorded.get(file), `Runtime metadata changed: ${file}`);
    }
    return { ...topology, runtimeContractUnchanged: true, bridgeRegistryUnchanged: true, manifestUnchanged: true,
      runtimeOutputUnchanged: true };
  }

  // git diff --check covers tracked changes; new files get the same whitespace rules here.
  #whitespace() {
    const tracked = this.git(["diff", "--check"]);
    assert.equal(tracked.exitCode, 0, `git diff --check failed:\n${tracked.stdout}`);
    const untracked = this.git(["ls-files", "--others", "--exclude-standard"]).stdout.split(/\r?\n/u)
      .filter(Boolean).filter(file => /\.(js|json|md|txt|html)$/u.test(file));
    const problems = [];
    for (const file of untracked) {
      const text = this.bytes(file).toString("utf8");
      text.split("\n").forEach((line, index) => {
        if (/[ \t]+\r?$/u.test(line)) problems.push(`${file}:${index + 1}: trailing whitespace`);
        if (line.match(/^[ \t]*/u)[0].includes(" \t")) problems.push(`${file}:${index + 1}: space before tab`);
      });
      if (/\n\s*\n$/u.test(text)) problems.push(`${file}: blank line at EOF`);
    }
    assert.deepEqual(problems, [], "new files fail the diff whitespace rules");
    return { trackedExitCode: 0, untrackedFilesChecked: untracked.length, problems: 0 };
  }
}

if (require.main === module) {
  try {
    const evidence = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf("--suite-evidence") + 1], "utf8"));
    const result = new Stage322Acceptance().run({ suiteEvidence: evidence });
    console.log(`Stage 3.22 acceptance recorded: Full ${result.automatedResults.suites.full.passedChecks} checks, ` +
      `fresh npm ci/build, ${result.freezeBoundary.frozenBatchCount} frozen batches.`);
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Stage322Acceptance };
