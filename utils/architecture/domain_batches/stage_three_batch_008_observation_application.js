"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ArchitecturePolicy } = require("../core/architecture_policy");
const { LiveObservationSnapshot } = require("../observation/persistence/live_observation_snapshot");
const { SourceFileScanner } = require("../migration/source_file_scanner");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("../migration/stage_two_runtime_script_alias_resolver");
const { CanonicalModulePath } = require("../migration/canonical_module_path");
const { CurrentAreaResolver } = require("../migration/current_area_resolver");
const { createMigrationManifestValidator } = require("../migration/migration_manifest_validator");
const { PersistedDependencyGraph } = require("../observation/integrity/persisted_dependency_graph");
const { DerivedReverseConsumerIndex } = require("../observation/integrity/derived_reverse_consumer_index");
const { ObservationGraphIntegrityValidator } = require("../observation/integrity/observation_graph_integrity_validator");
const { ArchitectureGuardSnapshotBuilder } = require("../guards/corpus/architecture_guard_snapshot_builder");
const { ArchitectureGuardEngine } = require("../guards/architecture_guard_engine");
const { immutableRecord } = require("../guards/core/guard_models");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { StageThreeBatch008LiveValidation, StageThreeBatch008LiveValidationContract } = require("./stage_three_batch_008_live_validation");
const { StageThreeBatch008ObservationReconciliation, StageThreeBatch008ObservationContract } = require("./stage_three_batch_008_observation_reconciliation");
const { beforeBatch008Observations, MANIFEST, OUTPUT } = require("./stage_three_batch_008_observation_transition");

const PREFIX = "architecture/migration/";
const PATHS = Object.freeze({ prebuild: `${PREFIX}stage_3_batch_008_prebuild_contract.json`,
  cutover: `${PREFIX}stage_3_batch_008_runtime_cutover.json`, live: `${PREFIX}stage_3_batch_008_live_runtime_validation.json`,
  audit: `${PREFIX}stage_3_batch_008_audit.json`, state: `${PREFIX}stage_3_execution_state.json`,
  runtime: `${PREFIX}stage_3_compatibility_runtime.json`, registry: "architecture/guards/migration_bridge_registry.json",
  baseline: "architecture/guards/global_provider_baseline.json", debt: "architecture/guards/known_debt_registry.json",
  policy: "architecture/module_architecture.json" });

class StageThreeBatch008ObservationApplication {
  constructor(root, { failureInjector } = {}) { this.root = path.resolve(root); this.failureInjector = failureInjector; }
  bytes(relative) { return fs.readFileSync(path.join(this.root, relative)); }
  json(relative) { return JSON.parse(this.bytes(relative)); }

  protectedSnapshot() {
    const walk = (relative) => fs.readdirSync(path.join(this.root, relative), { withFileTypes: true }).flatMap((entry) => {
      assert(!entry.isSymbolicLink(), "Protected source/evidence cannot be a symlink");
      const next = `${relative}/${entry.name}`;
      return entry.isDirectory() ? walk(next) : [next];
    });
    return [...walk("src"), ...walk("architecture"), ...walk("dist"),
      "index.html", "package.json", "package-lock.json", "refactor_Task.txt", "CHANGELOG.md"]
      .sort().map((relative) => ({ path: relative, sha256: fingerprint(this.bytes(relative)) }));
  }

