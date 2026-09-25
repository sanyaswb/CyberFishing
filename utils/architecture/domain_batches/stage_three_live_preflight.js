"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ArchitecturePolicy } = require("../core/architecture_policy");
const { LiveObservationSnapshot } = require("../observation/persistence/live_observation_snapshot");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("../migration/stage_two_runtime_script_alias_resolver");
const { StageThreeBatchExecutionPlanProjector } = require("./stage_three_batch_execution_plan_projector");
const { StageThreeBatchPreflightAuditBuilder, StageThreeBatchPreflightAuditValidator } = require("./stage_three_batch_preflight_audit");
const { immutableRecord } = require("../guards/core/guard_models");

const PATHS = Object.freeze({
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  domainAudit: "architecture/migration/stage_3_domain_audit.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
  runtimeOutput: "dist/stage-3-compat-runtime",
});
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const serialize = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const consumerCompare = (a, b) => `${a.provider}\0${a.source}\0${a.symbols.join(",")}`
  .localeCompare(`${b.provider}\0${b.source}\0${b.symbols.join(",")}`);

class StageThreeLivePreflight {
  constructor(root, profile) {
    this.root = path.resolve(root);
    this.profile = profile;
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root, profile: profile.executionProfile, paths: PATHS,
      rollbackFilePaths: [],
    });
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }
  read(file) { return this.bytes(file).toString("utf8"); }

  build() {
    const inputs = Object.fromEntries(Object.entries(PATHS)
      .filter(([key]) => !["index", "runtimeOutput"].includes(key))
      .map(([key, file]) => [key, this.json(file)]));
    const { approvedPlan, manifest, domainAudit, executionState, runtimeContract, bridgeRegistry } = inputs;
    const batchId = this.profile.batchId;
    const targets = this.profile.executionProfile.expectedTargets;
    assert.equal(executionState.approvedPlanSha256, sha(this.bytes(PATHS.approvedPlan)), "approved plan fingerprint is stale");
    assert(!Object.hasOwn(executionState, "activeBatchPhase"), "active batch phase already exists");
    for (const target of targets) {
      assert(!fs.existsSync(path.join(this.root, target.targetPath)), `target already exists: ${target.targetPath}`);
    }
    const policy = ArchitecturePolicy.load(path.join(this.root, "architecture/module_architecture.json"));
    const live = new LiveObservationSnapshot().build({ projectRoot: this.root, policy, manifest });
    const persistedByPath = new Map(manifest.modules.map(module => [module.currentPath, module]));
    assert.equal(live.modules.length, manifest.modules.length, "live source count differs from Manifest");
    for (const module of live.modules) {
      const persisted = persistedByPath.get(module.currentPath);
      assert(persisted, `unmanifested source: ${module.currentPath}`);
      assert.deepEqual(module.observed, persisted.observed, `stale observed facts: ${module.currentPath}`);
      assert.deepEqual(module.analysis.dependencies, persisted.analysis.dependencies,
        `stale dependency facts: ${module.currentPath}`);
    }
    const currentPaths = new Set(targets.map(target => target.currentPath));
    for (const target of targets) {
      const module = live.modules.find(item => item.currentPath === target.currentPath);
      assert(module, `source absent from live observation: ${target.currentPath}`);
      assert.equal(module.architecture.targetPath, target.targetPath, "target ownership drift");
      assert.equal(module.architecture.targetBoundary, "game-domain", "target boundary drift");
      assert.equal(module.architecture.migrationStatus, "classified", "source is no longer classic-classified");
      assert.deepEqual(module.analysis.dependencies.items, [], `target acquired a project dependency: ${target.currentPath}`);
    }
    const batch = approvedPlan.batches.find(record => record.id === batchId);
    assert(batch, `frozen batch missing: ${batchId}`);
    const consumers = live.modules.flatMap(module => module.analysis.dependencies.items
      .filter(edge => edge.resolution === "confirmed" && currentPaths.has(edge.target))
      .map(edge => ({ provider: edge.target, source: module.currentPath,
        sourceBoundary: module.architecture.targetBoundary, symbols: [...edge.symbols].sort() })))
      .sort(consumerCompare);
    assert.deepEqual(consumers, batch.externalLegacyConsumers.map(item => ({
      provider: item.provider, source: item.source, sourceBoundary: item.sourceBoundary,
      symbols: [...item.symbols].sort(),
    })).sort(consumerCompare), "live consumer set differs from frozen batch");
    for (const target of targets) {
      const audit = domainAudit.entries.find(entry => entry.currentPath === target.currentPath);
      assert(audit, `historical domain audit entry missing: ${target.currentPath}`);
      assert.deepEqual(audit.dependencyAudit.facts.reverseConsumers,
        consumers.filter(item => item.provider === target.currentPath)
          .map(({ source, sourceBoundary, symbols }) => ({ source, sourceBoundary, symbols })),
        `domain reverse consumer evidence differs: ${target.currentPath}`);
    }
    const logical = new LegacyScriptOrderReader(path.join(this.root, PATHS.index), {
      scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(this.root),
    }).read();
    for (const activation of batch.compatibility.newActivations) {
      const sourcePosition = logical.find(script => script.currentPath === activation.contract.sourceProvider)?.legacyLoadOrder;
      assert.equal(sourcePosition, activation.contract.legacyScriptIndex,
        `activation position differs from live classic provider: ${activation.contract.sourceProvider}`);
    }
    const runtimeFacts = {
      ...this.projector.runtimeFacts({ approvedPlan, executionState, runtimeContract }),
      bridgeCount: bridgeRegistry.bridges.length,
    };
    const evidence = Object.fromEntries(Object.entries(inputs)
      .map(([key]) => [`${key}Sha256`, sha(this.bytes(PATHS[key]))]));
    let sideEffectReview = null;
    let sideEffectReviewSha256 = null;
    if (this.profile.sideEffectEvidence) {
      const reference = this.profile.sideEffectEvidence;
      const bytes = this.bytes(reference.path);
      sideEffectReviewSha256 = sha(bytes);
      assert.equal(sideEffectReviewSha256, reference.sha256, "side-effect review evidence drift");
      sideEffectReview = JSON.parse(bytes);
      assert.equal(sideEffectReview.batchId, this.profile.batchId);
      assert(["reviewed-compatible-class-exposure-only", "reviewed-compatible"]
        .includes(sideEffectReview.status));
      assert.deepEqual(sideEffectReview.inputs, [
        { path: PATHS.approvedPlan, sha256: evidence.approvedPlanSha256 },
        { path: PATHS.executionState, sha256: evidence.executionStateSha256 },
      ]);
      for (const module of sideEffectReview.modules) {
        assert.equal(module.sourceSha256, sha(this.bytes(module.currentPath)),
          `side-effect source drift: ${module.currentPath}`);
      }
    }
    const base = new StageThreeBatchPreflightAuditBuilder({ profile: this.profile }).build({
      ...inputs, ...evidence, indexSha256: sha(this.bytes(PATHS.index)),
      runtimeOutputFingerprint: this.projector.rollbackEvidence().runtimeOutput.fingerprint,
      runtimeFacts, sourceReader: file => this.read(file),
      sideEffectReview, sideEffectReviewSha256,
    });
    const plannedTopology = {
      projectModuleCount: new Set([...base.runtimeBaseline.projectModules, ...base.closure.newProjectModules]).size,
      activationCount: runtimeFacts.activationCount + base.compatibility.activations.length,
      bridgeRecordCount: runtimeFacts.bridgeCount + consumers.length,
    };
    const artifact = immutableRecord({
      ...base,
      liveObservation: { status: "verified", sourceCount: live.modules.length,
        persistencePerformed: false, consumerRelationships: consumers },
      plannedTopology,
    });
    return this.validate(artifact);
  }

  validate(artifact) {
    new StageThreeBatchPreflightAuditValidator(this.profile).validate(artifact);
    const topology = this.profile.executionProfile.expectedTopology;
    assert.deepEqual(artifact.plannedTopology, {
      projectModuleCount: topology.afterProjectModuleCount,
      activationCount: topology.afterActivationCount,
      bridgeRecordCount: topology.afterBridgeCount,
    });
    assert.equal(artifact.liveObservation.status, "verified");
    assert.equal(artifact.liveObservation.persistencePerformed, false);
    assert.deepEqual(artifact.liveObservation.consumerRelationships, artifact.compatibility.consumers);
    for (const module of artifact.scope.modules) {
      assert.equal(module.dependencyDepth, 0);
      assert.equal(module.scc.cyclic, false);
      assert.deepEqual(module.scc.members, [module.currentPath]);
      assert.deepEqual(module.outgoingProjectEdges, []);
    }
    return artifact;
  }

  verifyReplay(artifact) {
    this.validate(artifact);
    assert.deepEqual(serialize(artifact), serialize(this.build()),
      `${this.profile.stageLabel} audit differs from live evidence`);
    return artifact;
  }
}

module.exports = { StageThreeLivePreflight, PATHS, sha, serialize };
