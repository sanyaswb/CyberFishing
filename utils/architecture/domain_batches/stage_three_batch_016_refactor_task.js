"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt from the batch-015 checkpoint (v0.24.52) to the batch-016 release
// checkpoint (v0.24.53) by exact anchored edits. Dynamic parts come from the frozen plan and the
// recorded acceptance evidence.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};

function BATCH_016_REFACTOR_TASK(current, { nextBatchId, symbols, completedModules, acceptance }) {
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  let text = replaceOnce(current, "- **Current release version:** `v0.24.52`",
    "- **Current release version:** `v0.24.53`");
  text = replaceOnce(text,
    "- **Next step:** `Stage 3.16.0 — Batch 016 Preflight and Dependency/State Audit`",
    "- **Next step:** `Stage 3.17.0 — Batch 017 Preflight and Dependency/State Audit`");
  text = replaceOnce(text, "## Completed batches 001–015 checklist",
    "## Completed batches 001–016 checklist");
  const batch015 = "- [x] **015 · Fishing · 6 modules:** endurance movement debuff, pressure " +
    "gain, active and passive endurance drain, stamina lateral position, and weakest tackle limit.\n";
  text = replaceOnce(text, batch015, batch015 +
    "- [x] **016 · Fishing · 1 module:** `PlayerPressureFatigueSourceResolver`.\n");
  const start = text.indexOf("**Checkpoint `v0.24.52`:**");
  const end = text.indexOf("Each batch `016–021` follows the same controlled lifecycle:");
  assert(start > 0 && end > start, "refactor_Task checkpoint section is missing");
  const checkpoint = "**Checkpoint `v0.24.53`:** `16/21` frozen batches and " +
    `\`${completedModules}/69\` frozen Domain modules are complete. The cumulative runtime has ` +
    "`63` project modules, `66` activations, and `96` bridge records. `activeBatchId = null`; " +
    "batch `017` is next. For batch 016, " + suites.summary + "; " +
    (acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
      : "owner-authorized automated smoke (headless game cycle and built-in browser load)") +
    ` passed with \`${console.errors} errors\` and \`${console.warnings} warnings\`.`;
  const active = [
    "## Stage 3.17–3.21 — Atomic Domain Migration Batches", "",
    `\`16/21\` frozen batches and \`${completedModules}/69\` frozen Domain modules are complete. ` +
      "The next exact batch is:", "", "```text", nextBatchId, "", ...symbols, "```", "",
    "Stage 3.17.0: perform a read-only preflight and an exact dependency and state audit; verify " +
      "approved activations, consumers, and the rollback boundary. Do not start runtime migration " +
      "before the subsequent phases.", "",
    "Current accepted runtime: 63 project modules, 66 activation contracts, and 96 bridge records " +
      "in one cumulative topology, with no active batch. Take the next scope from the frozen plan " +
      "and verify it against the actual graph.", "", "",
  ].join("\n");
  text = text.slice(0, start) + checkpoint + "\n\n" + active + text.slice(end);
  text = replaceOnce(text, "Each batch `016–021` follows the same controlled lifecycle:",
    "Each batch `017–021` follows the same controlled lifecycle:");
  return text;
}

module.exports = { BATCH_016_REFACTOR_TASK };
