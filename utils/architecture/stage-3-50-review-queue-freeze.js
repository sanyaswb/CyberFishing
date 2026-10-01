"use strict";

// Stage 3.50.1 review-queue freeze: hot-loop equivalence evidence for the six Domain sources of the Stage
// 3.50.0 review queue batch 050 and the freeze extension that repeats the 3.50.0 freeze decision with it
// (batch 051 follows once fish.js froze in 050).
//   node utils/architecture/stage-3-50-review-queue-freeze.js --write
//     builds both artifacts from the current tree and writes architecture/migration/stage_3_50_review_queue/;
//   node utils/architecture/stage-3-50-review-queue-freeze.js
//     replays them before batch 050 (newer batches reversed by their historical workspaces) and fails unless
//     both artifacts are byte-identical and the plan source chains the extension.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha256, serialize } = require("./post_freeze/post_freeze_workspace");
const { StageThreeBatchSourceObserver } = require("./domain_batches/stage_three_batch_source_observer");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");
const { StageThreeHotLoopEvidence, EQUIVALENCE_RULES_3_50 } = require("./review_queue/hot_loop_evidence");
const { StageThreeFreezeExtensionBuilder, StageThreeFreezeExtensionValidator, EXTENSION_3_50 } =
  require("./review_queue/freeze_extension");
const { STAGE_3_50 } = require("./post_freeze/post_freeze_review_profile");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const FIRST_BATCH = "050";
const STATE = "architecture/migration/stage_3_execution_state.json";
const DIRECTORY = "architecture/migration/stage_3_50_review_queue";
const ARTIFACTS = Object.freeze({
  hotLoopEvidence: `${DIRECTORY}/hot_loop_evidence.json`,
  freezeExtension: `${DIRECTORY}/freeze_extension.json`,
});
const HOT_LOOP_TASK = "stage-3.50.prerequisite.hot-loop-equivalence-evidence";

function build(root) {
  const bytes = file => fs.readFileSync(path.join(root, file));
  const json = file => JSON.parse(bytes(file).toString("utf8"));
  const reference = file => ({ path: file, sha256: sha256(bytes(file)) });
  const artifacts = new Map();
  const emit = (file, document) => {
    const output = serialize(document);
    artifacts.set(file, output);
    return { path: file, sha256: sha256(output) };
  };
  const base = json(STAGE_3_50.artifacts.approvedPrefix);
  const candidates = json(STAGE_3_50.artifacts.candidateBatches);
  const backlog = json(STAGE_3_50.artifacts.prerequisiteBacklog);
  const task = backlog.tasks.find(item => item.id === HOT_LOOP_TASK);
  assert(task && task.kind === "freeze-evidence" && task.graphChanging === false,
    `review-queue evidence task is not a non-graph freeze-evidence task: ${HOT_LOOP_TASK}`);
  // Every performance-gated module of the queued batches with its declared classes and reviewed imports.
  const observer = new StageThreeBatchSourceObserver();
  const modules = base.reviewQueue.flatMap(queued => {
    const candidate = candidates.batches.find(batch => batch.id === queued.id);
    return candidate.gates.performance.map(gate => ({
      currentPath: gate.module,
      classNames: observer.observe(bytes(gate.module).toString("utf8"), gate.module).classDeclarations,
      reviewedImports: [...new Set(candidate.imports.filter(item => item.consumer === gate.module)
        .flatMap(item => item.exportName ? [item.exportName] : item.legacySymbols))].sort(),
    }));
  });
  const records = new StageThreeHotLoopEvidence({ root }).build(modules);
  const backlogRef = reference(STAGE_3_50.artifacts.prerequisiteBacklog);
  const hotLoopRef = emit(ARTIFACTS.hotLoopEvidence, {
    schemaVersion: 1,
    kind: "cyber-fishing-stage-3-review-queue-hot-loop-evidence",
    stage: EXTENSION_3_50.stage,
    evidenceTaskId: task.id,
    prerequisiteBacklog: backlogRef,
    checks: task.checks,
    gameCycle: { script: "utils/game-cycle-check.js", probe: "utils/architecture/review_queue/game_cycle_trace_probe.js",
      traced: "every public prototype method of every class: call count, deltaTime range and SHA-256 of ordered arguments and results" },
    equivalenceRules: EQUIVALENCE_RULES_3_50,
    records,
  });
  const extension = new StageThreeFreezeExtensionBuilder().build({
    base, baseRef: reference(STAGE_3_50.artifacts.approvedPrefix),
    candidates, candidatesRef: reference(STAGE_3_50.artifacts.candidateBatches),
    reviewEvidence: json(STAGE_3_50.artifacts.reviewEvidence), reviewEvidenceRef: reference(STAGE_3_50.artifacts.reviewEvidence),
    backlog, backlogRef,
    executionState: json(STATE), executionStateRef: reference(STATE),
    evidence: records.map(record => ({ taskId: task.id, artifact: hotLoopRef, record })),
    readSource: file => bytes(file).toString("utf8"), profile: EXTENSION_3_50,
  });
  new StageThreeFreezeExtensionValidator().validate({ extension, base, profile: EXTENSION_3_50 });
  emit(ARTIFACTS.freezeExtension, extension);
  return { artifacts, extension };
}

