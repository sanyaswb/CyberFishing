const path = require("node:path");
const { ArchitectureGuardSnapshotBuilder } = require("./guards/corpus/architecture_guard_snapshot_builder");
const { ArchitectureGuardEngine } = require("./guards/architecture_guard_engine");
const { CanonicalJson } = require("./guards/core/canonical_json");
const { GuardArtifactRepository, KnownDebtRegistryValidator } = require("./guards/contracts/guard_artifact_repository");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const policy = require(path.join(PROJECT_ROOT, "architecture/module_architecture.json"));
const manifest = require(path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"));
const bridgeRegistry = require(path.join(PROJECT_ROOT, "architecture/guards/migration_bridge_registry.json"));
const globalBaseline = require(path.join(PROJECT_ROOT, "architecture/guards/global_provider_baseline.json"));
const emptyDebtRegistry = { schemaVersion: 1, kind: "cyber-fishing-known-debt", generatedFrom: "Stage 1.7 reviewed guard debt snapshot", debts: [] };
const snapshot = new ArchitectureGuardSnapshotBuilder({ projectRoot: PROJECT_ROOT, policy, manifest, bridgeRegistry, globalBaseline, debtRegistry: emptyDebtRegistry }).build();
const report = new ArchitectureGuardEngine({ projectRoot: PROJECT_ROOT }).run(snapshot, { includeStaleMetadata: false });
const eligible = new Set(["boundary-dependency", "qualified-role", "module-cycle", "browser-capability", "dev-leakage"]);
const modules = new Map(manifest.modules.map((item) => [item.currentPath, item]));
const debts = report.diagnostics.filter((item) => item.status === "FAIL" && eligible.has(item.rule)).map((item) => {
  const source = modules.get(item.source);
  const blockers = source?.analysis?.blockers?.items?.length ? [...source.analysis.blockers.items] : [`legacy-${item.rule}`];
  const identity = item.identity;
  return {
    id: CanonicalJson.debtId(item.rule, identity), rule: item.rule, source: item.source, target: item.target,
    reason: `Stage 1.7 baseline of reviewed v0.24.30 legacy ${item.rule} debt.`, blockers: blockers.sort(), owner: "architecture-team",
    migrationWave: source?.architecture?.migrationWave ?? 0, removalStage: "stage-2", evidenceFingerprint: CanonicalJson.fingerprint(identity), identity,
  };
}).sort((a, b) => a.id.localeCompare(b.id));
const output = path.join(PROJECT_ROOT, "architecture/guards/known_debt_registry.json");
new GuardArtifactRepository(output, new KnownDebtRegistryValidator()).write({ schemaVersion: 1, kind: "cyber-fishing-known-debt", generatedFrom: "Stage 1.7 reviewed guard debt snapshot", debts });
const counts = Object.fromEntries([...eligible].map((rule) => [rule, debts.filter((item) => item.rule === rule).length]));
console.log(`Known debt registry written: ${debts.length} exact records ${JSON.stringify(counts)}.`);
