"use strict";

const assert = require("node:assert/strict");

const MIGRATION = "architecture/migration";
// Continuation releases follow the Stage 3.22 convention: batch N is Stage 3.(N+1) and releases
// 0.24.(38+N); its source release is the previous batch's release.
const RELEASE_BASE = 38;

const ARTIFACTS = Object.freeze({
  sideEffectReview: "side_effect_review",
  audit: "audit",
  executionPlan: "execution_plan",
  testMatrix: "test_matrix",
  prebuild: "prebuild_contract",
  sourceBuild: "source_build_validation",
  cutover: "runtime_cutover",
  live: "live_runtime_validation",
  knownDebt: "known_debt_resolution",
  observation: "observation_reconciliation",
  automatedAcceptance: "automated_acceptance",
  acceptance: "acceptance_pass",
  browser: "browser_confirmation",
  releaseTransition: "release_transition",
  releaseRegression: "release_regression",
  releaseClosure: "release_closure",
});

// Every batch-derived name of one continuation batch: artifact paths, kinds, stage labels,
// release versions and temporary-directory prefixes. Nothing here is batch-specific data.
class StageThreeBatchContext {
  constructor(number) {
    assert.match(String(number), /^\d{3}$/u, "Batch number must have three digits");
    this.number = String(number);
    this.order = Number(this.number);
    assert(this.order >= 22, "Shared batch tooling covers continuation batches only");
    this.stage = `3.${this.order + 1}`;
    this.fromRelease = `0.24.${RELEASE_BASE + this.order - 1}`;
    this.toRelease = `0.24.${RELEASE_BASE + this.order}`;
    this.completedBefore = this.order - 1;
    this.paths = Object.freeze(Object.fromEntries(Object.entries(ARTIFACTS)
      .map(([key, name]) => [key, `${MIGRATION}/stage_3_batch_${this.number}_${name}.json`])));
    Object.freeze(this);
  }

  // Stage sub-step label, e.g. step(6) → "3.27.6".
  step(index) { return `${this.stage}.${index}`; }

  label(index) { return `Stage ${this.step(index)}`; }

  kind(name) { return `cyber-fishing-stage-3-batch-${this.number}-${name}`; }

  tempPrefix(purpose) { return `cyber-batch${this.number}-${purpose}-`; }

  next() { return new StageThreeBatchContext(String(this.order + 1).padStart(3, "0")); }
}

module.exports = { StageThreeBatchContext, ARTIFACTS };
