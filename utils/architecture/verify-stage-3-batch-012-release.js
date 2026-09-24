"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch012ReleaseCheck } = require("./stage-3-batch-012-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { TRANSITION } = require("./domain_batches/stage_three_batch_012_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_012_planning");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");

const OUTPUT = "architecture/migration/stage_3_batch_012_release_regression.json";

class Batch012ReleaseRegression {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Release regression attempt is immutable");
    const release = new Batch012ReleaseCheck().run(root);
    const transitionSha256 = sha(fs.readFileSync(path.join(root, TRANSITION)));
    const automatedPath = "architecture/migration/stage_3_batch_012_automated_acceptance.json";
    const automated = JSON.parse(fs.readFileSync(path.join(root, automatedPath)));
    const acceptance = JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_batch_012_acceptance_pass.json")));
    assert.equal(automated.status, "automated-pass-awaiting-browser");
    assert.equal(acceptance.completes.sha256, sha(fs.readFileSync(path.join(root, automatedPath))));
    assert.deepEqual(automated.suites.full,
      { passedChecks: CHECK_DEFINITIONS.length, failedChecks: 0 });
    const fresh = automated.freshInstall;
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    for (const step of fresh.steps) assert.equal(step.exitCode, 0);
    for (const output of fresh.runtimeOutput) assert.equal(sha(fs.readFileSync(path.join(root, output.path))),
      output.sha256, `Generated runtime drift: ${output.path}`);
    assert.equal(sha(fs.readFileSync(path.join(root, TRANSITION))), transitionSha256);
    new Batch012ReleaseCheck().run(root);
    const report = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-012-release-regression",
      batchId: "stage-3.candidate-012-assemblies-2086347a",
      releaseVersion: "0.24.49", recordedAt: new Date().toISOString(), status: "passed",
      releaseTransition: { path: TRANSITION, sha256: transitionSha256 },
      automatedAcceptance: { path: automatedPath,
        sha256: sha(fs.readFileSync(path.join(root, automatedPath))) },
      preReleaseSuites: automated.suites,
      verifiedTopology: release.topology,
      node: fresh.node, npm: fresh.npm,
      lockfileSha256: sha(fs.readFileSync(path.join(root, "package-lock.json"))),
      lockfileChanged: false,
      sourceCopy: { sourceBytesUnchanged: fresh.sourceBytesUnchanged },
      temporaryWorkspaceRemoved: fresh.temporaryWorkspaceRemoved,
      generatedOutputCopied: fresh.generatedOutputCopied,
      runtimeOutput: fresh.runtimeOutput,
      steps: fresh.steps,
    };
    const bytes = serialize(report);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, OUTPUT)), bytes));
    console.log("Stage 3.12.9 regression PASS: release metadata exact; pre-release npm ci/build retained; generated runtime byte-identical.");
    return report;
  }
}

if (require.main === module) {
  try { new Batch012ReleaseRegression().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch012ReleaseRegression, OUTPUT };
