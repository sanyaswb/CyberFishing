"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt from the Stage 3.22 checkpoint (v0.24.59) to the batch-022 release
// checkpoint (v0.24.60): the first batch of the Stage 3.22 approved prefix is checked off and the
// next step points to the following prefix batch.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};

function BATCH_022_REFACTOR_TASK(current, { batch, nextBatch, acceptance, topology }) {
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  let text = replaceOnce(current, "- **Current release version:** `v0.24.59`",
    "- **Current release version:** `v0.24.60`");
  text = replaceOnce(text,
    `- **Next step:** \`Stage 3.23.0 — Batch 022 Preflight from the Stage 3.22 Approved Prefix (${batch.id})\``,
    `- **Next step:** \`Stage 3.24.0 — Batch 023 Preflight from the Stage 3.22 Approved Prefix (${nextBatch.id})\``);
  const unchecked = `- [ ] **022 · `;
  assert.equal(text.split(unchecked).length, 2, "batch 022 prefix entry is missing");
  text = text.replace(unchecked, () => "- [x] **022 · ");
  const smoke = acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
    : "owner-authorized automated smoke (headless game cycle and built-in browser load)";
  const checkpoint = "**Checkpoint `v0.24.60`:** batch 022 is complete — the first migrated Domain module that " +
    "imports a completed-prefix export (`InventoryItemLocation`) instead of reading its legacy global. The execution " +
    "state adopted the Stage 3.22 approved prefix (historical approved-plan fingerprint unchanged); completed batches " +
    `001–022. The cumulative runtime has \`${topology.modules}\` project modules, \`${topology.activations}\` activations and ` +
    `\`${topology.bridges}\` bridge records (one retired). ${suites.summary}; ${smoke} passed with ` +
    `\`${console.errors} errors\` and \`${console.warnings} warnings\`.`;
  return replaceOnce(text, "\n### Review queue\n", `\n${checkpoint}\n\n### Review queue\n`);
}

module.exports = { BATCH_022_REFACTOR_TASK };
