"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { BATCH_009_EXECUTION_PROFILE: PROFILE } = require("./stage_three_batch_009_execution_profile");
const { BATCH_009_PREFLIGHT_PROFILE: PREFLIGHT } = require("./stage_three_batch_009_preflight_profile");
const { StageThreeBatchPreflightAuditBuilder, StageThreeBatchPreflightAuditValidator } = require("./stage_three_batch_preflight_audit");
const { StageThreeBatchExecutionPlanProjector } = require("./stage_three_batch_execution_plan_projector");
const { StageThreeBatchExecutionPlanValidator } = require("./stage_three_batch_execution_plan");
const { StageThreeBatchFocusedTestMatrixBuilder, StageThreeBatchFocusedTestMatrixValidator } = require("./stage_three_batch_focused_test_matrix");
const { ArchitecturePolicy } = require("../core/architecture_policy");
const { LiveObservationSnapshot } = require("../observation/persistence/live_observation_snapshot");
const { StageTwoRuntimeScriptAliasResolver } = require("../migration/stage_two_runtime_script_alias_resolver");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { Batch009EarlierEvaluationGate } = require("./stage_three_batch_009_evaluation_gate");
const { immutableRecord } = require("../guards/core/guard_models");

const PATHS = Object.freeze({
  audit: PROFILE.auditPath, output: PROFILE.executionPlanPath,
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  domainAudit: "architecture/migration/stage_3_domain_audit.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html", runtimeOutput: "dist/stage-3-compat-runtime",
});
const ROLLBACK_PATHS = [
  "CHANGELOG.md", "architecture/build/package_contract.json", PATHS.bridgeRegistry,
  PATHS.manifest, PATHS.runtimeContract, PATHS.executionState, PATHS.index,
  "package-lock.json", "package.json", "refactor_Task.txt", "src/config/project_version.js",
  ...PROFILE.expectedTargets.map(m => m.currentPath),
];
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const serialize = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

