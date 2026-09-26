"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt from the batch-020 checkpoint (v0.24.57) to the batch-021 release
// checkpoint (v0.24.58). Batch 021 is the last frozen batch, so the plan points to the graph review
// and new maximal-prefix freeze that the document already requires after batch 021.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};

function BATCH_021_REFACTOR_TASK(current, { completedModules, acceptance }) {
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  let text = replaceOnce(current, "- **Current release version:** `v0.24.57`",
    "- **Current release version:** `v0.24.58`");
  text = replaceOnce(text,
    "- **Next step:** `Stage 3.21.0 — Batch 021 Preflight and Dependency/State Audit`",
    "- **Next step:** `Stage 3.22.0 — Post-Freeze Graph Review and New Maximal-Prefix Freeze`");
  text = replaceOnce(text, "## Completed batches 001–020 checklist",
    "## Completed batches 001–021 checklist");
  const lines = text.split("\n");
  const last = lines.findIndex(line => line.startsWith("- [x] **020 · "));
  assert(last > 0 && !lines.some(line => line.startsWith("- [x] **021 · ")));
  lines.splice(last + 1, 0, "- [x] **021 · Equipment · 2 modules / 6 exports:** auto-refill " +
    "triggers, scopes, settings, memory and policy, and `ExactItemSignaturePolicy`.");
  text = lines.join("\n");
  const start = text.indexOf("**Checkpoint `v0.24.57`:**");
  const end = text.indexOf("Each batch `021–021` follows the same controlled lifecycle:");
  assert(start > 0 && end > start, "refactor_Task checkpoint section is missing");
  const smoke = acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
    : "owner-authorized automated smoke (headless game cycle and built-in browser load)";
  const checkpoint = "**Checkpoint `v0.24.58`:** `21/21` frozen batches and " +
    `\`${completedModules}/69\` frozen Domain modules are complete. The cumulative runtime has ` +
    "`78` project modules, `87` activations, and `139` bridge records. `activeBatchId = null`; " +
    "the frozen batch plan is exhausted. For batch 021, " + suites.summary + "; " + smoke +
    ` passed with \`${console.errors} errors\` and \`${console.warnings} warnings\`.`;
  const completed = [
    "## Stage 3.14–3.21 — Atomic Domain Migration Batches (complete)", "",
    `All \`21/21\` frozen batches and \`${completedModules}/69\` frozen Domain modules are migrated. ` +
      "Stage 3.22.0 starts with the graph-changing prerequisites below; no historical candidate is " +
      "execution ready until the new freeze exists.", "",
    "Current accepted runtime: 78 project modules, 87 activation contracts, and 139 bridge records " +
      "in one cumulative topology, with no active batch.", "", "",
  ].join("\n");
  text = text.slice(0, start) + checkpoint + "\n\n" + completed + text.slice(end);
  text = replaceOnce(text, "Each batch `021–021` follows the same controlled lifecycle:",
    "Every frozen batch `014–021` followed the same controlled lifecycle:");
  return replaceOnce(text, "\nAfter batch 021, complete graph-changing prerequisites",
    "\nWith batch 021 complete, complete graph-changing prerequisites");
}

module.exports = { BATCH_021_REFACTOR_TASK };
