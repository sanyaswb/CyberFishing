"use strict";

const { advanceRefactorTaskCheckpoint } = require("./stage_three_refactor_task_checkpoint");

// Advances refactor_Task.txt from the batch-016 checkpoint (v0.24.53) to the batch-017 release
// checkpoint (v0.24.54).
function BATCH_017_REFACTOR_TASK(current, { nextBatchId, symbols, completedModules, acceptance }) {
  return advanceRefactorTaskCheckpoint(current, {
    batchNumber: 17, fromRelease: "0.24.53", toRelease: "0.24.54",
    checklistEntry: "Inventory · 1 module / 2 exports:** `InventoryItemLocation`, " +
      "`InventoryItemLocationKind`.",
    completedModules, topology: { modules: 64, activations: 68, bridges: 111 },
    nextBatchId, symbols, acceptance,
  });
}

module.exports = { BATCH_017_REFACTOR_TASK };