  prepare() {
    const protectedBefore = this.protectedSnapshot();
    const { beforeBatch008Release } = require("./stage_three_batch_008_release_transition");
    const historicalReleaseBytes = (relative) => beforeBatch008Release(relative, this.bytes(relative), this.root);
    const data = Object.fromEntries(Object.entries(PATHS).map(([key, relative]) => [key, JSON.parse(historicalReleaseBytes(relative))]));
    const pendingBytes = beforeBatch008Observations(this.bytes(MANIFEST), this.root);
    const before = JSON.parse(pendingBytes);
    const live = new StageThreeBatch008LiveValidation(this.root).run();
    new StageThreeBatch008LiveValidationContract().validate(data.live, live);
    const policy = new ArchitecturePolicy(data.policy);
    // Full actual source corpus; no historical source reader and no stored facts
    // substituted for fresh observations. The old Manifest supplies metadata only.
    const observed = new LiveObservationSnapshot().build({ projectRoot: this.root, policy, manifest: before });
    const sources = new SourceFileScanner({ projectRoot: this.root, sourceRoot: path.join(this.root, "src") }).scan();
    const candidate = structuredClone(observed);
    const targets = new Set(data.prebuild.preliminaryMetadata.targets.map((item) => item.targetPath));
    for (const item of candidate.modules) if (targets.has(item.currentPath)) item.architecture.migrationStatus = "verified";
    const snapshot = new ArchitectureGuardSnapshotBuilder({ projectRoot: this.root, policy: data.policy,
      manifest: candidate, bridgeRegistry: data.registry, globalBaseline: data.baseline, debtRegistry: data.debt }).build();
    const esm = snapshot.sources.filter((item) => targets.has(item.currentPath)).map((item) => item.esm);
    const inputs = { ...data, before, observed, esm };
    const result = new StageThreeBatch008ObservationReconciliation().build(inputs);
    assert.deepEqual(result.manifest, candidate);
    const legacyScripts = new LegacyScriptOrderReader(path.join(this.root, "index.html"), {
      scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(this.root) }).read();
    createMigrationManifestValidator().validate({ manifest: result.manifest, policy, sourceFiles: sources,
      legacyScripts, canonicalPath: new CanonicalModulePath(),
      currentAreaResolver: new CurrentAreaResolver({ rootValue: policy.migrationManifest.currentArea.rootValue }) });
    const graph = new PersistedDependencyGraph(result.manifest);
    const reverse = new DerivedReverseConsumerIndex(graph);
    const graphSummary = new ObservationGraphIntegrityValidator(policy.observationContract.resolutionModel)
      .validate({ manifest: result.manifest, graph, reverseConsumerIndex: reverse });
    const guards = new ArchitectureGuardEngine({ projectRoot: this.root }).run(snapshot);
    assert.equal(guards.failureCount, 0, JSON.stringify(guards.diagnostics.filter((item) => item.status === "FAIL")));
    const evidence = Object.entries(PATHS).map(([, relative]) => ({ path: relative, sha256: fingerprint(historicalReleaseBytes(relative)) }));
    const artifact = immutableRecord({ schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-008-observation-reconciliation",
      status: "verified", batchId: data.state.activeBatchId, releaseVersion: data.state.releaseVersion,
      evidence, ...result.facts, graph: { ...graphSummary, reverseConsumers: "derived-only", unifiedEdges: snapshot.graph.edges.length },
      guards: { failureCount: guards.failureCount, knownDebtCount: guards.knownDebtCount,
        diagnosticsSha256: fingerprint(canonicalBytes(guards.diagnostics)), baselineGlobals: data.baseline.providers.length },
      metadataTransition: { field: "architecture.migrationStatus", from: "migrating", to: "verified", targets: [...targets].sort() },
      lifecycle: { completedBatchIds: data.state.completedBatchIds, activeBatchId: data.state.activeBatchId,
        activeBatchPhase: data.state.activeBatchPhase, batchCompleted: false },
      releaseClosureAuthorized: false, verdict: "eligible-for-full-acceptance",
      nextGate: "stage-3.8.8-full-acceptance-and-browser-smoke" });
    assert.deepEqual(this.protectedSnapshot(), protectedBefore, "Read-only reconciliation changed protected files");
    return { manifest: result.manifest, artifact, inputs, protectedBefore };
  }

  check() {
    const result = this.prepare();
    new StageThreeBatch008ObservationContract().validate(this.json(OUTPUT), result.artifact);
    assert.deepEqual(this.bytes(OUTPUT), canonicalBytes(result.artifact));
    assert.deepEqual(this.bytes(MANIFEST), canonicalBytes(result.manifest), "Persisted facts differ from full live scan");
    return result;
  }

  run() {
    if (fs.existsSync(path.join(this.root, OUTPUT))) return this.check();
    const result = this.prepare();
    assert.equal(fingerprint(this.bytes(MANIFEST)), result.artifact.manifestTransition.beforeSha256,
      "Manifest changed between observation and commit");
    assert.deepEqual(this.protectedSnapshot(), result.protectedBefore);
    const writes = [{ relativePath: MANIFEST, bytes: canonicalBytes(result.manifest) },
      { relativePath: OUTPUT, bytes: canonicalBytes(result.artifact) }];
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector: this.failureInjector }).commit(writes, () => {
      for (const item of writes) assert.deepEqual(this.bytes(item.relativePath), item.bytes);
      assert.deepEqual(beforeBatch008Observations(this.bytes(MANIFEST), this.root), canonicalBytes(result.inputs.before));
      for (const item of result.protectedBefore) if (item.path !== MANIFEST) {
        assert.equal(fingerprint(this.bytes(item.path)), item.sha256, `Reconciliation mutated ${item.path}`);
      }
    });
    return result;
  }
}

module.exports = { StageThreeBatch008ObservationApplication, PATHS };
