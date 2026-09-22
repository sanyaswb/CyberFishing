"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch009ObservationApplication } = require("./domain_batches/stage_three_batch_009_observation_application");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_009_automated_acceptance.json";

class Batch009AutomatedAcceptance {
  constructor(root = path.resolve(__dirname, "../..")) { this.root = path.resolve(root); }

  git(args) {
    const command = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
    const result = spawnSync(command, args, { cwd: this.root, encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout;
  }

  validateFresh(fresh, runtime) {
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.dependenciesCopied, false);
    assert.equal(fresh.generatedOutputCopied, false);
    assert.equal(fresh.sourceCopy.mode, "actual-working-tree-not-HEAD");
    assert.equal(fresh.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build", "architecture", "quick", "full"]);
    assert.deepEqual(fresh.steps[0].args, ["ci", "--include=dev", "--no-audit", "--no-fund"]);
    for (const step of fresh.steps) {
      assert.equal(step.exitCode, 0);
      assert.equal(step.stdoutSha256, fingerprint(Buffer.from(step.stdout)));
      assert.equal(step.stderrSha256, fingerprint(Buffer.from(step.stderr)));
    }
    for (const id of ["architecture", "quick", "full"]) {
      const step = fresh.steps.find(item => item.id === id), suite = id === "full" ? "all" : id;
      const expectedCount = CHECK_DEFINITIONS.filter(check => suite === "all" || check.suites.includes(suite)).length;
      assert.equal(step.passedChecks, expectedCount, "Fresh suite coverage differs from current catalog");
      assert.deepEqual(step.args, ["utils/run-checks.js", "--suite", suite]);
    }
    assert.deepEqual(fresh.runtimeOutput.map(item => item.path),
      [runtime.output.directory + runtime.output.runtimeFile,
        ...runtime.activationPositions.map(item => runtime.output.directory + item.shimFile)].sort());
    for (const item of fresh.runtimeOutput) {
      assert.equal(item.sha256, fingerprint(fs.readFileSync(path.join(this.root, item.path))));
    }
  }

  async run() {
    assert(!fs.existsSync(path.join(this.root, OUTPUT)), "Existing acceptance attempt must not be overwritten");
    const observation = new Batch009ObservationApplication(this.root);
    const checked = await observation.check(), protectedBefore = observation.protectedSnapshot();
    const sourceCommit = this.git(["rev-parse", "HEAD"]).trim();
    const worktreeStatus = this.git(["status", "--short"]);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: this.root }).run();
    const runtime = JSON.parse(fs.readFileSync(path.join(this.root, "architecture/migration/stage_3_compatibility_runtime.json")));
    this.validateFresh(fresh, runtime);
    this.git(["-c", "core.safecrlf=false", "diff", "--check"]);
    assert.deepEqual(observation.protectedSnapshot(), protectedBefore, "Acceptance mutated protected files");
    const evidencePaths = new Set([
      "architecture/migration/module_migration_manifest.json",
      "architecture/migration/stage_3_batch_009_observation_reconciliation.json",
      "architecture/migration/stage_3_batch_009_live_runtime_validation.json",
      "architecture/migration/stage_3_execution_state.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      "architecture/guards/migration_bridge_registry.json", "index.html",
    ]);
    const report = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-009-automated-acceptance",
      stage: "3.9.8", batchId: checked.artifact.batchId, releaseVersion: checked.artifact.releaseVersion,
      recordedAt: new Date().toISOString(), status: "automated-pass-awaiting-browser",
      sourceCommit, sourceRepositoryClean: worktreeStatus.trim().length === 0,
      sourceMode: "byte-verified-working-tree-including-uncommitted-batch-009-changes",
      worktreeStatusSha256: fingerprint(Buffer.from(worktreeStatus)),
      evidence: protectedBefore.filter(item => evidencePaths.has(item.path)),
      topology: checked.artifact.topology, lifecycle: checked.artifact.lifecycle,
      fresh, gitDiffCheck: "passed", runtimeAndReleaseUnchanged: true,
      browserSmoke: { status: "pending", performedBy: "user", required: [
        "boot", "canvas", "inventory", "cast-waiting-fight", "fish-rarity-behavior",
        "fish-anomaly-variant-behavior", "console-zero-errors", "console-zero-warnings",
      ] },
      releaseClosureAllowed: false, verdict: "awaiting-browser-proof",
    };
    const bytes = canonicalBytes(report);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([{ relativePath: OUTPUT, bytes }], () => {
      assert.deepEqual(fs.readFileSync(path.join(this.root, OUTPUT)), bytes);
      for (const item of protectedBefore) {
        assert.equal(fingerprint(fs.readFileSync(path.join(this.root, item.path))), item.sha256, item.path);
      }
    });
    console.log("Stage 3.9.8 automated PASS: " + fresh.steps.filter(item => item.passedChecks)
      .map(item => item.id + " " + item.passedChecks + "/" + item.passedChecks).join(", ") +
      ". Browser proof remains required; release 0.24.45 and active batch 009 unchanged.");
    return report;
  }
}

if (require.main === module) new Batch009AutomatedAcceptance().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { Batch009AutomatedAcceptance, OUTPUT };
