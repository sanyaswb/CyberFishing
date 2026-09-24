"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const espree = require("espree");
const { ArchitecturePolicy } = require("../core/architecture_policy");
const { LiveObservationSnapshot } = require("../observation/persistence/live_observation_snapshot");
const { StageThreeBatchExecutionPlanProjector } = require("./stage_three_batch_execution_plan_projector");
const { StageThreeBatchPreflightAuditBuilder, StageThreeBatchPreflightAuditValidator } = require("./stage_three_batch_preflight_audit");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("../migration/stage_two_runtime_script_alias_resolver");
const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_010_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_010_preflight_profile");

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

class Batch010SourceContract {
  verify(source) {
    const ast = espree.parse(source, { ecmaVersion: "latest", sourceType: "script" });
    assert.equal(ast.body.length, 1, "one class declaration is required");
    const declaration = ast.body[0];
    assert.equal(declaration.type, "ClassDeclaration", "top-level effect or dependency found");
    assert.equal(declaration.id.name, "UnlimitedAssemblyCapacityPolicy");
    assert.equal(declaration.superClass, null, "inheritance changes evaluation/dependency semantics");
    assert.equal(declaration.body.body.length, 1, "class must expose only canApply");
    const method = declaration.body.body[0];
    assert.equal(method.type, "MethodDefinition");
    assert.equal(method.kind, "method");
    assert.equal(method.static, false);
    assert.equal(method.computed, false);
    assert.equal(method.key.name, "canApply");
    assert.equal(method.value.params.length, 0);
    assert.equal(method.value.body.body.length, 1, "canApply body changed");
    const statement = method.value.body.body[0];
    assert.equal(statement.type, "ReturnStatement");
    assert.equal(statement.argument.type, "ObjectExpression", "fresh object result required");
    const properties = statement.argument.properties;
    assert.equal(properties.length, 2, "result key count changed");
    assert.deepEqual(properties.map(property => property.key.name), ["allowed", "reason"]);
    assert(properties.every(property => property.type === "Property" && !property.computed && !property.method && !property.shorthand && property.kind === "init"));
    assert.equal(properties[0].value.type, "Literal");
    assert.equal(properties[0].value.value, true);
    assert.equal(properties[1].value.type, "Literal");
    assert.equal(properties[1].value.value, null);
    const context = vm.createContext({});
    const Policy = new vm.Script(`${source}\nUnlimitedAssemblyCapacityPolicy`, { filename: "batch-010-classic-baseline.js" }).runInContext(context);
    const policy = new Policy();
    const first = policy.canApply();
    const second = policy.canApply();
    assert.deepEqual(Object.keys(first), ["allowed", "reason"]);
    assert.equal(first.allowed, true);
    assert.equal(first.reason, null);
    assert.notStrictEqual(first, second, "canApply must allocate a fresh result per call");
    assert.deepEqual(Object.keys(second), ["allowed", "reason"]);
    assert.equal(second.allowed, true);
    assert.equal(second.reason, null);
    return immutableRecord({
      className: declaration.id.name,
      methodName: "canApply",
      resultKeys: ["allowed", "reason"],
      resultValues: { allowed: true, reason: null },
      freshResultPerCall: true,
      objectAllocationsPerCall: 1,
      instanceFields: [],
      topLevelEffects: [],
      externalReads: [],
    });
  }
}

