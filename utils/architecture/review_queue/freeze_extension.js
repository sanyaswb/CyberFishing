"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { CanonicalJson } = require("../guards/core/canonical_json");
const { EXTENSION_KIND } = require("../domain_batches/stage_three_approved_plan_source");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const REASON = /^insufficient-evidence:(src\/[^:]+\.js):(.+)$/u;

// Repeats the Stage 3.22 freeze decision for the review queue with the collected evidence. A queued
// batch is frozen only when (1) every module source still reproduces its Stage 3.22 evidence
// fingerprint, so the reviewed graph and sources are unchanged, (2) every recorded finding of every
// module is resolved by exactly one evidence record bound to the current source, and (3) every
// earlier queued batch is frozen as well (maximal ordered prefix).
class StageThreeFreezeExtensionBuilder {
  build({ base, baseRef, candidates, candidatesRef, reviewEvidence, reviewEvidenceRef, backlog, backlogRef,
    executionState, executionStateRef, evidence, readSource }) {
    const candidateById = new Map(candidates.batches.map(batch => [batch.id, batch]));
    const moduleEvidence = new Map(reviewEvidence.modules.map(record => [record.currentPath, record]));
    const decisions = [];
    const frozen = [];
    const queue = [];
    let open = true;
    for (const queued of base.reviewQueue) {
      const candidate = candidateById.get(queued.id);
      assert(candidate, `review-queue batch has no candidate record: ${queued.id}`);
      const bindings = candidate.modules.map(module => {
        const record = moduleEvidence.get(module.currentPath);
        assert(record, `review-queue module lacks Stage 3.22 evidence: ${module.currentPath}`);
        const source = readSource(module.currentPath);
        const { evidenceFingerprint, ...fields } = record;
        const reproduced = CanonicalJson.fingerprint({ ...fields,
          source: CanonicalJson.fingerprint(source) }) === evidenceFingerprint;
        return { currentPath: module.currentPath, targetPath: module.targetPath,
          stage322EvidenceFingerprint: evidenceFingerprint, sourceSha256: sha(source),
          stage322SourceBinding: reproduced ? "reproduced" : "changed", findings: [...record.findings] };
      });
      const resolutions = [];
      const unresolved = [];
      for (const binding of bindings) {
        if (binding.stage322SourceBinding !== "reproduced") {
          unresolved.push(`source-changed-since-stage-3.22-review:${binding.currentPath}`);
          continue;
        }
        for (const finding of binding.findings) {
          const matches = evidence.filter(item => item.record.currentPath === binding.currentPath &&
            item.record.finding === finding);
          if (matches.length !== 1 || matches[0].record.sourceSha256 !== binding.sourceSha256) {
            unresolved.push(`unresolved-finding:${binding.currentPath}:${finding}`);
            continue;
          }
          resolutions.push({ currentPath: binding.currentPath, finding, evidenceTaskId: matches[0].taskId,
            evidence: matches[0].artifact, verdict: matches[0].record.verdict });
        }
      }
      for (const reason of queued.reasons) {
        const match = REASON.exec(reason);
        assert(match, `review-queue reason is not an evidence finding: ${reason}`);
        assert(bindings.some(binding => binding.currentPath === match[1] && binding.findings.includes(match[2])),
          `review-queue reason is not a recorded module finding: ${reason}`);
      }
      const ready = open && unresolved.length === 0;
      decisions.push({ batchId: queued.id, order: queued.order,
        stage322Decision: "requires-evidence",
        decision: ready ? "approved-frozen" : "requires-evidence",
        evidenceTaskIds: [...queued.evidenceTaskIds], moduleBindings: bindings,
        resolutions: resolutions.sort((left, right) => compare(`${left.currentPath}\0${left.finding}`,
          `${right.currentPath}\0${right.finding}`)),
        unresolved: open ? unresolved : ["after-evidence-freeze-barrier", ...unresolved] });
      if (ready) frozen.push({ ...candidate, status: "approved-frozen" });
      else {
        open = false;
        queue.push({ ...queued });
      }
    }
    const baseIds = base.batches.map(batch => batch.id);
    const completedIds = [...base.completedPrefix.completedBatchIds, ...baseIds];
    assert.deepEqual(executionState.completedBatchIds, completedIds,
      "the freeze extension follows the complete Stage 3.22 approved prefix");
    const last = frozen.at(-1);
    return {
      schemaVersion: 1,
      kind: EXTENSION_KIND,
      stage: "3.34.0",
      status: "approved-extension-frozen",
      runtimeMigrationAllowed: false,
      executionAdoption: {
        status: "not-adopted",
        reason: "The execution state keeps the completed 001–032 prefix and the Stage 3.22 continuation; the first frozen batch adopts this extension in its own prebuild state transition.",
      },
      base: baseRef,
      completedPrefix: { executionState: executionStateRef, completedBatchIds: completedIds },
      sources: { candidateBatches: candidatesRef, reviewEvidence: reviewEvidenceRef, prerequisiteBacklog: backlogRef,
        evidence: [...new Map(evidence.map(item => [item.artifact.path, item.artifact])).values()] },
      policy: "repeat-stage-3.22-freeze-for-the-review-queue-with-unchanged-graph-and-sources",
      freezeBoundary: {
        policy: "maximal-ordered-evidence-sufficient-prefix",
        firstBatchId: frozen[0]?.id || null,
        lastBatchId: last?.id || null,
        firstRequiresEvidenceBatchId: queue[0]?.id || null,
        frozenBatchCount: frozen.length,
        frozenModuleCount: frozen.reduce((count, batch) => count + batch.modules.length, 0),
        newActivationCount: frozen.reduce((count, batch) => count + batch.compatibility.newActivations.length, 0),
        topologyBefore: base.freezeBoundary.topologyAfterPrefix,
        topologyAfterExtension: last ? last.cumulativeDelta.after : base.freezeBoundary.topologyAfterPrefix,
      },
      batchDecisions: decisions,
      batches: frozen,
      reviewQueue: queue,
      resolvedEvidenceTaskIds: [...new Set(decisions.filter(item => item.decision === "approved-frozen")
        .flatMap(item => item.evidenceTaskIds))].sort(compare),
      remaining: {
        prerequisiteBlocked: base.prerequisiteBlocked.map(item => item.currentPath).sort(compare),
        deferred: base.deferred.map(item => item.currentPath).sort(compare),
        backlogTaskIds: backlog.tasks.map(task => task.id).filter(id =>
          !decisions.some(item => item.decision === "approved-frozen" && item.evidenceTaskIds.includes(id))).sort(compare),
      },
      summary: {
        reviewQueueBatchCount: base.reviewQueue.length,
        frozenBatchCount: frozen.length,
        frozenModuleCount: frozen.reduce((count, batch) => count + batch.modules.length, 0),
        requiresEvidenceBatchCount: queue.length,
        prerequisiteBlockedModuleCount: base.prerequisiteBlocked.length,
        deferredModuleCount: base.deferred.length,
      },
    };
  }
}

