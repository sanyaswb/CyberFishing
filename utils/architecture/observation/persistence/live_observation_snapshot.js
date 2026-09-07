"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { SourceFileScanner } = require("../../migration/source_file_scanner");
const { LegacyScriptOrderReader } = require("../../migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("../../migration/stage_two_runtime_script_alias_resolver");
const { LegacySymbolProviderScannerFactory } = require("../providers/legacy_symbol_provider_scanner");
const { LegacyExternalConsumerScannerFactory } = require("../consumers/legacy_external_consumer_scanner");
const { LegacyDependencyGraphAnalyzerFactory } = require("../resolution/legacy_dependency_graph_analyzer");
const { ObservationManifestProjector } = require("./observation_manifest_projector");
const { ManifestDependencyProjector } = require("./manifest_dependency_projector");
const { MigrationObservationSnapshotBuilder } = require("./migration_observation_snapshot_builder");
const { MigrationObservationReconciler } = require("../../migration/migration_observation_reconciler");

class LiveObservationSnapshot {
  build({ projectRoot, policy, manifest }) {
    const contract = policy.migrationManifest.observationContract;
    const patches = new MigrationObservationSnapshotBuilder({
      sourceReader: (absolute) => fs.readFileSync(absolute, "utf8"),
      providerScanner: new LegacySymbolProviderScannerFactory().create(contract),
      consumerScanner: new LegacyExternalConsumerScannerFactory().create(contract),
      dependencyAnalyzer: new LegacyDependencyGraphAnalyzerFactory().create(contract.resolutionModel),
      projector: new ObservationManifestProjector(new ManifestDependencyProjector()),
    }).build({
      sourceFiles: new SourceFileScanner({ projectRoot, sourceRoot: path.join(projectRoot, "src") }).scan(),
      legacyScripts: new LegacyScriptOrderReader(path.join(projectRoot, "index.html"), {
        scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(projectRoot),
      }).read(),
    });
    return new MigrationObservationReconciler(policy.migrationManifest.schemaVersion)
      .reconcile({ existingManifest: manifest, observationPatches: patches });
  }
}
module.exports = { LiveObservationSnapshot };
