"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch009Planning, PROFILE, PREFLIGHT, PATHS } = require("./domain_batches/stage_three_batch_009_planning");
const { StageThreeBatchPreflightAuditValidator } = require("./domain_batches/stage_three_batch_preflight_audit");
const { StageThreeBatchFocusedTestMatrixValidator } = require("./domain_batches/stage_three_batch_focused_test_matrix");
const { BATCH_009_MATRIX_DEPENDENCIES: dependencies } = require("./domain_batches/stage_three_batch_009_focused_test_catalog");
const { Batch009EarlierEvaluationGate } = require("./domain_batches/stage_three_batch_009_evaluation_gate");
const { RepresentationEquivalenceGuard, ClassicClassLoader } = require("./domain_batches/stage_three_batch_focused_harness");
const { BATCH_009_EXECUTABLE_CASES: cases } = require("./domain_batches/stage_three_batch_009_behavior_cases");

class Batch009PlanningFixtures {
  run(root = path.resolve(__dirname, "../..")) {
    const app = new Batch009Planning(root), audit = app.json(PROFILE.auditPath), plan = app.json(PROFILE.executionPlanPath);
    const matrix = app.json(PROFILE.testMatrixPath);
    let negatives = 0;
    const rejects = (base, mutation, validate, label) => {
      const changed = structuredClone(base); mutation(changed);
      assert.throws(() => validate(changed), label); negatives++;
    };
    const auditValidator = a => new StageThreeBatchPreflightAuditValidator(PREFLIGHT).validate(a);
    const matrixValidator = m => new StageThreeBatchFocusedTestMatrixValidator(dependencies).validate(m);
    auditValidator(audit); app.validatePlan(plan); matrixValidator(matrix);
    for (const [label, mutate] of [
      ["missing target", a => a.scope.modules.pop()],
      ["closure expands", a => a.closure.unexpectedDependencies.push({ target: "unapproved" })],
      ["config coupling", a => a.boundaries.directConfigDependencies.push("config")],
      ["browser capability", a => a.boundaries.browserCapabilities.push("dom")],
      ["transport read", a => a.boundaries.transportReads.push("transport")],
      ["unsafe effect", a => a.effects.unsafe.push("registration")],
      ["duplicate owner", a => a.scope.modules[0].state.ownerIdentity = "duplicate"],
      ["new allocations", a => a.scope.modules[0].sourceShape.allocationTotals.newExpressions++],
      ["missing activation", a => a.compatibility.activations.pop()],
      ["new prerequisite", a => a.prerequisites.newlyDiscovered.push("config-di")],
    ]) rejects(audit, mutate, auditValidator, label);
    for (const [label, mutate] of [
      ["wrong activation position", p => p.compatibility.activations[0].legacyScriptIndex++],
      ["missing consumer", p => p.compatibility.plannedBridgeRecords.pop()],
      ["unapproved global under same bridge ID", p => p.compatibility.plannedBridgeRecords[0].globalProviders[0].symbol = "Other"],
      ["changed activation consumer", p => p.compatibility.activations[0].consumers[0] = "src/other.js"],
      ["missing atomic publication member", p => p.cutoverTransaction.publishTogether.pop()],
      ["early publication", p => p.cutoverTransaction.publishOnlyAfter.pop()],
      ["extra consumer", p => p.compatibility.plannedBridgeRecords.push(p.compatibility.plannedBridgeRecords[0])],
      ["incorrect target", p => p.scope.modules[0].targetPath += "x"],
      ["wrong active batch", p => p.lifecycle.openState.activeBatchId = "other"],
      ["early completion", p => p.lifecycle.openState.completedBatchIds.push(PROFILE.batchId)],
      ["completed phase remains", p => p.lifecycle.completedState.activeBatchPhase = "runtime-active"],
      ["unapproved relocation", p => p.runtimeRelocation.afterLogicalPosition++],
      ["stale evaluation fingerprint", p => p.earlierEvaluationEvidence.sha256 = "0".repeat(64)],
      ["rollback wrong runtime position", p => p.rollback.restoreRuntimeBeforeLogicalPosition--],
      ["noncanonical bridge", p => p.compatibility.plannedBridgeRecords[0].id = "bridge-invalid"],
      ["isolated IIFE", p => p.cumulativeRuntime.isolatedIifeAllowed = true],
      ["missing rollback evidence", p => p.rollback.baselineEvidence.files.pop()],
    ]) rejects(plan, mutate, p => app.validatePlan(p), label);
    for (const [label, mutate] of [
      ["missing behavior", m => m.behaviorCases.pop()],
      ["missing compatibility", m => m.compatibilityCases.pop()],
      ["missing evaluation identity", m => m.identityContract.moduleEvaluationCount = 2],
      ["cutover enabled early", m => m.runtimeCutoverAllowed = true],
      ["lookup budget", m => m.statePerformanceContract.transportLookupsAllowed = 1],
    ]) rejects(matrix, mutate, matrixValidator, label);

    const gate = new Batch009EarlierEvaluationGate();
    const synthetic = source => gate.verify({ projectRoot: root,
      modules: [{ currentPath: "fixture.js", targetPath: "fixture.js" }], read: () => source, reviews: [] });
    synthetic("export class Safe { method() { return new Map(); } }");
    for (const source of [
      "export class Unsafe extends Unknown {}",
      "export class Unsafe { static state = document; }",
      "export class Unsafe { [register()]() {} }",
      "export class Unsafe { static { register(); } }",
      "register(); export class Unsafe {}",
      "const config = createConfig(); export class Unsafe {}",
      "const copy = GlobalState; export class Unsafe {}",
      "import './future.js'; export class Unsafe {}",
      "export class Unsafe {} globalThis.Extra = Unsafe;",
      "const cache = new WeakMap(); export class NeedsReview {}",
    ]) { assert.throws(() => synthetic(source)); negatives++; }
    const runtime = app.json(PATHS.runtimeContract);
    const modules = audit.earlierEvaluation.records.map(r => ({ currentPath: r.source, targetPath: r.target }));
    rejects(runtime.sideEffectReviews, r => r[0].evidenceFingerprint = "0".repeat(64), reviews => gate.verify({
      projectRoot: root, modules, reviews, read: f => app.read(f),
    }), "stale review");
    assert.throws(() => gate.verify({ projectRoot: root, modules: [...modules, modules[0]], reviews: runtime.sideEffectReviews, read: f => app.read(f) })); negatives++;

    const representation = new RepresentationEquivalenceGuard();
    const anomaly = PROFILE.expectedTargets[0], source = app.read(anomaly.currentPath);
    assert.throws(() => representation.validate({ classicSource: source,
      candidateSource: source.replace(/^class /u, "export class ").replace("normalizedRoll >= chance", "normalizedRoll > chance"),
      exportName: anomaly.exports[0], transportSymbol: runtime.transport.symbol })); negatives++;
    const loader = new ClassicClassLoader();
    const mutated = loader.load(source.replace("normalizedRoll >= chance", "normalizedRoll > chance"), anomaly.exports[0], "mutation-fixture.js");
    assert.throws(() => cases.FishAnomalyVariantResolver["exact-roll-threshold"](mutated)); negatives++;
    const raritySource = app.read(PROFILE.expectedTargets[1].currentPath);
    const badRarity = loader.load(raritySource.replace("upperDistance <= lowerDistance", "upperDistance < lowerDistance"), "FishRarityResolver", "mutation-fixture.js");
    assert.throws(() => cases.FishRarityResolver["range-gap-tie-prefers-upper-level"](badRarity)); negatives++;
    assert.throws(() => { PROFILE.expectedTargets.push({}); }); negatives++;
    const immutable = auditValidator(audit);
    assert.throws(() => { immutable.scope.modules[0].state.ownerIdentity = "changed"; }); negatives++;
    console.log(`Stage 3.9.0–3.9.2 fixtures PASS: ${negatives} negative cases including semantic mutation detection; positive contracts immutable.`);
    return negatives;
  }
}
if (require.main === module) new (require("./domain_batches/stage_three_batch_009_historical_workspace").Batch009HistoricalWorkspace)()
  .run(path.resolve(__dirname,"../.."), root => new Batch009PlanningFixtures().run(root)).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { Batch009PlanningFixtures };
