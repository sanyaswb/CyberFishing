"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { CanonicalJson } = require("../guards/core/canonical_json");
const { recordKind, stageDirectories } = require("../stage_four/cluster_ledger");

const HISTORICAL_PLAN = "architecture/migration/stage_3_approved_batches.json";
const CONTINUATION_KIND = "cyber-fishing-stage-3-22-approved-prefix";
const EXTENSION_KIND = "cyber-fishing-stage-3-review-queue-freeze-extension";
const HISTORICAL_DOMAIN_AUDIT = "architecture/migration/stage_3_domain_audit.json";
const CONTINUATION_DOMAIN_AUDIT = "architecture/migration/stage_3_22/domain_audit.json";
const RUNTIME_CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Single source of the Stage 3 execution plan. Without an adopted continuation it returns the frozen
// historical plan byte-for-byte, so every released batch replays unchanged. Once the execution
// state references the Stage 3.22 approved prefix, it returns one ordered plan: the historical
// batches followed by the continuation batches, normalized to the historical record shape. An
// adopted review-queue freeze extension names its base continuation by fingerprint and appends
// its newly frozen batches after the base batches.
class StageThreeApprovedPlanSource {
  constructor({ read }) {
    assert.equal(typeof read, "function", "plan source requires a byte reader");
    this.read = read;
  }

