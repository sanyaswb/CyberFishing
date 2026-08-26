"use strict";

const crypto = require("node:crypto");
const { immutableRecord } = require("../guards/core/guard_models");

const FROZEN_BATCH_COUNT = 21;
const RELEASE_VERSION = "0.24.37";
const GRAPH_CHANGING_KINDS = new Set(["boundary-extraction", "config-di"]);

class CanonicalRecordFingerprint {
  static value(value) {
    return crypto
      .createHash("sha256")
      .update(Buffer.from(JSON.stringify(value), "utf8"))
      .digest("hex");
  }
}

class StageThreeReviewEvidenceBuilder {
  build({ candidate, candidateSha256 }) {
    const frozen = candidate.batches.slice(0, FROZEN_BATCH_COUNT);
    const sideEffectReviews = frozen
      .flatMap((batch) => batch.sideEffectReviews.map((review) => ({
        batchId: batch.id,
        module: review.module,
        originatingStage: review.originatingStage,
        evidenceFingerprint: review.evidenceFingerprint,
        decision: "approved-compatible",
        classification: review.originatingStage === "stage-2"
          ? "module-local-storage-evaluated-once"
          : "legacy-exposure-or-deterministic-local-initialization",
        reason: review.originatingStage === "stage-2"
          ? "Private module-local storage is created once by the cumulative graph and owns no duplicated gameplay state."
          : "Observed initialization is either deferred within the exported behavior, deterministic module-local state, or legacy exposure relocated to the exact activation shim.",
        observations: review.observations,
      })))
      .sort((left, right) => left.module.localeCompare(right.module));
    const stateIdentityReviews = frozen
      .flatMap((batch) => batch.prerequisites
        .filter((item) => item.kind === "state-review")
        .map((item) => {
          const moduleRecord = batch.modules.find((module) => module.currentPath === item.module);
          const gate = batch.gates.stateIdentity.find((record) => record.module === item.module);
          const identity = {
            batchId: batch.id,
            currentPath: moduleRecord.currentPath,
            targetPath: moduleRecord.targetPath,
            authoritativeOwnersBefore: moduleRecord.stateOwnershipInvariant.before.authoritativeOwners,
            authoritativeOwnersAfter: moduleRecord.stateOwnershipInvariant.after.authoritativeOwners,
            reviewIssues: gate.reviewIssues,
          };
          return {
            ...identity,
            evidenceFingerprint: CanonicalRecordFingerprint.value(identity),
            decision: "approved-preserved",
            proof: "single-cumulative-module-instance-and-same-authoritative-owner",
            duplicateStateCopies: "forbidden",
            reason: "Collection state remains owned by the same class or instance; the cumulative runtime evaluates the module once and activation shims expose references rather than copies.",
          };
        }))
      .sort((left, right) => left.currentPath.localeCompare(right.currentPath));
    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-reviewed-freeze-evidence",
      status: "reviewed",
      releaseVersion: RELEASE_VERSION,
      sourceCandidate: {
        path: "architecture/migration/stage_3_candidate_batches.json",
        sha256: candidateSha256,
      },
      reviewOwner: "stage-3.0.6-approved-prefix-freeze",
      sideEffectReviews,
      stateIdentityReviews,
    });
  }
}

