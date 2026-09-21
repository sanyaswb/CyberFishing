"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { Batch009Planning, PROFILE, serialize } = require("./domain_batches/stage_three_batch_009_planning");
const { BATCH_009_MATRIX_DEPENDENCIES } = require("./domain_batches/stage_three_batch_009_focused_test_catalog");
const root = path.resolve(__dirname, "../..");
const app = new Batch009Planning(root);
function persist(file, value) {
  const destination = path.join(root, file), bytes = serialize(value);
  if (fs.existsSync(destination)) {
    if (!fs.readFileSync(destination).equals(bytes)) throw new Error(`Refusing to overwrite changed planning evidence: ${file}`);
  } else fs.writeFileSync(destination, bytes, { flag: "wx" });
}
if (require.main === module) {
  persist(PROFILE.auditPath, app.audit());
  persist(PROFILE.executionPlanPath, app.plan());
  persist(PROFILE.testMatrixPath, app.matrix(BATCH_009_MATRIX_DEPENDENCIES));
  console.log("Stage 3.9.0–3.9.2 planning artifacts generated; run planning and fixture checks before acceptance. Runtime unchanged.");
}
module.exports = { persist };
