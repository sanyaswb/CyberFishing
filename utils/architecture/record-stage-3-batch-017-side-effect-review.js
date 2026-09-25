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
const { BATCH_017_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_017_preflight_profile");

const OUTPUT = "architecture/migration/stage_3_batch_017_side_effect_review.json";
const BATCH = "stage-3.candidate-017-inventory-fd62478b";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const contracts = Object.freeze(Object.fromEntries(Object.entries(PROFILE.reviewedContracts)
  .map(([source, contract]) => [source, { kind: "frozen-literal-constants",
    ...contract.frozenConstants }])));

class Batch017SideEffectReview {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const planPath = "architecture/migration/stage_3_approved_batches.json";
    const statePath = "architecture/migration/stage_3_execution_state.json";
    const approved = this.json(planPath);
    const state = this.json(statePath);
    const batch = approved.batches[16];
    assert.equal(batch.id, BATCH);
    assert.equal(batch.modules.length, 1);
    assert.equal(batch.sideEffectReviews.length, 1);
    assert.equal(state.releaseVersion, "0.24.53");
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 16).map(item => item.id));
    const reviewer = new StageThreeReviewedEvaluationEffect();
    const modules = batch.modules.map(module => {
      const contract = contracts[module.currentPath];
      assert(contract, `Missing reviewed contract: ${module.currentPath}`);
      const source = this.bytes(module.currentPath).toString("utf8");
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath);
      assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
      const review = reviewer.frozenConstants({ source, currentPath: module.currentPath,
        className: contract.className, bindings: contract.bindings });
      assert.equal(review.kind, "frozen-literal-constants");
      assert.deepEqual(frozen.observations, Object.values(contract.bindings).map(item =>
        ({ kind: "call", location: item.location, classification: "observable" })));
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
    assert.equal(modules.reduce((sum, item) => sum + item.activations.length, 0), 2);
    // The only retained target-side evaluation effect is the Object.freeze call on the
    // string-literal location kind table, exported unchanged next to the class.
    const [location] = modules;
    const locationSource = this.bytes(location.currentPath).toString("utf8");
    const targetSource = new RepresentationOnlyReviewedEsmTarget().project({ source: locationSource,
      currentPath: location.currentPath, targetPath: location.targetPath,
      exports: ["InventoryItemLocation", "InventoryItemLocationKind"], sourceSha256: sha(locationSource),
      contract: PROFILE.reviewedContracts[location.currentPath], targetEvaluation: null }).targetSource;
    const observation = new ModuleEvaluationEffectObserver().observe({
      modulePath: location.targetPath, source: targetSource,
    });
    assert.equal(observation.classification, "needs-review");
    // The ESM target prefixes the constant declaration with `export `, shifting the call by 7 columns.
    assert.deepEqual(observation.observations.map(item => [item.kind, item.location]),
      Object.values(location.contract.bindings).map(item => {
        const [line, column] = item.location.split(":").map(Number);
        return ["initializer-execution", `${line}:${column + "export ".length}`];
      }));
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-017-side-effect-review",
      batchId: BATCH, stage: "3.17.0", status: "reviewed-compatible",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [planPath, statePath].map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      modules, targetEvaluation: {
        module: location.targetPath, decision: "approved-compatible",
        evidenceFingerprint: observation.evidenceFingerprint,
        observations: observation.observations,
        exactEffect: "one Object.freeze call on a string-literal location kind table; no external state read or global write",
      },
      cutoverAllowedByThisReviewAlone: false,
      nextGate: "stage-3.17.0-live-preflight-and-graph-audit",
    };
  }

  run() {
    const bytes = serialize(this.build());
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Frozen batch 017 effect review drift");
    else new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    return { path: OUTPUT, sha256: sha(bytes) };
  }
}

if (require.main === module) {
  try { const result = new Batch017SideEffectReview(path.resolve(__dirname, "../..")).run();
    console.log(`Stage 3.17.0 side effects reviewed: 1 source, 2 activations; ${result.sha256}`); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch017SideEffectReview, OUTPUT, contracts };