class StageThreeApprovedPrefixBuilder {
  build({ candidate, candidateSha256, reviewEvidence, reviewEvidenceSha256 }) {
    const frozenSource = candidate.batches.slice(0, FROZEN_BATCH_COUNT);
    const queueSource = candidate.batches.slice(FROZEN_BATCH_COUNT);
    const frozenBatches = frozenSource.map((batch) => immutableRecord({
      ...batch,
      status: "approved-frozen",
    }));
    const reviewQueue = queueSource.map((batch) => immutableRecord({
      id: batch.id,
      order: batch.order,
      status: "requires-replan",
      purpose: batch.purpose,
      moduleCount: batch.modules.length,
      modules: batch.modules.map((module) => ({
        currentPath: module.currentPath,
        targetPath: module.targetPath,
      })),
      triggerPrerequisiteIds: batch.cumulativeRuntimeTopology.topologyRevalidation
        .triggerPrerequisiteIds,
      reason: batch.order === FROZEN_BATCH_COUNT + 1
        ? "first-graph-changing-freeze-barrier"
        : "after-graph-changing-freeze-barrier",
      requiredTransition: "prerequisite-then-observe-replan-review-and-freeze",
    }));
    const frozenModules = frozenBatches
      .flatMap((batch) => batch.modules.map((module) => module.currentPath))
      .sort();
    const replanModules = reviewQueue
      .flatMap((batch) => batch.modules.map((module) => module.currentPath))
      .sort();
    const deferredModules = candidate.deferred.map((record) => record.currentPath).sort();
    const activationCount = frozenBatches.reduce(
      (count, batch) => count + batch.compatibility.newActivations.length,
      0,
    );
    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-approved-prefix",
      status: "approved-prefix-frozen",
      releaseVersion: RELEASE_VERSION,
      runtimeMigrationAllowed: false,
      sourceCandidate: {
        path: "architecture/migration/stage_3_candidate_batches.json",
        sha256: candidateSha256,
      },
      reviewEvidence: {
        path: "architecture/migration/stage_3_review_evidence.json",
        sha256: reviewEvidenceSha256,
      },
      freezeBoundary: {
        policy: "maximal-ordered-graph-stable-prefix",
        firstBatchId: frozenBatches[0].id,
        lastBatchId: frozenBatches.at(-1).id,
        firstRequiresReplanBatchId: reviewQueue[0].id,
        frozenBatchCount: frozenBatches.length,
        frozenModuleCount: frozenModules.length,
        activationCount,
        sideEffectReviewCount: reviewEvidence.sideEffectReviews.length,
        stateIdentityReviewCount: reviewEvidence.stateIdentityReviews.length,
      },
      batches: frozenBatches,
      reviewQueue,
      deferred: candidate.deferred,
      coverage: {
        frozen: frozenModules,
        requiresReplan: replanModules,
        deferred: deferredModules,
        unassigned: [],
      },
      summary: {
        domainModuleCount: frozenModules.length + replanModules.length + deferredModules.length,
        frozenBatchCount: frozenBatches.length,
        frozenModuleCount: frozenModules.length,
        reviewQueueBatchCount: reviewQueue.length,
        reviewQueueModuleCount: replanModules.length,
        deferredModuleCount: deferredModules.length,
        coverageStatus: "complete-frozen-replan-or-deferred",
      },
    });
  }
}

class StageThreeExecutionStateBuilder {
  build({ approvedPlanSha256 }) {
    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-execution-state",
      releaseVersion: RELEASE_VERSION,
      approvedPlanSha256,
      status: "approved-prefix-ready",
      completedBatchIds: [],
      activeBatchId: null,
      compatibilityRuntimeActivated: false,
    });
  }
}

