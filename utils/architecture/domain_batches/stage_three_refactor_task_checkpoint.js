"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt from one batch release checkpoint to the next by exact anchored
// edits. Every anchor must occur exactly once, so a drifted document fails instead of being
// rewritten.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};
const pad = number => String(number).padStart(3, "0");

function advanceRefactorTaskCheckpoint(current, {
  batchNumber, fromRelease, toRelease, checklistEntry, completedModules, topology,
  nextBatchId, symbols, acceptance,
}) {
  const batch = pad(batchNumber), next = pad(batchNumber + 1), previous = pad(batchNumber - 1);
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  let text = replaceOnce(current, `- **Current release version:** \`v${fromRelease}\``,
    `- **Current release version:** \`v${toRelease}\``);
  text = replaceOnce(text,
    `- **Next step:** \`Stage 3.${batchNumber}.0 — Batch ${batch} Preflight and Dependency/State Audit\``,
    `- **Next step:** \`Stage 3.${batchNumber + 1}.0 — Batch ${next} Preflight and Dependency/State Audit\``);
  text = replaceOnce(text, `## Completed batches 001–${previous} checklist`,
    `## Completed batches 001–${batch} checklist`);
  const lines = text.split("\n");
  const last = lines.findIndex(line => line.startsWith(`- [x] **${previous} · `));
  assert(last > 0 && !lines.some(line => line.startsWith(`- [x] **${batch} · `)),
    "refactor_Task checklist is out of order");
  lines.splice(last + 1, 0, `- [x] **${batch} · ${checklistEntry}`);
  text = lines.join("\n");
  const start = text.indexOf(`**Checkpoint \`v${fromRelease}\`:**`);
  const end = text.indexOf(`Each batch \`${batch}–021\` follows the same controlled lifecycle:`);
  assert(start > 0 && end > start, "refactor_Task checkpoint section is missing");
  const smoke = acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
    : "owner-authorized automated smoke (headless game cycle and built-in browser load)";
  const checkpoint = `**Checkpoint \`v${toRelease}\`:** \`${batchNumber}/21\` frozen batches and ` +
    `\`${completedModules}/69\` frozen Domain modules are complete. The cumulative runtime has ` +
    `\`${topology.modules}\` project modules, \`${topology.activations}\` activations, and ` +
    `\`${topology.bridges}\` bridge records. \`activeBatchId = null\`; batch \`${next}\` is next. ` +
    `For batch ${batch}, ${suites.summary}; ${smoke} passed with \`${console.errors} errors\` and ` +
    `\`${console.warnings} warnings\`.`;
  const active = [
    `## Stage 3.${batchNumber + 1}–3.21 — Atomic Domain Migration Batches`, "",
    `\`${batchNumber}/21\` frozen batches and \`${completedModules}/69\` frozen Domain modules are ` +
      "complete. The next exact batch is:", "", "```text", nextBatchId, "", ...symbols, "```", "",
    `Stage 3.${batchNumber + 1}.0: perform a read-only preflight and an exact dependency and state ` +
      "audit; verify approved activations, consumers, and the rollback boundary. Do not start " +
      "runtime migration before the subsequent phases.", "",
    `Current accepted runtime: ${topology.modules} project modules, ${topology.activations} ` +
      `activation contracts, and ${topology.bridges} bridge records in one cumulative topology, ` +
      "with no active batch. Take the next scope from the frozen plan and verify it against the " +
      "actual graph.", "", "",
  ].join("\n");
  text = text.slice(0, start) + checkpoint + "\n\n" + active + text.slice(end);
  return replaceOnce(text, `Each batch \`${batch}–021\` follows the same controlled lifecycle:`,
    `Each batch \`${next}–021\` follows the same controlled lifecycle:`);
}

module.exports = { advanceRefactorTaskCheckpoint };
