"use strict";

// Stage 4 light cluster path (owner decision 0.3): node utils/architecture/stage-4-cluster.js --cluster NNN
// --step plan|apply|verify. The cluster record architecture/migration/stage_4/clusters/NNN_slug.json holds the
// hand-written input (modules, exports, imports, tier) and receives `output` (apply) and `verification`.
const path = require("node:path");
const { StageFourClusterApply, StageFourClusterPlan, StageFourClusterVerify, StageFourWorkspace, recordFileFor } =
  require("./stage_four/cluster_path");

const ROOT = path.resolve(__dirname, "../..");
const option = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};
const id = option("cluster");
// --stage 5 selects the Stage 5 ledger (same mechanism, stage-qualified records); Stage 4 is the default.
const stage = Number(option("stage") || 4);
const step = option("step");
if (!/^\d{3}$/u.test(id || "") || !["plan", "apply", "verify"].includes(step)) {
  console.error("Usage: node utils/architecture/stage-4-cluster.js --cluster NNN --step plan|apply|verify [--stage 4|5]");
  process.exit(2);
}
const workspace = new StageFourWorkspace(ROOT);
const recordFile = recordFileFor(ROOT, id, stage);
const summary = (plan) => [
  `targets: ${plan.targets.map((item) => `${item.module.currentPath} -> ${item.module.targetPath}`).join("; ")}`,
  `consumers: ${plan.consumers.map((item) => `${item.consumer} [${item.boundary}] ${item.symbols.join(",")}`).join("; ") || "none"}`,
  `activations: ${plan.activations.map((item) => `${item.shimFile} (${item.removalStage})`).join(", ") || "none"}`,
  `inert: ${plan.inert.map((item) => item.targetModule).join(", ") || "none"}`,
  `retired activations: ${plan.retiredActivations.map((item) => item.shimFile).join(", ") || "none"}`,
  `bridges: +${plan.bridgesAdded.length} -${plan.bridgesRetired.length}; import edges: ${plan.importEdges.length}; ` +
    `side-effect reviews: ${plan.targets.filter((item) => item.review).length}; runtime slot ${plan.runtimeSlot}`,
  `property readers reviewed: ${plan.propertyReaders.length}`,
].join("\n");

if (step === "plan") {
  const plan = new StageFourClusterPlan(workspace, workspace.json(recordFile)).build();
  console.log(`Stage 4 cluster ${id} plan OK\n${summary(plan)}`);
} else if (step === "apply") {
  const { plan, record } = new StageFourClusterApply(workspace, recordFile).run();
  console.log(`Stage 4 cluster ${id} applied (${record.output.files.filter((file) => file.before !== file.after).length} ` +
    `files changed)\n${summary(plan)}`);
} else {
  const { verification, passed } = new StageFourClusterVerify(workspace, recordFile).run();
  for (const guard of verification.guards) console.log(`${guard.status} ${guard.check}: ${guard.summary}`);
  for (const item of verification.evidence) console.log(`${item.status} ${item.name} ${item.sha256}`);
  console.log(`game-cycle identical: ${verification.gameCycle.identical}`);
  console.log(`Stage 4 cluster ${id} verify ${passed ? "PASS" : "FAIL"}`);
  if (!passed) process.exitCode = 1;
}
