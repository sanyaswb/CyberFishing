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
const { Batch013LiveValidation } = require("./stage_three_batch_013_live_validation");
const { Batch013CutoverHistory } = require("./stage_three_batch_013_cutover_history");
const { Batch013ObservationReconciliation, Batch013ObservationContract } = require("./stage_three_batch_013_observation_reconciliation");
const { beforeBatch013Observations, MANIFEST, OUTPUT, PREBUILD, CUTOVER, RUNTIME, KIND, NEXT } = require("./stage_three_batch_013_observation_transition");

const PATHS = Object.freeze({
  prebuild: PREBUILD, cutover: CUTOVER, runtime: RUNTIME,
  live: "architecture/migration/stage_3_batch_013_live_runtime_validation.json",
  audit: "architecture/migration/stage_3_batch_013_audit.json",
  state: "architecture/migration/stage_3_execution_state.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  baseline: "architecture/guards/global_provider_baseline.json",
  debt: "architecture/guards/known_debt_registry.json",
  policy: "architecture/module_architecture.json",
  approved: "architecture/migration/stage_3_approved_batches.json",
});

class Batch013ObservationApplication {
  constructor(root, { failureInjector } = {}) {
    this.root = path.resolve(root);
    this.failureInjector = failureInjector;
  }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  protectedSnapshot() {
    const walk = relative => fs.readdirSync(path.join(this.root, relative), { withFileTypes: true }).flatMap(entry => {
      assert(!entry.isSymbolicLink(), "Protected tree contains a symlink");
      const next = relative + "/" + entry.name;
      return entry.isDirectory() ? walk(next) : [next];
    });
    return [...walk("src"), ...walk("architecture"), ...walk("dist"), "index.html",
      "package.json", "package-lock.json", "CHANGELOG.md", "refactor_Task.txt"].sort()
      .map(file => ({ path: file, sha256: fingerprint(this.bytes(file)) }));
  }

