"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_008_PREFLIGHT_PROFILE,
} = require("./domain_batches/stage_three_batch_008_preflight_profile");
const {
  StageThreeBatchPreflightAuditBuilder,
  StageThreeBatchPreflightAuditValidator,
} = require("./domain_batches/stage_three_batch_preflight_audit");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  domainAudit: "architecture/migration/stage_3_domain_audit.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
  runtimeOutput: "dist/stage-3-compat-runtime",
  output: "architecture/migration/stage_3_batch_008_audit.json",
});

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

function runtimeOutputFingerprint(historical = null) {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(item);
      else if (entry.isFile()) {
        files.push({
          path: path.relative(PROJECT_ROOT, item).replaceAll("\\", "/"),
          sha256: sha256(historical ? historical.bytes(path.relative(PROJECT_ROOT, item).replaceAll("\\", "/")) : fs.readFileSync(item)),
        });
      }
    }
  };
  walk(absolute(PATHS.runtimeOutput));
  const { Batch008CutoverHistory } = require("./domain_batches/stage_three_batch_008_cutover_history");
  const history = new Batch008CutoverHistory(PROJECT_ROOT);
  const allowed = historical && history.active() ? new Set(history.json("architecture/migration/stage_3_batch_008_execution_plan.json")
    .rollback.baselineEvidence.runtimeOutput.files.map((item) => item.path)) : null;
  const selected = files.filter((item) => !allowed || allowed.has(item.path)).sort((left, right) => left.path.localeCompare(right.path));
  return sha256(Buffer.from(JSON.stringify(selected), "utf8"));
}

function runtimeFacts({ runtimeContract, bridgeRegistry }) {
  const html = bytes(PATHS.index).toString("utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/giu)];
  const moduleScriptCount = scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length;
  const runtimePath = `${runtimeContract.output.directory}${runtimeContract.output.runtimeFile}`;
  const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
  const logicalScripts = new LegacyScriptOrderReader(absolute(PATHS.index), {
    scriptAliases: aliases,
  }).read();
  const runtimeScriptCount = scripts.filter((match) => match[2].split("?")[0] === runtimePath).length;
  if (runtimeScriptCount !== 1) throw new Error("Stage 3.8.0 requires one cumulative runtime script");
  return Object.freeze({
    projectModuleCount: new Set(runtimeContract.activationPositions
      .map((activation) => activation.targetModule)).size,
    activationCount: runtimeContract.activationPositions.length,
    bridgeCount: bridgeRegistry.bridges.length,
    scriptTopology: Object.freeze({
      physicalClassicScriptCount: scripts.length - moduleScriptCount,
      logicalLegacyPositionCount: logicalScripts.length,
      moduleScriptCount,
      cumulativeRuntimeScriptCount: runtimeScriptCount,
      isolatedIifeScriptCount: scripts.filter((match) =>
        match[2].includes("dist/legacy-bridges/")).length,
    }),
  });
}

function buildArtifact({ historicalPrebuild = false } = {}) {
  const { StageThreeBatch008HistoricalInputs } = require("./domain_batches/stage_three_batch_008_historical_inputs");
  const historical = historicalPrebuild ? new StageThreeBatch008HistoricalInputs(PROJECT_ROOT) : null;
  const input = (relative) => {
    if (!historical) return readJsonWithFingerprint(relative);
    const value = historical.bytes(relative);
    return { document: JSON.parse(value), sha256: sha256(value) };
  };
  if (historical) historical.verifyTargets();
  const approvedPlan = readJsonWithFingerprint(PATHS.approvedPlan);
  const manifest = input(PATHS.manifest);
  const domainAudit = readJsonWithFingerprint(PATHS.domainAudit);
  const executionState = input(PATHS.executionState);
  const runtimeContract = input(PATHS.runtimeContract);
  const bridgeRegistry = input(PATHS.bridgeRegistry);
  const artifact = new StageThreeBatchPreflightAuditBuilder({
    profile: BATCH_008_PREFLIGHT_PROFILE,
  }).build({
    approvedPlan: approvedPlan.document,
    approvedPlanSha256: approvedPlan.sha256,
    manifest: manifest.document,
    manifestSha256: manifest.sha256,
    domainAudit: domainAudit.document,
    domainAuditSha256: domainAudit.sha256,
    executionState: executionState.document,
    executionStateSha256: executionState.sha256,
    runtimeContract: runtimeContract.document,
    runtimeContractSha256: runtimeContract.sha256,
    bridgeRegistry: bridgeRegistry.document,
    bridgeRegistrySha256: bridgeRegistry.sha256,
    indexSha256: sha256(historical ? historical.bytes(PATHS.index) : bytes(PATHS.index)),
    runtimeOutputFingerprint: runtimeOutputFingerprint(historical),
    runtimeFacts: runtimeFacts({
      runtimeContract: runtimeContract.document,
      bridgeRegistry: bridgeRegistry.document,
    }),
    sourceReader: (relativePath) => (historical ? historical.bytes(relativePath) : bytes(relativePath)).toString("utf8"),
  });
  new StageThreeBatchPreflightAuditValidator(BATCH_008_PREFLIGHT_PROFILE).validate(artifact);
  return artifact;
}

function serialize(artifact) {
  return Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

function writeArtifact(artifact) {
  fs.writeFileSync(absolute(PATHS.output), serialize(artifact));
}

if (require.main === module) {
  const artifact = buildArtifact();
  writeArtifact(artifact);
  console.log(
    `Stage 3.8.0 audit generated: ${artifact.scope.targetCount} targets, ` +
    `${artifact.closure.existingCumulativeModuleCount}→${artifact.closure.resultingProjectModuleCount} modules, ` +
    `${artifact.compatibility.consumers.length} consumers; ${artifact.verdict}.`,
  );
}

module.exports = {
  PATHS,
  buildArtifact,
  runtimeFacts,
  runtimeOutputFingerprint,
  serialize,
  writeArtifact,
};