function verifyPlan(root, extensionBytes) {
  const read = file => fs.readFileSync(path.join(root, file));
  const state = JSON.parse(read(STATE));
  const plan = new StageThreeApprovedPlanSource({ read }).load(state,
    { adopting: { path: ARTIFACTS.freezeExtension, sha256: sha256(extensionBytes) } });
  const extension = JSON.parse(extensionBytes);
  const ids = plan.document.batches.map(batch => batch.id);
  assert.deepEqual(ids.slice(state.completedBatchIds.length), extension.batches.map(batch => batch.id),
    "plan source does not append the extension's frozen batches");
}

function replay(root) {
  const result = build(root);
  const mismatches = Object.values(ARTIFACTS).filter(file => {
    const absolute = path.join(root, file);
    return !fs.existsSync(absolute) || !fs.readFileSync(absolute).equals(result.artifacts.get(file));
  });
  if (mismatches.length > 0) throw new Error(`Stage 3.50.1 review-queue freeze replay differs:\n- ${mismatches.join("\n- ")}`);
  verifyPlan(root, result.artifacts.get(ARTIFACTS.freezeExtension));
  return result;
}

function write() {
  const result = build(PROJECT_ROOT);
  for (const file of Object.values(ARTIFACTS)) {
    const absolute = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(absolute) && !fs.readFileSync(absolute).equals(result.artifacts.get(file))) {
      throw new Error(`Stage 3.50.1 review-queue artifacts are immutable; ${file} differs`);
    }
  }
  fs.mkdirSync(path.join(PROJECT_ROOT, DIRECTORY), { recursive: true });
  for (const file of Object.values(ARTIFACTS)) fs.writeFileSync(path.join(PROJECT_ROOT, file), result.artifacts.get(file));
  verifyPlan(PROJECT_ROOT, result.artifacts.get(ARTIFACTS.freezeExtension));
  return result;
}

const report = ({ extension }) => `${extension.summary.frozenBatchCount} frozen batches ` +
  `(${extension.summary.frozenModuleCount} modules), ${extension.summary.requiresEvidenceBatchCount} still queued`;

async function main(argv) {
  if (argv.includes("--write")) {
    console.log(`Stage 3.50.1 review-queue freeze written: ${report(write())}.`);
    return;
  }
  const { StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
  const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");
  const result = StageThreeBatchRegistry.has(FIRST_BATCH)
    ? await new StageThreeHistoricalWorkspace(StageThreeBatchRegistry.load(FIRST_BATCH), StageThreeBatchRegistry)
      .run(PROJECT_ROOT, prior => replay(prior))
    : replay(PROJECT_ROOT);
  console.log(`Stage 3.50.1 review-queue freeze replay OK: ${Object.keys(ARTIFACTS).length} artifacts byte-identical; ` +
    `${report(result)}.`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { build, replay, write, ARTIFACTS };
