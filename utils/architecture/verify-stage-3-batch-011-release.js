"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { Batch011ReleaseCheck } = require("./stage-3-batch-011-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { TRANSITION } = require("./domain_batches/stage_three_batch_011_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_011_planning");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_011_release_regression.json";

class Batch011ReleaseRegression {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Release regression attempt is immutable");
    const release = new Batch011ReleaseCheck().run(root);
    const transitionSha256 = sha(fs.readFileSync(path.join(root, TRANSITION)));
    const automatedPath = "architecture/migration/stage_3_batch_011_automated_acceptance.json";
    const automated = JSON.parse(fs.readFileSync(path.join(root, automatedPath)));
    const acceptance = JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_batch_011_acceptance_pass.json")));
    assert.equal(automated.status, "automated-pass-awaiting-browser");
    assert.equal(acceptance.completes.sha256, sha(fs.readFileSync(path.join(root, automatedPath))));
    for (const [id, suite] of [["architecture", "architecture"], ["quick", "quick"], ["full", "all"]]) {
      const expected = CHECK_DEFINITIONS.filter(check => suite === "all" || check.suites.includes(suite)).length;
      assert.equal(automated.suites[id].passedChecks, expected);
      assert.equal(automated.suites[id].failedChecks, 0);
    }
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run({ suites: false });
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    for (const step of fresh.steps) assert.equal(step.exitCode, 0);
    assert.equal(sha(fs.readFileSync(path.join(root, TRANSITION))), transitionSha256);
    new Batch011ReleaseCheck().run(root);
    const report = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-011-release-regression",
      batchId: "stage-3.candidate-011-items-11818ee5",
      releaseVersion: "0.24.48", recordedAt: new Date().toISOString(), status: "passed",
      releaseTransition: { path: TRANSITION, sha256: transitionSha256 },
      automatedAcceptance: { path: automatedPath,
        sha256: sha(fs.readFileSync(path.join(root, automatedPath))) },
      preReleaseSuites: automated.suites,
      verifiedTopology: release.topology,
      ...fresh,
    };
    const bytes = serialize(report);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, OUTPUT)), bytes));
    console.log("Stage 3.11.9 fresh regression PASS: release metadata exact; npm ci and cumulative build passed; pre-release 140/82/168 retained; generated runtime byte-identical.");
    return report;
  }
}

if (require.main === module) {
  try { new Batch011ReleaseRegression().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch011ReleaseRegression, OUTPUT };