// Structural gate of a freeze extension: frozen batches continue the base order, carry no
// graph-changing prerequisite, keep batch-only atomic rollback, and every hot-loop gate module is
// covered by a resolved hot-loop evidence record.
class StageThreeFreezeExtensionValidator {
  validate({ extension, base }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(extension.kind === EXTENSION_KIND, "freeze extension kind differs");
    require(extension.runtimeMigrationAllowed === false, "freeze extension must not allow runtime migration");
    require(extension.executionAdoption.status === "not-adopted", "freeze extension must not be adopted by itself");
    const firstOrder = base.completedPrefix.completedBatchIds.length + base.batches.length + 1;
    const decisions = new Map(extension.batchDecisions.map(item => [item.batchId, item]));
    extension.batches.forEach((batch, index) => {
      const decision = decisions.get(batch.id);
      require(batch.id === base.reviewQueue[index]?.id, `frozen batch is not the ordered review queue: ${batch.id}`);
      require(batch.order === firstOrder + index, `frozen batch order differs: ${batch.id}`);
      require(decision?.decision === "approved-frozen", `frozen batch lacks an approved decision: ${batch.id}`);
      require((decision?.unresolved || []).length === 0, `frozen batch has unresolved findings: ${batch.id}`);
      require(batch.cumulativeRuntimeTopology.topologyRevalidation.requiredBeforeApprovedFreeze === false,
        `frozen batch carries a graph-changing prerequisite: ${batch.id}`);
      require(batch.rollback.atomic === true && batch.rollback.partialRollbackAllowed === false,
        `frozen batch rollback is not batch-only atomic: ${batch.id}`);
      for (const gate of batch.gates.performance) {
        require((decision?.resolutions || []).some(item => item.currentPath === gate.module &&
          item.finding === "hot-loop-equivalence-evidence-missing"), `hot-loop gate lacks evidence: ${gate.module}`);
      }
      for (const binding of decision?.moduleBindings || []) {
        require(binding.stage322SourceBinding === "reproduced", `module source changed: ${binding.currentPath}`);
        for (const finding of binding.findings) {
          require(decision.resolutions.some(item => item.currentPath === binding.currentPath && item.finding === finding),
            `finding is not resolved: ${binding.currentPath}:${finding}`);
        }
      }
    });
    require(extension.batches.length + extension.reviewQueue.length === base.reviewQueue.length,
      "frozen batches and remaining queue must cover the review queue");
    if (errors.length > 0) throw new Error(`Review-queue freeze extension failed:\n- ${errors.join("\n- ")}`);
    return true;
  }
}

module.exports = { StageThreeFreezeExtensionBuilder, StageThreeFreezeExtensionValidator };
