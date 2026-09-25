"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeGlobalExposureReview } = require("./domain_batches/stage_three_global_exposure_review");
const { StageThreeReviewedEvaluationEffect } = require("./domain_batches/stage_three_reviewed_evaluation_effect");
const { ModuleEvaluationEffectObserver } = require("../build/compat_runtime/cumulative_side_effect_gate");
const { serialize } = require("./domain_batches/stage_three_live_preflight");

const OUTPUT = "architecture/migration/stage_3_batch_013_side_effect_review.json";
const BATCH = "stage-3.candidate-013-fishing-0267b3ea";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const contracts = Object.freeze({
  "src/core/fishing/fish_direction_intent_sampler.js": {
    kind: "frozen-literal-ranges", className: "FishDirectionIntentSampler",
    bindings: {
      DEFAULT_FISH_RADIAL_RANGE: { location: "1:35", values: [0.35, 1] },
      DEFAULT_FISH_LATERAL_RANGE: { location: "2:36", values: [-1, 1] },
    },
  },
  "src/core/fishing/fishing_cast_exposure_resolver.js": {
    kind: "global-this-class-exposure", symbol: "FishingCastExposureResolver", location: "13:1",
  },
  "src/core/fishing/player_force_budget_allocator.js": {
    kind: "guarded-window-class-exposure", symbol: "PlayerForceBudgetAllocator", location: "199:3",
  },
  "src/core/fishing/player_pressure/player_pressure_fatigue_calculator.js": {
    kind: "guarded-window-class-exposure", symbol: "PlayerPressureFatigueCalculator", location: "439:3",
  },
  "src/core/fishing/rod_control_angle_resolver.js": {
    kind: "guarded-window-class-exposure", symbol: "RodControlAngleResolver", location: "55:3",
  },
  "src/core/fishing/stamina/stamina_regen_calculator.js": {
    kind: "guarded-window-class-exposure", symbol: "StaminaRegenCalculator", location: "131:3",
  },
});

class Batch013SideEffectReview {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const planPath = "architecture/migration/stage_3_approved_batches.json";
    const statePath = "architecture/migration/stage_3_execution_state.json";
    const approved = this.json(planPath);
    const state = this.json(statePath);
    const batch = approved.batches[12];
    assert.equal(batch.id, BATCH);
    assert.equal(batch.modules.length, 6);
    assert.equal(batch.sideEffectReviews.length, 6);
    assert.equal(state.releaseVersion, "0.24.49");
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 12).map(item => item.id));
    const reviewer = new StageThreeReviewedEvaluationEffect();
    const modules = batch.modules.map(module => {
      const contract = contracts[module.currentPath];
      assert(contract);
      const source = this.bytes(module.currentPath).toString("utf8");
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath);
      assert(frozen);
      let review;
      if (contract.kind === "frozen-literal-ranges") {
        review = reviewer.frozenConstants({ source, currentPath: module.currentPath,
          className: contract.className, bindings: contract.bindings });
        assert.deepEqual(frozen.observations.map(item => item.location),
          Object.values(contract.bindings).map(item => item.location));
      } else if (contract.kind === "global-this-class-exposure") {
        review = new StageThreeGlobalExposureReview().review({ source,
          currentPath: module.currentPath, symbol: contract.symbol, location: contract.location });
        assert.deepEqual(frozen.observations.map(item => item.location), [contract.location]);
      } else {
        review = reviewer.windowExposure({ source, currentPath: module.currentPath,
          symbol: contract.symbol, location: contract.location });
        assert.deepEqual(frozen.observations.map(item => item.location), [contract.location]);
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
    assert.equal(modules.reduce((sum, item) => sum + item.activations.length, 0), 8);
    // The only retained target-side evaluation calls are the two literal Object.freeze calls.
    const range = modules[0];
    const rangeSource = this.bytes(range.currentPath).toString("utf8")
      .replace("const DEFAULT_FISH_RADIAL_RANGE", "export const DEFAULT_FISH_RADIAL_RANGE")
      .replace("const DEFAULT_FISH_LATERAL_RANGE", "export const DEFAULT_FISH_LATERAL_RANGE")
      .replace("class FishDirectionIntentSampler", "export class FishDirectionIntentSampler");
    const observation = new ModuleEvaluationEffectObserver().observe({
      modulePath: range.targetPath, source: rangeSource,
    });
    assert.equal(observation.classification, "needs-review");
    assert.deepEqual(observation.observations.map(item => item.kind),
      ["initializer-execution", "initializer-execution"]);
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-013-side-effect-review",
      batchId: BATCH, stage: "3.13.0", status: "reviewed-compatible",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [planPath, statePath].map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
      modules, targetEvaluation: {
        module: range.targetPath, decision: "approved-compatible",
        evidenceFingerprint: observation.evidenceFingerprint,
        observations: observation.observations,
        exactEffect: "two Object.freeze calls on numeric literal arrays; no external state read or global write",
      },
      cutoverAllowedByThisReviewAlone: false,
      nextGate: "stage-3.13.0-live-preflight-and-graph-audit",
    };
  }

  run() {
    const bytes = serialize(this.build());
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Frozen batch 013 effect review drift");
    else new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    return { path: OUTPUT, sha256: sha(bytes) };
  }
}

if (require.main === module) {
  try { const result = new Batch013SideEffectReview(path.resolve(__dirname, "../..")).run();
    console.log(`Stage 3.13.0 side effects reviewed: 6 sources, 8 activations; ${result.sha256}`); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch013SideEffectReview, OUTPUT, contracts };
