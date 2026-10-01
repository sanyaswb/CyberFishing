"use strict";

const assert = require("node:assert/strict");
const { PROFILE } = require("./post_freeze_release_transition");

const replaceOnce = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `release document anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, () => to);
};
const short = id => id.replace("stage-3.replan-322.batch-", "batch-");
const title = value => value.charAt(0).toUpperCase() + value.slice(1);
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Release texts of the Stage 3.22 audit-only release. All figures come from the reviewed
// artifacts and the recorded acceptance, never from literals.
class PostFreezeReleaseDocuments {
  constructor({ approved, backlog, graph, acceptance }) {
    this.approved = approved;
    this.backlog = backlog;
    this.graph = graph;
    this.acceptance = acceptance;
  }

  gates() {
    const suites = this.acceptance.automatedResults.suites;
    return `focused Stage 3.22 check (${this.acceptance.automatedResults.focused.negativeFixtures} negative ` +
      `fixtures), Architecture ${suites.architecture.passedChecks}/${suites.architecture.passedChecks}, ` +
      `Quick ${suites.quick.passedChecks}/${suites.quick.passedChecks}, Full ` +
      `${suites.full.passedChecks}/${suites.full.passedChecks} (${suites.full.platform}), fresh npm ci, ` +
      "cumulative build and git diff --check passed; browser smoke not required and not recorded";
  }

  changelog() {
    const boundary = this.approved.freezeBoundary;
    const summary = this.approved.summary;
    const reassessment = this.graph.reassessment.summary;
    const backlog = this.backlog.summary;
    const queue = this.approved.reviewQueue.map(item => `\`${short(item.id)}\``).join(" and ");
    return [
      `## v${PROFILE.toRelease} - ${PROFILE.title}`, "", "### Changed", "",
      "- Completed Stage 3.22, an audit-only post-freeze Domain graph review: no prerequisite refactoring, module migration or cutover; `runtimeMigrationAllowed = false`.",
      `- Refreshed observations in memory with ${this.acceptance.coverage.observationDrift} drift; the Domain scope holds ` +
        `${summary.domainModuleCount} modules (${summary.completedModuleCount} completed ESM targets and ` +
        `${reassessment.remainingModuleCount} remaining classic modules).`,
      `- Preserved the physical graph and resolved ${this.graph.logicalGraph.edgesByKind["activation-resolved"]} ` +
        "activation-shim dependencies to their ESM owners with consumer, symbol, export, execution-phase and " +
        `activation-position provenance; the logical graph has ${this.graph.sccs.logical.cyclic.length} cyclic SCCs.`,
      `- Reassessed the remaining modules: ${reassessment.candidate} review candidates, ` +
        `${reassessment.prerequisiteBlocked} prerequisite-blocked and ${reassessment.deferred} deferred.`,
      `- Froze a new approved prefix of ${boundary.frozenBatchCount} batches and ${boundary.frozenModuleCount} ` +
        `modules (\`${short(boundary.firstBatchId)}\`–\`${short(boundary.lastBatchId)}\`); ${queue} ` +
        "require evidence before a freeze.",
      `- Recorded ${backlog.taskCount} backlog tasks: ${backlog.graphChangingTaskCount} graph-changing ` +
        `prerequisite and decomposition tasks and ${backlog.evidenceTaskCount} freeze-evidence tasks.`,
      `- Validation: ${this.gates()}.`,
      "- The execution state keeps completed batches 001–021 and the historical approved-plan fingerprint; " +
        "the runtime topology stays at 78 modules, 87 activations and 139 bridges.",
      "", "",
    ].join("\n");
  }

  projectVersionNotes(eol) {
    const boundary = this.approved.freezeBoundary;
    return [
      "  notes: Object.freeze([",
      '    "Complete the Stage 3.22 post-freeze Domain graph review without module migration",',
      `    "Resolve activation shims to ESM owners in a logical graph of ${this.approved.summary.domainModuleCount} Domain modules",`,
      `    "Freeze a new approved prefix of ${boundary.frozenBatchCount} batches and ${boundary.frozenModuleCount} modules from batch 022",`,
      '    "Keep the runtime topology at 78 modules, 87 activations and 139 bridges",',
      "  ]),",
    ].join(eol);
  }

  refactorTask(current) {
    const boundary = this.approved.freezeBoundary;
    const first = this.approved.batches[0];
    let text = replaceOnce(current, `- **Current release version:** \`v${PROFILE.fromRelease}\``,
      `- **Current release version:** \`v${PROFILE.toRelease}\``);
    text = replaceOnce(text,
      "- **Next step:** `Stage 3.22.0 — Post-Freeze Graph Review and New Maximal-Prefix Freeze`",
      `- **Next step:** \`Stage 3.23.0 — Batch 022 Preflight from the Stage 3.22 Approved Prefix (${first.id})\``);
    text = replaceOnce(text,
      "Stage 3.22.0 starts with the graph-changing prerequisites below; no historical candidate is execution ready until the new freeze exists.",
      "Stage 3.22 then reviewed the post-freeze graph and froze a new approved prefix (see below).");
    const start = text.indexOf("With batch 021 complete, complete graph-changing prerequisites");
    const end = text.indexOf("# 3. Stage 4 — Application + Platform");
    assert(start > 0 && end > start, "refactor_Task Stage 3 closing paragraph is missing");
    return text.slice(0, start) + this.#stage322Section(boundary) + text.slice(end);
  }

  #stage322Section(boundary) {
    const reassessment = this.graph.reassessment.summary;
    const batches = this.approved.batches.map(batch => {
      const symbols = batch.exports.map(item => `\`${item.exportName}\``);
      return `- [ ] **${String(batch.order).padStart(3, "0")} · ${title(batch.targetArea)} · ` +
        `${plural(batch.modules.length, "module")}${symbols.length !== batch.modules.length
          ? ` / ${plural(symbols.length, "export")}` : ""}:** ${symbols.join(", ")} — \`${batch.id}\`.`;
    });
    const queue = this.approved.reviewQueue.map(item =>
      `- **${String(item.order).padStart(3, "0")}** \`${item.id}\` (${plural(item.moduleCount, "module")}): ` +
      `requires evidence — ${item.evidenceTaskIds.map(id => `\`${id}\``).join(", ")}.`);
    const tasks = this.backlog.tasks.map(task => `- \`${task.id}\` (${task.kind}): ${task.intent}`);
    return [
      `## Stage 3.22 — Post-Freeze Graph Review (complete, \`v${PROFILE.toRelease}\`)`, "",
      "Audit-only stage: no prerequisite refactoring, module migration or cutover; `runtimeMigrationAllowed = false`. " +
        "Artifacts live in `architecture/migration/stage_3_22/`; `node utils/architecture/stage-3-22-post-freeze-review.js` " +
        "replays them byte-for-byte at the recorded checkpoint.", "",
      `- **Observation:** fresh in-memory observation with \`${this.acceptance.coverage.observationDrift}\` drift; ` +
        `Domain scope \`${this.approved.summary.domainModuleCount}\` = \`${this.approved.summary.completedModuleCount}\` ` +
        `completed ESM targets + \`${reassessment.remainingModuleCount}\` remaining classic modules.`,
      `- **Logical graph:** the physical graph is preserved; \`${this.graph.logicalGraph.edgesByKind["activation-resolved"]}\` ` +
        "activation-shim reads resolve to their ESM owners with full provenance; " +
        `\`${this.graph.sccs.logical.cyclic.length}\` cyclic SCCs; maximum planning depth \`${this.graph.sccs.planning.maximumDepth}\`.`,
      `- **Reassessment:** \`${reassessment.candidate}\` review candidates, \`${reassessment.prerequisiteBlocked}\` ` +
        `prerequisite-blocked and \`${reassessment.deferred}\` deferred modules; complete, non-overlapping coverage with \`0\` unassigned. ` +
        "Historical candidates `022–040` remain reference material only.",
      `- **Gate outcomes:** ${this.gates()}.`, "",
      `### New approved prefix (${boundary.frozenBatchCount} batches / ${boundary.frozenModuleCount} modules)`, "",
      "The prefix is frozen but not yet adopted by the execution state, which keeps batches 001–021 and the historical " +
        "approved-plan fingerprint. Each batch is a separate patch release with a batch-only rollback checkpoint; " +
        `after the prefix the runtime topology is \`${boundary.topologyAfterPrefix.modules}\` modules, ` +
        `\`${boundary.topologyAfterPrefix.activations}\` activations and \`${boundary.topologyAfterPrefix.bridges}\` bridges.`, "",
      ...batches, "",
      "### Review queue", "",
      ...queue, "",
      "### Prerequisite backlog", "",
      ...tasks, "",
      "### Next steps", "",
      `1. Stage 3.23.0: adopt the approved prefix and migrate \`${this.approved.batches[0].id}\` ` +
        "(preflight → ESM targets and imports → candidate build → cutover → verification → release `v0.24.60`), then the rest of the prefix in order.",
      "2. Resolve backlog prerequisites as separate tasks, never mixed with a module migration; every graph change is followed by a repeated graph review and a new freeze for the affected modules.",
      "3. Repeat prerequisite → graph review → freeze → migration batches until every approved Domain cluster is migrated, ownership is confirmed and bridges are removed under control.",
      "",
      "Stage 3 is complete only when all approved Domain clusters have migrated, state ownership is unambiguous, and every bridge has a controlled removal path.",
      "", "",
    ].join("\n");
  }
}

module.exports = { PostFreezeReleaseDocuments };
