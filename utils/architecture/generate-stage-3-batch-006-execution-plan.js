"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchExecutionPlanBuilder,
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: "architecture/migration/stage_3_batch_006_audit.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
  runtimeOutput: "dist/stage-3-compat-runtime",
  output: "architecture/migration/stage_3_batch_006_execution_plan.json",
});

const ROLLBACK_FILE_PATHS = Object.freeze([
  "CHANGELOG.md",
  "architecture/build/package_contract.json",
  "architecture/guards/migration_bridge_registry.json",
  "architecture/migration/module_migration_manifest.json",
  "architecture/migration/stage_3_compatibility_runtime.json",
  "architecture/migration/stage_3_execution_state.json",
  "index.html",
  "package-lock.json",
  "package.json",
  "refactor_Task.txt",
  "src/config/project_version.js",
  "src/core/fishing/hold_opposition_resolver.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/line_constraint_state_resolver.js",
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/core/fishing/rod_control_tension_mode_resolver.js",
  "src/core/float_tackle_line_budget_policy.js",
]);

function absolute(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function bytes(relativePath) {
  return fs.readFileSync(absolute(relativePath));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJsonWithFingerprint(relativePath) {
  const value = bytes(relativePath);
  return Object.freeze({
    document: JSON.parse(value.toString("utf8")),
    sha256: sha256(value),
  });
}

function runtimeOutputEvidence() {
  const root = absolute(PATHS.runtimeOutput);
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) {
        const relativePath = path.relative(PROJECT_ROOT, child).replaceAll("\\", "/");
        files.push({ path: relativePath, sha256: sha256(fs.readFileSync(child)) });
      }
    }
  };
  walk(root);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    path: PATHS.runtimeOutput,
    files,
    fingerprint: sha256(Buffer.from(JSON.stringify(files), "utf8")),
  });
}

function rollbackEvidence() {
  return Object.freeze({
    files: ROLLBACK_FILE_PATHS.map((relativePath) => ({
      path: relativePath,
      sha256: sha256(bytes(relativePath)),
    })).sort((left, right) => left.path.localeCompare(right.path)),
    runtimeOutput: runtimeOutputEvidence(),
  });
}

function runtimeFacts({ approvedPlan, executionState, runtimeContract }) {
  const completedCount = executionState.completedBatchIds.length;
  const selectedBatch = approvedPlan.batches[completedCount - 1];
  if (!selectedBatch) throw new Error("Current completed Stage 3 batch is missing");
  const html = bytes(PATHS.index).toString("utf8");
  const scriptTags = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/giu)];
  const moduleScriptCount = scriptTags.filter((match) => /\btype=["']module["']/iu.test(match[1])).length;
  const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
  const logical = new LegacyScriptOrderReader(absolute(PATHS.index), {
    scriptAliases: aliases,
  }).read();
  const runtimeScriptCount = scriptTags.filter((match) =>
    match[2].split("?")[0] === `${runtimeContract.output.directory}${runtimeContract.output.runtimeFile}`).length;
  if (runtimeScriptCount !== 1) throw new Error("Expected exactly one active cumulative runtime script");
  return Object.freeze({
    projectModuleCount: selectedBatch.cumulativeRuntimeTopology.moduleRecordCount,
    activationCount: runtimeContract.activationPositions.length,
    scriptTopology: Object.freeze({
      physicalClassicScriptCount: scriptTags.length - moduleScriptCount,
      logicalLegacyPositionCount: logical.length,
      moduleScriptCount,
      cumulativeRuntimeScriptCount: runtimeScriptCount,
      isolatedIifeScriptCount: scriptTags.filter((match) =>
        match[2].includes("dist/legacy-bridges/")).length,
    }),
  });
}

function buildPlan() {
  const audit = readJsonWithFingerprint(PATHS.audit);
  const approvedPlan = readJsonWithFingerprint(PATHS.approvedPlan);
  const executionState = readJsonWithFingerprint(PATHS.executionState);
  const runtimeContract = readJsonWithFingerprint(PATHS.runtimeContract);
  const manifest = readJsonWithFingerprint(PATHS.manifest);
  const bridgeRegistry = readJsonWithFingerprint(PATHS.bridgeRegistry);
  for (const module of audit.document.scope.modules) {
    if (fs.existsSync(absolute(module.targetPath))) {
      throw new Error(`Batch 006 target already exists before cutover: ${module.targetPath}`);
    }
  }
  const plan = new StageThreeBatchExecutionPlanBuilder().build({
    audit: audit.document,
    auditSha256: audit.sha256,
    approvedPlan: approvedPlan.document,
    approvedPlanSha256: approvedPlan.sha256,
    executionState: executionState.document,
    executionStateSha256: executionState.sha256,
    runtimeContract: runtimeContract.document,
    runtimeContractSha256: runtimeContract.sha256,
    manifestSha256: manifest.sha256,
    bridgeRegistry: bridgeRegistry.document,
    bridgeRegistrySha256: bridgeRegistry.sha256,
    runtimeFacts: runtimeFacts({
      approvedPlan: approvedPlan.document,
      executionState: executionState.document,
      runtimeContract: runtimeContract.document,
    }),
    rollbackEvidence: rollbackEvidence(),
  });
  new StageThreeBatchExecutionPlanValidator().validate(plan);
  return plan;
}

function serialize(plan) {
  return Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, "utf8");
}

function writePlan(plan) {
  fs.writeFileSync(absolute(PATHS.output), serialize(plan));
}

if (require.main === module) {
  const plan = buildPlan();
  writePlan(plan);
  console.log(
    `Stage 3.6.2 execution plan generated: ${plan.scope.targetCount} targets, ` +
      `${plan.scope.activationCount} activations, ${plan.scope.consumerRelationshipCount} consumer bridges; ` +
      `${plan.cumulativeRuntime.beforeProjectModuleCount} → ${plan.cumulativeRuntime.afterProjectModuleCount} project modules; ` +
      `${plan.verdict}.`,
  );
}

module.exports = {
  PATHS,
  ROLLBACK_FILE_PATHS,
  buildPlan,
  rollbackEvidence,
  runtimeFacts,
  serialize,
  writePlan,
};
