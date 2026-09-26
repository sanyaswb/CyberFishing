"use strict";

const assert = require("node:assert/strict");

// Advances refactor_Task.txt by one completed batch of the Stage 3.22 approved prefix: the release
// line, the next-step line, the batch checkbox and the single prefix checkpoint paragraph.
const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `refactor_Task anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};
const stageOf = order => `3.${order + 1}`;

function advanceContinuationRefactorTask(current, { fromRelease, toRelease, batch, nextBatch, firstOrder,
  summary, acceptance, topology }) {
  const suites = acceptance.automatedEvidence;
  const console = acceptance.browserSmoke.consoleCounts;
  const number = String(batch.order).padStart(3, "0");
  let text = replaceOnce(current, `- **Current release version:** \`v${fromRelease}\``,
    `- **Current release version:** \`v${toRelease}\``);
  const nextStep = nextBatch
    ? `Stage ${stageOf(nextBatch.order)}.0 — Batch ${String(nextBatch.order).padStart(3, "0")} Preflight from the Stage 3.22 Approved Prefix (${nextBatch.id})`
    : "Stage 3 review queue and prerequisite backlog";
  text = replaceOnce(text,
    `- **Next step:** \`Stage ${stageOf(batch.order)}.0 — Batch ${number} Preflight from the Stage 3.22 Approved Prefix (${batch.id})\``,
    `- **Next step:** \`${nextStep}\``);
  text = replaceOnce(text, `- [ ] **${number} · `, `- [x] **${number} · `);
  const start = text.indexOf(`**Checkpoint \`v${fromRelease}\`:**`);
  const end = text.indexOf("\n### Review queue\n");
  assert(start > 0 && end > start, "refactor_Task prefix checkpoint is missing");
  const smoke = acceptance.browserSmoke.performedBy === "user" ? "user-performed browser smoke"
    : "owner-authorized automated smoke (headless game cycle and built-in browser load)";
  const checkpoint = `**Checkpoint \`v${toRelease}\`:** batches ${String(firstOrder).padStart(3, "0")}–${number} ` +
    `of the approved prefix are complete (completed batches 001–${number}). ${summary} The cumulative runtime has ` +
    `\`${topology.modules}\` project modules, \`${topology.activations}\` activations and \`${topology.bridges}\` ` +
    `bridge records. ${suites.summary}; ${smoke} passed with \`${console.errors} errors\` and ` +
    `\`${console.warnings} warnings\`.\n`;
  return text.slice(0, start) + checkpoint + text.slice(end);
}

module.exports = { advanceContinuationRefactorTask };