class Batch009Planning {
  constructor(root) {
    this.root = path.resolve(root);
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root, profile: PROFILE, paths: PATHS, rollbackFilePaths: ROLLBACK_PATHS,
      readBytes: file => this.bytes(file),
    });
  }
  bytes(file) { return require("./stage_three_batch_009_prebuild_history").beforeBatch009Prebuild(
    file, fs.readFileSync(path.join(this.root, file)), this.root); }
  json(file) { return JSON.parse(this.bytes(file)); }
  read(file) { return this.bytes(file).toString("utf8"); }

  audit() {
    const inputs = Object.fromEntries(Object.entries(PATHS).filter(([key]) =>
      ["approvedPlan", "manifest", "domainAudit", "executionState", "runtimeContract", "bridgeRegistry"].includes(key))
      .map(([key, file]) => [key, this.json(file)]));
    assert(!Object.hasOwn(inputs.executionState, "activeBatchPhase"), "stale active phase");
    assert.equal(inputs.executionState.approvedPlanSha256, sha(this.bytes(PATHS.approvedPlan)));
    for (const m of PROFILE.expectedTargets) assert(!fs.existsSync(path.join(this.root, m.targetPath)), "target already active");
    const policy = ArchitecturePolicy.load(path.join(this.root, "architecture/module_architecture.json"));
    const live = new LiveObservationSnapshot().build({ projectRoot: this.root, policy, manifest: inputs.manifest });
    // Recompute actual facts; old audit is not a substitute for live observation.
    const currentByPath = new Map(inputs.manifest.modules.map(m => [m.currentPath, m]));
    for (const m of live.modules) {
      const persisted = currentByPath.get(m.currentPath);
      assert(persisted, `unmanifested source: ${m.currentPath}`);
      assert.deepEqual(m.observed, persisted.observed, `stale observed facts: ${m.currentPath}`);
      assert.deepEqual(m.analysis.dependencies, persisted.analysis.dependencies, `stale dependencies: ${m.currentPath}`);
    }
    assert.equal(live.modules.length, inputs.manifest.modules.length);
    for (const target of PROFILE.expectedTargets) {
      const entry = live.modules.find(m => m.currentPath === target.currentPath);
      assert.equal(entry.architecture.targetBoundary, "game-domain", "ownership drift");
      assert.equal(entry.architecture.targetPath, target.targetPath, "approved target path drift");
      assert.equal(entry.architecture.migrationStatus, "classified", "provider no longer preflight-classic");
      assert.deepEqual(entry.architecture.roles, ["domain-behavior"], "role drift");
      assert.equal(entry.analysis.dependencies.status, "verified");
      for (const field of ["items", "unresolved", "ambiguous", "issues"]) {
        assert.equal(entry.analysis.dependencies[field].length, 0, `non-leaf/uncertain dependency: ${target.currentPath}/${field}`);
      }
    }
    const runtimeFacts = this.projector.runtimeFacts(inputs);
    return this.buildAuditFromInputs(inputs, live, { ...runtimeFacts, bridgeCount: inputs.bridgeRegistry.bridges.length });
  }

  buildAuditFromInputs(inputs, live, runtimeFacts) {
    const evidence = Object.fromEntries(Object.entries(inputs).map(([key]) => [key + "Sha256", sha(this.bytes(PATHS[key]))]));
    const audit = new StageThreeBatchPreflightAuditBuilder({ profile: PREFLIGHT }).build({
      ...inputs, ...evidence, indexSha256: sha(this.bytes(PATHS.index)),
      runtimeOutputFingerprint: this.projector.rollbackEvidence().runtimeOutput.fingerprint,
      runtimeFacts, sourceReader: file => this.read(file),
    });
    new StageThreeBatchPreflightAuditValidator(PREFLIGHT).validate(audit);
    const batch = inputs.approvedPlan.batches.find(b => b.id === PROFILE.batchId);
    const targetSet = new Set(PROFILE.expectedTargets.map(m => m.currentPath));
    const consumerFacts = live.modules.flatMap(m => m.analysis.dependencies.items
      .filter(edge => edge.resolution === "confirmed" && targetSet.has(edge.target))
      .map(edge => ({ source: m.currentPath, provider: edge.target, symbols: edge.symbols })));
    const key = r => `${r.provider}|${r.source}|${[...r.symbols].sort().join(",")}`;
    assert.deepEqual(consumerFacts.map(key).sort(), batch.externalLegacyConsumers.map(key).sort(), "live consumer set differs");
    const modules = [
      ...audit.closure.existingCumulativeModules.map(source => ({ currentPath: source, targetPath: source })),
      ...PROFILE.expectedTargets,
    ];
    const earlierEvaluation = new Batch009EarlierEvaluationGate().verify({
      projectRoot: this.root, modules, read: f => this.read(f), reviews: inputs.runtimeContract.sideEffectReviews,
    });
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(this.root);
    const logical = new LegacyScriptOrderReader(path.join(this.root, PATHS.index), { scriptAliases: aliases }).read();
    const html = this.read(PATHS.index);
    const runtimePath = inputs.runtimeContract.output.directory + inputs.runtimeContract.output.runtimeFile;
    const physical = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gu)].map(m => m[1].split("?")[0]);
    const runtimeIndex = physical.indexOf(runtimePath);
    assert(runtimeIndex >= 0 && physical.lastIndexOf(runtimePath) === runtimeIndex, "not one runtime");
    const nextLogical = physical.slice(runtimeIndex + 1).map(f => logical.find(l => l.source.split("?")[0] === f)).find(Boolean);
    const minimum = Math.min(...inputs.runtimeContract.activationPositions.map(a => a.legacyScriptIndex),
      ...batch.compatibility.newActivations.map(a => a.contract.legacyScriptIndex));
    for (const a of batch.compatibility.newActivations) {
      assert.equal(logical.find(l => l.currentPath === a.contract.sourceProvider)?.legacyLoadOrder, a.contract.legacyScriptIndex);
    }
    return immutableRecord({ ...audit,
      liveObservation: { status: "verified", sourceCount: live.modules.length, persistencePerformed: false, consumerRelationships: consumerFacts },
      earlierEvaluation,
      runtimeRelocation: {
        runtimePath, beforeLogicalPosition: nextLogical.legacyLoadOrder,
        afterLogicalPosition: minimum, required: minimum < nextLogical.legacyLoadOrder,
        strategy: "move-existing-single-runtime-immediately-before-earliest-approved-activation",
        logicalOrderUnchanged: true, physicalScriptCountUnchanged: true,
        existingActivationPositionsUnchanged: true, newInfrastructureGlobalAllowed: false,
        candidateBuildMustRevalidateEntireClosure: true,
      },
      stateReviewClarifications: {
        mechanicalOwnerListsMayIncludeMethods: true,
        actualStateOwner: "resolver-instance-not-module-or-transport",
        rarity: "constructor-normalized-primitives-and-private-Set; no setters; fresh result per call",
        anomaly: "one frozen none-result per instance; fresh frozen success result per call",
        allocationCountsAre: "static-source-site-counts-not-measured-allocations-per-frame",
      },
    });
  }

  plan() {
    const audit = this.json(PATHS.audit);
    const base = this.projector.buildPlan();
    const plan = structuredClone(base);
    plan.runtimeRelocation = audit.runtimeRelocation;
    plan.earlierEvaluationEvidence = { path: PATHS.audit, sha256: sha(this.bytes(PATHS.audit)), wholeClosureRevalidationRequired: true };
    plan.operations[3].outcome = "Render both shims in isolated candidate storage; live classic providers remain unchanged.";
    plan.operations[4].outcome = "Project exact bridge records in candidate metadata only; live registry remains unchanged.";
    plan.operations[5].outcome = "Project candidate Manifest/runtime contract; no planned topology enters active runtime truth.";
    plan.operations[6].outcome = "Validate isolated cumulative build and earlier evaluation, then atomically publish providers/shims, output, index relocation, registry, Manifest and runtime-active state; restore all before-images on failure.";
    plan.cutoverTransaction = {
      prebuildPhase: "metadata-only-activeBatchPhase-prebuild-live-topology-remains-34-35-60",
      candidatePhase: "targets-shims-registry-manifest-runtime-contract-in-isolated-candidate-view",
      publishOnlyAfter: ["source-equivalence", "whole-closure-earlier-evaluation", "candidate-build-output-validation", "identity-and-timing-fixtures"],
      publishTogether: ["two-targets", "two-provider-shims", "single-runtime-output", "runtime-script-relocation", "runtime-contract", "bridge-registry", "manifest", "runtime-active-state"],
      onFailure: "restore-all-before-images-and-previous-validated-output; do-not-serve-partial-publication",
      filesystemMultiFileRenameIsNotAtomic: true,
      completedOnlyAfterFullAcceptance: true,
    };
    plan.rollback.restoreRuntimeBeforeLogicalPosition = audit.runtimeRelocation.beforeLogicalPosition;
    plan.acceptance.preBuild.push("whole-closure-source-shas-and-reviewed-initializers-current");
    plan.acceptance.postBuild.push("runtime-before-earliest-activation-with-all-other-logical-positions-preserved");
    plan.acceptance.releaseCriteria.push("exact-release-sha-forward-and-reverse-transitions", "structured-user-browser-confirmation");
    this.validatePlan(plan);
    return immutableRecord(plan);
  }
  validatePlan(plan) {
    new StageThreeBatchExecutionPlanValidator(PROFILE).validate(plan);
    const audit = this.json(PATHS.audit);
    assert.deepEqual(plan.runtimeRelocation, audit.runtimeRelocation, "relocation differs from audited positions");
    assert.equal(plan.earlierEvaluationEvidence.sha256, sha(this.bytes(PATHS.audit)), "stale full-closure evidence");
    assert.equal(plan.cutoverTransaction.completedOnlyAfterFullAcceptance, true);
    assert.equal(plan.cutoverTransaction.filesystemMultiFileRenameIsNotAtomic, true);
    assert.equal(plan.rollback.restoreRuntimeBeforeLogicalPosition, audit.runtimeRelocation.beforeLogicalPosition);
    const frozen = this.json(PATHS.approvedPlan).batches.find(b => b.id === PROFILE.batchId);
    const expectedActivations = frozen.compatibility.newActivations.map(a => ({ ...a.contract,
      mechanism: a.mechanism, consumers: [...a.legacyConsumers].sort(), removalCondition: a.removalCondition,
    })).sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(plan.compatibility.activations, expectedActivations, "exact activation contract drift");
    for (const bridge of plan.compatibility.plannedBridgeRecords) {
      const activation = expectedActivations.find(a => a.sourceProvider === bridge.bridge);
      assert(activation && activation.consumers.includes(bridge.source), "unapproved consumer relationship");
      assert.equal(bridge.target, activation.targetModule);
      assert.equal(bridge.removalStage, activation.removalStage);
      assert.equal(bridge.reason, PROFILE.bridgeReason);
      assert.deepEqual(bridge.globalProviders, [{ symbol: activation.legacySymbol, mechanism: "global-this-property" }]);
    }
    assert.deepEqual(plan.cutoverTransaction.publishTogether, ["two-targets", "two-provider-shims", "single-runtime-output", "runtime-script-relocation", "runtime-contract", "bridge-registry", "manifest", "runtime-active-state"]);
    assert.deepEqual(plan.cutoverTransaction.publishOnlyAfter, ["source-equivalence", "whole-closure-earlier-evaluation", "candidate-build-output-validation", "identity-and-timing-fixtures"]);
    return plan;
  }
  matrix(dependencies) {
    const matrix = new StageThreeBatchFocusedTestMatrixBuilder(dependencies).build({
      executionPlan: this.json(PROFILE.executionPlanPath), executionPlanSha256: sha(this.bytes(PROFILE.executionPlanPath)),
    });
    return new StageThreeBatchFocusedTestMatrixValidator(dependencies).validate(matrix);
  }
}
module.exports = { Batch009Planning, PROFILE, PREFLIGHT, PATHS, sha, serialize };
