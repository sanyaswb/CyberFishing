"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../../architecture/guards/core/guard_models");
const {
  EsmDependencyObserver,
} = require("../../architecture/guards/observation/esm_dependency_observer");
const { CanonicalCompatibilityPath } = require("./cumulative_runtime_contract");

class StageThreeTargetSelector {
  select({ approvedPlan, executionState }) {
    const batches = Array.isArray(approvedPlan?.batches) ? approvedPlan.batches : [];
    const orderedIds = batches.map((batch) => batch.id);
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error("Stage 3 approved batch ids must be unique");
    }
    const completed = Array.isArray(executionState?.completedBatchIds)
      ? executionState.completedBatchIds
      : [];
    if (
      completed.length > orderedIds.length ||
      !completed.every((id, index) => id === orderedIds[index])
    ) {
      throw new Error("Stage 3 completedBatchIds must be an ordered approved prefix");
    }
    const expectedActive = orderedIds[completed.length] || null;
    if (
      executionState?.activeBatchId !== null &&
      executionState?.activeBatchId !== expectedActive
    ) {
      throw new Error("Stage 3 activeBatchId must be the first batch after completed prefix");
    }
    const allowedIds = new Set([
      ...completed,
      ...(executionState?.activeBatchId ? [executionState.activeBatchId] : []),
    ]);
    const targetOwners = new Map();
    for (const batch of batches) {
      if (!allowedIds.has(batch.id)) continue;
      if (batch.status !== "approved-frozen") {
        throw new Error(`Stage 3 batch is not approved-frozen: ${batch.id}`);
      }
      for (const moduleRecord of batch.modules || []) {
        const targetPath = CanonicalCompatibilityPath.normalize(
          moduleRecord.targetPath,
          "Stage 3 targetPath",
        );
        if (targetOwners.has(targetPath)) {
          throw new Error(`Stage 3 target belongs to multiple selected batches: ${targetPath}`);
        }
        targetOwners.set(targetPath, batch.id);
      }
    }
    return immutableRecord({
      selectedBatchIds: [...allowedIds],
      targetModules: [...targetOwners.keys()].sort(),
      targetOwners: [...targetOwners.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([module, owner]) => ({ module, owner })),
    });
  }
}

class StageTwoMigratedTargetCatalog {
  collect({ approvedPlan, executionState }) {
    const completed = new Set(executionState?.completedBatchIds || []);
    const records = [];
    for (const batch of approvedPlan?.batches || []) {
      if (!completed.has(batch.id)) continue;
      for (const moduleRecord of batch.modules || []) {
        const source = CanonicalCompatibilityPath.normalize(
          moduleRecord.targetPath,
          "completed Stage 2 target",
        );
        const outputs = (batch.bridgeStrategy?.bridges || [])
          .filter((bridge) => bridge.targetModule === source)
          .map((bridge) => CanonicalCompatibilityPath.normalize(
            bridge.outputPath,
            "Stage 2 compatibility output",
          ))
          .sort();
        records.push({
          source,
          originatingStage: "stage-2",
          identitySensitive: true,
          previousRuntime: "stage-2-isolated-iife",
          previousOutputs: [...new Set(outputs)],
        });
      }
    }
    const bySource = new Map();
    for (const record of records) {
      if (bySource.has(record.source)) {
        throw new Error(`Completed Stage 2 target is duplicated: ${record.source}`);
      }
      if (record.previousOutputs.length === 0) {
        throw new Error(`Completed Stage 2 target lacks isolated output evidence: ${record.source}`);
      }
      bySource.set(record.source, record);
    }
    return immutableRecord([...bySource.values()].sort((left, right) =>
      left.source.localeCompare(right.source)));
  }
}

class CumulativeGraphPlanner {
  constructor({ projectRoot, observer = null } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.observer = observer || new EsmDependencyObserver({ projectRoot: this.projectRoot });
  }

