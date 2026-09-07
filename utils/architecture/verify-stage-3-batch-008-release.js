"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
const { StageThreeBatch008ReleaseAcceptanceCheck, CLOSURE } = require("./stage-3-batch-008-release-acceptance-check");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");

class Batch008ReleaseRegression {
  run(root = path.resolve(__dirname, "../..")) {
    const output = path.join(root, "architecture/migration/stage_3_batch_008_release_regression.json");
    assert(!fs.existsSync(output), "Do not overwrite a recorded release regression attempt");
    const check = new StageThreeBatch008ReleaseAcceptanceCheck(root);
    const before = fs.readFileSync(path.join(root, CLOSURE));
    check.run();
    const fresh = new FreshPackageInstallVerifier({ projectRoot: root }).run();
    assert.deepEqual(fs.readFileSync(path.join(root, CLOSURE)), before);
    check.run();
    const closure = JSON.parse(before);
    const report = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-008-release-regression",
      batchId: closure.batchId, releaseVersion: closure.releaseVersion, recordedAt: new Date().toISOString(),
      testedClosure: { path: CLOSURE, sha256: fingerprint(before), phase: closure.status },
      ...fresh };
    fs.writeFileSync(output, canonicalBytes(report), { flag: "wx" });
    console.log(`Release regression PASS: ${fresh.steps.filter((s) => s.passedChecks)
      .map((s) => `${s.id} ${s.passedChecks}/${s.passedChecks}`).join(", ")}; runtime output byte-identical.`);
  }
}
if (require.main === module) new Batch008ReleaseRegression().run();
module.exports = { Batch008ReleaseRegression };
