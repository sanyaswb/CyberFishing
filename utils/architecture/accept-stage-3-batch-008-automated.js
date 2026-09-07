"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { StageThreeBatch008ObservationApplication } = require("./domain_batches/stage_three_batch_008_observation_application");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");

class Batch008AutomatedAcceptance {
  run() {
    const root = path.resolve(__dirname, "../..");
    const output = "architecture/migration/stage_3_batch_008_automated_acceptance.json";
    assert(!fs.existsSync(path.join(root, output)), "Acceptance attempt already exists; do not overwrite historical results");
    const observation = new StageThreeBatch008ObservationApplication(root);
    const checked = observation.check();
    const protectedBefore = observation.protectedSnapshot();
    const git = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
    const command = (args) => {
      const result = spawnSync(git, args, { cwd: root, encoding: "utf8", shell: false });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const sourceCommit = command(["rev-parse", "HEAD"]).trim();
    const worktreeStatus = command(["status", "--short"]);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run();
    for (const id of ["architecture", "quick", "full"]) {
      const step = fresh.steps.find((item) => item.id === id);
      assert(step.passedChecks > 0 && step.exitCode === 0);
    }
    command(["-c", "core.safecrlf=false", "diff", "--check"]);
    assert.deepEqual(observation.protectedSnapshot(), protectedBefore, "Acceptance mutated source/runtime/release evidence");
    const report = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-008-automated-acceptance",
      stage: "3.8.8", batchId: checked.artifact.batchId, releaseVersion: checked.artifact.releaseVersion,
      recordedAt: new Date().toISOString(), status: "automated-pass-awaiting-browser",
      sourceCommit, sourceRepositoryClean: worktreeStatus.trim().length === 0,
      sourceMode: "byte-verified-working-tree-including-uncommitted-batch-008-changes",
      worktreeStatusSha256: fingerprint(Buffer.from(worktreeStatus)),
      evidence: protectedBefore.filter((item) => item.path === "architecture/migration/stage_3_batch_008_observation_reconciliation.json" ||
        item.path === "architecture/migration/stage_3_batch_008_live_runtime_validation.json"),
      fresh, gitDiffCheck: "passed", runtimeAndReleaseUnchanged: true,
      browserSmoke: { status: "pending", performedBy: "user", required: ["boot-canvas-inventory", "cast-waiting-fight",
        "real-line-release-recovery", "stroke-distance-gained-lost-stable", "hold-drag-recovery-gates", "console-zero-errors-warnings"] },
      releaseClosureAllowed: false, verdict: "awaiting-browser-proof" };
    fs.writeFileSync(path.join(root, output), canonicalBytes(report), { flag: "wx" });
    console.log(`Stage 3.8.8 automated PASS: ${fresh.steps.filter((item) => item.passedChecks).map((item) =>
      `${item.id} ${item.passedChecks}/${item.passedChecks}`).join(", ")}. Browser proof still required.`);
  }
}

if (require.main === module) new Batch008AutomatedAcceptance().run();
module.exports = { Batch008AutomatedAcceptance };
