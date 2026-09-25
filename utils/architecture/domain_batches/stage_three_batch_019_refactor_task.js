"use strict";

const { advanceRefactorTaskCheckpoint } = require("./stage_three_refactor_task_checkpoint");

// Advances refactor_Task.txt from the batch-018 checkpoint (v0.24.55) to the batch-019 release
// checkpoint (v0.24.56).
function BATCH_019_REFACTOR_TASK(current, { nextBatchId, symbols, completedModules, acceptance }) {
  return advanceRefactorTaskCheckpoint(current, {
    batchNumber: 19, fromRelease: "0.24.55", toRelease: "0.24.56",
    checklistEntry: "Items · 3 modules:** `BaitEffectivenessGradePolicy`, " +
      "`BaitFreshnessDecayPolicy`, `ItemQualityGradePolicy`.",
    completedModules, topology: { modules: 73, activations: 77, bridges: 130 },
    nextBatchId, symbols, acceptance,
  });
}

module.exports = { BATCH_019_REFACTOR_TASK };
