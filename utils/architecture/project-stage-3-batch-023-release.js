"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch023ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_023_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_023_planning");
const { BATCH_023_REFACTOR_TASK } = require("./domain_batches/stage_three_batch_023_refactor_task");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

class Batch023ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_023_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_023_browser_confirmation.json";
    const acceptance = JSON.parse(read(acceptancePath));
    const browser = JSON.parse(read(browserPath));
    assert.equal(acceptance.verdict, "eligible-for-release-closure");
    assert.equal(browser.supplements.sha256, sha(read(acceptancePath)));
    assert.equal(browser.status, "passed");
    assert.equal(browser.console.errors, 0);
    assert.equal(browser.console.warnings, 0);
    for (const evidence of [acceptance.completes, ...acceptance.protectedEvidence]) {
      assert.equal(sha(read(evidence.path)), evidence.sha256, `Stale acceptance: ${evidence.path}`);
    }
    const edits = new Map(RELEASE_PATHS.map(file => [file, []]));
    const add = (file, from, to, count = 1) => edits.get(file).push({ from, to, count });
    add("package.json", '  "version": "0.24.60",', '  "version": "0.24.61",');
    add("package-lock.json", '  "version": "0.24.60",', '  "version": "0.24.61",', 2);
    const state = JSON.parse(read(STATE));
    const approved = new StageThreeApprovedPlanSource({ read }).load(state).document;
    assert.equal(approved.batches[22].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: RELEASE_PROFILE.toRelease,
      completedBatchIds: approved.batches.slice(0, 23).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.60"></script>',
      '    <script src="src/config/project_version.js?v=0.24.61"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.60";',
      'const CURRENT_PROJECT_VERSION = "0.24.61";');
    add(version, '  codename: "assemblies-item-reader-domain",',
      '  codename: "items-metric-strategies-domain",');
    const oldDate = read(version).toString().match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(version, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, [
      "  notes: Object.freeze([",
      '    "Migrate three item metric strategies as named game-domain ESM exports",',
      '    "Import the shared ItemMetricStrategy superclass from its completed ESM owner",',
      '    "Complete batch 023 of the Stage 3.22 approved prefix",',
      '    "Preserve eighty-two project modules, ninety-two activations and one hundred forty-two bridges",',
      "  ]),",
    ].join(eol));
    const changelog = [
      `## v0.24.61 - ${RELEASE_PROFILE.title}`, "", "### Changed", "",
      "- Completed batch 023 of the Stage 3.22 approved prefix: DerivedStatMetricStrategy, NumericStatMetricStrategy and TargetRangeMetricStrategy as named ESM exports.",
      "- Each target imports its eager superclass ItemMetricStrategy from the completed ESM owner; the three classic global reads and their bridges were retired. The evaluation gate accepts a reviewed imported superclass of a verified closure module, and reviewed imports of every selected batch are re-verified.",
      "- Extended the cumulative graph from 79 to 82 project modules and from 89 to 92 activation contracts, with 142 exact bridge relationships (3 added, 3 retired).",
      "- The next task is batch 024 preflight.",
      "", "",
    ].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    // The plan document is advanced to the 0.24.61 checkpoint by one exact reversible edit.
    const task = read("refactor_Task.txt").toString();
    add("refactor_Task.txt", task, BATCH_023_REFACTOR_TASK(task, {
      batch: approved.batches[22], nextBatch: approved.batches[23], acceptance,
      topology: { modules: 82, activations: 92, bridges: 142 } }));
    const transition = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-023-release-transition",
      batchId: acceptance.batchId,
      fromRelease: RELEASE_PROFILE.fromRelease, toRelease: RELEASE_PROFILE.toRelease,
      acceptance: { path: acceptancePath, sha256: sha(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: sha(read(browserPath)) },
      records: [],
    };
    const writes = [], validator = new Batch023ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = Batch023ReleaseTransition.replace(after, operation.from, operation.to, operation.count);
      }
      const nextBytes = Buffer.from(after);
      validator.validateDelta(file, before, nextBytes);
      transition.records.push({ path: file, beforeSha256: sha(before),
        afterSha256: sha(nextBytes), edits: operations });
      writes.push({ path: file, beforeSha256: sha(before), after: nextBytes });
    }
    validator.validate(transition);
    for (const item of transition.records) {
      const projected = writes.find(write => write.path === item.path);
      assert.deepEqual(validator.reverse(projected.after, item), read(item.path));
    }
    return { transition, writes };
  }
}

if (require.main === module) {
  const result = new Batch023ReleaseProjection().run();
  console.log(`Stage 3.24.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}

module.exports = { Batch023ReleaseProjection };
