"use strict";

// Stage 3.42.0 replacement post-freeze graph review after batch 040 and prerequisite transition
// 030: duplicate resolveFightPhysicsConfig removal.
//   node utils/architecture/stage-3-42-graph-review.js --write --commit <sha>
//     builds the review from the current tree and writes architecture/migration/stage_3_42_graph_review/;
//   node utils/architecture/stage-3-42-graph-review.js
//     replays the review before batch 041 (newer batches reversed by their historical workspaces)
//     and fails unless every artifact is byte-identical and the plan source chains its approved prefix.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PostFreezeWorkspace } = require("./post_freeze/post_freeze_workspace");
const { PostFreezeReview } = require("./post_freeze/post_freeze_review");
const { STAGE_3_42 } = require("./post_freeze/post_freeze_review_profile");
const { REVIEWED_COLLECTIONS_3_40 } = require("./post_freeze/post_freeze_evidence_review");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const FIRST_BATCH = "041";
const STATE = "architecture/migration/stage_3_execution_state.json";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const review = () => new PostFreezeReview({ profile: STAGE_3_42, reviewedCollections: REVIEWED_COLLECTIONS_3_40 });

function verifyPlan(root, approvedBytes) {
  const read = file => fs.readFileSync(path.join(root, file));
  const state = JSON.parse(read(STATE));
  const reference = { path: STAGE_3_42.artifacts.approvedPrefix, sha256: sha(approvedBytes) };
  const plan = new StageThreeApprovedPlanSource({ read }).load(state, { adopting: reference });
  const approved = JSON.parse(approvedBytes);
  const ids = plan.document.batches.map(batch => batch.id);
  assert.deepEqual(ids.slice(0, state.completedBatchIds.length), state.completedBatchIds);
  assert.deepEqual(ids.slice(state.completedBatchIds.length), approved.batches.map(batch => batch.id),
    "plan source does not append the newly frozen batches");
  assert.equal(plan.domainAuditPath, STAGE_3_42.artifacts.domainAudit);
  return plan;
}

function replay(root) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, STAGE_3_42.artifacts.baseline), "utf8"));
  const result = review().build({ workspace: new PostFreezeWorkspace(root), commit: baseline.commit });
  const mismatches = Object.values(STAGE_3_42.artifacts).filter(file => {
    const absolute = path.join(root, file);
    return !fs.existsSync(absolute) || !fs.readFileSync(absolute).equals(result.artifacts.get(file));
  });
  if (mismatches.length > 0) throw new Error(`Stage 3.42.0 graph review replay differs:\n- ${mismatches.join("\n- ")}`);
  verifyPlan(root, result.artifacts.get(STAGE_3_42.artifacts.approvedPrefix));
  return result;
}

function write(commit) {
  assert.match(commit || "", /^[0-9a-f]{40}$/u, "--write requires --commit <full baseline sha>");
  const result = review().build({ workspace: new PostFreezeWorkspace(PROJECT_ROOT), commit });
  for (const file of Object.values(STAGE_3_42.artifacts)) {
    const absolute = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(absolute) && !fs.readFileSync(absolute).equals(result.artifacts.get(file))) {
      throw new Error(`Stage 3.42.0 review artifacts are immutable; ${file} differs`);
    }
  }
  fs.mkdirSync(path.join(PROJECT_ROOT, STAGE_3_42.directory), { recursive: true });
  for (const file of Object.values(STAGE_3_42.artifacts)) fs.writeFileSync(path.join(PROJECT_ROOT, file), result.artifacts.get(file));
  verifyPlan(PROJECT_ROOT, result.artifacts.get(STAGE_3_42.artifacts.approvedPrefix));
  return result;
}

const report = result => {
  const summary = result.summary;
  return `${summary.approvedPrefix.frozenBatchCount} frozen batches (${summary.approvedPrefix.frozenModuleCount} modules), ` +
    `${summary.reassessment.prerequisiteBlocked} prerequisite-blocked, ${summary.reassessment.deferred} deferred, ` +
    `${result.context.backlog.resolvedTaskIds.length} backlog tasks resolved, ${summary.backlog.taskCount} open`;
};

async function main(argv) {
  if (argv.includes("--write")) {
    console.log(`Stage 3.42.0 graph review written: ${report(write(argv[argv.indexOf("--commit") + 1]))}.`);
    return;
  }
  const { StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
  const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");
  const result = StageThreeBatchRegistry.has(FIRST_BATCH)
    ? await new StageThreeHistoricalWorkspace(StageThreeBatchRegistry.load(FIRST_BATCH), StageThreeBatchRegistry)
      .run(PROJECT_ROOT, prior => replay(prior))
    : replay(PROJECT_ROOT);
  console.log(`Stage 3.42.0 graph review replay OK: ${Object.keys(STAGE_3_42.artifacts).length} artifacts byte-identical; ` +
    `${report(result)}.`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { replay, write, verifyPlan };
