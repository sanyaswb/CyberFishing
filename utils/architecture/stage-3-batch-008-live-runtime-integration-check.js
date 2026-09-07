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
const application = new StageThreeBatch008LiveValidation(root);
const observed = application.run();
assert.deepEqual(application.run(), observed, "Live measurements must be deterministic");
const bytes = fs.readFileSync(path.join(root, OUTPUT));
new StageThreeBatch008LiveValidationContract().validate(JSON.parse(bytes), observed);
assert.deepEqual(bytes, canonicalBytes(observed), "Persisted live evidence is not canonical");
assert.deepEqual(snapshot(), before, "Read-only live validation changed source/runtime/metadata bytes");
console.log(`Stage 3.8.6 PASS: ${observed.runtime.projectModules.length} modules; ` +
  `${observed.runtime.activationTiming.length} exact exposures; ${observed.evaluation.modules.length} measured evaluations once; ` +
  `${observed.behavior.cases.length} classic/live parity cases; real LineSystem state owner; ` +
  "allocation-site equality, zero post-activation transport reads, byte-stable replay.");
