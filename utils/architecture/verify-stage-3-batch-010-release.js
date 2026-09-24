"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch010ReleaseCheck } = require("./stage-3-batch-010-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { TRANSITION } = require("./domain_batches/stage_three_batch_010_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_010_planning");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_010_release_regression.json";

class Batch010ReleaseRegression {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Release regression attempt is immutable");
    const release = new Batch010ReleaseCheck().run(root);
    const transitionSha256 = sha(fs.readFileSync(path.join(root, TRANSITION)));
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run();
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    assert.deepEqual(fresh.steps.map(step => step.id),
      ["npm-ci", "cumulative-build", "architecture", "quick", "full"]);
    for (const step of fresh.steps) assert.equal(step.exitCode, 0);
    for (const [id, suite] of [["architecture", "architecture"], ["quick", "quick"], ["full", "all"]]) {
      const step = fresh.steps.find(item => item.id === id);
      const expected = CHECK_DEFINITIONS.filter(check => suite === "all" || check.suites.includes(suite)).length;
      assert.equal(step.passedChecks, expected, `${id} suite count differs from current catalog`);
    }
    assert.equal(sha(fs.readFileSync(path.join(root, TRANSITION))), transitionSha256);
    new Batch010ReleaseCheck().run(root);
    const report = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-010-release-regression",
      batchId: "stage-3.candidate-010-inventory-e3dffbe7",
      releaseVersion: "0.24.47", recordedAt: new Date().toISOString(), status: "passed",
      releaseTransition: { path: TRANSITION, sha256: transitionSha256 },
      verifiedTopology: release.topology,
      ...fresh,
    };
    const bytes = serialize(report);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, OUTPUT)), bytes));
    console.log(`Stage 3.10.9 fresh regression PASS: ${fresh.steps.filter(step => step.passedChecks)
      .map(step => `${step.id} ${step.passedChecks}/${step.passedChecks}`).join(", ")}; generated runtime byte-identical.`);
    return report;
  }
}

if (require.main === module) {
  try { new Batch010ReleaseRegression().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch010ReleaseRegression, OUTPUT };