  plan({
    targetModules,
    approvedInfrastructureModules = [],
    previousStageModules = [],
    previousRuntimeTransitions = [],
    activations = [],
  }) {
    const targets = this.#canonicalSet(targetModules, "target module");
    const infrastructure = this.#canonicalSet(
      approvedInfrastructureModules,
      "approved infrastructure module",
    );
    const previousBySource = this.#previousStageIndex(previousStageModules);
    const transitionsByModule = this.#transitionIndex(previousRuntimeTransitions);
    const activationIdsByModule = this.#activationIdsByModule(activations);
    const allowed = new Set([...targets, ...infrastructure, ...previousBySource.keys()]);
    const records = new Map();
    const edges = new Map();
    const identitySensitivePrevious = [...previousBySource.values()]
      .filter((record) => record.identitySensitive)
      .map((record) => record.source);
    const queue = [...new Set([...targets, ...identitySensitivePrevious])].sort();
    while (queue.length > 0) {
      const source = queue.shift();
      if (records.has(source)) continue;
      if (!allowed.has(source)) {
        throw new Error(`Cumulative graph contains an unapproved module: ${source}`);
      }
      const absolute = this.#absolute(source);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        throw new Error(`Cumulative graph module is missing: ${source}`);
      }
      const observation = this.observer.observeFile(source);
      if (observation.status !== "verified" || !observation.hasEsmSyntax) {
        throw new Error(`Cumulative graph requires verified ESM: ${source}`);
      }
      const dependencies = [];
      for (const dependency of observation.observations) {
        if (dependency.resolutionStatus !== "confirmed-project") {
          throw new Error(
            `Cumulative graph dependency is not a confirmed project module: ` +
              `${source} → ${dependency.specifier}`,
          );
        }
        if (!dependency.hasExplicitJsExtension) {
          throw new Error(
            `Cumulative graph dependency requires explicit .js: ${source} → ${dependency.specifier}`,
          );
        }
        if (dependency.mechanism === "dynamic-import") {
          throw new Error(`Cumulative IIFE does not allow dynamic imports: ${source}`);
        }
        const target = dependency.resolvedTarget;
        if (!allowed.has(target)) {
          throw new Error(`Cumulative graph contains an unapproved module: ${target}`);
        }
        dependencies.push(target);
        const edgeKey = `${source}\u0000${target}`;
        edges.set(edgeKey, { source, target, mechanism: dependency.mechanism });
        queue.push(target);
      }
      records.set(source, {
        path: source,
        dependencies: [...new Set(dependencies)].sort(),
        entryTarget: targets.has(source),
        infrastructure: infrastructure.has(source),
        originatingStage: previousBySource.get(source)?.originatingStage || "stage-3",
        identitySensitive: previousBySource.get(source)?.identitySensitive ?? true,
        evaluationSafety: "pending",
      });
      queue.sort();
    }

    for (const target of targets) {
      if (!records.has(target)) {
        throw new Error(`Cumulative graph did not include selected target: ${target}`);
      }
    }
    const dependentTargets = [...records.values()]
      .filter((record) => record.entryTarget && record.dependencies.length > 0)
      .map((record) => record.path)
      .sort();
    const conflicts = [];
    const issues = [];
    for (const previous of [...previousBySource.values()].sort((left, right) =>
      left.source.localeCompare(right.source))) {
      if (!records.has(previous.source) || previous.previousRuntime !== "stage-2-isolated-iife") {
        continue;
      }
      const transition = transitionsByModule.get(previous.source) || null;
      const actualActivationIds = activationIdsByModule.get(previous.source) || [];
      const expectedActivationIds = transition?.activationIds || [];
      const transitionMatches = transition &&
        transition.previousRuntime === previous.previousRuntime &&
        this.#sameArray(transition.previousOutputs, previous.previousOutputs) &&
        this.#sameArray(expectedActivationIds, actualActivationIds);
      const status = transitionMatches ? "resolved" : "unresolved";
      conflicts.push({
        previousRuntime: previous.previousRuntime,
        module: previous.source,
        previousOutputs: previous.previousOutputs,
        requiredTransition: "replace-isolated-output-with-cumulative-activation",
        status,
      });
      if (status === "unresolved") {
        issues.push({
          code: "existing-isolated-runtime-conflict",
          module: previous.source,
          message:
            "A previously isolated ESM module requires an exact cumulative activation transition.",
        });
      }
      transitionsByModule.delete(previous.source);
    }
    for (const staleModule of [...transitionsByModule.keys()].sort()) {
      issues.push({
        code: "stale-previous-runtime-transition",
        module: staleModule,
        message: "A previous runtime transition does not match a module in the cumulative graph.",
      });
    }
    return immutableRecord({
      topology: "single-cumulative-module-graph",
      modules: [...records.values()].sort((left, right) =>
        left.path.localeCompare(right.path)),
      edges: [...edges.values()].sort((left, right) =>
        `${left.source}\u0000${left.target}`.localeCompare(`${right.source}\u0000${right.target}`)),
      entryTargets: [...targets].sort(),
      cumulativeRoots: [...new Set([...targets, ...identitySensitivePrevious])].sort(),
      dependentTargets,
      moduleRecordCount: records.size,
      activations: (activations || []).map((activation) => ({
        id: activation.id,
        symbol: activation.legacySymbol,
        module: activation.targetModule,
        export: activation.exportName,
        legacyLoadOrder: activation.legacyScriptIndex,
        mechanism: "global-this-property",
      })).sort((left, right) => left.id.localeCompare(right.id)),
      existingCompatibilityConflicts: conflicts,
      issues,
    });
  }

  #previousStageIndex(records) {
    const result = new Map();
    for (const record of records || []) {
      const source = CanonicalCompatibilityPath.normalize(
        record.source,
        "previous stage module",
      );
      if (result.has(source)) throw new Error(`Duplicate previous stage module: ${source}`);
      const outputs = [...new Set(record.previousOutputs || [])].sort();
      result.set(source, {
        source,
        originatingStage: record.originatingStage,
        identitySensitive: record.identitySensitive === true,
        previousRuntime: record.previousRuntime,
        previousOutputs: outputs,
      });
    }
    return result;
  }

  #transitionIndex(records) {
    const result = new Map();
    for (const record of records || []) {
      if (result.has(record.module)) {
        throw new Error(`Duplicate previous runtime transition: ${record.module}`);
      }
      result.set(record.module, record);
    }
    return result;
  }

  #activationIdsByModule(activations) {
    const result = new Map();
    for (const activation of activations || []) {
      if (!result.has(activation.targetModule)) result.set(activation.targetModule, []);
      result.get(activation.targetModule).push(activation.id);
    }
    for (const ids of result.values()) ids.sort();
    return result;
  }

  #canonicalSet(values, label) {
    const result = new Set();
    for (const value of values || []) {
      const normalized = CanonicalCompatibilityPath.normalize(value, label);
      if (result.has(normalized)) throw new Error(`Duplicate ${label}: ${normalized}`);
      result.add(normalized);
    }
    return result;
  }

  #absolute(relativePath) {
    const absolute = path.resolve(this.projectRoot, relativePath);
    const relative = path.relative(this.projectRoot, absolute).replaceAll("\\", "/");
    if (relative !== relativePath) {
      throw new Error(`Cumulative graph path escaped project root: ${relativePath}`);
    }
    return absolute;
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

class CumulativeRuntimePlanAssembler {
  assemble({ graph, effects }) {
    const effectByModule = new Map(
      (effects?.modules || []).map((record) => [record.module, record]),
    );
    return immutableRecord({
      topology: graph.topology,
      cumulativeRoots: graph.cumulativeRoots,
      modules: graph.modules.map((record) => {
        const effect = effectByModule.get(record.path);
        if (!effect) throw new Error(`Missing evaluation safety for ${record.path}`);
        return {
          ...record,
          evaluationSafety: effect.classification,
          evaluationReview: effect.reviewed ? "approved-compatible" : "not-required",
        };
      }),
      edges: graph.edges,
      activations: graph.activations,
      existingCompatibilityConflicts: graph.existingCompatibilityConflicts,
      issues: graph.issues,
    });
  }
}

module.exports = {
  CumulativeGraphPlanner,
  CumulativeRuntimePlanAssembler,
  StageThreeTargetSelector,
  StageTwoMigratedTargetCatalog,
};