  async prepare() {
    const protectedBefore = this.protectedSnapshot();
    new Batch013CutoverHistory(this.root).artifact();
    await new Batch013LiveValidation(this.root).run();
    const data = Object.fromEntries(Object.entries(PATHS).map(([key, file]) => [key, this.json(file)]));
    const pendingBytes = beforeBatch013Observations(this.bytes(MANIFEST), this.root);
    const before = JSON.parse(pendingBytes);
    const policy = new ArchitecturePolicy(data.policy);
    // Always scan every actual src file. Historical evidence supplies approved
    // metadata and rollback anchors, never replacement source observations.
    const observed = new LiveObservationSnapshot().build({ projectRoot: this.root, policy, manifest: before });
    const candidate = structuredClone(observed);
    const targets = new Set(data.prebuild.preliminaryMetadata.targets.map(item => item.targetPath));
    for (const item of candidate.modules) if (targets.has(item.currentPath)) item.architecture.migrationStatus = "verified";
    const snapshot = new ArchitectureGuardSnapshotBuilder({ projectRoot: this.root, policy: data.policy,
      manifest: candidate, bridgeRegistry: data.registry, globalBaseline: data.baseline, debtRegistry: data.debt }).build();
    const esm = snapshot.sources.filter(item => targets.has(item.currentPath)).map(item => item.esm);
    const inputs = { ...data, before, observed, esm };
    const result = new Batch013ObservationReconciliation().build(inputs);
    assert.deepEqual(result.manifest, candidate);
    const sources = new SourceFileScanner({ projectRoot: this.root, sourceRoot: path.join(this.root, "src") }).scan();
    const scripts = new LegacyScriptOrderReader(path.join(this.root, "index.html"), {
      scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(this.root) }).read();
    createMigrationManifestValidator().validate({ manifest: result.manifest, policy, sourceFiles: sources,
      legacyScripts: scripts, canonicalPath: new CanonicalModulePath(),
      currentAreaResolver: new CurrentAreaResolver({ rootValue: policy.migrationManifest.currentArea.rootValue }) });
    const graph = new PersistedDependencyGraph(result.manifest), reverse = new DerivedReverseConsumerIndex(graph);
    const graphSummary = new ObservationGraphIntegrityValidator(policy.observationContract.resolutionModel)
      .validate({ manifest: result.manifest, graph, reverseConsumerIndex: reverse });
    const guards = new ArchitectureGuardEngine({ projectRoot: this.root }).run(snapshot);
    assert.equal(guards.failureCount, 0, JSON.stringify(guards.diagnostics.filter(item => item.status === "FAIL")));
    const uniqueProviders = [...new Map(data.prebuild.preliminaryMetadata.plannedActivationPositions
      .map(activation => [activation.sourceProvider, activation])).values()];
    const reverseConsumers = uniqueProviders.map(activation => {
      const legacy = reverse.consumersOf(activation.sourceProvider);
      const providerBridges = data.registry.bridges.filter(bridge => bridge.bridge === activation.sourceProvider);
      assert.deepEqual(legacy, providerBridges.map(bridge => ({ source: bridge.source,
        symbols: bridge.globalProviders.map(provider => provider.symbol).sort() }))
        .sort((a, b) => a.source.localeCompare(b.source)));
      const unified = snapshot.graph.edges.filter(edge => edge.target === activation.targetModule);
      assert.deepEqual(unified.map(edge => edge.source), [activation.sourceProvider]);
      assert(unified[0].mechanisms.includes("approved-bridge"));
      return { sourceProvider: activation.sourceProvider, targetModule: activation.targetModule,
        legacy, targetLegacyConsumers: reverse.consumersOf(activation.targetModule), unifiedIncoming: unified };
    });
    const artifact = immutableRecord({ schemaVersion: 1, kind: KIND, status: "verified",
      batchId: data.state.activeBatchId, releaseVersion: data.state.releaseVersion,
      evidence: Object.values(PATHS).map(file => ({ path: file, sha256: fingerprint(this.bytes(file)) })),
      ...result.facts, graph: { ...graphSummary, unifiedEdges: snapshot.graph.edges.length,
        reverseConsumers: "derived-only", verifiedIncoming: reverseConsumers,
        reverseIndexSha256: fingerprint(canonicalBytes(reverse.entries())) },
      guards: { failureCount: guards.failureCount, knownDebtCount: guards.knownDebtCount,
        diagnosticsSha256: fingerprint(canonicalBytes(guards.diagnostics)), baselineGlobals: data.baseline.providers.length },
      metadataTransition: { field: "architecture.migrationStatus", from: "migrating", to: "verified", targets: [...targets].sort() },
      topology: data.prebuild.plannedTopology.counts,
      lifecycle: { completedBatchIds: data.state.completedBatchIds, activeBatchId: data.state.activeBatchId,
        activeBatchPhase: data.state.activeBatchPhase, batchCompleted: false },
      releaseClosureAuthorized: false, verdict: "eligible-for-full-acceptance", nextGate: NEXT });
    new Batch013ObservationContract(data.prebuild).validate(artifact, artifact);
    assert.deepEqual(this.protectedSnapshot(), protectedBefore, "Read-only reconciliation mutated protected files");
    return { manifest: result.manifest, artifact, inputs, protectedBefore };
  }

  async check() {
    const result = await this.prepare();
    new Batch013ObservationContract(result.inputs.prebuild).validate(this.json(OUTPUT), result.artifact);
    assert.deepEqual(this.bytes(OUTPUT), canonicalBytes(result.artifact));
    assert.deepEqual(this.bytes(MANIFEST), canonicalBytes(result.manifest), "Persisted facts differ from actual sources");
    return result;
  }

  async run() {
    if (fs.existsSync(path.join(this.root, OUTPUT))) return this.check();
    const result = await this.prepare();
    assert.equal(fingerprint(this.bytes(MANIFEST)), result.artifact.manifestTransition.beforeSha256);
    assert.deepEqual(this.protectedSnapshot(), result.protectedBefore);
    const writes = [{ relativePath: MANIFEST, bytes: canonicalBytes(result.manifest) },
      { relativePath: OUTPUT, bytes: canonicalBytes(result.artifact) }];
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector: this.failureInjector }).commit(writes, () => {
      for (const item of writes) assert.deepEqual(this.bytes(item.relativePath), item.bytes);
      assert.deepEqual(beforeBatch013Observations(this.bytes(MANIFEST), this.root), canonicalBytes(result.inputs.before));
      for (const item of result.protectedBefore) if (item.path !== MANIFEST) {
        assert.equal(fingerprint(this.bytes(item.path)), item.sha256, "Reconciliation mutated " + item.path);
      }
    });
    return result;
  }
}

module.exports = { Batch013ObservationApplication, PATHS };
