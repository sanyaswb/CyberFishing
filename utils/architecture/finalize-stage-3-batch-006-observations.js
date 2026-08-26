"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  MigrationManifestRepository,
} = require("./migration/migration_manifest_repository");
const {
  createMigrationManifestValidator,
} = require("./migration/migration_manifest_validator");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const { CanonicalModulePath } = require("./migration/canonical_module_path");
const { CurrentAreaResolver } = require("./migration/current_area_resolver");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { SourceFileScanner } = require("./migration/source_file_scanner");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-006-fishing-e48e70d8";
const MANIFEST_PATH = "architecture/migration/module_migration_manifest.json";
const OUTPUT_PATH = "architecture/migration/stage_3_batch_006_observation_reconciliation.json";

class StageThreeBatch006ObservationFinalizer {
  run() {
    const manifest = this.#json(MANIFEST_PATH);
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const contract = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const baseline = this.#json("architecture/guards/global_provider_baseline.json");
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    this.#require(batch?.status === "approved-frozen", "batch is not approved-frozen");
    const entries = new Map(manifest.modules.map((record) => [record.currentPath, record]));
    const activations = contract.activationPositions.filter((record) =>
      record.owner === BATCH_ID);
    const bridges = registry.bridges.filter((record) => record.owner === BATCH_ID);
    this.#require(activations.length === 6, "activation set differs");
    this.#require(bridges.length === 7, "bridge set differs");
    const controlledTransitions = [];
    for (const moduleRecord of batch.modules) {
      const source = entries.get(moduleRecord.currentPath);
      const target = entries.get(moduleRecord.targetPath);
      const activation = activations.find((record) =>
        record.sourceProvider === moduleRecord.currentPath);
      this.#require(source && target && activation,
        `Manifest pair is incomplete: ${moduleRecord.currentPath}`);
      this.#require(this.#same(source.architecture.roles, ["compatibility-bridge"]),
        `source role differs: ${moduleRecord.currentPath}`);
      this.#require(source.architecture.targetPath === moduleRecord.targetPath,
        `source targetPath differs: ${moduleRecord.currentPath}`);
      this.#require(source.observed.providers.status === "verified" &&
        source.observed.providers.items.length === 1,
      `source provider observation differs: ${moduleRecord.currentPath}`);
      this.#require(this.#same(source.observed.providers.items[0], {
        symbol: activation.legacySymbol,
        mechanism: "global-this-property",
        availability: "program-init",
      }), `source provider transition differs: ${moduleRecord.currentPath}`);
      this.#require(this.#same(source.observed.consumers.items, [{
        symbol: "__CYBER_FISHING_COMPAT_RUNTIME__",
        mechanism: "global-this-property",
        accessRequirement: "required",
        executionPhase: "eager",
      }]), `source transport observation differs: ${moduleRecord.currentPath}`);
      this.#require(source.analysis.dependencies.items.length === 0 &&
        source.analysis.dependencies.confirmed.length === 0 &&
        source.analysis.dependencies.ambiguous.length === 0 &&
        this.#same(source.analysis.dependencies.unresolved, [{
          symbol: "__CYBER_FISHING_COMPAT_RUNTIME__",
          mechanism: "global-this-property",
          accessRequirement: "required",
          executionPhase: "eager",
          resolution: "unresolved",
        }]), `source unresolved set differs: ${moduleRecord.currentPath}`);
      this.#require(target.architecture.targetBoundary === "game-domain" &&
        this.#same(target.architecture.roles, moduleRecord.roles) &&
        target.architecture.targetPath === moduleRecord.targetPath,
      `target architecture differs: ${moduleRecord.targetPath}`);
      this.#require(target.observed.providers.status === "verified" &&
        target.observed.consumers.status === "verified" &&
        target.analysis.dependencies.status === "verified" &&
        target.observed.providers.items.length === 0 &&
        target.observed.consumers.items.length === 0 &&
        target.analysis.dependencies.items.length === 0 &&
        target.analysis.dependencies.unresolved.length === 0 &&
        target.analysis.dependencies.ambiguous.length === 0,
      `target observations differ: ${moduleRecord.targetPath}`);
      target.architecture.migrationStatus = "verified";
      const previous = baseline.providers.find((record) =>
        record.currentPath === moduleRecord.currentPath &&
        record.symbol === activation.legacySymbol);
      this.#require(previous?.mechanism === "global-lexical",
        `legacy global baseline differs: ${moduleRecord.currentPath}`);
      this.#require(bridges.some((record) =>
        record.bridge === moduleRecord.currentPath &&
        record.target === moduleRecord.targetPath &&
        record.globalProviders.some((provider) =>
          provider.symbol === activation.legacySymbol &&
          provider.mechanism === "global-this-property")),
      `approved global transition is missing: ${moduleRecord.currentPath}`);
      controlledTransitions.push({
        currentPath: moduleRecord.currentPath,
        symbol: activation.legacySymbol,
        fromMechanism: "global-lexical",
        toMechanism: "global-this-property",
        activationId: activation.id,
      });
    }
    this.#verifyConsumerSet(batch, bridges, entries);
    delete manifest.preliminaryMigration;
    this.#validateManifest(manifest);
    new MigrationManifestRepository(this.#absolute(MANIFEST_PATH)).write(manifest);
    const artifact = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-observation-reconciliation",
      status: "verified",
      batchId: BATCH_ID,
      moduleCount: manifest.modules.length,
      targetCount: batch.modules.length,
      activationCount: activations.length,
      bridgeRelationshipCount: bridges.length,
      observations: {
        targetStatus: "verified",
        compatibilityTransportUnresolvedCount: batch.modules.length,
        preexistingUnresolvedCount: 19,
        totalUnresolvedCount: manifest.modules.reduce((count, record) =>
          count + record.analysis.dependencies.unresolved.length, 0),
        speculativeEdgeCount: 0,
        ambiguousCount: 0,
      },
      controlledGlobalTransitions: controlledTransitions.sort((left, right) =>
        left.currentPath.localeCompare(right.currentPath)),
      fingerprints: {
        manifestSha256: this.#sha256(fs.readFileSync(this.#absolute(MANIFEST_PATH))),
        registrySha256: this.#sha256(fs.readFileSync(this.#absolute(
          "architecture/guards/migration_bridge_registry.json",
        ))),
        runtimeContractSha256: this.#sha256(fs.readFileSync(this.#absolute(
          "architecture/migration/stage_3_compatibility_runtime.json",
        ))),
      },
      verdict: "eligible-for-architecture-guard-validation",
    };
    fs.writeFileSync(this.#absolute(OUTPUT_PATH),
      `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    console.log(
      `Stage 3.6.7 observations finalized: ${batch.modules.length} verified targets, ` +
        `${bridges.length} exact bridge relationships, ${batch.modules.length} controlled global transitions.`,
    );
  }

  #verifyConsumerSet(batch, bridges, entries) {
    const expected = batch.externalLegacyConsumers.map((record) =>
      `${record.provider}\0${record.source}\0${[...record.symbols].sort().join(",")}`)
      .sort();
    const actual = bridges.map((record) =>
      `${record.bridge}\0${record.source}\0${record.globalProviders
        .map((provider) => provider.symbol).sort().join(",")}`)
      .sort();
    this.#require(this.#same(actual, expected), "bridge consumer set differs");
    for (const consumer of batch.externalLegacyConsumers) {
      const entry = entries.get(consumer.source);
      this.#require(entry, `consumer Manifest entry is missing: ${consumer.source}`);
      for (const symbol of consumer.symbols) {
        this.#require(entry.analysis.dependencies.confirmed.some((record) =>
          record.symbol === symbol && record.target === consumer.provider),
        `reverse consumer resolution differs: ${consumer.source} -> ${symbol}`);
      }
    }
  }

  #validateManifest(manifest) {
    const policy = ArchitecturePolicy.load(this.#absolute(
      "architecture/module_architecture.json",
    ));
    const sourceFiles = new SourceFileScanner({
      projectRoot: PROJECT_ROOT,
      sourceRoot: this.#absolute("src"),
    }).scan();
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const legacyScripts = new LegacyScriptOrderReader(this.#absolute("index.html"), {
      scriptAliases: aliases,
    }).read();
    const currentAreaResolver = new CurrentAreaResolver({
      rootValue: policy.migrationManifest.currentArea.rootValue,
    });
    createMigrationManifestValidator().validate({
      manifest,
      policy,
      sourceFiles,
      legacyScripts,
      canonicalPath: new CanonicalModulePath(),
      currentAreaResolver,
    });
  }

  #json(relativePath) {
    return JSON.parse(fs.readFileSync(this.#absolute(relativePath), "utf8"));
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.6.7 observation reconciliation failed: ${message}`);
  }
}

new StageThreeBatch006ObservationFinalizer().run();
