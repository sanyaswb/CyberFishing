"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

const FIRST_BATCH_ID = "stage-3.candidate-001-inventory-85f44b2e";
const RELEASE_VERSION = "0.24.38";

class StageThreeFirstBatchContractBuilder {
  buildRuntimeContract({ foundationContract, approvedPlan, reviewEvidence }) {
    const batch = this.#batch(approvedPlan);
    const reviewedModules = new Set(batch.sideEffectReviews.map((review) => review.module));
    const sideEffectReviews = reviewEvidence.sideEffectReviews
      .filter((review) => reviewedModules.has(review.module))
      .map((review) => ({
        module: review.module,
        evidenceFingerprint: review.evidenceFingerprint,
        decision: review.decision,
        owner: FIRST_BATCH_ID,
        reason: review.reason,
      }))
      .sort((left, right) => left.module.localeCompare(right.module));
    return immutableRecord({
      ...foundationContract,
      status: "migration-active",
      previousRuntimeTransitions: batch.compatibility.requiredTransitions,
      sideEffectReviews,
      activationPositions: batch.compatibility.newActivations
        .map((activation) => activation.contract)
        .sort((left, right) => left.id.localeCompare(right.id)),
    });
  }

  buildExecutionState({ foundationState }) {
    return immutableRecord({
      ...foundationState,
      releaseVersion: RELEASE_VERSION,
      status: "migration-active",
      completedBatchIds: [FIRST_BATCH_ID],
      activeBatchId: null,
      compatibilityRuntimeActivated: true,
    });
  }

  buildBridgeRecord({ approvedPlan }) {
    const batch = this.#batch(approvedPlan);
    const activation = batch.compatibility.newActivations.find(
      (record) => record.contract.legacySymbol ===
        "InventoryEquipTargetSelectionPolicy",
    );
    return immutableRecord({
      bridge: "src/core/inventory/equip_target_selection_policy.js",
      source: activation.legacyConsumers[0],
      target: activation.contract.targetModule,
      reason: "Preserve the exact synchronous UI consumer until presentation migration removes the legacy symbol.",
      owner: FIRST_BATCH_ID,
      introducedStage: "stage-3",
      removalStage: activation.contract.removalStage,
      globalProviders: [{
        symbol: activation.contract.legacySymbol,
        mechanism: "global-this-property",
      }],
    });
  }

  #batch(approvedPlan) {
    const batch = approvedPlan.batches.find((record) => record.id === FIRST_BATCH_ID);
    if (!batch || batch.status !== "approved-frozen") {
      throw new Error(`First Stage 3 batch is not approved-frozen: ${FIRST_BATCH_ID}`);
    }
    return batch;
  }
}

module.exports = {
  FIRST_BATCH_ID,
  RELEASE_VERSION,
  StageThreeFirstBatchContractBuilder,
};