  // `adopting` is the exact continuation a batch profile pins before its prebuild records the
  // adoption in the execution state; once adopted, both references must be identical.
  // A profile may also pin the freeze extension of the adopted continuation; its prebuild then
  // records the extension as the adopted plan.
  load(executionState, { adopting = null } = {}) {
    const adopted = executionState.continuationPlan;
    const extending = Boolean(adopting && adopted && !isDeepStrictEqual(adopted, adopting) &&
      this.extendsContinuation(adopting, adopted));
    if (adopting && adopted && !extending) {
      assert.deepEqual(adopted, adopting, "adopted continuation plan differs from the profile");
    }
    const historicalBytes = this.read(HISTORICAL_PLAN);
    const historicalSha256 = sha256(historicalBytes);
    assert.equal(executionState.approvedPlanSha256, historicalSha256, "approved plan fingerprint is stale");
    const historical = JSON.parse(historicalBytes.toString("utf8"));
    const reference = extending ? adopting : adopted || adopting;
    if (!reference) {
      return Object.freeze({ document: historical, sha256: historicalSha256, continuation: null,
        references: [{ path: HISTORICAL_PLAN, sha256: historicalSha256 }], domainAuditPath: HISTORICAL_DOMAIN_AUDIT });
    }
    // Follow the chain of links (freeze extensions and repeated-review approved prefixes) down to the
    // Stage 3.22 approved prefix; every link names its base by fingerprint.
    const links = [];
    let current = { reference, document: this.#document(reference, "continuation plan fingerprint is stale") };
    while (current.document.kind !== CONTINUATION_KIND) {
      assert(this.#isLink(current.document), "continuation plan kind is invalid");
      links.unshift(current);
      const base = current.document.base;
      current = { reference: base, document: this.#document(base, "extension base continuation fingerprint is stale") };
    }
    const root = current;
    let continuation = root.document;
    this.#validateContinuation(continuation, historical, historicalSha256);
    for (const link of links) {
      const replaceAt = this.#validateExtension(link.document, continuation, historical);
      const baseBatches = replaceAt === null ? continuation.batches : continuation.batches.slice(0, replaceAt);
      continuation = { ...continuation, batches: [...baseBatches, ...link.document.batches],
        extension: { path: link.reference.path, sha256: link.reference.sha256 } };
    }
    const review = [...links].reverse().find(link => link.document.kind !== EXTENSION_KIND);
    const domainAuditPath = review
      ? `${review.document.sourceCandidate.path.split("/").slice(0, -1).join("/")}/domain_audit.json`
      : CONTINUATION_DOMAIN_AUDIT;
    const batches = [...historical.batches];
    const retiredBy = this.#retiredBy();
    const continuationIds = new Set(continuation.batches.map(batch => batch.id));
    // A plan read at an earlier checkpoint sees retirements of later batches (from a newer
    // continuation link) in the live runtime contract; they are not yet part of this plan.
    // A later replacement review may reuse the next unexecuted order while replacing an older
    // frozen suffix. It is later relative to this checkpoint when it follows the completed prefix,
    // even if the older plan had already reserved the same or higher order numbers.
    const completedOrder = executionState.completedBatchIds.length;
    const later = id => Number(/\.batch-(\d{3})-/u.exec(id)?.[1]) > completedOrder;
    for (const retiring of retiredBy.values()) {
      assert(continuationIds.has(retiring) || later(retiring), `activation retired by an unknown batch: ${retiring}`);
    }
    // The frozen cumulative set is proven against the recorded fingerprint; activations retired by
    // this or an earlier continuation batch are then removed from the effective cumulative set.
    let frozenCumulative = [...historical.batches.at(-1).compatibility.cumulativeActivationIds];
    const retiredSoFar = new Set();
    for (const batch of continuation.batches) {
      frozenCumulative = [...frozenCumulative,
        ...batch.compatibility.newActivations.map(activation => activation.contract.id)].sort();
      for (const [id, retiring] of retiredBy) if (retiring === batch.id) retiredSoFar.add(id);
      batches.push(this.#normalize(batch, batches.at(-1), frozenCumulative, retiredSoFar));
    }
    const document = { ...historical, batches, continuation: { path: reference.path, sha256: reference.sha256 } };
    // One link keeps the original single-extension fingerprint; longer chains list every link.
    const planSha256 = links.length === 0 ? { historical: historicalSha256, continuation: reference.sha256 }
      : links.length === 1 ? { historical: historicalSha256, continuation: root.reference.sha256, extension: reference.sha256 }
        : { historical: historicalSha256, continuation: root.reference.sha256, links: links.map(link => link.reference.sha256) };
    return Object.freeze({
      document,
      sha256: sha256(Buffer.from(JSON.stringify(planSha256))),
      continuation,
      references: [{ path: HISTORICAL_PLAN, sha256: historicalSha256 },
        { path: root.reference.path, sha256: root.reference.sha256 },
        ...links.map(link => ({ path: link.reference.path, sha256: link.reference.sha256 }))],
      domainAuditPath,
    });
  }

  #document(reference, message) {
    const bytes = this.read(reference.path);
    assert.equal(sha256(bytes), reference.sha256, message);
    return JSON.parse(bytes.toString("utf8"));
  }

  // A chain link: a review-queue freeze extension or the approved prefix of a repeated review.
  #isLink(document) {
    return Boolean(document?.base) && (document.kind === EXTENSION_KIND ||
      /^cyber-fishing-stage-3-\d+-approved-prefix$/u.test(document.kind));
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
  // Every reviewed import record of one batch with its export resolved: completed-prefix and
  // foundation records as frozen, earlier-batch records through the exact activation of the
  // earlier batch.
  static resolvedImportRecords(document, batch) {
    // An earlier-batch import naming several legacy symbols of one module (batch 045+) becomes one
    // record per symbol, each resolved through its own exact activation.
    return (batch.imports || []).filter(record =>
      ["completed-prefix", "earlier-batch", "foundation"].includes(record.resolution))
      .flatMap(record => record.resolution === "earlier-batch"
        ? (Array.isArray(record.legacySymbols) && record.legacySymbols.length > 1
          ? record.legacySymbols.map(symbol => ({ ...record, legacySymbols: [symbol] })) : [record])
          .map(single => StageThreeApprovedPlanSource.#earlierBatchImport(document, single))
        : [record]);
  }

  static reviewedImports(document, batchIds) {
    const selected = new Set(batchIds);
    const result = {};
    for (const batch of document.batches.filter(record => selected.has(record.id))) {
      for (const module of batch.modules) {
        const imports = StageThreeApprovedPlanSource.resolvedImportRecords(document, batch)
          .filter(record => record.consumer === module.currentPath);
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

  // An import of an earlier batch of the same continuation names no export in the frozen plan; it
  // resolves exactly through that batch's frozen activation of the imported legacy symbol.
  static #earlierBatchImport(document, record) {
    const source = document.batches.find(batch => batch.id === record.batchId);
    assert(source, `earlier-batch import names an unknown batch: ${record.batchId}`);
    assert(Array.isArray(record.legacySymbols) && record.legacySymbols.length === 1,
      `earlier-batch import must name exactly one legacy symbol: ${record.from}`);
    const activations = source.compatibility.newActivations.map(item => item.contract).filter(contract =>
      contract.targetModule === record.from && contract.legacySymbol === record.legacySymbols[0]);
    assert.equal(activations.length, 1, `earlier-batch import has no exact activation: ${record.from}`);
    return { ...record, exportName: activations[0].exportName, legacySymbol: activations[0].legacySymbol,
      viaShim: activations[0].sourceProvider, activationId: activations[0].id };
  }

  #retiredBy() {
    let bytes;
    try { bytes = this.read(RUNTIME_CONTRACT); } catch { return new Map(); }
    const retired = JSON.parse(bytes.toString("utf8")).retiredActivations || [];
    return new Map(retired.filter(record => {
      const cluster = /^stage-([45])\.cluster-(\d{3})-([a-z0-9-]+)$/u.exec(record.retiredBy);
      if (!cluster) return true;
      // Stage 4/5 retirements belong to their applied ledgers; they do not rewrite the frozen Stage 3 plan.
      const stage = Number(cluster[1]);
      const file = `${stageDirectories(stage).clusters}/${cluster[2]}_${cluster[3]}.json`;
      const applied = JSON.parse(this.read(file).toString("utf8"));
      assert(applied.kind === recordKind(stage) && applied.id === cluster[2] && applied.slug === cluster[3] &&
        applied.output?.status === "applied" && applied.output.owner === record.retiredBy &&
        applied.output.activationsRetired?.includes(record.activation.id),
      `activation retirement has no exact applied Stage ${stage} cluster: ${record.activation.id}`);
      return false;
    }).map(record => [record.activation.id, record.retiredBy]));
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

  // True when `candidate` names a chain link (freeze extension or repeated-review approved prefix)
  // whose base is exactly the `base` reference.
  extendsContinuation(candidate, base) {
    let document;
    try { document = JSON.parse(this.read(candidate.path).toString("utf8")); } catch { return false; }
    return this.#isLink(document) && isDeepStrictEqual(document.base, base);
  }

  // A freeze extension follows the complete base continuation: every historical and base batch is
  // completed and its frozen batches continue the order.
  #validateExtension(extension, continuation, historical) {
    assert(["approved-extension-frozen", "approved-prefix-frozen"].includes(extension.status), "freeze extension is not frozen");
    assert.equal(extension.runtimeMigrationAllowed, false);
    if (extension.replacesIncompleteSuffix === true) {
      const existingIds = [...historical.batches, ...continuation.batches].map(batch => batch.id);
      const completedIds = extension.completedPrefix.completedBatchIds;
      assert(completedIds.length >= historical.batches.length && completedIds.length < existingIds.length,
        "replacement review must keep the historical prefix and replace a non-empty suffix");
      assert.deepEqual(completedIds, existingIds.slice(0, completedIds.length),
        "replacement review must follow the exact completed base prefix");
      assert(extension.batches.length > 0, "replacement review has no frozen batches");
      extension.batches.forEach((batch, index) => {
        assert.equal(batch.order, completedIds.length + index + 1,
          `replacement batch order differs: ${batch.id}`);
        assert.equal(batch.status, "approved-frozen", `replacement batch is not frozen: ${batch.id}`);
      });
      return completedIds.length - historical.batches.length;
    }
    assert.deepEqual(extension.completedPrefix.completedBatchIds,
      [...historical.batches, ...continuation.batches].map(batch => batch.id),
      "freeze extension must follow the complete base continuation");
    assert(extension.batches.length > 0, "freeze extension has no frozen batches");
    extension.batches.forEach((batch, index) => {
      assert.equal(batch.order, historical.batches.length + continuation.batches.length + index + 1,
        `extension order differs: ${batch.id}`);
      assert.equal(batch.status, "approved-frozen", `extension batch is not frozen: ${batch.id}`);
    });
    return null;
  }

  // Adds the cumulative fields historical consumers read and proves them against the recorded
  // cumulative activation count and fingerprint of the continuation batch.
  #normalize(batch, previous, frozenCumulative, retiredSoFar) {
    const previousTopology = previous.cumulativeRuntimeTopology;
    assert.equal(frozenCumulative.length, batch.compatibility.cumulativeActivationCount,
      `cumulative activation count differs: ${batch.id}`);
    assert.equal(CanonicalJson.fingerprint(frozenCumulative), batch.compatibility.cumulativeActivationFingerprint,
      `cumulative activation fingerprint differs: ${batch.id}`);
    const cumulativeActivationIds = frozenCumulative.filter(id => !retiredSoFar.has(id));
    const retiredActivationIds = [...retiredSoFar].sort();
    const stage3Targets = [...new Set([...previousTopology.stage3Targets,
      ...batch.modules.map(module => module.targetPath)])].sort();
    return {
      ...batch,
      compatibility: { ...batch.compatibility, cumulativeActivationIds,
        ...(retiredActivationIds.length > 0 ? { cumulativeRetiredActivationIds: retiredActivationIds } : {}) },
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

module.exports = {
  StageThreeApprovedPlanSource,
  HISTORICAL_PLAN,
  CONTINUATION_DOMAIN_AUDIT,
  HISTORICAL_DOMAIN_AUDIT,
  EXTENSION_KIND,
};
