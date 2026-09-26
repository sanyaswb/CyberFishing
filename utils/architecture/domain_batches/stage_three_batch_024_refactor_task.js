"use strict";

const { advanceContinuationRefactorTask } = require("./stage_three_continuation_refactor_task");

// Advances refactor_Task.txt from the batch-023 checkpoint (v0.24.61) to v0.24.62.
function BATCH_024_REFACTOR_TASK(current, { batch, nextBatch, acceptance, topology }) {
  return advanceContinuationRefactorTask(current, { fromRelease: "0.24.61", toRelease: "0.24.62",
    batch, nextBatch, firstOrder: 22, acceptance, topology,
    summary: "Batch 024 migrated InventoryItemReservationPolicy: its reviewed globalThis exposure moved to " +
      "the activation shim and it imports `InventoryItemLocation` from the completed ESM owner." });
}

module.exports = { BATCH_024_REFACTOR_TASK };
