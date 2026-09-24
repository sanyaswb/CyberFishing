"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch010ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_010_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_010_planning");

class Batch010ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_010_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_010_browser_confirmation.json";
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
    add("package.json", '  "version": "0.24.46",', '  "version": "0.24.47",');
    add("package-lock.json", '  "version": "0.24.46",', '  "version": "0.24.47",', 2);
    const approved = JSON.parse(read("architecture/migration/stage_3_approved_batches.json"));
    const state = JSON.parse(read(STATE));
    assert.equal(approved.batches[9].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: RELEASE_PROFILE.toRelease,
      completedBatchIds: approved.batches.slice(0, 10).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.46"></script>',
      '    <script src="src/config/project_version.js?v=0.24.47"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.46";',
      'const CURRENT_PROJECT_VERSION = "0.24.47";');
    add(version, '  codename: "fish-rarity-and-anomaly-domain",',
      '  codename: "inventory-assembly-capacity-domain",');
    add(version, '  updatedAt: "2026-09-22",',
      `  updatedAt: "${acceptance.recordedAt.slice(0, 10)}",`);
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, [
      "  notes: Object.freeze([",
      '    "Migrate UnlimitedAssemblyCapacityPolicy to a named game-domain ESM export",',
      '    "Preserve one cumulative graph with thirty-seven project modules and thirty-eight activations",',
      '    "Complete frozen batch 010 with sixty-four exact classic-consumer bridge relationships",',
      '    "Preserve assembly capacity behavior, class identity and fresh result allocation",',
      "  ]),",
    ].join(eol));
    const changelog = [
      "## v0.24.47 - Inventory Assembly Capacity Domain", "", "### Changed", "",
      "- Completed atomic Stage 3 batch 010: UnlimitedAssemblyCapacityPolicy is a named game-domain ESM module.",
      "- Extended the single cumulative graph from 36 to 37 project modules and from 37 to 38 activation contracts, with 64 exact bridge relationships and no isolated IIFE.",
      "- Preserved logical activation position 148, both classic consumers, class identity and fresh allowed/reason result behavior.",
      "- Advanced the completed ordered prefix to batches 001–010 (28 of 69 frozen Domain modules); the next task is batch 011 preflight.",
      "", "",
    ].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    add("refactor_Task.txt", "**Поточна release-версія:** `v0.24.46`",
      "**Поточна release-версія:** `v0.24.47`");
    add("refactor_Task.txt", "**Поточний наступний етап:** `Stage 3.10.0 — Batch 010 Preflight and Dependency/State Audit`",
      "**Поточний наступний етап:** `Stage 3.11.0 — Batch 011 Preflight and Dependency/State Audit`");
    const task = read("refactor_Task.txt").toString();
    const start = task.indexOf("## Stage 3.10–3.21 — Atomic Domain Migration Batches");
    const end = task.indexOf("Кожен batch `010–021`", start);
    assert(start >= 0 && end > start, "Active task section missing");
    const next = approved.batches[10];
    const symbols = next.modules.flatMap(module => module.providers.map(provider => provider.symbol));
    add("refactor_Task.txt", task.slice(start, end), [
      "## Stage 3.11–3.21 — Atomic Domain Migration Batches", "",
      "Завершено `10/21` frozen batches і `28/69` frozen domain-модулів. Наступний exact batch:", "", "```text",
      next.id, "", ...symbols, "```", "",
      "Stage 3.11.0: read-only preflight, exact dependency/state audit, approved activation/consumers і rollback boundary. Runtime migration не починається до наступних підетапів.", "",
      "Поточний accepted runtime: 37 project modules, 38 activation contracts, 64 bridge records; одна cumulative topology, жодного active batch. Наступний scope береться з frozen plan і перевіряється на фактичному graph.", "", "",
    ].join("\n"));
    add("refactor_Task.txt", "Кожен batch `010–021`", "Кожен batch `011–021`");
    const transition = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-010-release-transition",
      batchId: acceptance.batchId,
      fromRelease: RELEASE_PROFILE.fromRelease, toRelease: RELEASE_PROFILE.toRelease,
      acceptance: { path: acceptancePath, sha256: sha(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: sha(read(browserPath)) },
      records: [],
    };
    const writes = [], validator = new Batch010ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = Batch010ReleaseTransition.replace(after, operation.from, operation.to, operation.count);
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
  const result = new Batch010ReleaseProjection().run();
  console.log(`Stage 3.10.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}

module.exports = { Batch010ReleaseProjection };
