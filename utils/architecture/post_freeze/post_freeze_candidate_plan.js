"use strict";

const crypto = require("node:crypto");
const { CanonicalJson } = require("../guards/core/canonical_json");
const { DomainCandidateClusterSelector } = require("../domain_batches/domain_candidate_cluster_selector");
const { DomainCandidateBatchDesigner } = require("../domain_batches/domain_candidate_batch_designer");
const { PostFreezePlanValidator } = require("./post_freeze_plan_validator");

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const FIRST_ORDER = 22;
const ID_PREFIX = "stage-3.replan-322.batch-";
const AREA_SCENARIOS = Object.freeze({
  assemblies: ["inventory-v2 assembly preparation, refill and persistence round-trip"],
  fishing: ["game-cycle-check: light fish victory with spinning, feeder and pole",
    "game-cycle-check: large fish failure (tackle overload)"],
  inventory: ["inventory-v2 line allocation and consumable identity checks"],
  items: ["item progression, quality and rarity parity over the authored catalog"],
});

// Designs the reviewed next-prefix candidate plan for the remaining classic Domain modules. It
// reuses the historical cluster selector and batch designer (atomic SCCs, max batch size, depth
// order, deterministic tie-breaking) and adds what the post-freeze plan needs on top: evidence
// readiness ordering, replan identifiers, imports/exports and cumulative deltas from the current
// 78/87/139 runtime topology.
class PostFreezeCandidatePlanner {
  constructor({ firstOrder = FIRST_ORDER, validator = new PostFreezePlanValidator() } = {}) {
    this.firstOrder = firstOrder;
    this.validator = validator;
  }

