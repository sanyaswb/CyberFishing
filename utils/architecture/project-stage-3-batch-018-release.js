"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch018ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_018_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_018_planning");
const { BATCH_018_REFACTOR_TASK } = require("./domain_batches/stage_three_batch_018_refactor_task");

class Batch018ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_018_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_018_browser_confirmation.json";
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
    add("package.json", '  "version": "0.24.54",', '  "version": "0.24.55",');
    add("package-lock.json", '  "version": "0.24.54",', '  "version": "0.24.55",', 2);
    const approved = JSON.parse(read("architecture/migration/stage_3_approved_batches.json"));
    const state = JSON.parse(read(STATE));
    assert.equal(approved.batches[17].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: RELEASE_PROFILE.toRelease,
      completedBatchIds: approved.batches.slice(0, 18).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.54"></script>',
      '    <script src="src/config/project_version.js?v=0.24.55"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.54";',
      'const CURRENT_PROJECT_VERSION = "0.24.55";');
    add(version, '  codename: "inventory-item-location-domain",',
      '  codename: "items-bait-freshness-metrics-domain",');
    const oldDate = read(version).toString().match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(version, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, [
      "  notes: Object.freeze([",
      '    "Migrate six Items modules with seven named game-domain ESM exports",',
      '    "Preserve one cumulative graph with seventy project modules and seventy-four activations",',
      '    "Complete frozen batch 018 with one hundred twenty-three exact classic-consumer bridge relationships",',
      '    "Preserve bait knowledge, match, freshness, bounded metric and rating tier behavior",',
      "  ]),",
    ].join(eol));
    const changelog = [
      `## v0.24.55 - ${RELEASE_PROFILE.title}`, "", "### Changed", "",
      "- Completed atomic Stage 3 batch 018: six Items modules with seven named ESM exports (bait effectiveness knowledge and match, bait freshness modifier, item freshness state, bounded item metrics, rating tiers).",
      "- Extended the cumulative graph from 64 to 70 project modules and from 68 to 74 activation contracts, with 123 exact bridge relationships.",
      "- Preserved activation timing, twelve classic consumer relationships, class identity, the local knowledge-policy inheritance chain, state ownership and item behavior.",
      "- Added a reviewed class-family shape (several classes with exact global exposures, local superclasses only); the unconsumed abstract BaitEffectivenessKnowledgePolicy is kept as an ESM export without a classic global.",
      "- Advanced the completed ordered prefix to batches 001–018 (61 of 69 frozen Domain modules); the next task is batch 019 preflight.",
      "", "",
    ].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    // The plan document is advanced to the 0.24.55 checkpoint by one exact reversible edit.
    const task = read("refactor_Task.txt").toString();
    const next = approved.batches[18];
    const symbols = [...new Set(next.modules.flatMap(module => module.providers.map(provider => provider.symbol)))];
    add("refactor_Task.txt", task, BATCH_018_REFACTOR_TASK(task, { nextBatchId: next.id, symbols,
      completedModules: approved.batches.slice(0, 18).reduce((sum, batch) => sum + batch.modules.length, 0),
      acceptance }));
    const transition = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-018-release-transition",
      batchId: acceptance.batchId,
      fromRelease: RELEASE_PROFILE.fromRelease, toRelease: RELEASE_PROFILE.toRelease,
      acceptance: { path: acceptancePath, sha256: sha(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: sha(read(browserPath)) },
      records: [],
    };
    const writes = [], validator = new Batch018ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = Batch018ReleaseTransition.replace(after, operation.from, operation.to, operation.count);
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
  const result = new Batch018ReleaseProjection().run();
  console.log(`Stage 3.18.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}

module.exports = { Batch018ReleaseProjection };