class Batch010Preflight {
  constructor(root) {
    this.root = path.resolve(root);
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root, profile: PROFILE.executionProfile, paths: PATHS,
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
    assert.equal(executionState.approvedPlanSha256, sha(this.bytes(PATHS.approvedPlan)), "approved plan fingerprint is stale");
    assert(!Object.hasOwn(executionState, "activeBatchPhase"), "active batch phase already exists");
    const target = PROFILE.executionProfile.expectedTargets[0];
    assert(!fs.existsSync(path.join(this.root, target.targetPath)), "target already exists before batch 010");
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
    const liveTarget = live.modules.find(module => module.currentPath === target.currentPath);
    assert(liveTarget, "batch 010 source absent from live observation");
    assert.equal(liveTarget.architecture.targetPath, target.targetPath, "target ownership drift");
    assert.equal(liveTarget.architecture.targetBoundary, "game-domain", "target boundary drift");
    assert.equal(liveTarget.architecture.migrationStatus, "classified", "source is no longer classic-classified");
    assert.deepEqual(liveTarget.analysis.dependencies.items, [], "target acquired a project dependency");
    const source = this.read(target.currentPath);
    const sourceContract = new Batch010SourceContract().verify(source);
    const batch = approvedPlan.batches.find(record => record.id === PROFILE.batchId);
    assert(batch, "frozen batch 010 missing");
    const consumerFacts = live.modules.flatMap(module => module.analysis.dependencies.items
      .filter(edge => edge.resolution === "confirmed" && edge.target === target.currentPath)
      .map(edge => ({ provider: target.currentPath, source: module.currentPath,
        sourceBoundary: module.architecture.targetBoundary, symbols: [...edge.symbols].sort() })))
      .sort((left, right) => left.source.localeCompare(right.source));
    assert.deepEqual(consumerFacts, batch.externalLegacyConsumers, "live classic consumer set differs from frozen batch");
    const auditEntry = domainAudit.entries.find(entry => entry.currentPath === target.currentPath);
    assert(auditEntry, "historical domain audit entry missing");
    assert.deepEqual(auditEntry.dependencyAudit.facts.reverseConsumers, consumerFacts.map(({ source, sourceBoundary, symbols }) => ({ source, sourceBoundary, symbols })),
      "domain reverse consumer evidence differs from current graph");
    const logical = new LegacyScriptOrderReader(path.join(this.root, PATHS.index), {
      scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(this.root),
    }).read();
    const sourcePosition = logical.find(script => script.currentPath === target.currentPath)?.legacyLoadOrder;
    assert.equal(sourcePosition, 148, "classic provider load position changed");
    assert.equal(batch.compatibility.newActivations[0].contract.legacyScriptIndex, sourcePosition,
      "activation position differs from live classic provider");
    const runtimeFacts = {
      ...this.projector.runtimeFacts({ approvedPlan, executionState, runtimeContract }),
      bridgeCount: bridgeRegistry.bridges.length,
    };
    const evidence = Object.fromEntries(Object.entries(inputs)
      .map(([key]) => [`${key}Sha256`, sha(this.bytes(PATHS[key]))]));
    const base = new StageThreeBatchPreflightAuditBuilder({ profile: PROFILE }).build({
      ...inputs, ...evidence, indexSha256: sha(this.bytes(PATHS.index)),
      runtimeOutputFingerprint: this.projector.rollbackEvidence().runtimeOutput.fingerprint,
      runtimeFacts, sourceReader: file => this.read(file),
    });
    const plannedTopology = {
      projectModuleCount: new Set([...base.runtimeBaseline.projectModules, ...base.closure.newProjectModules]).size,
      activationCount: runtimeFacts.activationCount + base.compatibility.activations.length,
      bridgeRecordCount: runtimeFacts.bridgeCount + consumerFacts.length,
    };
    assert.deepEqual(plannedTopology, { projectModuleCount: 37, activationCount: 38, bridgeRecordCount: 64 });
    const artifact = immutableRecord({
      ...base,
      liveObservation: {
        status: "verified", sourceCount: live.modules.length,
        persistencePerformed: false, consumerRelationships: consumerFacts,
      },
      sourceContract,
      plannedTopology,
    });
    this.validate(artifact);
    return artifact;
  }

  validate(artifact) {
    new StageThreeBatchPreflightAuditValidator(PROFILE).validate(artifact);
    assert.equal(artifact.scope.modules[0].dependencyDepth, 0);
    assert.equal(artifact.scope.modules[0].scc.cyclic, false);
    assert.deepEqual(artifact.scope.modules[0].scc.members, [PROFILE.executionProfile.expectedTargets[0].currentPath]);
    assert.deepEqual(artifact.scope.modules[0].outgoingProjectEdges, []);
    assert.deepEqual(artifact.scope.modules[0].sourceShape.methods.map(method => method.name), ["canApply"]);
    assert.deepEqual(artifact.sourceContract.resultValues, { allowed: true, reason: null });
    assert.equal(artifact.sourceContract.freshResultPerCall, true);
    assert.equal(artifact.sourceContract.objectAllocationsPerCall, 1);
    assert.deepEqual(artifact.sourceContract.externalReads, []);
    assert.equal(artifact.liveObservation.status, "verified");
    assert.equal(artifact.liveObservation.persistencePerformed, false);
    assert.deepEqual(artifact.liveObservation.consumerRelationships, artifact.compatibility.consumers);
    assert.deepEqual(artifact.plannedTopology, { projectModuleCount: 37, activationCount: 38, bridgeRecordCount: 64 });
    return artifact;
  }

  verifyReplay(artifact) {
    this.validate(artifact);
    assert.deepEqual(serialize(artifact), serialize(this.build()),
      "Stage 3.10.0 audit differs from live source, consumer, activation, graph or runtime evidence");
    return artifact;
  }
}

module.exports = { Batch010Preflight, Batch010SourceContract, PROFILE, PATHS, sha, serialize };
