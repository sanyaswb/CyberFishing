"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../../architecture/guards/core/guard_models");
const {
  EsmDependencyObserver,
} = require("../../architecture/guards/observation/esm_dependency_observer");
const { CanonicalCompatibilityPath } = require("./cumulative_runtime_contract");

const { CumulativeGraphPlanner } = require("../../architecture/migration/cumulative_graph_provenance");

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
