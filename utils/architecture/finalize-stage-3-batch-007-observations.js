"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const { SourceFileScanner } = require("./migration/source_file_scanner");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");
const { MigrationObservationReconciler } = require("./migration/migration_observation_reconciler");
const { createMigrationManifestValidator } = require("./migration/migration_manifest_validator");
const { CanonicalModulePath } = require("./migration/canonical_module_path");
const { CurrentAreaResolver } = require("./migration/current_area_resolver");
const { LegacySymbolProviderScannerFactory } = require("./observation/providers/legacy_symbol_provider_scanner");
const { LegacyExternalConsumerScannerFactory } = require("./observation/consumers/legacy_external_consumer_scanner");
const { LegacyDependencyGraphAnalyzerFactory } = require("./observation/resolution/legacy_dependency_graph_analyzer");
const { ManifestDependencyProjector } = require("./observation/persistence/manifest_dependency_projector");
const { ObservationManifestProjector } = require("./observation/persistence/observation_manifest_projector");
const { MigrationObservationSnapshotBuilder } = require("./observation/persistence/migration_observation_snapshot_builder");
const { ObservationGraphIntegrityValidator } = require("./observation/integrity/observation_graph_integrity_validator");
const { PersistedDependencyGraph } = require("./observation/integrity/persisted_dependency_graph");
const { DerivedReverseConsumerIndex } = require("./observation/integrity/derived_reverse_consumer_index");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeBatch007ObservationReconciliation, StageThreeBatch007ReconciliationValidator } =
  require("./domain_batches/stage_three_batch_007_observation_reconciliation");
const { StageThreeBatch007FallbackProbe, FALLBACK_SOURCE } = require("./domain_batches/stage_three_batch_007_fallback_probe");
const { manifestBytes, sha256, verifyBatch007ManifestEvidence } = require("./domain_batches/stage_three_batch_007_manifest_transition");
const { BATCH_007_PREBUILD_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatch007LifecycleTransition,
} = require("./domain_batches/stage_three_batch_007_lifecycle_transition");

const PATHS = Object.freeze({
  manifest: "architecture/migration/module_migration_manifest.json",
  approved: "architecture/migration/stage_3_approved_batches.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  baseline: "architecture/guards/global_provider_baseline.json",
  state: "architecture/migration/stage_3_execution_state.json",
  prebuild: "architecture/migration/stage_3_batch_007_prebuild_contract.json",
  cutover: "architecture/migration/stage_3_batch_007_runtime_cutover.json",
  sourceBuild: "architecture/migration/stage_3_batch_007_source_build_validation.json",
  live: "architecture/migration/stage_3_batch_007_live_runtime_validation.json",
  policy: "architecture/module_architecture.json",
  fallbackReview: "architecture/migration/stage_3_batch_007_fallback_review.json",
  historicalRepair: "architecture/migration/stage_3_batch_007_changelog_repair.json",
  output: "architecture/migration/stage_3_batch_007_observation_reconciliation.json",
});

class StageThreeBatch007ObservationApplication {
  constructor(projectRoot = path.resolve(__dirname, "../..")) {
    this.root = path.resolve(projectRoot);
  }