  plan({ eligibility, evidence, logicalGraph, runtimeContract, bridgeRegistry, completedBatchIds }) {
    const { modules, decisions, categories, policy } = eligibility;
    const moduleByPath = new Map(modules.map(module => [module.currentPath, module]));
    const clusterDecisions = new Map([...decisions].map(([currentPath, decision]) => [currentPath,
      categories.get(currentPath) === "candidate" ? decision : { ...decision, status: "deferred" }]));
    const selected = new DomainCandidateClusterSelector(policy).select({ modules, decisions: clusterDecisions });
    const readiness = this.#readiness(selected.batches, moduleByPath, evidence);
    const ordered = [
      ...selected.batches.filter(batch => readiness.get(batch.id).ready),
      ...selected.batches.filter(batch => !readiness.get(batch.id).ready),
    ];
    const renamed = ordered.map((batch, index) => {
      const order = this.firstOrder + index;
      const digest = crypto.createHash("sha256").update(JSON.stringify(batch.modulePaths)).digest("hex").slice(0, 8);
      return { ...batch, order, id: `${ID_PREFIX}${String(order).padStart(3, "0")}-${batch.targetArea}-${digest}`,
        sourceClusterId: batch.id };
    });
    const design = new DomainCandidateBatchDesigner({ policy }).design({
      modules, decisions: clusterDecisions, clusters: { batches: renamed, deferredModules: [] },
      stageTwoExposures: [],
    });
    const batches = this.#enrich({ design, renamed, readiness, logicalGraph, runtimeContract,
      bridgeRegistry, completedBatchIds, moduleByPath });
    const records = eligibility.records;
    const plan = {
      batches,
      prerequisiteBlocked: records.filter(record => record.category === "prerequisite-blocked").map(record => ({
        currentPath: record.currentPath, targetPath: record.targetPath,
        prerequisiteIds: record.blockedBy.prerequisiteIds, blockedByModules: record.blockedBy.modules,
      })),
      deferred: records.filter(record => record.category === "deferred").map(record => ({
        currentPath: record.currentPath, targetPath: record.targetPath,
        reasonCodes: [...record.eligibility.reasonCodes],
      })),
    };
    plan.coverage = {
      assigned: batches.flatMap(batch => batch.modules.map(module => module.currentPath)).sort(compare),
      prerequisiteBlocked: plan.prerequisiteBlocked.map(item => item.currentPath).sort(compare),
      deferred: plan.deferred.map(item => item.currentPath).sort(compare),
      unassigned: [],
    };
    this.validator.validate({ plan, eligibility, logicalGraph, runtimeContract, firstOrder: this.firstOrder,
      maximumModulesPerBatch: policy.clustering.maximumModulesPerBatch });
    return plan;
  }

  #readiness(batches, moduleByPath, evidence) {
    const verdicts = new Map(evidence.map(record => [record.currentPath, record]));
    const batchOf = new Map(batches.flatMap(batch => batch.modulePaths.map(path => [path, batch.id])));
    const readiness = new Map(batches.map(batch => {
      const reasons = batch.modulePaths.flatMap(path => verdicts.get(path).findings
        .map(finding => `insufficient-evidence:${path}:${finding}`));
      return [batch.id, { ready: reasons.length === 0, reasons }];
    }));
    let changed = true;
    while (changed) {
      changed = false;
      for (const batch of batches) {
        const state = readiness.get(batch.id);
        if (!state.ready) continue;
        const blocking = batch.modulePaths.flatMap(path => moduleByPath.get(path).dependencyAudit.facts
          .internalDependencies.map(item => item.target))
          .filter(target => batchOf.get(target) !== batch.id && !readiness.get(batchOf.get(target)).ready);
        if (blocking.length === 0) continue;
        readiness.set(batch.id, { ready: false,
          reasons: [...new Set(blocking)].sort(compare).map(path => `depends-on-unfrozen-module:${path}`) });
        changed = true;
      }
    }
    return readiness;
  }

  #enrich({ design, renamed, readiness, logicalGraph, runtimeContract, bridgeRegistry, completedBatchIds, moduleByPath }) {
    const baseline = {
      activationIds: runtimeContract.activationPositions.map(item => item.id),
      activationTargets: runtimeContract.activationPositions.map(item => item.targetModule),
      bridges: bridgeRegistry.bridges.map(bridge => ({ id: bridge.id, source: bridge.source,
        bridge: bridge.bridge, target: bridge.target, origin: "registry" })),
    };
    const state = { activationIds: new Set(baseline.activationIds),
      activationTargets: new Set(baseline.activationTargets), bridges: [...baseline.bridges] };
    const batchOfModule = new Map(renamed.flatMap(batch => batch.modulePaths.map(path => [path, batch])));
    const inherited = [...completedBatchIds];
    return design.batches.map((batch, index) => {
      const cluster = renamed[index];
      const currentPaths = new Set(batch.modules.map(module => module.currentPath));
      const before = this.#counts(state);
      const newBridges = this.#newBridges(batch.compatibility.newActivations);
      const retired = state.bridges.filter(bridge => currentPaths.has(bridge.source))
        .sort((left, right) => compare(`${left.source}\u0000${left.target}\u0000${left.bridge}`,
          `${right.source}\u0000${right.target}\u0000${right.bridge}`));
      state.bridges = [...state.bridges.filter(bridge => !currentPaths.has(bridge.source)), ...newBridges];
      for (const activation of batch.compatibility.newActivations) {
        state.activationIds.add(activation.contract.id);
        state.activationTargets.add(activation.contract.targetModule);
      }
      const after = this.#counts(state);
      const cumulativeActivationIds = [...state.activationIds].sort(compare);
      const record = {
        ...batch,
        status: "candidate",
        sourceClusterId: cluster.sourceClusterId,
        freezeReadiness: readiness.get(cluster.sourceClusterId),
        imports: this.#imports(batch, logicalGraph, batchOfModule, moduleByPath),
        // A provider observed through several mechanisms (lexical and globalThis) is one export.
        exports: batch.modules.flatMap(module => [...new Set(module.providers.map(provider => provider.symbol))]
          .map(symbol => ({ module: module.targetPath, exportName: symbol, legacySymbol: symbol })))
          .sort((left, right) => compare(`${left.module}\u0000${left.exportName}`, `${right.module}\u0000${right.exportName}`)),
        cumulativeDelta: {
          before,
          after,
          modulesAdded: batch.modules.map(module => module.targetPath).sort(compare),
          activationsAdded: batch.compatibility.newActivations.map(item => item.contract.id).sort(compare),
          bridgesAdded: newBridges.map(({ source, bridge, target, symbol }) => ({ source, bridge, target, symbol })),
          bridgesRetired: retired.map(({ id, source, bridge, target, origin }) => ({ id: id || null, source, bridge, target, origin })),
          bridgeLegsVerifiedAt: "prebuild",
        },
        compatibility: {
          ...batch.compatibility,
          cumulativeActivationIds: undefined,
          cumulativeActivationCount: cumulativeActivationIds.length,
          cumulativeActivationFingerprint: CanonicalJson.fingerprint(cumulativeActivationIds),
        },
        cumulativeRuntimeTopology: {
          topology: batch.cumulativeRuntimeTopology.topology,
          inheritedBatchIds: [...inherited],
          moduleRecords: batch.cumulativeRuntimeTopology.moduleRecords.stage3New,
          topologyBefore: before,
          topologyAfter: after,
          topologyRevalidation: batch.cumulativeRuntimeTopology.topologyRevalidation,
          candidateBatchId: batch.id,
        },
        focusedScenarios: this.#scenarios(batch),
      };
      delete record.compatibility.cumulativeActivationIds;
      inherited.push(batch.id);
      return record;
    });
  }

  #counts(state) {
    return { modules: state.activationTargets.size, activations: state.activationIds.size,
      bridges: state.bridges.length };
  }

  #newBridges(activations) {
    const bridges = new Map();
    for (const activation of activations) {
      for (const consumer of activation.legacyConsumers) {
        const key = `${consumer}\u0000${activation.contract.targetModule}`;
        if (!bridges.has(key)) {
          bridges.set(key, { source: consumer, bridge: activation.contract.sourceProvider,
            target: activation.contract.targetModule, symbol: activation.contract.legacySymbol, origin: "plan" });
        }
      }
    }
    return [...bridges.values()].sort((left, right) => compare(`${left.source}\u0000${left.target}`,
      `${right.source}\u0000${right.target}`));
  }

  #imports(batch, logicalGraph, batchOfModule, moduleByPath) {
    const currentPaths = new Set(batch.modules.map(module => module.currentPath));
    const resolved = logicalGraph.activationResolution.filter(item => currentPaths.has(item.consumer))
      .map(item => ({ consumer: item.consumer, from: item.targetModule, exportName: item.exportName,
        legacySymbol: item.symbol, resolution: item.scope === "completed-domain" ? "completed-prefix" : "foundation",
        viaShim: item.shim, activationId: item.activationId, executionPhases: item.executionPhases }));
    const planned = batch.modules.flatMap(module => moduleByPath.get(module.currentPath).dependencyAudit.facts
      .internalDependencies.map(dependency => {
        const dependencyBatch = batchOfModule.get(dependency.target);
        return { consumer: module.currentPath, from: moduleByPath.get(dependency.target).targetPath,
          exportName: null, legacySymbols: [...dependency.symbols].sort(compare),
          resolution: dependencyBatch.id === batch.id ? "same-batch" : "earlier-batch",
          batchId: dependencyBatch.id, executionPhases: [...dependency.executionPhases].sort(compare) };
      }));
    return [...resolved, ...planned].sort((left, right) =>
      compare(`${left.consumer}\u0000${left.from}\u0000${left.legacySymbol || ""}`,
        `${right.consumer}\u0000${right.from}\u0000${right.legacySymbol || ""}`));
  }

  #scenarios(batch) {
    const scenarios = batch.modules.map(module => {
      const items = [`behavior parity of ${module.providers.map(item => item.symbol).join(", ") || module.targetPath}`];
      if (module.eligibility.invariantImpact.state === "review-required") items.push("state identity: same authoritative owner");
      if (module.eligibility.invariantImpact.sideEffects === "review-required") items.push("cumulative evaluation safety");
      if (module.eligibility.invariantImpact.compatibility === "activation-required") items.push("activation timing and exact export");
      if (module.eligibility.invariantImpact.performance === "enhanced-gates-required") {
        items.push("allocation and deltaTime equivalence without hot-loop compatibility lookup");
      }
      return { module: module.currentPath, scenarios: items };
    });
    return { modules: scenarios, integration: [...(AREA_SCENARIOS[batch.targetArea] || [])] };
  }
}

module.exports = { PostFreezeCandidatePlanner, FIRST_ORDER, ID_PREFIX };
