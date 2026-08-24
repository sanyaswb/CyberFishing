"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeApprovedPrefixValidator,
  StageThreeExecutionStateValidator,
} = require("./domain_batches/domain_approved_prefix");
const { PATHS, buildArtifacts, readRuntimeFacts } = require("./generate-stage-3-approved-prefix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

class StageThreeApprovedPrefixIntegrationCheck {
  run() {
    const protectedPaths = [
      "src/core/inventory/equip_target_selection_policy.js",
      "index.html",
      "architecture/migration/module_migration_manifest.json",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/stage_3_candidate_batches.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
    ];
    const before = new Map(protectedPaths.map((item) => [item, read(item)]));
    const generated = buildArtifacts({
      runtimeFacts: {
        contractStatus: "foundation-verified",
        runtimeScriptCount: 0,
        outputExists: false,
      },
    });
    const persisted = {
      review: read(PATHS.review),
      approved: read(PATHS.approved),
      state: read(PATHS.state),
    };
    assert.deepEqual(persisted.review, generated.serialized.review);
    assert.deepEqual(persisted.approved, generated.serialized.approved);
    const candidateBytes = read(PATHS.candidate);
    const candidate = JSON.parse(candidateBytes.toString("utf8"));
    const reviewEvidence = JSON.parse(persisted.review.toString("utf8"));
    const approvedPlan = JSON.parse(persisted.approved.toString("utf8"));
    const state = JSON.parse(persisted.state.toString("utf8"));
    new StageThreeApprovedPrefixValidator().validate({
      candidate,
      candidateSha256: sha256(candidateBytes),
      reviewEvidence,
      reviewEvidenceSha256: sha256(persisted.review),
      approvedPlan,
    });
    new StageThreeExecutionStateValidator().validate({
      approvedPlan,
      approvedPlanSha256: sha256(persisted.approved),
      state,
      runtimeFacts: readRuntimeFacts(),
    });
    assert.equal(approvedPlan.batches.length, 21);
    assert.equal(approvedPlan.coverage.frozen.length, 69);
    assert.equal(approvedPlan.reviewQueue.length, 19);
    assert.equal(approvedPlan.coverage.requiresReplan.length, 37);
    assert.equal(approvedPlan.coverage.deferred.length, 29);
    assert.equal(approvedPlan.coverage.unassigned.length, 0);
    assert.equal(reviewEvidence.sideEffectReviews.length, 41);
    assert.equal(reviewEvidence.stateIdentityReviews.length, 5);
    assert.equal(approvedPlan.freezeBoundary.activationCount, 87);
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.equal(
      state.activeBatchId === approvedPlan.batches[0].id ||
        state.completedBatchIds[0] === approvedPlan.batches[0].id,
      true,
    );
    assert.equal(state.completedBatchIds.length <= approvedPlan.batches.length, true);
    if (state.activeBatchId) {
      assert.equal(
        state.activeBatchId,
        approvedPlan.batches[state.completedBatchIds.length].id,
      );
    }
    for (const [relativePath, bytes] of before) {
      assert.deepEqual(read(relativePath), bytes, `freeze check mutated ${relativePath}`);
    }
    console.log(
      `Stage 3.0.6 approved prefix remains frozen during Stage 3 migration: ` +
        `21 batches / 69 modules; 19 batches / 37 modules require replan; 29 deferred.`,
    );
  }
}

new StageThreeApprovedPrefixIntegrationCheck().run();
