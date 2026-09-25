"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt from the batch-014 checkpoint (v0.24.51) to the batch-015 release
// checkpoint (v0.24.52) by exact anchored edits. Dynamic parts come from the frozen plan and the
// recorded acceptance evidence.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};

function BATCH_015_REFACTOR_TASK(current, { nextBatchId, symbols, completedModules, acceptance }) {
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  let text = replaceOnce(current, "- **Current release version:** `v0.24.51`",
    "- **Current release version:** `v0.24.52`");
  text = replaceOnce(text,
    "- **Next step:** `Stage 3.15.0 — Batch 015 Preflight and Dependency/State Audit`",
    "- **Next step:** `Stage 3.16.0 — Batch 016 Preflight and Dependency/State Audit`");
  text = replaceOnce(text, "## Completed batches 001–014 checklist",
    "## Completed batches 001–015 checklist");
  const batch014 = "- [x] **014 · Fishing · 6 modules:** landing lift readiness, pressure " +
    "fatigue state, tension build rate, stamina drain and transition, and tackle failure selection.\n";
  text = replaceOnce(text, batch014, batch014 +
    "- [x] **015 · Fishing · 6 modules:** endurance movement debuff, pressure gain, " +
    "active and passive endurance drain, stamina lateral position, and weakest tackle limit.\n");
  const start = text.indexOf("**Checkpoint `v0.24.51`:**");
  const end = text.indexOf("Each batch `015–021` follows the same controlled lifecycle:");
  assert(start > 0 && end > start, "refactor_Task checkpoint section is missing");
  const checkpoint = "**Checkpoint `v0.24.52`:** `15/21` frozen batches and " +
    `\`${completedModules}/69\` frozen Domain modules are complete. The cumulative runtime has ` +
    "`62` project modules, `65` activations, and `95` bridge records. `activeBatchId = null`; " +
    "batch `016` is next. For batch 015, " + suites.summary + "; " +
    (acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
      : "owner-authorized automated smoke (headless game cycle and built-in browser load)") +
    ` passed with \`${console.errors} errors\` and \`${console.warnings} warnings\`.`;
  const active = [
    "## Stage 3.16–3.21 — Atomic Domain Migration Batches", "",
    `\`15/21\` frozen batches and \`${completedModules}/69\` frozen Domain modules are complete. ` +
      "The next exact batch is:", "", "```text", nextBatchId, "", ...symbols, "```", "",
    "Stage 3.16.0: perform a read-only preflight and an exact dependency and state audit; verify " +
      "approved activations, consumers, and the rollback boundary. Do not start runtime migration " +
      "before the subsequent phases.", "",
    "Current accepted runtime: 62 project modules, 65 activation contracts, and 95 bridge records " +
      "in one cumulative topology, with no active batch. Take the next scope from the frozen plan " +
      "and verify it against the actual graph.", "", "",
  ].join("\n");
  text = text.slice(0, start) + checkpoint + "\n\n" + active + text.slice(end);
  text = replaceOnce(text, "Each batch `015–021` follows the same controlled lifecycle:",
    "Each batch `016–021` follows the same controlled lifecycle:");
  text = replaceOnce(text, "\nAfter batch 021, complete graph-changing prerequisites",
    "\nCheck suites: replay checks of released batches run in the `history` suite; `quick` and " +
    "`architecture` keep the cumulative invariants, the active batch checks, and the latest " +
    "released batch check. Run `quick` after each sub-stage, `history` whenever shared tooling " +
    "changes, and the full suite (which includes `history`) at acceptance and release closure.\n" +
    "\nAfter batch 021, complete graph-changing prerequisites");
  return text;
}

module.exports = { BATCH_015_REFACTOR_TASK };
