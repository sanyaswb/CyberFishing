"use strict";

const assert = require("node:assert/strict");
const {
  StageThreeApprovedPrefixValidator,
  StageThreeExecutionStateValidator,
} = require("./domain_batches/domain_approved_prefix");
const { buildArtifacts } = require("./generate-stage-3-approved-prefix");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeApprovedPrefixFixtureCheck {
  run() {
    const runtimeFacts = {
      contractStatus: "foundation-verified",
      runtimeScriptCount: 0,
      outputExists: false,
    };
    const generated = buildArtifacts({ runtimeFacts });
    const candidate = require("../../architecture/migration/stage_3_candidate_batches.json");
    const candidateSha256 = generated.approvedPlan.sourceCandidate.sha256;
    const reviewEvidenceSha256 = generated.approvedPlan.reviewEvidence.sha256;
    const approvedPlanSha256 = generated.state.approvedPlanSha256;
    const validatePlan = (approvedPlan, reviewEvidence = generated.reviewEvidence) =>
      new StageThreeApprovedPrefixValidator().validate({
        candidate,
        candidateSha256,
        reviewEvidence,
        reviewEvidenceSha256,
        approvedPlan,
      });
    assert.doesNotThrow(() => validatePlan(generated.approvedPlan));
    assert.doesNotThrow(() => new StageThreeExecutionStateValidator().validate({
      approvedPlan: generated.approvedPlan,
      approvedPlanSha256,
      state: generated.state,
      runtimeFacts,
    }));

    this.#fails(() => {
      const invalid = clone(generated.approvedPlan);
      invalid.sourceCandidate.sha256 = "0".repeat(64);
      validatePlan(invalid);
    }, /candidate fingerprint is stale/);
    this.#fails(() => {
      const invalid = clone(generated.reviewEvidence);
      invalid.sideEffectReviews.pop();
      validatePlan(generated.approvedPlan, invalid);
    }, /side-effect review coverage is incomplete/);
    this.#fails(() => {
      const invalid = clone(generated.reviewEvidence);
      invalid.sideEffectReviews[0].decision = "deferred";
      validatePlan(generated.approvedPlan, invalid);
    }, /side-effect review is not approved/);
    this.#fails(() => {
      const invalid = clone(generated.reviewEvidence);
      invalid.stateIdentityReviews[0].authoritativeOwnersAfter.push("DuplicateOwner");
      validatePlan(generated.approvedPlan, invalid);
    }, /state owner changes during migration/);
    this.#fails(() => {
      const invalid = clone(generated.approvedPlan);
      invalid.batches[20] = clone(candidate.batches[21]);
      invalid.batches[20].status = "approved-frozen";
      validatePlan(invalid);
    }, /approved batch identity differs/);
    this.#fails(() => {
      const invalid = clone(generated.approvedPlan);
      invalid.reviewQueue.shift();
      validatePlan(invalid);
    }, /review queue must contain 19 batches/);
    this.#fails(() => {
      const invalid = clone(generated.approvedPlan);
      invalid.coverage.unassigned.push("src/game/domain/unknown.js");
      validatePlan(invalid);
    }, /must not contain unassigned/);
    this.#fails(() => {
      const invalid = clone(generated.state);
      invalid.completedBatchIds = [generated.approvedPlan.batches[1].id];
      new StageThreeExecutionStateValidator().validate({
        approvedPlan: generated.approvedPlan,
        approvedPlanSha256,
        state: invalid,
        runtimeFacts,
      });
    }, /ordered approved prefix/);
    this.#fails(() => {
      const invalid = clone(generated.state);
      invalid.activeBatchId = generated.approvedPlan.batches[1].id;
      new StageThreeExecutionStateValidator().validate({
        approvedPlan: generated.approvedPlan,
        approvedPlanSha256,
        state: invalid,
        runtimeFacts,
      });
    }, /first batch after completed prefix/);
    this.#fails(() => new StageThreeExecutionStateValidator().validate({
      approvedPlan: generated.approvedPlan,
      approvedPlanSha256,
      state: generated.state,
      runtimeFacts: { ...runtimeFacts, runtimeScriptCount: 1 },
    }), /must not appear in index/);
    this.#fails(() => new StageThreeExecutionStateValidator().validate({
      approvedPlan: generated.approvedPlan,
      approvedPlanSha256,
      state: generated.state,
      runtimeFacts: { ...runtimeFacts, outputExists: true },
    }), /must not leave build output/);

    console.log("Stage 3.0.6 approved-prefix fixtures passed: 12 cases.");
  }

  #fails(action, pattern) {
    assert.throws(action, pattern);
  }
}

new StageThreeApprovedPrefixFixtureCheck().run();
