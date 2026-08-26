"use strict";

class StageThreeManifestMetadataProjector {
  project({ manifest, approvedPlan, executionState }) {
    const batchId = executionState.activeBatchId ||
      executionState.completedBatchIds.at(-1);
    const batch = approvedPlan.batches.find((record) => record.id === batchId);
    if (!batch || batch.status !== "approved-frozen") {
      throw new Error("Stage 3 manifest metadata requires an approved selected batch");
    }
    const migrationStatus = executionState.activeBatchId === batchId
      ? "migrating"
      : "verified";
    const modulesByPath = new Map(
      manifest.modules.map((record) => [record.currentPath, record]),
    );
    for (const moduleRecord of batch.modules) {
      const source = modulesByPath.get(moduleRecord.currentPath);
      const target = modulesByPath.get(moduleRecord.targetPath);
      if (!source || !target) {
        throw new Error(
          `Stage 3 manifest metadata path is missing: ` +
            `${moduleRecord.currentPath} → ${moduleRecord.targetPath}`,
        );
      }
      source.architecture.roles = ["compatibility-bridge"];
      source.architecture.targetBoundary = batch.targetBoundary;
      source.architecture.targetPath = moduleRecord.targetPath;

      target.architecture = {
        migrationStatus,
        roles: [...moduleRecord.roles],
        targetBoundary: batch.targetBoundary,
        targetPath: moduleRecord.targetPath,
        migrationWave: source.architecture.migrationWave,
      };
      target.analysis.blockers = structuredClone(source.analysis.blockers);
    }
    return manifest;
  }
}

module.exports = { StageThreeManifestMetadataProjector };
