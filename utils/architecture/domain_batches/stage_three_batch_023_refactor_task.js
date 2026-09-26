"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt from the batch-022 checkpoint (v0.24.60) to the batch-023 release
// checkpoint (v0.24.61): batch 023 of the Stage 3.22 approved prefix is checked off, its
// checkpoint replaces the previous one and the next step points to batch 024.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};

function BATCH_023_REFACTOR_TASK(current, { batch, nextBatch, acceptance, topology }) {
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  let text = replaceOnce(current, "- **Current release version:** `v0.24.60`",
    "- **Current release version:** `v0.24.61`");
  text = replaceOnce(text,
    `- **Next step:** \`Stage 3.24.0 — Batch 023 Preflight from the Stage 3.22 Approved Prefix (${batch.id})\``,
    `- **Next step:** \`Stage 3.25.0 — Batch 024 Preflight from the Stage 3.22 Approved Prefix (${nextBatch.id})\``);
  text = replaceOnce(text, "- [ ] **023 · ", "- [x] **023 · ");
  const start = text.indexOf("**Checkpoint `v0.24.60`:**");
  const end = text.indexOf("\n### Review queue\n");
  assert(start > 0 && end > start, "refactor_Task prefix checkpoint is missing");
  const smoke = acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
    : "owner-authorized automated smoke (headless game cycle and built-in browser load)";
  const checkpoint = "**Checkpoint `v0.24.61`:** batches 022–023 of the approved prefix are complete " +
    "(completed batches 001–023). Batch 023 migrated three item metric strategies whose shared superclass " +
    "`ItemMetricStrategy` is now an imported completed-prefix export. The cumulative runtime has " +
    `\`${topology.modules}\` project modules, \`${topology.activations}\` activations and \`${topology.bridges}\` ` +
    `bridge records. ${suites.summary}; ${smoke} passed with \`${console.errors} errors\` and ` +
    `\`${console.warnings} warnings\`.\n`;
  return text.slice(0, start) + checkpoint + text.slice(end);
}

module.exports = { BATCH_023_REFACTOR_TASK };