class StageThreeApprovedPrefixValidator {
  validate({ candidate, candidateSha256, reviewEvidence, reviewEvidenceSha256, approvedPlan }) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(reviewEvidence?.schemaVersion === 1, "review evidence schemaVersion must be 1");
    require(reviewEvidence?.status === "reviewed", "review evidence status must be reviewed");
    require(
      reviewEvidence?.sourceCandidate?.sha256 === candidateSha256,
      "review evidence candidate fingerprint is stale",
    );
    const frozenSource = candidate.batches.slice(0, FROZEN_BATCH_COUNT);
    const queueSource = candidate.batches.slice(FROZEN_BATCH_COUNT);
    const expectedSideReviews = frozenSource.flatMap((batch) => batch.sideEffectReviews);
    const expectedStateReviews = frozenSource.flatMap((batch) => batch.prerequisites
      .filter((item) => item.kind === "state-review"));
    require(expectedSideReviews.length === 41, "frozen prefix must require exactly 41 side-effect reviews");
    require(expectedStateReviews.length === 5, "frozen prefix must require exactly 5 state reviews");
    require(
      reviewEvidence.sideEffectReviews.length === expectedSideReviews.length,
      "side-effect review coverage is incomplete",
    );
    require(
      reviewEvidence.stateIdentityReviews.length === expectedStateReviews.length,
      "state review coverage is incomplete",
    );
    const sideByFingerprint = new Map(reviewEvidence.sideEffectReviews.map((item) => [
      item.evidenceFingerprint,
      item,
    ]));
    for (const review of expectedSideReviews) {
      const approved = sideByFingerprint.get(review.evidenceFingerprint);
      require(Boolean(approved), `missing side-effect review: ${review.module}`);
      require(approved?.decision === "approved-compatible", `side-effect review is not approved: ${review.module}`);
    }
    for (const review of reviewEvidence.stateIdentityReviews) {
      require(review.decision === "approved-preserved", `state review is not approved: ${review.currentPath}`);
      require(
        this.#sameArray(review.authoritativeOwnersBefore, review.authoritativeOwnersAfter),
        `state owner changes during migration: ${review.currentPath}`,
      );
      require(review.duplicateStateCopies === "forbidden", `duplicate state is not forbidden: ${review.currentPath}`);
    }
    require(approvedPlan?.schemaVersion === 1, "approved plan schemaVersion must be 1");
    require(approvedPlan?.status === "approved-prefix-frozen", "approved plan status is invalid");
    require(approvedPlan?.runtimeMigrationAllowed === false, "freeze must not activate runtime migration");
    require(approvedPlan?.sourceCandidate?.sha256 === candidateSha256, "approved plan candidate fingerprint is stale");
    require(approvedPlan?.reviewEvidence?.sha256 === reviewEvidenceSha256, "approved plan review fingerprint is stale");
    require(approvedPlan?.batches?.length === FROZEN_BATCH_COUNT, "approved prefix must contain 21 batches");
    require(approvedPlan?.reviewQueue?.length === 19, "review queue must contain 19 batches");
    let activationCount = 0;
    for (let index = 0; index < frozenSource.length; index += 1) {
      const source = frozenSource[index];
      const approved = approvedPlan.batches[index];
      require(approved?.id === source.id, `approved batch identity differs at order ${index + 1}`);
      require(approved?.order === index + 1, `approved batch order differs: ${source.id}`);
      require(approved?.status === "approved-frozen", `batch is not approved-frozen: ${source.id}`);
      require(
        !approved.prerequisites.some((item) => GRAPH_CHANGING_KINDS.has(item.kind)),
        `frozen batch has graph-changing prerequisite: ${source.id}`,
      );
      require(
        approved.gates.performance.length === 0,
        `frozen prefix unexpectedly contains a performance prerequisite: ${source.id}`,
      );
      require(approved.rollback.atomic === true, `batch rollback is not atomic: ${source.id}`);
      require(approved.rollback.partialRollbackAllowed === false, `partial rollback is allowed: ${source.id}`);
      for (const activation of approved.compatibility.newActivations) {
        activationCount += 1;
        require(/^activation-[a-f0-9]{12}$/.test(activation.contract.id), `activation id is invalid: ${activation.contract.id}`);
        require(activation.legacyConsumers.length > 0, `activation consumers are empty: ${activation.contract.id}`);
        require(
          activation.removalCondition === "all-listed-legacy-consumers-migrated",
          `activation removal condition is invalid: ${activation.contract.id}`,
        );
      }
    }
    require(activationCount === 87, "frozen prefix must contain exactly 87 activation contracts");
    require(
      queueSource[0]?.cumulativeRuntimeTopology?.topologyRevalidation?.requiredBeforeApprovedFreeze === true,
      "batch 022 must be the first graph-changing freeze barrier",
    );
    for (let index = 0; index < queueSource.length; index += 1) {
      const queued = approvedPlan.reviewQueue[index];
      require(queued?.id === queueSource[index].id, `review queue identity differs at order ${index + 22}`);
      require(queued?.status === "requires-replan", `review queue record is not requires-replan: ${queued?.id}`);
    }
    const frozen = approvedPlan.coverage.frozen;
    const replan = approvedPlan.coverage.requiresReplan;
    const deferred = approvedPlan.coverage.deferred;
    require(frozen.length === 69, "frozen coverage must contain 69 modules");
    require(replan.length === 37, "requires-replan coverage must contain 37 modules");
    require(deferred.length === 29, "deferred coverage must contain 29 modules");
    require(approvedPlan.coverage.unassigned.length === 0, "approved coverage must not contain unassigned modules");
    require(
      new Set([...frozen, ...replan, ...deferred]).size === 135,
      "approved coverage must contain 135 unique domain modules",
    );
    if (errors.length > 0) {
      throw new Error(`Stage 3 approved prefix failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(approvedPlan);
  }

  #sameArray(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
}

class StageThreeExecutionStateValidator {
  validate({ approvedPlan, approvedPlanSha256, state, runtimeFacts }) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(state?.schemaVersion === 1, "Stage 3 state schemaVersion must be 1");
    require(state?.kind === "cyber-fishing-stage-3-execution-state", "Stage 3 state kind is invalid");
    require(state?.approvedPlanSha256 === approvedPlanSha256, "Stage 3 state approved-plan fingerprint is stale");
    require(
      ["approved-prefix-ready", "migration-active", "frozen-prefix-complete"].includes(state?.status),
      "Stage 3 state status is invalid",
    );
    const orderedIds = approvedPlan.batches.map((batch) => batch.id);
    const completed = Array.isArray(state?.completedBatchIds) ? state.completedBatchIds : [];
    require(
      completed.every((id, index) => id === orderedIds[index]),
      "Stage 3 completedBatchIds must be an ordered approved prefix",
    );
    const expectedActive = orderedIds[completed.length] || null;
    require(
      state.activeBatchId === null || state.activeBatchId === expectedActive,
      "Stage 3 activeBatchId must be the first batch after completed prefix",
    );
    const activeBatchPhase = state.activeBatchId === null
      ? null
      : (state.activeBatchPhase || "runtime-active");
    require(
      activeBatchPhase === null || ["prebuild", "runtime-active"].includes(activeBatchPhase),
      "Stage 3 activeBatchPhase must be prebuild or runtime-active",
    );
    require(
      state.activeBatchId !== null || state.activeBatchPhase === undefined,
      "Stage 3 inactive state must not retain activeBatchPhase",
    );
    if (state.compatibilityRuntimeActivated === false) {
      require(completed.length === 0, "inactive compatibility runtime requires no completed batches");
      require(state.activeBatchId === null, "inactive compatibility runtime requires no active batch");
      require(runtimeFacts?.contractStatus === "foundation-verified", "inactive runtime requires foundation contract");
      require(runtimeFacts?.runtimeScriptCount === 0, "inactive runtime must not appear in index.html");
      require(runtimeFacts?.outputExists === false, "inactive runtime must not leave build output");
    } else {
      const selectedCount = completed.length +
        (state.activeBatchId && activeBatchPhase === "runtime-active" ? 1 : 0);
      const selectedBatch = approvedPlan.batches[selectedCount - 1];
      const expectedRuntimeScriptCount =
        1 + (selectedBatch?.compatibility?.cumulativeActivationIds?.length || 0);
      require(
        completed.length > 0 || state.activeBatchId !== null,
        "active compatibility runtime requires an active or completed approved batch",
      );
      require(state.status === "migration-active", "active compatibility runtime requires migration-active status");
      require(runtimeFacts?.contractStatus === "migration-active", "active runtime requires migration-active contract");
      require(
        runtimeFacts?.runtimeScriptCount === expectedRuntimeScriptCount,
        "active runtime requires one cumulative script and the exact selected activation set",
      );
      require(runtimeFacts?.outputExists === true, "active runtime requires validated build output");
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3 execution state failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(state);
  }
}

module.exports = {
  CanonicalRecordFingerprint,
  FROZEN_BATCH_COUNT,
  RELEASE_VERSION,
  StageThreeApprovedPrefixBuilder,
  StageThreeApprovedPrefixValidator,
  StageThreeExecutionStateBuilder,
  StageThreeExecutionStateValidator,
  StageThreeReviewEvidenceBuilder,
};
