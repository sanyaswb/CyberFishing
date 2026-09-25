"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeReviewedEvaluationEffect } = require("./domain_batches/stage_three_reviewed_evaluation_effect");
const { RepresentationOnlyNamedEsmTarget } = require("./domain_batches/stage_three_representation_target");
const { ModuleEvaluationEffectObserver } = require("../build/compat_runtime/cumulative_side_effect_gate");
const { serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_014_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_014_preflight_profile");

const OUTPUT = "architecture/migration/stage_3_batch_014_side_effect_review.json";
const BATCH = "stage-3.candidate-014-fishing-fefd469b";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const contracts = Object.freeze(Object.fromEntries(Object.entries(PROFILE.reviewedContracts)
  .map(([source, contract]) => [source, contract.frozenStaticFields
    ? { kind: "frozen-literal-static-fields", ...contract.frozenStaticFields }
    : { kind: "guarded-window-class-exposure", symbol: contract.legacyExposure.symbol,
      location: contract.legacyExposure.location }])));

class Batch014SideEffectReview {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const planPath = "architecture/migration/stage_3_approved_batches.json";
    const statePath = "architecture/migration/stage_3_execution_state.json";
    const approved = this.json(planPath);
    const state = this.json(statePath);
    const batch = approved.batches[13];
    assert.equal(batch.id, BATCH);
    assert.equal(batch.modules.length, 6);
    assert.equal(batch.sideEffectReviews.length, 6);
    assert.equal(state.releaseVersion, "0.24.50");
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 13).map(item => item.id));
    const reviewer = new StageThreeReviewedEvaluationEffect();
    const modules = batch.modules.map(module => {
      const contract = contracts[module.currentPath];
      assert(contract, `Missing reviewed contract: ${module.currentPath}`);
      const source = this.bytes(module.currentPath).toString("utf8");
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath);
      assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
      let review;
      if (contract.kind === "frozen-literal-static-fields") {
        review = reviewer.frozenStaticFields({ source, currentPath: module.currentPath,
          className: contract.className, bindings: contract.bindings });
        assert.deepEqual(frozen.observations, Object.values(contract.bindings).map(item =>
          ({ kind: "call", location: item.location, classification: "observable" })));
      } else {
        review = reviewer.windowExposure({ source, currentPath: module.currentPath,
          symbol: contract.symbol, location: contract.location });
        assert.deepEqual(frozen.observations,
          [{ kind: "assignment", location: contract.location, classification: "observable" }]);
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
    assert.equal(modules.reduce((sum, item) => sum + item.activations.length, 0), 6);
    // The only retained target-side evaluation effects are the two frozen static tables.
    const selector = modules.find(item => item.contract.kind === "frozen-literal-static-fields");
    const selectorSource = this.bytes(selector.currentPath).toString("utf8");
    const targetSource = new RepresentationOnlyNamedEsmTarget().project({ source: selectorSource,
      currentPath: selector.currentPath, targetPath: selector.targetPath,
      exportName: selector.contract.className, sourceSha256: sha(selectorSource) }).targetSource;
    const observation = new ModuleEvaluationEffectObserver().observe({
      modulePath: selector.targetPath, source: targetSource,
    });
    assert.equal(observation.classification, "needs-review");
    assert.deepEqual(observation.observations.map(item => [item.kind, item.location]),
      Object.values(selector.contract.bindings).map(item => ["initializer-execution", item.location]));
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-014-side-effect-review",
      batchId: BATCH, stage: "3.14.0", status: "reviewed-compatible",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [planPath, statePath].map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      modules, targetEvaluation: {
        module: selector.targetPath, decision: "approved-compatible",
        evidenceFingerprint: observation.evidenceFingerprint,
        observations: observation.observations,
        exactEffect: "two Object.freeze calls on string-literal static tables during class definition; no external state read or global write",
      },
      cutoverAllowedByThisReviewAlone: false,
      nextGate: "stage-3.14.0-live-preflight-and-graph-audit",
    };
  }

  run() {
    const bytes = serialize(this.build());
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Frozen batch 014 effect review drift");
    else new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    return { path: OUTPUT, sha256: sha(bytes) };
  }
}

if (require.main === module) {
  try { const result = new Batch014SideEffectReview(path.resolve(__dirname, "../..")).run();
    console.log(`Stage 3.14.0 side effects reviewed: 6 sources, 6 activations; ${result.sha256}`); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch014SideEffectReview, OUTPUT, contracts };
