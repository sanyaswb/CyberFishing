"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeReviewedEvaluationEffect } = require("./domain_batches/stage_three_reviewed_evaluation_effect");
const { RepresentationOnlyReviewedEsmTarget } = require("./domain_batches/stage_three_reviewed_representation_target");
const { ModuleEvaluationEffectObserver } = require("../build/compat_runtime/cumulative_side_effect_gate");
const { serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_020_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_020_preflight_profile");

const OUTPUT = "architecture/migration/stage_3_batch_020_side_effect_review.json";
const BATCH = "stage-3.candidate-020-assemblies-43d77861";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const contracts = Object.freeze(Object.fromEntries(Object.entries(PROFILE.reviewedContracts)
  .map(([source, contract]) => [source, contract.privateStaticSets
    ? { kind: "private-static-literal-sets", ...contract.privateStaticSets,
      exposure: contract.legacyExposure
        ? { symbol: contract.legacyExposure.symbol, location: contract.legacyExposure.location } : null }
    : { kind: "frozen-literal-constants", ...contract.frozenConstants }])));
// The ESM representation prefixes a top-level constant with `export `, shifting its call by 7 columns.
const targetLocation = (contract, location) => {
  if (contract.kind !== "frozen-literal-constants") return location;
  const [line, column] = location.split(":").map(Number);
  return `${line}:${column + "export ".length}`;
};

class Batch020SideEffectReview {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const planPath = "architecture/migration/stage_3_approved_batches.json";
    const statePath = "architecture/migration/stage_3_execution_state.json";
    const approved = this.json(planPath);
    const state = this.json(statePath);
    const batch = approved.batches[19];
    assert.equal(batch.id, BATCH);
    assert.equal(batch.modules.length, 3);
    assert.equal(batch.sideEffectReviews.length, 3);
    assert.equal(state.releaseVersion, "0.24.56");
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 19).map(item => item.id));
    const reviewer = new StageThreeReviewedEvaluationEffect();
    const modules = batch.modules.map(module => {
      const contract = contracts[module.currentPath];
      assert(contract, `Missing reviewed contract: ${module.currentPath}`);
      const source = this.bytes(module.currentPath).toString("utf8");
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath);
      assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
      let review;
      if (contract.kind === "private-static-literal-sets") {
        review = reviewer.privateStaticSets({ source, currentPath: module.currentPath,
          className: contract.className, bindings: contract.bindings, exposure: contract.exposure });
        assert.deepEqual(frozen.observations, [
          ...Object.values(contract.bindings).map(item =>
            ({ kind: "instantiation", location: item.location, classification: "observable" })),
          ...(contract.exposure ? [{ kind: "assignment", location: contract.exposure.location,
            classification: "observable" }] : []),
        ]);
      } else {
        review = reviewer.frozenConstants({ source, currentPath: module.currentPath,
          className: contract.className, bindings: contract.bindings });
        assert.equal(review.kind, "frozen-literal-constants");
        assert.deepEqual(frozen.observations, Object.values(contract.bindings).map(item =>
          ({ kind: "call", location: item.location, classification: "observable" })));
      }
      assert.equal(review.sourceSha256, sha(source));
      assert.equal(frozen.status, "required-before-approved-freeze");
      assert.equal(frozen.requiredDecision, "approved-compatible-or-batch-deferred");
      return { currentPath: module.currentPath, targetPath: module.targetPath,
        sourceSha256: review.sourceSha256, contract, review,
        frozenEvidenceFingerprint: frozen.evidenceFingerprint,
        frozenObservations: frozen.observations,
        activations: batch.compatibility.newActivations.filter(item =>
          item.contract.sourceProvider === module.currentPath).map(item => item.contract),
      };
    });
    assert.equal(modules.reduce((sum, item) => sum + item.activations.length, 0), 4);
    // Each ESM target keeps exactly its reviewed literal initializers: two private static
    // `new Set` literals and one Object.freeze status table. Exposures are removed.
    const targetEvaluations = modules.map(module => {
      const moduleSource = this.bytes(module.currentPath).toString("utf8");
      const exports = PROFILE.executionProfile.expectedTargets
        .find(target => target.currentPath === module.currentPath).exports;
      const contract = PROFILE.reviewedContracts[module.currentPath];
      let targetSource;
      if (contract.privateStaticSets) {
        const exposure = contract.legacyExposure || null;
        targetSource = new (require("./domain_batches/stage_three_representation_target")
          .RepresentationOnlyNamedEsmTarget)().project({ source: moduleSource,
          currentPath: module.currentPath, targetPath: module.targetPath, exportName: exports[0],
          sourceSha256: sha(moduleSource), legacyExposure: exposure }).targetSource;
      } else {
        targetSource = new RepresentationOnlyReviewedEsmTarget().project({ source: moduleSource,
          currentPath: module.currentPath, targetPath: module.targetPath, exports,
          sourceSha256: sha(moduleSource), contract, targetEvaluation: null }).targetSource;
      }
      const observation = new ModuleEvaluationEffectObserver().observe({
        modulePath: module.targetPath, source: targetSource,
      });
      assert.equal(observation.classification, "needs-review");
      const bindings = Object.values(module.contract.bindings);
      assert.deepEqual(observation.observations.map(item => [item.kind, item.location]),
        bindings.map(item => ["initializer-execution", targetLocation(module.contract, item.location)]));
      return { module: module.targetPath, decision: "approved-compatible",
        evidenceFingerprint: observation.evidenceFingerprint, observations: observation.observations,
        exactEffect: module.contract.kind === "private-static-literal-sets"
          ? "one private static Set of string literals created during class definition; unreachable from outside the class; no external state read or global write"
          : "one Object.freeze call on a string-literal status table; no external state read or global write" };
    }).sort((left, right) => left.module.localeCompare(right.module));
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-020-side-effect-review",
      batchId: BATCH, stage: "3.20.0", status: "reviewed-compatible",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [planPath, statePath].map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      modules, targetEvaluation: null, targetEvaluations,
      cutoverAllowedByThisReviewAlone: false,
      nextGate: "stage-3.20.0-live-preflight-and-graph-audit",
    };
  }

  run() {
    const bytes = serialize(this.build());
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Frozen batch 020 effect review drift");
    else new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    return { path: OUTPUT, sha256: sha(bytes) };
  }
}

if (require.main === module) {
  try { const result = new Batch020SideEffectReview(path.resolve(__dirname, "../..")).run();
    console.log(`Stage 3.20.0 side effects reviewed: 3 sources, 4 activations; ${result.sha256}`); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch020SideEffectReview, OUTPUT, contracts };
