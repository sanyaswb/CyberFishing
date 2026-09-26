"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { CanonicalJson } = require("../guards/core/canonical_json");

const HISTORICAL_PLAN = "architecture/migration/stage_3_approved_batches.json";
const CONTINUATION_KIND = "cyber-fishing-stage-3-22-approved-prefix";
const HISTORICAL_DOMAIN_AUDIT = "architecture/migration/stage_3_domain_audit.json";
const CONTINUATION_DOMAIN_AUDIT = "architecture/migration/stage_3_22/domain_audit.json";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Single source of the Stage 3 execution plan. Without an adopted continuation it returns the frozen
// historical plan byte-for-byte, so every released batch replays unchanged. Once the execution
// state references the Stage 3.22 approved prefix, it returns one ordered plan: the historical
// batches followed by the continuation batches, normalized to the historical record shape.
class StageThreeApprovedPlanSource {
  constructor({ read }) {
    assert.equal(typeof read, "function", "plan source requires a byte reader");
    this.read = read;
  }

  // `adopting` is the exact continuation a batch profile pins before its prebuild records the
  // adoption in the execution state; once adopted, both references must be identical.
  load(executionState, { adopting = null } = {}) {
    if (adopting && executionState.continuationPlan) {
      assert.deepEqual(executionState.continuationPlan, adopting, "adopted continuation plan differs from the profile");
    }
    const historicalBytes = this.read(HISTORICAL_PLAN);
    const historicalSha256 = sha256(historicalBytes);
    assert.equal(executionState.approvedPlanSha256, historicalSha256, "approved plan fingerprint is stale");
    const historical = JSON.parse(historicalBytes.toString("utf8"));
    const reference = executionState.continuationPlan || adopting;
    if (!reference) {
      return Object.freeze({ document: historical, sha256: historicalSha256, continuation: null,
        references: [{ path: HISTORICAL_PLAN, sha256: historicalSha256 }], domainAuditPath: HISTORICAL_DOMAIN_AUDIT });
    }
    const continuationBytes = this.read(reference.path);
    assert.equal(sha256(continuationBytes), reference.sha256, "continuation plan fingerprint is stale");
    const continuation = JSON.parse(continuationBytes.toString("utf8"));
    this.#validateContinuation(continuation, historical, historicalSha256);
    const batches = [...historical.batches];
    for (const batch of continuation.batches) batches.push(this.#normalize(batch, batches.at(-1)));
    const document = { ...historical, batches, continuation: { path: reference.path, sha256: reference.sha256 } };
    return Object.freeze({
      document,
      sha256: sha256(Buffer.from(JSON.stringify({ historical: historicalSha256, continuation: reference.sha256 }))),
      continuation,
      references: [{ path: HISTORICAL_PLAN, sha256: historicalSha256 }, { ...reference }],
      domainAuditPath: CONTINUATION_DOMAIN_AUDIT,
    });
  }

  // Historical batch N ran as Stage 3.N. An adopted continuation starts after its own audit-only
  // stage, so its first selected batch runs as the next stage number.
  currentStage(executionState) {
    const plan = this.load(executionState);
    const selected = executionState.completedBatchIds.length +
      (executionState.activeBatchId && executionState.activeBatchPhase !== "prebuild" ? 1 : 0);
    const historical = plan.document.batches.length - (plan.continuation?.batches.length || 0);
    const number = plan.continuation && selected > historical
      ? Number(plan.continuation.stage.split(".")[1]) + selected - historical
      : selected;
    return `3.${number}`;
  }

  // Exact reviewed completed-prefix imports of every target in the given batches, keyed by target
  // path, in the execution plan's `importsAllowed` shape (relative specifier from the target).
  static reviewedImports(document, batchIds) {
    const selected = new Set(batchIds);
    const result = {};
    for (const batch of document.batches.filter(record => selected.has(record.id))) {
      for (const module of batch.modules) {
        const imports = (batch.imports || []).filter(record => record.consumer === module.currentPath &&
          record.resolution === "completed-prefix");
        if (imports.length === 0) continue;
        const directory = module.targetPath.split("/").slice(0, -1);
        result[module.targetPath] = imports.map(record => {
          const target = record.from.split("/");
          let common = 0;
          while (common < directory.length && directory[common] === target[common]) common += 1;
          const relative = [...directory.slice(common).map(() => ".."), ...target.slice(common)].join("/");
          return { specifier: relative.startsWith(".") ? relative : `./${relative}`, from: record.from,
            exportName: record.exportName, activationId: record.activationId };
        }).sort((left, right) => `${left.specifier}\0${left.exportName}`.localeCompare(`${right.specifier}\0${right.exportName}`));
      }
    }
    return result;
  }

  #validateContinuation(continuation, historical, historicalSha256) {
    assert.equal(continuation.kind, CONTINUATION_KIND, "continuation plan kind is invalid");
    assert.equal(continuation.status, "approved-prefix-frozen", "continuation plan is not frozen");
    assert.equal(continuation.runtimeMigrationAllowed, false);
    assert.equal(continuation.completedPrefix.approvedPlan.sha256, historicalSha256,
      "continuation plan does not extend the historical approved plan");
    assert.deepEqual(continuation.completedPrefix.completedBatchIds, historical.batches.map(batch => batch.id),
      "continuation plan must follow the complete historical prefix");
    continuation.batches.forEach((batch, index) => {
      assert.equal(batch.order, historical.batches.length + index + 1, `continuation order differs: ${batch.id}`);
      assert.equal(batch.status, "approved-frozen", `continuation batch is not frozen: ${batch.id}`);
    });
  }

  // Adds the cumulative fields historical consumers read and proves them against the recorded
  // cumulative activation count and fingerprint of the continuation batch.
  #normalize(batch, previous) {
    const previousTopology = previous.cumulativeRuntimeTopology;
    const cumulativeActivationIds = [...previous.compatibility.cumulativeActivationIds,
      ...batch.compatibility.newActivations.map(activation => activation.contract.id)].sort();
    assert.equal(cumulativeActivationIds.length, batch.compatibility.cumulativeActivationCount,
      `cumulative activation count differs: ${batch.id}`);
    assert.equal(CanonicalJson.fingerprint(cumulativeActivationIds), batch.compatibility.cumulativeActivationFingerprint,
      `cumulative activation fingerprint differs: ${batch.id}`);
    const stage3Targets = [...new Set([...previousTopology.stage3Targets,
      ...batch.modules.map(module => module.targetPath)])].sort();
    return {
      ...batch,
      compatibility: { ...batch.compatibility, cumulativeActivationIds },
      cumulativeRuntimeTopology: {
        ...batch.cumulativeRuntimeTopology,
        stage3Targets,
        stage2Targets: [...previousTopology.stage2Targets],
        moduleRecordCount: previousTopology.stage2Targets.length + stage3Targets.length,
        inheritedStage3BatchIds: [...batch.cumulativeRuntimeTopology.inheritedBatchIds],
        moduleRecords: { stage2Foundation: [], stage3New: batch.cumulativeRuntimeTopology.moduleRecords },
        activationIds: cumulativeActivationIds,
      },
    };
  }
}

module.exports = { StageThreeApprovedPlanSource, HISTORICAL_PLAN, CONTINUATION_DOMAIN_AUDIT, HISTORICAL_DOMAIN_AUDIT };
