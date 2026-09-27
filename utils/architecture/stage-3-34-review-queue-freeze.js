"use strict";

// Stage 3.34.0 review-queue freeze (evidence for the Stage 3.22 review queue and its freeze extension).
//   node utils/architecture/stage-3-34-review-queue-freeze.js --write
//     collects the evidence on the current tree and writes architecture/migration/stage_3_34_review_queue/;
//   node utils/architecture/stage-3-34-review-queue-freeze.js
//     replays the freeze before batch 033 (newer batches reversed by their historical workspaces) and
//     fails unless every artifact is byte-identical and the plan source chains the extension.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeReviewQueueFreeze } = require("./review_queue/review_queue_freeze");
const { ARTIFACTS, DIRECTORY } = require("./review_queue/review_queue_paths");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const FIRST_EXTENSION_BATCH = "033";
const STATE = "architecture/migration/stage_3_execution_state.json";

function verifyPlan(root, extensionRef) {
  const read = file => fs.readFileSync(path.join(root, file));
  const state = JSON.parse(read(STATE));
  const plan = new StageThreeApprovedPlanSource({ read }).load(state, { adopting: extensionRef });
  const extension = JSON.parse(read(extensionRef.path));
  const ids = plan.document.batches.map(batch => batch.id);
  assert.deepEqual(ids.slice(-extension.batches.length), extension.batches.map(batch => batch.id),
    "plan source does not append the frozen extension batches");
  assert.deepEqual(ids.slice(0, state.completedBatchIds.length), state.completedBatchIds,
    "plan source does not keep the completed prefix");
  return plan;
}

function replay(root) {
  const result = new StageThreeReviewQueueFreeze({ root }).build();
  const mismatches = Object.values(ARTIFACTS).filter(file => {
    const absolute = path.join(root, file);
    return !fs.existsSync(absolute) || !fs.readFileSync(absolute).equals(result.artifacts.get(file));
  });
  return { result, mismatches };
}

function write(root = PROJECT_ROOT) {
  const result = new StageThreeReviewQueueFreeze({ root }).build();
  for (const file of Object.values(ARTIFACTS)) {
    const absolute = path.join(root, file);
    if (fs.existsSync(absolute) && !fs.readFileSync(absolute).equals(result.artifacts.get(file))) {
      throw new Error(`review-queue evidence is immutable; ${file} differs (record new facts as new evidence)`);
    }
  }
  fs.mkdirSync(path.join(root, DIRECTORY), { recursive: true });
  for (const file of Object.values(ARTIFACTS)) fs.writeFileSync(path.join(root, file), result.artifacts.get(file));
  return result;
}

function report(result) {
  const { summary, freezeBoundary } = result.extension;
  return `${summary.frozenBatchCount}/${summary.reviewQueueBatchCount} review-queue batches frozen ` +
    `(${summary.frozenModuleCount} modules, ${freezeBoundary.newActivationCount} activations), ` +
    `${summary.requiresEvidenceBatchCount} still requiring evidence`;
}

async function main(argv) {
  if (argv.includes("--write")) {
    const result = write();
    const bytes = result.artifacts.get(ARTIFACTS.freezeExtension);
    verifyPlan(PROJECT_ROOT, { path: ARTIFACTS.freezeExtension,
      sha256: require("node:crypto").createHash("sha256").update(bytes).digest("hex") });
    console.log(`Stage 3.34.0 review-queue freeze written: ${report(result)}.`);
    return;
  }
  const { StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
  const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");
  const registry = StageThreeBatchRegistry;
  const action = prior => {
    const { result, mismatches } = replay(prior);
    if (mismatches.length > 0) throw new Error(`Stage 3.34.0 review-queue freeze replay differs:\n- ${mismatches.join("\n- ")}`);
    const bytes = result.artifacts.get(ARTIFACTS.freezeExtension);
    verifyPlan(prior, { path: ARTIFACTS.freezeExtension,
      sha256: require("node:crypto").createHash("sha256").update(bytes).digest("hex") });
    return result;
  };
  const result = registry.has(FIRST_EXTENSION_BATCH)
    ? await new StageThreeHistoricalWorkspace(registry.load(FIRST_EXTENSION_BATCH), registry)
      .run(PROJECT_ROOT, action, { copyTools: true })
    : action(PROJECT_ROOT);
  console.log(`Stage 3.34.0 review-queue freeze replay OK: ${Object.keys(ARTIFACTS).length} artifacts byte-identical; ` +
    `${report(result)}.`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { replay, write, verifyPlan };
