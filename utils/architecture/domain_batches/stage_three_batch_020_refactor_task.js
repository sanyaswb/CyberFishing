"use strict";

const { advanceRefactorTaskCheckpoint } = require("./stage_three_refactor_task_checkpoint");

// Advances refactor_Task.txt from the batch-019 checkpoint (v0.24.56) to the batch-020 release
// checkpoint (v0.24.57).
function BATCH_020_REFACTOR_TASK(current, { nextBatchId, symbols, completedModules, acceptance }) {
  return advanceRefactorTaskCheckpoint(current, {
    batchNumber: 20, fromRelease: "0.24.56", toRelease: "0.24.57",
    checklistEntry: "Assemblies \u00b7 3 modules / 4 exports:** refill-compatible and exact assembly " +
      "refill signatures, `AssemblyState`, and `AssemblyPreparationStatus`.",
    completedModules, topology: { modules: 76, activations: 81, bridges: 135 },
    nextBatchId, symbols, acceptance,
  });
}

module.exports = { BATCH_020_REFACTOR_TASK };
