"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch012ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_012_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_012_planning");

class Batch012ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_012_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_012_browser_confirmation.json";
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
    add("package.json", '  "version": "0.24.48",', '  "version": "0.24.49",');
    add("package-lock.json", '  "version": "0.24.48",', '  "version": "0.24.49",', 2);
    const approved = JSON.parse(read("architecture/migration/stage_3_approved_batches.json"));
    const state = JSON.parse(read(STATE));
    assert.equal(approved.batches[11].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: RELEASE_PROFILE.toRelease,
      completedBatchIds: approved.batches.slice(0, 12).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.48"></script>',
      '    <script src="src/config/project_version.js?v=0.24.49"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.48";',
      'const CURRENT_PROJECT_VERSION = "0.24.49";');
    add(version, '  codename: "items-progression-and-rarity-domain",',
      '  codename: "assemblies-domain",');
    const oldDate = read(version).toString().match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(version, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, [
      "  notes: Object.freeze([",
      '    "Migrate two Assemblies classes to named game-domain ESM exports",',
      '    "Preserve one cumulative graph with forty-four project modules and forty-five activations",',
      '    "Complete frozen batch 012 with seventy-six exact classic-consumer bridge relationships",',
      '    "Preserve attachment target and assembly completion behavior and class identity",',
      "  ]),",
    ].join(eol));
    const changelog = [
      "## v0.24.49 - Assemblies Domain", "", "### Changed", "",
      "- Completed atomic Stage 3 batch 012: AssemblyAttachmentTargetResolver and AssemblyCompletionPolicy are named game-domain ESM modules.",
      "- Extended the cumulative graph from 42 to 44 project modules and from 43 to 45 activation contracts, with 76 exact bridge relationships.",
      "- Preserved activation positions 153 and 154, two classic consumer relationships, class identity and existing global exposure timing.",
      "- Advanced the completed ordered prefix to batches 001–012 (35 of 69 frozen Domain modules); the next task is batch 013 preflight.",
      "", "",
    ].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    add("refactor_Task.txt", "**Поточна release-версія:** `v0.24.48`",
      "**Поточна release-версія:** `v0.24.49`");
    add("refactor_Task.txt", "**Поточний наступний етап:** `Stage 3.12.0 — Batch 012 Preflight and Dependency/State Audit`",
      "**Поточний наступний етап:** `Stage 3.13.0 — Batch 013 Preflight and Dependency/State Audit`");
    const task = read("refactor_Task.txt").toString();
    const start = task.indexOf("## Stage 3.12–3.21 — Atomic Domain Migration Batches");
    const end = task.indexOf("Кожен batch `012–021`", start);
    assert(start >= 0 && end > start, "Active task section missing");
    const next = approved.batches[12];
    const symbols = [...new Set(next.modules.flatMap(module => module.providers.map(provider => provider.symbol)))];
    add("refactor_Task.txt", task.slice(start, end), [
      "## Stage 3.13–3.21 — Atomic Domain Migration Batches", "",
      "Завершено `12/21` frozen batches і `35/69` frozen domain-модулів. Наступний exact batch:", "", "```text",
      next.id, "", ...symbols, "```", "",
      "Stage 3.13.0: read-only preflight, exact dependency/state audit, approved activation/consumers і rollback boundary. Runtime migration не починається до наступних підетапів.", "",
      "Поточний accepted runtime: 44 project modules, 45 activation contracts, 76 bridge records; одна cumulative topology, жодного active batch. Наступний scope береться з frozen plan і перевіряється на фактичному graph.", "", "",
    ].join("\n"));
    add("refactor_Task.txt", "Кожен batch `012–021`", "Кожен batch `013–021`");
    const transition = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-012-release-transition",
      batchId: acceptance.batchId,
      fromRelease: RELEASE_PROFILE.fromRelease, toRelease: RELEASE_PROFILE.toRelease,
      acceptance: { path: acceptancePath, sha256: sha(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: sha(read(browserPath)) },
      records: [],
    };
    const writes = [], validator = new Batch012ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = Batch012ReleaseTransition.replace(after, operation.from, operation.to, operation.count);
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
  const result = new Batch012ReleaseProjection().run();
  console.log(`Stage 3.12.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}

module.exports = { Batch012ReleaseProjection };