  prepare() {
    const data = Object.fromEntries(Object.entries(PATHS).filter(([key]) => key !== "output")
      .map(([key, relative]) => [key, this.json(relative)]));
    const lifecycle = new StageThreeBatch007LifecycleTransition();
    const before = this.protectedSnapshot();
    for (const artifact of [data.cutover, data.live]) {
      for (const evidence of Object.values(artifact.evidence)) {
        if (evidence.path === PATHS.state) {
          lifecycle.verifyRuntimeActiveEvidence(this.bytes(evidence.path), evidence.sha256);
        } else if (evidence.path === "index.html") {
          lifecycle.verifyIndexEvidence(this.bytes(evidence.path), evidence.sha256);
        } else if (evidence.path === PATHS.manifest) {
          verifyBatch007ManifestEvidence(this.bytes(evidence.path), evidence.sha256);
        } else assert.equal(sha256(this.bytes(evidence.path)), evidence.sha256,
          `Stale historical evidence: ${evidence.path}`);
      }
    }
    const batchCompleted = lifecycle.isCompleted(data.state);
    data.state = lifecycle.projectRuntimeActive(data.state);
    assert.equal(data.live.status, "verified");
    assert.equal(data.live.batchId, PROFILE.batchId);
    this.verifyHistoricalRepair(data.historicalRepair);
    const policy = ArchitecturePolicy.load(this.absolute(PATHS.policy));
    const contract = policy.observationContract;
    const sourceFiles = new SourceFileScanner({ projectRoot: this.root,
      sourceRoot: this.absolute("src") }).scan();
    const legacyScripts = new LegacyScriptOrderReader(this.absolute("index.html"), {
      scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(this.root),
    }).read();
    const patches = new MigrationObservationSnapshotBuilder({
      sourceReader: (absolute) => fs.readFileSync(absolute, "utf8"),
      providerScanner: new LegacySymbolProviderScannerFactory().create(contract),
      consumerScanner: new LegacyExternalConsumerScannerFactory().create(contract),
      dependencyAnalyzer: new LegacyDependencyGraphAnalyzerFactory().create(contract.resolutionModel),
      projector: new ObservationManifestProjector(new ManifestDependencyProjector()),
    }).build({ sourceFiles, legacyScripts });
    const observedManifest = new MigrationObservationReconciler(policy.migrationManifest.schemaVersion)
      .reconcile({ existingManifest: data.manifest, observationPatches: patches });
    const batch = data.approved.batches.find((item) => item.id === PROFILE.batchId);
    for (const source of data.sourceBuild.sources) {
      const target = this.bytes(source.targetPath);
      assert.equal(sha256(target), source.targetSha256);
      assert.equal(sha256(Buffer.from(target.toString("utf8").replace(
        `export class ${source.exportName}`, `class ${source.exportName}`))),
        source.sourceSha256, "classic parity baseline is not exact");
    }
    const fallback = new StageThreeBatch007FallbackProbe().run({ read: (relative) =>
      this.bytes(relative).toString("utf8"), runtime: data.runtime, sourceBuild: data.sourceBuild });
    const evidence = Object.fromEntries(Object.entries(PATHS)
      .filter(([key]) => !["manifest", "output"].includes(key))
      .map(([key, relative]) => [key, this.evidence(relative)]));
    Object.assign(evidence, {
      fallbackSource: this.evidence(FALLBACK_SOURCE),
      calculatorTarget: this.evidence(data.fallbackReview.targetModule),
      bootstrap: this.evidence("src/app/bootstrap.js"),
      inventoryUI: this.evidence("src/ui/inventory/inventory_v2_ui.js"),
      inventoryBootstrap: this.evidence("src/ui/inventory/inventory_v2_bootstrap.js"),
      tooltip: this.evidence("src/ui/inventory/inventory_v2_tooltip_presenter.js"),
      index: this.evidence("index.html"),
      runtimeBundle: this.evidence(`${data.runtime.output.directory}${data.runtime.output.runtimeFile}`),
      changelog: this.evidence("CHANGELOG.md"),
    });
    if (batchCompleted) {
      evidence.state = structuredClone(data.live.evidence.executionState);
      evidence.index = structuredClone(data.live.evidence.index);
      evidence.changelog = {
        path: data.historicalRepair.path,
        sha256: data.historicalRepair.restoredSha256,
      };
    }
    const inputs = { ...data, observedManifest, batch, fallback, evidence };
    const result = new StageThreeBatch007ObservationReconciliation().build(inputs);
    createMigrationManifestValidator().validate({ manifest: result.manifest, policy, sourceFiles, legacyScripts,
      canonicalPath: new CanonicalModulePath(), currentAreaResolver: new CurrentAreaResolver({
        rootValue: policy.migrationManifest.currentArea.rootValue }) });
    const graph = new PersistedDependencyGraph(result.manifest);
    new ObservationGraphIntegrityValidator(contract.resolutionModel).validate({ manifest: result.manifest,
      graph, reverseConsumerIndex: new DerivedReverseConsumerIndex(graph) });
    assert.deepEqual(this.protectedSnapshot(), before, "Preparation mutated protected files");
    return { ...result, inputs };
  }

  check() {
    const before = this.protectedSnapshot({ includeManifest: true, includeArtifact: true });
    const expected = this.prepare();
    assert.deepEqual(this.bytes(PATHS.manifest), manifestBytes(expected.manifest));
    const artifact = this.json(PATHS.output);
    const historicalExpected = structuredClone(expected.artifact);
    // Stage 3.7.7 evidence remains immutable. The manifest transition validator
    // above already proves the exact later hydration-boundary and opt-in probe
    // observation deltas. The probe adds one required DEBUG_MODULES consumer
    // and one confirmed relationship without changing the inter-file edge set.
    assert.equal(
      expected.artifact.totals.consumers,
      artifact.totals.consumers + 1,
      "Unexpected post-3.7.7 consumer delta",
    );
    assert.equal(
      expected.artifact.totals.confirmed,
      artifact.totals.confirmed + 1,
      "Unexpected post-3.7.7 confirmed relationship delta",
    );
    historicalExpected.totals = structuredClone(artifact.totals);
    historicalExpected.evidence.manifest = artifact.evidence.manifest;
    historicalExpected.evidence.state = artifact.evidence.state;
    historicalExpected.evidence.index = artifact.evidence.index;
    historicalExpected.evidence.changelog = artifact.evidence.changelog;
    new StageThreeBatch007ReconciliationValidator().validate(
      artifact,
      historicalExpected,
    );
    assert.deepEqual(this.bytes(PATHS.output), manifestBytes(historicalExpected), "non-canonical evidence bytes");
    assert.deepEqual(this.protectedSnapshot({ includeManifest: true, includeArtifact: true }), before,
      "Read-only reconciliation check mutated files");
    return artifact;
  }

