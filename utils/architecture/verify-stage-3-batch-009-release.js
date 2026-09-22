"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch009ReleaseCheck } = require("./stage-3-batch-009-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { TRANSITION } = require("./domain_batches/stage_three_batch_009_release_transition");

const OUTPUT = "architecture/migration/stage_3_batch_009_release_regression.json";

class Batch009ReleaseRegression {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Do not overwrite a release regression attempt");
    const release = new Batch009ReleaseCheck().run(root);
    const before = fingerprint(fs.readFileSync(path.join(root, TRANSITION)));
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run();
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    assert.deepEqual(fresh.steps.map(step => step.id),
      ["npm-ci", "cumulative-build", "architecture", "quick", "full"]);
    for (const step of fresh.steps) assert.equal(step.exitCode, 0);
    assert.equal(fingerprint(fs.readFileSync(path.join(root, TRANSITION))), before);
    new Batch009ReleaseCheck().run(root);
    const report = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-009-release-regression",
      batchId: "stage-3.candidate-009-fish-444e8034", releaseVersion: "0.24.46",
      recordedAt: new Date().toISOString(), status: "passed",
      releaseTransition: { path: TRANSITION, sha256: before },
      verifiedTopology: release.topology, ...fresh };
    const bytes = canonicalBytes(report);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, OUTPUT)), bytes));
    console.log(`Stage 3.9.9 fresh regression PASS: ${fresh.steps.filter(step => step.passedChecks)
      .map(step => `${step.id} ${step.passedChecks}/${step.passedChecks}`).join(", ")}; generated runtime byte-identical.`);
    return report;
  }
}

if (require.main === module) {
  try { new Batch009ReleaseRegression().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { Batch009ReleaseRegression, OUTPUT };
