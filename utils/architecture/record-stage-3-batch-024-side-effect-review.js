"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeGlobalExposureReview } = require("./domain_batches/stage_three_global_exposure_review");
const { RepresentationOnlyReviewedEsmTarget } = require("./domain_batches/stage_three_reviewed_representation_target");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");
const { ModuleEvaluationEffectObserver } = require("../build/compat_runtime/cumulative_side_effect_gate");
const { serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_024_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_024_preflight_profile");

const OUTPUT = "architecture/migration/stage_3_batch_024_side_effect_review.json";
const BATCH = "stage-3.replan-322.batch-024-inventory-21307d68";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const contracts = Object.freeze(Object.fromEntries(Object.entries(PROFILE.reviewedContracts)
  .map(([source, contract]) => [source, { kind: "global-this-class-exposure",
    symbol: contract.legacyExposure.symbol, location: contract.legacyExposure.location }])));

class Batch024SideEffectReview {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const statePath = "architecture/migration/stage_3_execution_state.json";
    const state = this.json(statePath);
    const plan = new StageThreeApprovedPlanSource({ read: file => this.bytes(file) })
      .load(state, { adopting: PROFILE.executionProfile.continuationPlan });
    const approved = plan.document;
    const batch = approved.batches[23];
    assert.equal(batch.id, BATCH);
    assert.equal(batch.modules.length, 1);
    assert.equal(batch.sideEffectReviews.length, 1);
    assert.equal(state.releaseVersion, "0.24.61");
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 23).map(item => item.id));
    const modules = batch.modules.map(module => {
      const contract = contracts[module.currentPath];
      assert(contract, `Missing reviewed contract: ${module.currentPath}`);
      const source = this.bytes(module.currentPath).toString("utf8");
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath);
      assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
      const review = new StageThreeGlobalExposureReview().review({ source,
        currentPath: module.currentPath, symbol: contract.symbol, location: contract.location });
      assert.deepEqual(frozen.observations,
        [{ kind: "assignment", location: contract.location, classification: "observable" }]);
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
    assert.equal(modules.reduce((sum, item) => sum + item.activations.length, 0), 1);
    // The only classic evaluation effect is the reviewed global exposure that the representation
    // removes; the ESM target (a reviewed import plus one class) evaluates without any effect.
    const imports = StageThreeApprovedPlanSource.reviewedImports(approved, [BATCH]);
    const targetEffectFree = modules.map(module => {
      const moduleSource = this.bytes(module.currentPath).toString("utf8");
      const exports = PROFILE.executionProfile.expectedTargets
        .find(target => target.currentPath === module.currentPath).exports;
      const targetSource = new RepresentationOnlyReviewedEsmTarget().project({ source: moduleSource,
        currentPath: module.currentPath, targetPath: module.targetPath, exports,
        sourceSha256: sha(moduleSource), contract: PROFILE.reviewedContracts[module.currentPath],
        targetEvaluation: null, imports: imports[module.targetPath] || [] }).targetSource;
      const observation = new ModuleEvaluationEffectObserver().observe({
        modulePath: module.targetPath, source: targetSource,
      });
      assert.equal(observation.classification, "safe");
      assert.deepEqual(observation.observations, []);
      return { module: module.targetPath, classification: observation.classification,
        evidenceFingerprint: observation.evidenceFingerprint };
    });
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-024-side-effect-review",
      batchId: BATCH, stage: "3.25.0", status: "reviewed-compatible",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [...plan.references, { path: statePath, sha256: sha(this.bytes(statePath)) }],
      modules, targetEvaluation: null, targetEffectFree,
      cutoverAllowedByThisReviewAlone: false,
      nextGate: "stage-3.25.0-live-preflight-and-graph-audit",
    };
  }

  run() {
    const bytes = serialize(this.build());
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Frozen batch 024 effect review drift");
    else new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    return { path: OUTPUT, sha256: sha(bytes) };
  }
}

if (require.main === module) {
  try { const result = new Batch024SideEffectReview(path.resolve(__dirname, "../..")).run();
    console.log(`Stage 3.25.0 side effects reviewed: 1 source, 1 activation; ${result.sha256}`); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch024SideEffectReview, OUTPUT, contracts };
