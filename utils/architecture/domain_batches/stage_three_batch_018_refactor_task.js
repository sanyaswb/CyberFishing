"use strict";

const { advanceRefactorTaskCheckpoint } = require("./stage_three_refactor_task_checkpoint");

// Advances refactor_Task.txt from the batch-017 checkpoint (v0.24.54) to the batch-018 release
// checkpoint (v0.24.55).
function BATCH_018_REFACTOR_TASK(current, { nextBatchId, symbols, completedModules, acceptance }) {
  return advanceRefactorTaskCheckpoint(current, {
    batchNumber: 18, fromRelease: "0.24.54", toRelease: "0.24.55",
    checklistEntry: "Items · 6 modules / 7 exports:** bait effectiveness knowledge and match, " +
      "bait freshness modifier, item freshness state, bounded item metrics, and rating tiers.",
    completedModules, topology: { modules: 70, activations: 74, bridges: 123 },
    nextBatchId, symbols, acceptance,
  });
}

module.exports = { BATCH_018_REFACTOR_TASK };