  write({ failureInjector = null } = {}) {
    const before = this.protectedSnapshot();
    const result = this.prepare();
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector }).commit([
      { relativePath: PATHS.manifest, bytes: manifestBytes(result.manifest) },
      { relativePath: PATHS.output, bytes: manifestBytes(result.artifact) },
    ], () => {
      this.check();
      assert.deepEqual(this.protectedSnapshot(), before, "Finalization changed runtime or frozen metadata");
    });
    return result.artifact;
  }

  protectedSnapshot({ includeManifest = false, includeArtifact = false } = {}) {
    const files = new Set(["index.html", "package.json", "package-lock.json", "CHANGELOG.md"]);
    const walk = (relative) => {
      for (const item of fs.readdirSync(this.absolute(relative), { withFileTypes: true })) {
        const child = `${relative}/${item.name}`;
        if (item.isDirectory()) walk(child);
        else files.add(child);
      }
    };
    walk("src");
    walk("architecture");
    walk("dist/stage-3-compat-runtime");
    if (!includeManifest) files.delete(PATHS.manifest);
    if (!includeArtifact) files.delete(PATHS.output);
    // Transaction temporaries are owned by ControlledMetadataTransaction, not runtime truth.
    return [...files].filter((name) => !/\/\.[^/]+\.(stage|backup)-\d+-\d+$/u.test(name)).sort()
      .map((relative) => this.evidence(relative));
  }

  verifyHistoricalRepair(record) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.kind, "cyber-fishing-historical-changelog-repair");
    assert.equal(record.status, "exact-restoration-verified");
    assert.equal(record.stage, "stage-3.7.7");
    assert.equal(record.path, "CHANGELOG.md");
    assert.equal(record.source.kind, "git-blob");
    assert.equal(record.source.path, record.path);
    assert.match(record.source.commit, /^[a-f0-9]{40}$/u);
    assert.match(record.beforeSha256, /^[a-f0-9]{64}$/u);
    assert.equal(record.operation, "restore-deleted-suffix-only");
    assert.equal(record.retainedPrefixUnchanged, true);
    assert.equal(record.releaseNotesRewritten, false);
    const bytes = new StageThreeBatch007LifecycleTransition()
      .historicalChangelogBytes(this.bytes(record.path), record.restoredSha256);
    assert(Number.isInteger(record.beforeByteLength) && record.beforeByteLength > 0 &&
      record.beforeByteLength < bytes.length);
    assert.equal(sha256(bytes.subarray(0, record.beforeByteLength)), record.beforeSha256,
      "Restoration changed the previously retained prefix");
    assert.equal((bytes.subarray(record.beforeByteLength).toString("utf8").match(/\n/gu) || []).length,
      record.restoredLineCount, "Restored suffix line count differs");
    assert.equal(sha256(bytes), record.restoredSha256, "Restored changelog bytes differ from historical evidence");
    const blob = crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    assert.equal(blob, record.source.blob, "Restored changelog differs from the authoritative Git blob");
  }

  evidence(relative) { return { path: relative, sha256: sha256(this.bytes(relative)) }; }
  json(relative) { return JSON.parse(this.bytes(relative)); }
  bytes(relative) { return fs.readFileSync(this.absolute(relative)); }
  absolute(relative) {
    assert(!path.isAbsolute(relative) && !relative.includes("\\") &&
      !relative.split("/").some((part) => ["", ".", ".."].includes(part)), "invalid project-relative path");
    return path.resolve(this.root, relative);
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert(args.length <= 1 && (args.length === 0 || ["--write", "--acceptance-gate", "--release-gate"].includes(args[0])), "unknown option");
    const app = new StageThreeBatch007ObservationApplication();
    const artifact = args[0] === "--write" ? app.write() : app.check();
    if (args[0] === "--release-gate") new StageThreeBatch007ReconciliationValidator().assertReleaseAllowed(artifact);
    if (args[0] === "--acceptance-gate") new StageThreeBatch007ReconciliationValidator().assertAcceptanceAllowed(artifact);
    console.log(`Stage 3.7.7 mechanical reconciliation passed: ${artifact.totals.modules} modules, ` +
      `${artifact.totals.edges} edges, ${artifact.frozenBridgeRelationships.length} frozen relationships + ` +
      `1 reviewed guarded standalone fallback; Stage 3.7.8 eligible, release closure not authorized.`);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { StageThreeBatch007ObservationApplication, PATHS };
