"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatch008LiveValidation, StageThreeBatch008LiveValidationContract, OUTPUT } =
  require("./domain_batches/stage_three_batch_008_live_validation");
const { canonicalBytes } = require("./domain_batches/stage_three_pending_target_manifest");
const { snapshot } = require("./stage-3-batch-008-source-build-integration-check");

const root = path.resolve(__dirname, "../..");
const before = snapshot();
const observed = new StageThreeBatch008LiveValidation(root).run();
const artifact = new StageThreeBatch008LiveValidationContract().validate(observed,
  new StageThreeBatch008LiveValidation(root).run());
assert.deepEqual(snapshot(), before, "Live validation mutated protected project bytes");
const bytes = canonicalBytes(artifact);
const output = path.join(root, OUTPUT);
if (fs.existsSync(output)) {
  assert.deepEqual(fs.readFileSync(output), bytes, "Existing evidence differs; do not silently overwrite history");
} else {
  fs.writeFileSync(output, bytes, { flag: "wx" });
}
console.log(`Stage 3.8.6 evidence verified: ${artifact.evaluation.modules.length} measured modules; ` +
  `${artifact.behavior.cases.length} live parity cases; ${artifact.runtime.activationTiming.length} exact activations. ` +
  artifact.verdict);
