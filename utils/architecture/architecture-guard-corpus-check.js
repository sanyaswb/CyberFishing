const fs = require("node:fs");
const path = require("node:path");
const { ArchitectureGuardPolicyValidator } = require("./guards/contracts/architecture_guard_policy_validator");
const { GuardArtifactRepository, GlobalProviderBaselineValidator, KnownDebtRegistryValidator, MigrationBridgeRegistryValidator } = require("./guards/contracts/guard_artifact_repository");
const { ArchitectureGuardSnapshotBuilder } = require("./guards/corpus/architecture_guard_snapshot_builder");
const { ArchitectureGuardEngine } = require("./guards/architecture_guard_engine");
const { GuardReportFormatter } = require("./guards/core/guard_report_formatter");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");
const { StageFourClusterLedger } = require("./stage_four/cluster_ledger");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const paths = {
  policy: path.join(PROJECT_ROOT, "architecture/module_architecture.json"),
  manifest: path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"),
  debt: path.join(PROJECT_ROOT, "architecture/guards/known_debt_registry.json"),
  bridges: path.join(PROJECT_ROOT, "architecture/guards/migration_bridge_registry.json"),
  globals: path.join(PROJECT_ROOT, "architecture/guards/global_provider_baseline.json"),
  index: path.join(PROJECT_ROOT, "index.html"),
  legacy: LegacyScriptOrderReader.sourcePath(PROJECT_ROOT),
};
const trackedBytes = new Map(Object.entries(paths).map(([key, file]) => [key, fs.readFileSync(file)]));
const policy = JSON.parse(trackedBytes.get("policy").toString("utf8"));
const manifest = JSON.parse(trackedBytes.get("manifest").toString("utf8"));
new ArchitectureGuardPolicyValidator().validate(policy);
const debtRegistry = new GuardArtifactRepository(paths.debt, new KnownDebtRegistryValidator()).read();
const bridgeRegistry = new GuardArtifactRepository(paths.bridges, new MigrationBridgeRegistryValidator()).read();
const globalBaseline = new GuardArtifactRepository(paths.globals, new GlobalProviderBaselineValidator()).read();
const sourceBytes = new Map(manifest.modules.map((item) => [item.currentPath, fs.readFileSync(path.join(PROJECT_ROOT, item.currentPath))]));
const started = Date.now();
const snapshot = new ArchitectureGuardSnapshotBuilder({ projectRoot: PROJECT_ROOT, policy, manifest, bridgeRegistry, globalBaseline, debtRegistry }).build();
const report = new ArchitectureGuardEngine({ projectRoot: PROJECT_ROOT }).run(snapshot);
for (const [key, before] of trackedBytes) if (!before.equals(fs.readFileSync(paths[key]))) throw new Error(`Architecture guard mutated ${key}`);
for (const [currentPath, before] of sourceBytes) if (!before.equals(fs.readFileSync(path.join(PROJECT_ROOT, currentPath)))) throw new Error(`Architecture guard mutated ${currentPath}`);
if (snapshot.sources.length !== manifest.modules.length) throw new Error("Architecture guard did not scan every manifest source");
if (snapshot.sources.some((item) => item.esm.status === "failed")) throw new Error("Architecture guard corpus contains parse failures");
const esmEdges = snapshot.sources.flatMap((item) => item.esm.observations).filter((item) => item.resolutionStatus === "confirmed-project");
const actualEsmEdges = [...new Set(esmEdges.map((item) => `${item.source}->${item.resolvedTarget}`))].sort();
// Approved ESM edges: exact Stage 2 bridge edges plus the reviewed imports of completed-prefix
// exports declared by Stage 3 batches that are completed or runtime-active in the execution plan.
const stageThreeState = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "architecture/migration/stage_3_execution_state.json")));
const stageThreePlan = new StageThreeApprovedPlanSource({ read: (file) => fs.readFileSync(path.join(PROJECT_ROOT, file)) })
  .load(stageThreeState).document;
const selectedBatchIds = new Set([...stageThreeState.completedBatchIds,
  ...(stageThreeState.activeBatchPhase === "runtime-active" ? [stageThreeState.activeBatchId] : [])]);
const reviewedImportEdges = stageThreePlan.batches.filter((batch) => selectedBatchIds.has(batch.id))
  .flatMap((batch) => StageThreeApprovedPlanSource.resolvedImportRecords(stageThreePlan, batch)
    .map((item) => `${batch.modules.find((module) => module.currentPath === item.consumer).targetPath}->${item.from}`));
// Stage 4: plus the reviewed imports of applied cluster records.
const ledger = StageFourClusterLedger.cumulative(PROJECT_ROOT);
// Exact removed importers (validated cleanup records): their approved edges retire with the absent file only.
const removedModules = ledger.removedTargetModules();
for (const file of removedModules) if (fs.existsSync(path.join(PROJECT_ROOT, file))) throw new Error(`Removed importer still exists: ${file}`);
const approvedEsmEdges = [...new Set([
  ...bridgeRegistry.bridges
    .filter((item) => item.introducedStage === "stage-2")
    .map((item) => `${item.bridge}->${item.target}`),
  ...reviewedImportEdges,
  ...ledger.reviewedImportEdges(),
  ...StageFourClusterLedger.reviewedPreparationImportEdges(PROJECT_ROOT)
    .map(edge => `${edge.source}->${edge.target}`),
])].filter(edge => {
  const [source] = edge.split("->");
  return !removedModules.includes(source);
}).sort();
if (JSON.stringify(actualEsmEdges) !== JSON.stringify(approvedEsmEdges)) {
  throw new Error(`Live ESM edges must equal exact approved bridge edges: expected ${approvedEsmEdges.join(", ") || "none"}; received ${actualEsmEdges.join(", ") || "none"}`);
}
if (report.failureCount > 0) throw new Error(new GuardReportFormatter().format(report));
const elapsed = Date.now() - started;
if (elapsed > 5000) throw new Error(`Architecture guard corpus exceeded 5s target: ${elapsed}ms`);
console.log(`Architecture guard corpus passed: ${snapshot.sources.length} modules, ${snapshot.graph.edges.length} unified edges, ${globalBaseline.providers.length} globals, ${report.knownDebtCount} exact known-debt diagnostics, 0 FAIL in ${elapsed}ms; read-only.`);
