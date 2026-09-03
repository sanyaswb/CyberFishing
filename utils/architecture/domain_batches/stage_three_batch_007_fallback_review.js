"use strict";

const assert = require("node:assert/strict");
const { FALLBACK_SOURCE, FALLBACK_TARGET } = require("./stage_three_batch_007_fallback_probe");
const { manifestBytes, sha256 } = require("./stage_three_batch_007_manifest_transition");
const { BATCH_007_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");

// An explicit reviewed decision is separate from mechanically produced observations.
class StageThreeBatch007FallbackReviewValidator {
  validate({ review, fallback, activation, evidence }) {
    assert(review, "Explicit semantic review is required");
    assert.deepEqual(Object.keys(review).sort(), ["schemaVersion", "kind", "id", "batchId", "status",
      "approval", "classification", "scope", "source", "sourceProvider", "targetModule", "symbol",
      "activationId", "productionDIBehaviorChanged", "gameplaySemanticsChanged", "calculatorFormulasChanged",
      "runtimeIdentityChanged", "saveApiChanged", "additionalTooltipRows", "removalStage",
      "removalDependencyRetained", "scopeExpansionAllowed", "authorizesBatchCompletion",
      "observedBehaviorSha256", "evidence"].sort(), "Unexpected semantic review fields");
    assert.equal(review.schemaVersion, 1);
    assert.equal(review.kind, "cyber-fishing-stage-3-fallback-semantic-review");
    assert.equal(review.id, "stage-3.7.7-guarded-standalone-fallback-review");
    assert.equal(review.batchId, PROFILE.batchId);
    assert.equal(review.status, "approved", "Semantic decision must be explicitly approved");
    assert.equal(review.approval?.authority, "user");
    assert.equal(review.approval.approvedStage, "stage-3.7.7");
    assert.equal(typeof review.approval.reason, "string");
    assert(review.approval.reason.trim().length > 0);
    assert.deepEqual(Object.keys(review.approval).sort(), ["authority", "approvedStage", "reason"].sort());
    assert.equal(review.classification, "guarded-standalone-fallback-delta");
    assert.equal(review.scope, "InventoryV2BalanceParameterResolver standalone fallback only");
    assert.equal(review.source, FALLBACK_SOURCE);
    assert.equal(review.sourceProvider, FALLBACK_TARGET);
    assert.equal(review.targetModule, activation.targetModule);
    assert.equal(review.symbol, activation.legacySymbol);
    assert.equal(review.activationId, activation.id);
    assert.equal(review.removalStage, activation.removalStage);
    assert.equal(review.removalDependencyRetained, true);
    for (const key of ["productionDIBehaviorChanged", "gameplaySemanticsChanged", "calculatorFormulasChanged",
      "runtimeIdentityChanged", "saveApiChanged", "scopeExpansionAllowed", "authorizesBatchCompletion"]) {
      assert.equal(review[key], false, `Review cannot authorize ${key}`);
    }
    assert.deepEqual(review.additionalTooltipRows, ["effective-retrieve-speed", "retrieve-duration"]);
    assert.deepEqual(fallback.standaloneAddedRows, review.additionalTooltipRows);
    assert.equal(fallback.diResultsEqual, true);
    assert.equal(fallback.standaloneResultsEqual, false);
    assert.equal(fallback.injectedGlobalReads, 0);
    const [di, standalone] = fallback.regressionCases;
    assert.equal(fallback.regressionCases.length, 2);
    assert.equal(di.id, "explicit-di-preserves-historical-production-output");
    assert.equal(standalone.id, "standalone-guarded-fallback-adds-exact-two-rows");
    assert.equal(di.status, "PASS");
    assert.equal(standalone.status, "PASS");
    assert.equal(di.beforeSha256, di.afterSha256);
    assert.notEqual(standalone.beforeSha256, standalone.afterSha256);
    assert.equal(standalone.afterSha256, di.afterSha256);
    assert.equal(standalone.existingRowsAndSectionsUnchanged, true);
    assert.deepEqual(standalone.addedRows, review.additionalTooltipRows);
    assert.equal(review.observedBehaviorSha256, sha256(manifestBytes(fallback)),
      "Behavior changed beyond the exact reviewed observation");
    const evidenceKeys = ["fallbackSource", "calculatorTarget", "bootstrap", "inventoryUI", "tooltip",
      "inventoryBootstrap", "runtimeBundle"];
    assert.deepEqual(Object.keys(review.evidence).sort(), [...evidenceKeys].sort());
    for (const key of evidenceKeys) {
      assert.deepEqual(review.evidence[key], evidence[key], `Stale semantic review evidence: ${key}`);
    }
  }
}

module.exports = { StageThreeBatch007FallbackReviewValidator };
