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
const { StageThreeApprovedPlanSource } = require("./stage_three_approved_plan_source");

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
    // The plan source returns the historical plan unchanged or, after adoption, the historical
    // prefix followed by the Stage 3.22 continuation; its audit evidence follows the same plan.
    const plan = new StageThreeApprovedPlanSource({ read: file => this.bytes(file) })
      .load(inputs.executionState, { adopting: this.profile.executionProfile.continuationPlan || null });
    inputs.approvedPlan = plan.document;
    const domainAuditDocument = this.json(plan.domainAuditPath);
    inputs.domainAudit = plan.continuation ? domainAuditDocument.document : domainAuditDocument;
    const { approvedPlan, manifest, domainAudit, executionState, runtimeContract, bridgeRegistry } = inputs;
    const batchId = this.profile.batchId;
    const targets = this.profile.executionProfile.expectedTargets;
    const expectedImports = this.profile.executionProfile.expectedImports || [];
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
      assert.deepEqual(module.analysis.dependencies.items, this.#reviewedImportItems(expectedImports, target.currentPath),
        `target dependency differs from its reviewed imports: ${target.currentPath}`);
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
    if (plan.continuation) {
      evidence.approvedPlanSha256 = plan.sha256;
      evidence.domainAuditSha256 = sha(this.bytes(plan.domainAuditPath));
    }
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
        ...(plan.continuation ? plan.references
          : [{ path: PATHS.approvedPlan, sha256: evidence.approvedPlanSha256 }]),
        { path: PATHS.executionState, sha256: evidence.executionStateSha256 },
      ]);
      for (const module of sideEffectReview.modules) {
        assert.equal(module.sourceSha256, sha(this.bytes(module.currentPath)),
          `side-effect source drift: ${module.currentPath}`);
      }
    }
    const base = new StageThreeBatchPreflightAuditBuilder({ profile: this.profile }).build({
      ...inputs, ...evidence, indexSha256: sha(this.bytes(PATHS.index)),
      ...(plan.continuation ? { planEvidence: { references: plan.references, domainAuditPath: plan.domainAuditPath } } : {}),
      activationPositions: runtimeContract.activationPositions, expectedImports,
      runtimeOutputFingerprint: this.projector.rollbackEvidence().runtimeOutput.fingerprint,
      runtimeFacts, sourceReader: file => this.read(file),
      sideEffectReview, sideEffectReviewSha256,
    });
    // Stage 3 activations whose every bridge is held by a module of this batch lose their last
    // classic consumer: the batch retires them (inert placeholder position, no global).
    const retiring = this.retiringActivations({ runtimeContract, bridgeRegistry, currentPaths });
    assert.deepEqual(retiring.map(item => item.id), this.profile.executionProfile.expectedRetiredActivationIds || [],
      "retiring activation set differs from the profile");
    const plannedTopology = {
      projectModuleCount: new Set([...base.runtimeBaseline.projectModules, ...base.closure.newProjectModules]).size,
      activationCount: runtimeFacts.activationCount + base.compatibility.activations.length - retiring.length,
      bridgeRecordCount: runtimeFacts.bridgeCount + consumers.length -
        (this.profile.executionProfile.expectedRetiredBridgeIds || []).length,
    };
    const artifact = immutableRecord({
      ...base,
      liveObservation: { status: "verified", sourceCount: live.modules.length,
        persistencePerformed: false, consumerRelationships: consumers },
      plannedTopology,
      ...(retiring.length > 0 ? { activationRetirement: {
        reason: "all-listed-legacy-consumers-migrated", placeholder: "inert-classic-position",
        activations: retiring.map(item => ({ ...item })) } } : {}),
    });
    return this.validate(artifact);
  }

  retiringActivations({ runtimeContract, bridgeRegistry, currentPaths }) {
    const holds = (bridge, activation) => bridge.target === activation.targetModule &&
      bridge.globalProviders.some(provider => provider.symbol === activation.legacySymbol);
    return runtimeContract.activationPositions.filter(activation => activation.owner.startsWith("stage-3."))
      .filter(activation => {
        const bridges = bridgeRegistry.bridges.filter(bridge => holds(bridge, activation));
        return bridges.length > 0 && bridges.every(bridge => currentPaths.has(bridge.source));
      })
      .sort((left, right) => left.id.localeCompare(right.id));
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
    const expectedImports = this.profile.executionProfile.expectedImports || [];
    for (const module of artifact.scope.modules) {
      // A positive depth is only the dependency on completed earlier batches of this continuation;
      // the audit proves each such closure edge is a completed batch read through a reviewed import.
      assert(module.dependencyDepth === 0 || (artifact.prerequisites.reviewed || [])
        .some(prerequisite => prerequisite.kind === "batch-completion"),
      `dependency depth ${module.dependencyDepth} requires completed prerequisite batches: ${module.currentPath}`);
      assert.equal(module.scc.cyclic, false);
      assert.deepEqual(module.scc.members, [module.currentPath]);
      assert.deepEqual(module.outgoingProjectEdges.map(({ target, symbols }) => ({ target, symbols })),
        this.#reviewedImportItems(expectedImports, module.currentPath).map(({ target, symbols }) => ({ target, symbols })));
    }
    return artifact;
  }

  // A reviewed import of a completed-prefix export is observed on the classic source as a confirmed
  // read of the activation shim that exposes that export.
  #reviewedImportItems(expectedImports, consumer) {
    const byShim = new Map();
    for (const record of expectedImports.filter(item => item.consumer === consumer)) {
      if (!byShim.has(record.viaShim)) byShim.set(record.viaShim, []);
      byShim.get(record.viaShim).push(record.legacySymbol);
    }
    return [...byShim].sort(([left], [right]) => left.localeCompare(right))
      .map(([target, symbols]) => ({ target, symbols: symbols.sort(), resolution: "confirmed" }));
  }

  verifyReplay(artifact) {
    this.validate(artifact);
    assert.deepEqual(serialize(artifact), serialize(this.build()),
      `${this.profile.stageLabel} audit differs from live evidence`);
    return artifact;
  }
}

module.exports = { StageThreeLivePreflight, PATHS, sha, serialize };
