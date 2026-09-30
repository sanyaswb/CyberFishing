"use strict";

const { STAGE_3_22 } = require("./post_freeze_review_profile");

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// Records the freeze decision of every candidate batch from the reviewed module evidence: a batch
// is approved only when each module's ownership, identity, evaluation, configuration and hot-loop
// evidence is sufficient and every dependency is completed or frozen before it.
class PostFreezeReviewEvidenceBuilder {
  build({ candidates, candidateRef, evidence, backlog, reviewedCollections, profile = STAGE_3_22 }) {
    const evidenceByPath = new Map(evidence.map(record => [record.currentPath, record]));
    const evidenceTaskByModule = new Map();
    for (const task of backlog.tasks.filter(item => item.kind === "freeze-evidence")) {
      for (const module of task.modules) {
        if (!evidenceTaskByModule.has(module)) evidenceTaskByModule.set(module, []);
        evidenceTaskByModule.get(module).push(task.id);
      }
    }
    const batchDecisions = candidates.batches.map(batch => {
      const modulePaths = batch.modules.map(module => module.currentPath);
      const ready = batch.freezeReadiness.ready;
      return {
        batchId: batch.id,
        order: batch.order,
        decision: ready ? "approved-frozen" : "requires-evidence",
        reasons: [...batch.freezeReadiness.reasons],
        evidenceTaskIds: [...new Set(modulePaths.flatMap(path => evidenceTaskByModule.get(path) || []))].sort(compare),
        moduleEvidence: modulePaths.map(path => ({ currentPath: path,
          verdict: evidenceByPath.get(path).verdict,
          evidenceFingerprint: evidenceByPath.get(path).evidenceFingerprint })),
      };
    });
    const approvedBatches = candidates.batches.filter(batch => batch.freezeReadiness.ready);
    const sideEffectReviews = approvedBatches.flatMap(batch => batch.sideEffectReviews.map(review => {
      const record = evidence.find(item => item.targetPath === review.module);
      return { batchId: batch.id, module: review.module, evidenceFingerprint: review.evidenceFingerprint,
        decision: "approved-compatible",
        classifications: [...new Set(record.evaluation.effects.map(effect => effect.review))].sort(compare),
        observations: review.observations };
    })).sort((left, right) => compare(left.module, right.module));
    const stateIdentityReviews = approvedBatches.flatMap(batch => batch.gates.stateIdentity
      .filter(gate => gate.status === "partial").map(gate => {
        const record = evidenceByPath.get(gate.module);
        return { batchId: batch.id, currentPath: gate.module, targetPath: record.targetPath,
          decision: "approved-preserved",
          proof: "single-cumulative-module-instance-and-same-authoritative-owner",
          authoritativeOwners: record.ownership.authoritativeOwners,
          reviewIssues: gate.reviewIssues,
          collections: record.ownership.collections.map(item => ({ owner: item.owner, status: item.status,
            creation: item.creation, cacheLifetime: item.cacheLifetime })),
          composition: record.ownership.selfComposition.map(item => ({ composed: item.composed,
            provider: item.provider, providerStatus: item.providerStatus })),
          duplicateStateCopies: "forbidden",
          evidenceFingerprint: record.evidenceFingerprint };
      })).sort((left, right) => compare(left.currentPath, right.currentPath));
    return {
      schemaVersion: 1,
      kind: profile.kind("review-evidence"),
      stage: profile.stage,
      status: "reviewed",
      reviewOwner: profile.reviewOwner,
      sourceCandidate: candidateRef,
      reviewedCollections: Object.entries(reviewedCollections)
        .map(([owner, contract]) => ({ owner, ...contract }))
        .sort((left, right) => compare(left.owner, right.owner)),
      summary: {
        moduleCount: evidence.length,
        candidateModules: evidence.filter(item => item.category === "candidate").length,
        sufficientCandidates: evidence.filter(item => item.category === "candidate" && item.verdict === "sufficient").length,
        insufficientCandidates: evidence.filter(item => item.category === "candidate" && item.verdict !== "sufficient").length,
        approvedBatches: batchDecisions.filter(item => item.decision === "approved-frozen").length,
        requiresEvidenceBatches: batchDecisions.filter(item => item.decision !== "approved-frozen").length,
        sideEffectReviews: sideEffectReviews.length,
        stateIdentityReviews: stateIdentityReviews.length,
      },
      batchDecisions,
      sideEffectReviews,
      stateIdentityReviews,
      modules: evidence,
    };
  }
}

