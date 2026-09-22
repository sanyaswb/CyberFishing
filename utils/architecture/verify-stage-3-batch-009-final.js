"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch009ReleaseCheck } = require("./stage-3-batch-009-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_009_release_final_verification.json";
const CLOSURE = "architecture/migration/stage_3_batch_009_release_closure.json";

class Batch009FinalVerification {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Final verification must not be overwritten");
    const closureBefore = fs.readFileSync(path.join(root, CLOSURE));
    new Batch009ReleaseCheck().run(root);
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run();
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    for (const step of fresh.steps) assert.equal(step.exitCode, 0);
    assert.deepEqual(fs.readFileSync(path.join(root, CLOSURE)), closureBefore);
    new Batch009ReleaseCheck().run(root);
    const git = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
    const diff = spawnSync(git, ["-c", "core.safecrlf=false", "diff", "--check"],
      { cwd: root, encoding: "utf8", shell: false });
    assert.equal(diff.status, 0, diff.stderr || diff.stdout);
    const report = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-009-final-verification",
      batchId: "stage-3.candidate-009-fish-444e8034", releaseVersion: "0.24.46",
      recordedAt: new Date().toISOString(), status: "passed",
      testedClosure: { path: CLOSURE, sha256: fingerprint(closureBefore) },
      gitDiffCheck: "passed", ...fresh };
    const bytes = canonicalBytes(report);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, OUTPUT)), bytes));
    console.log(`Stage 3.9.9 final PASS: ${fresh.steps.filter(step => step.passedChecks)
      .map(step => `${step.id} ${step.passedChecks}/${step.passedChecks}`).join(", ")}; closure and runtime byte-stable.`);
  }
}

if (require.main === module) {
  try { new Batch009FinalVerification().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { Batch009FinalVerification, OUTPUT };
