"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { StageThreeBatch009ReleaseTransition, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_009_release_transition");

// Read-only projection. A separate reviewed transaction publishes these bytes.
class Batch009ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_009_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_009_browser_confirmation.json";
    const acceptance = JSON.parse(read(acceptancePath));
    const browser = JSON.parse(read(browserPath));
    assert.equal(acceptance.verdict, "eligible-for-release-closure");
    assert.equal(browser.supplements.sha256, fingerprint(read(acceptancePath)));
    for (const evidence of [acceptance.completes, ...acceptance.protectedEvidence]) {
      assert.equal(fingerprint(read(evidence.path)), evidence.sha256, `Stale acceptance: ${evidence.path}`);
    }
    const edits = new Map(RELEASE_PATHS.map(file => [file, []]));
    const add = (file, from, to, count = 1) => edits.get(file).push({ from, to, count });
    add("package.json", '  "version": "0.24.45",', '  "version": "0.24.46",');
    add("package-lock.json", '  "version": "0.24.45",', '  "version": "0.24.46",', 2);
    const approved = JSON.parse(read("architecture/migration/stage_3_approved_batches.json"));
    const state = JSON.parse(read(STATE));
    assert.equal(approved.batches[8].id, acceptance.batchId);
    const completed = { ...state, releaseVersion: "0.24.46",
      completedBatchIds: approved.batches.slice(0, 9).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), canonicalBytes(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.45"></script>',
      '    <script src="src/config/project_version.js?v=0.24.46"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.45";',
      'const CURRENT_PROJECT_VERSION = "0.24.46";');
    add(version, '  codename: "line-spool-stroke-distance-and-reel-hold",',
      '  codename: "fish-rarity-and-anomaly-domain",');
    add(version, '  updatedAt: "2026-09-07",', '  updatedAt: "2026-09-22",');
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, ["  notes: Object.freeze([",
      '    "Migrate FishRarityResolver and FishAnomalyVariantResolver to named game-domain ESM exports",',
      '    "Preserve one cumulative graph with thirty-six project modules and thirty-seven activations",',
      '    "Complete frozen batch 009 with sixty-two exact classic-consumer bridge relationships",',
      '    "Preserve fish rarity and anomaly behavior, identity, timing and save semantics",',
      "  ]),"].join(eol));
    const changelog = ["## v0.24.46 - Fish Rarity and Anomaly Domain", "", "### Changed", "",
      "- Completed atomic Stage 3 batch 009: FishRarityResolver and FishAnomalyVariantResolver are named game-domain ESM modules.",
      "- Extended the single cumulative graph from 34 to 36 project modules and from 35 to 37 activation contracts, with 62 exact bridge relationships and no isolated IIFE.",
      "- Preserved the exact logical activation positions 42 and 43, existing bootstrap consumers, class identity and fish rarity/anomaly behavior.",
      "- Advanced the completed ordered prefix to batches 001–009 (27 of 69 frozen Domain modules); the next task is batch 010 preflight.",
      "", ""].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    add("refactor_Task.txt", "**Поточна release-версія:** `v0.24.45`",
      "**Поточна release-версія:** `v0.24.46`");
    add("refactor_Task.txt", "**Поточний наступний етап:** `Stage 3.9.0 — Batch 009 Preflight and Dependency/State Audit`",
      "**Поточний наступний етап:** `Stage 3.10.0 — Batch 010 Preflight and Dependency/State Audit`");
    const task = read("refactor_Task.txt").toString();
    const start = task.indexOf("## Stage 3.9–3.21 — Atomic Domain Migration Batches");
    const end = task.indexOf("Кожен batch `009–021`", start);
    assert(start >= 0 && end > start, "Active task section missing");
    add("refactor_Task.txt", task.slice(start, end), [
      "## Stage 3.10–3.21 — Atomic Domain Migration Batches", "",
      "Завершено `9/21` frozen batches і `27/69` frozen domain-модулів. Наступний exact batch:", "", "```text",
      approved.batches[9].id, "", "UnlimitedAssemblyCapacityPolicy", "```", "",
      "Stage 3.10.0: read-only preflight, exact dependency/state audit, approved activation/consumers і rollback boundary. Runtime migration не починається до наступних підетапів.", "",
      "Поточний accepted runtime: 36 project modules, 37 activation contracts, 62 bridge records; одна cumulative topology, жодного active batch. Наступний scope береться з frozen plan і перевіряється на фактичному graph.", "", "",
    ].join("\n"));
    add("refactor_Task.txt", "Кожен batch `009–021`", "Кожен batch `010–021`");
    const transition = { schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-009-release-transition",
      batchId: acceptance.batchId, fromRelease: "0.24.45", toRelease: "0.24.46",
      acceptance: { path: acceptancePath, sha256: fingerprint(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: fingerprint(read(browserPath)) }, records: [] };
    const writes = [], validator = new StageThreeBatch009ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) after = StageThreeBatch009ReleaseTransition.replace(
        after, operation.from, operation.to, operation.count);
      const next = Buffer.from(after);
      validator.validateDelta(file, before, next);
      transition.records.push({ path: file, beforeSha256: fingerprint(before),
        afterSha256: fingerprint(next), edits: operations });
      writes.push({ path: file, beforeSha256: fingerprint(before), after: next });
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
  const result = new Batch009ReleaseProjection().run();
  console.log(`Stage 3.9.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}
module.exports = { Batch009ReleaseProjection };