class PostFreezeApprovedPrefixBuilder {
  // `base` (repeated reviews) names the adopted continuation this approved prefix extends.
  build({ candidates, candidateRef, reviewEvidence, reviewEvidenceRef, backlog, backlogRef,
    completedPrefix, historical, baselineTopology, profile = STAGE_3_22, base = null }) {
    const decisions = new Map(reviewEvidence.batchDecisions.map(item => [item.batchId, item]));
    let open = true;
    const frozen = [];
    const queue = [];
    for (const batch of candidates.batches) {
      const decision = decisions.get(batch.id);
      if (open && decision.decision === "approved-frozen") {
        frozen.push({ ...batch, status: "approved-frozen" });
        continue;
      }
      open = false;
      queue.push({
        id: batch.id,
        order: batch.order,
        status: "requires-evidence",
        purpose: batch.purpose,
        moduleCount: batch.modules.length,
        modules: batch.modules.map(module => ({ currentPath: module.currentPath, targetPath: module.targetPath })),
        reasons: decision.decision === "approved-frozen"
          ? ["after-evidence-freeze-barrier"] : [...decision.reasons],
        evidenceTaskIds: [...decision.evidenceTaskIds],
        requiredTransition: "collect-evidence-then-repeat-freeze-review",
      });
    }
    const taskIdsFor = (path, kind) => backlog.tasks.filter(task => (!kind || task.kind === kind) &&
      ((task.modules || []).some(item => (typeof item === "string" ? item : item.currentPath) === path) ||
        (task.unblocksCandidates || []).includes(path))).map(task => task.id).sort(compare);
    const frozenModules = frozen.flatMap(batch => batch.modules.map(module => module.currentPath)).sort(compare);
    const queuedModules = queue.flatMap(batch => batch.modules.map(module => module.currentPath)).sort(compare);
    const last = frozen.at(-1);
    return {
      schemaVersion: 1,
      kind: profile.kind("approved-prefix"),
      stage: profile.stage,
      status: "approved-prefix-frozen",
      runtimeMigrationAllowed: false,
      executionAdoption: {
        status: "not-adopted",
        reason: profile.adoptionReason,
      },
      ...(base ? { base } : {}),
      ...(profile.replacesIncompleteSuffix ? { replacesIncompleteSuffix: true } : {}),
      completedPrefix,
      sourceCandidate: candidateRef,
      reviewEvidence: reviewEvidenceRef,
      prerequisiteBacklog: backlogRef,
      historicalReference: historical,
      freezeBoundary: {
        policy: "maximal-ordered-evidence-sufficient-prefix",
        firstBatchId: frozen[0]?.id || null,
        lastBatchId: last?.id || null,
        firstRequiresEvidenceBatchId: queue[0]?.id || null,
        frozenBatchCount: frozen.length,
        frozenModuleCount: frozenModules.length,
        newActivationCount: frozen.reduce((count, batch) => count + batch.compatibility.newActivations.length, 0),
        topologyBefore: baselineTopology,
        topologyAfterPrefix: last ? last.cumulativeDelta.after : baselineTopology,
      },
      batches: frozen,
      reviewQueue: queue,
      prerequisiteBlocked: candidates.prerequisiteBlocked.map(item => ({ ...item,
        taskIds: taskIdsFor(item.currentPath) })),
      deferred: candidates.deferred.map(item => ({ ...item,
        taskIds: taskIdsFor(item.currentPath, "responsibility-decomposition") })),
      coverage: {
        completed: completedPrefix.targets,
        frozen: frozenModules,
        requiresEvidence: queuedModules,
        prerequisiteBlocked: candidates.coverage.prerequisiteBlocked,
        deferred: candidates.coverage.deferred,
        unassigned: [],
      },
      summary: {
        domainModuleCount: completedPrefix.targets.length + frozenModules.length + queuedModules.length +
          candidates.coverage.prerequisiteBlocked.length + candidates.coverage.deferred.length,
        completedModuleCount: completedPrefix.targets.length,
        frozenBatchCount: frozen.length,
        frozenModuleCount: frozenModules.length,
        reviewQueueBatchCount: queue.length,
        reviewQueueModuleCount: queuedModules.length,
        prerequisiteBlockedModuleCount: candidates.coverage.prerequisiteBlocked.length,
        deferredModuleCount: candidates.coverage.deferred.length,
        coverageStatus: "complete-completed-frozen-evidence-blocked-or-deferred",
      },
    };
  }
}

class PostFreezeApprovedPrefixValidator {
  validate({ approved, candidates, reviewEvidence, expectedDomainModuleCount, profile = STAGE_3_22 }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(approved.runtimeMigrationAllowed === false, "approved prefix must not allow runtime migration");
    require(approved.executionAdoption.status === "not-adopted", "approved prefix must not be adopted by execution state");
    const decisions = new Map(reviewEvidence.batchDecisions.map(item => [item.batchId, item]));
    approved.batches.forEach((batch, index) => {
      require(batch.id === candidates.batches[index].id, `frozen batch is not an ordered candidate prefix: ${batch.id}`);
      require(decisions.get(batch.id)?.decision === "approved-frozen", `frozen batch lacks approved evidence: ${batch.id}`);
      require(batch.gates.performance.length === 0, `frozen batch carries a hot-loop gate: ${batch.id}`);
      require(batch.cumulativeRuntimeTopology.topologyRevalidation.requiredBeforeApprovedFreeze === false,
        `frozen batch carries a graph-changing prerequisite: ${batch.id}`);
      require(batch.rollback.atomic === true && batch.rollback.partialRollbackAllowed === false,
        `frozen batch rollback is not batch-only atomic: ${batch.id}`);
      for (const record of decisions.get(batch.id)?.moduleEvidence || []) {
        require(record.verdict === "sufficient", `frozen module lacks sufficient evidence: ${record.currentPath}`);
      }
    });
    require(approved.batches.length + approved.reviewQueue.length === candidates.batches.length,
      "approved prefix and review queue must cover every candidate batch");
    const coverage = approved.coverage;
    const all = [...coverage.completed, ...coverage.frozen, ...coverage.requiresEvidence,
      ...coverage.prerequisiteBlocked, ...coverage.deferred];
    require(new Set(all).size === all.length, "approved coverage overlaps");
    require(all.length === expectedDomainModuleCount, "approved coverage is incomplete");
    require(coverage.unassigned.length === 0, "approved coverage has unassigned modules");
    if (errors.length > 0) throw new Error(`Stage ${profile.stage} approved prefix failed:\n- ${errors.join("\n- ")}`);
    return true;
  }
}

module.exports = {
  PostFreezeReviewEvidenceBuilder,
  PostFreezeApprovedPrefixBuilder,
  PostFreezeApprovedPrefixValidator,
};
