"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch014ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_014_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_014_planning");
const { BATCH_014_REFACTOR_TASK } = require("./domain_batches/stage_three_batch_014_refactor_task");

class Batch014ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_014_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_014_browser_confirmation.json";
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
    add("package.json", '  "version": "0.24.50",', '  "version": "0.24.51",');
    add("package-lock.json", '  "version": "0.24.50",', '  "version": "0.24.51",', 2);
    const approved = JSON.parse(read("architecture/migration/stage_3_approved_batches.json"));
    const state = JSON.parse(read(STATE));
    assert.equal(approved.batches[13].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: RELEASE_PROFILE.toRelease,
      completedBatchIds: approved.batches.slice(0, 14).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.50"></script>',
      '    <script src="src/config/project_version.js?v=0.24.51"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.50";',
      'const CURRENT_PROJECT_VERSION = "0.24.51";');
    add(version, '  codename: "fishing-domain",',
      '  codename: "fishing-stamina-tackle-domain",');
    const oldDate = read(version).toString().match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(version, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, [
      "  notes: Object.freeze([",
      '    "Migrate six Fishing modules with six named game-domain ESM exports",',
      '    "Preserve one cumulative graph with fifty-six project modules and fifty-nine activations",',
      '    "Complete frozen batch 014 with eighty-nine exact classic-consumer bridge relationships",',
      '    "Preserve landing lift, pressure fatigue, tension build, stamina and tackle failure behavior",',
      "  ]),",
    ].join(eol));
    const changelog = [
      `## v0.24.51 - ${RELEASE_PROFILE.title}`, "", "### Changed", "",
      "- Completed atomic Stage 3 batch 014: six Fishing modules with six named ESM exports (landing lift readiness, pressure fatigue state, tension build rate, stamina drain and transition, tackle failure selection).",
      "- Extended the cumulative graph from 50 to 56 project modules and from 53 to 59 activation contracts, with 89 exact bridge relationships.",
      "- Preserved activation timing, six classic consumer relationships, class identity, two frozen static failure tables, state ownership and fishing behavior.",
      "- Advanced the completed ordered prefix to batches 001–014 (47 of 69 frozen Domain modules); the next task is batch 015 preflight.",
      "", "",
    ].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    // The whole plan document is replaced by one exact reversible edit: the user-approved English
    // edition of refactor_Task.txt, advanced to the 0.24.51 checkpoint.
    const task = read("refactor_Task.txt").toString();
    const next = approved.batches[14];
    const symbols = [...new Set(next.modules.flatMap(module => module.providers.map(provider => provider.symbol)))];
    add("refactor_Task.txt", task, BATCH_014_REFACTOR_TASK({ nextBatchId: next.id, symbols,
      completedModules: approved.batches.slice(0, 14).reduce((sum, batch) => sum + batch.modules.length, 0),
      acceptance }));
    const transition = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-014-release-transition",
      batchId: acceptance.batchId,
      fromRelease: RELEASE_PROFILE.fromRelease, toRelease: RELEASE_PROFILE.toRelease,
      acceptance: { path: acceptancePath, sha256: sha(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: sha(read(browserPath)) },
      records: [],
    };
    const writes = [], validator = new Batch014ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = Batch014ReleaseTransition.replace(after, operation.from, operation.to, operation.count);
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
  const result = new Batch014ReleaseProjection().run();
  console.log(`Stage 3.14.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}

module.exports = { Batch014ReleaseProjection };
