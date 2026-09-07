"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { StageThreeBatch008ReleaseTransition, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_008_release_transition");

// Read-only projection. Applying the reviewed patch is a separate operation.
class Batch008ReleaseProjection {
  run(root) {
    const read = (file) => fs.readFileSync(path.join(root, file));
    const acceptedPath = "architecture/migration/stage_3_batch_008_acceptance_pass.json";
    const accepted = JSON.parse(read(acceptedPath));
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(accepted.browserSmoke.status, "passed");
    for (const item of [accepted.completes, ...accepted.protectedEvidence]) {
      assert.equal(fingerprint(read(item.path)), item.sha256, `Acceptance is stale: ${item.path}`);
    }
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already exists");
    const edits = new Map(RELEASE_PATHS.map((file) => [file, []]));
    const add = (file, from, to, count = 1) => edits.get(file).push({ from, to, count });
    for (const file of ["package.json", "package-lock.json"]) {
      add(file, '  "version": "0.24.44",', '  "version": "0.24.45",', file === "package-lock.json" ? 2 : 1);
    }
    const state = JSON.parse(read(STATE));
    const approved = JSON.parse(read("architecture/migration/stage_3_approved_batches.json"));
    const next = { ...state, releaseVersion: "0.24.45",
      completedBatchIds: approved.batches.slice(0, 8).map((batch) => batch.id), activeBatchId: null };
    delete next.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), canonicalBytes(next).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.44"></script>',
      '    <script src="src/config/project_version.js?v=0.24.45"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.44";', 'const CURRENT_PROJECT_VERSION = "0.24.45";');
    add(version, '  codename: "fishing-domain-state-and-motion",', '  codename: "line-spool-stroke-distance-and-reel-hold",');
    add(version, '  updatedAt: "2026-09-04",', '  updatedAt: "2026-09-07",');
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)[0];
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, ["  notes: Object.freeze([",
      '    "Migrate LineSpoolState, RodStrokeDistanceTracker and ReelHoldLoadPolicy to named ESM exports",',
      '    "Preserve one cumulative graph with thirty-four project modules and thirty-five activations",',
      '    "Complete frozen batch 008 with sixty exact classic-consumer bridge relationships",',
      '    "Preserve fishing formulas, mutable state identity, activation timing and save semantics",',
      "  ]),"].join(eol));
    const changelog = ["## v0.24.45 - Line Spool, Stroke Distance and Reel Hold", "", "### Changed", "",
      "- Completed atomic Stage 3 batch 008: LineSpoolState, RodStrokeDistanceTracker and ReelHoldLoadPolicy are named game-domain ESM modules.",
      "- Extended the single cumulative graph from 31 to 34 project modules and from 32 to 35 activation contracts, with 60 exact bridge records and no isolated IIFEs.",
      "- Preserved the three logical activation positions (90, 94, 114), exact classic consumers, mutable state identity, hot-loop allocations, formulas, API and save format.",
      "- Advanced the ordered completed prefix to batches 001–008 (25 of 69 frozen Domain modules). The next task is batch 009 preflight; no runtime changes are included in release closure.",
      "", "### Validation", "",
      "- Stage 3.8.8 fresh npm ci acceptance passed Architecture 111/111, Quick 65/65 and Full 139/139; generated runtime output matched byte-for-byte.",
      "- Manual browser smoke was accepted from the user's overall test confirmation. No per-check console counters or numeric telemetry were supplied or inferred.",
      "- Preserved 424 logical positions, 426 physical classic scripts, zero module scripts, 203 registered known-debt diagnostics and zero guard failures.",
      "- Immutable acceptance and release-transition evidence records the exact batch-only rollback to v0.24.44; batches 001–007 remain completed.", "", ""].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n", `# CyberFishing changelog\n\n${changelog}`);
    add("refactor_Task.txt", "**Поточна release-версія:** `v0.24.44`", "**Поточна release-версія:** `v0.24.45`");
    add("refactor_Task.txt", "**Поточний наступний етап:** `Stage 3.8.9 — Release Closure v0.24.45`",
      "**Поточний наступний етап:** `Stage 3.9.0 — Batch 009 Preflight and Dependency/State Audit`");
    const task = read("refactor_Task.txt").toString();
    const start = task.indexOf("## Stage 3.8–3.21 — Atomic Domain Migration Batches");
    const end = task.indexOf("Кожен batch `008–021`", start);
    assert(start >= 0 && end > start);
    add("refactor_Task.txt", task.slice(start, end), [
      "## Stage 3.9–3.21 — Atomic Domain Migration Batches", "",
      "Завершено `8/21` frozen batches і `25/69` frozen domain-модулів. Наступний exact batch:", "", "```text",
      approved.batches[8].id, "", "FishAnomalyVariantResolver", "FishRarityResolver", "```", "",
      "Stage 3.9.0: read-only preflight, exact dependency/state audit, approved activations/consumers і rollback boundary. Scope та порядок визначаються frozen plan; runtime migration не починається до наступних погоджених підетапів.", "",
      "Поточний accepted runtime: 34 project modules, 35 activation contracts, 60 bridge records; одна cumulative topology, жодного active batch. Особлива увага наступного аудиту: authoritative state, cached result identity та відсутність нового config/platform coupling.", "", ""].join("\n"));
    add("refactor_Task.txt", "Кожен batch `008–021`", "Кожен batch `009–021`");
    const transition = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-008-release-transition",
      batchId: accepted.batchId, fromRelease: "0.24.44", toRelease: "0.24.45",
      acceptance: { path: acceptedPath, sha256: fingerprint(read(acceptedPath)) }, records: [] };
    const writes = [];
    for (const [file, operations] of edits) {
      const before = read(file);
      let text = before.toString();
      for (const edit of operations) text = StageThreeBatch008ReleaseTransition.replace(text, edit.from, edit.to, edit.count);
      const after = Buffer.from(text);
      new StageThreeBatch008ReleaseTransition(root).validateDelta(file, before, after);
      transition.records.push({ path: file, beforeSha256: fingerprint(before), afterSha256: fingerprint(after), edits: operations });
      writes.push({ path: file, before: before.toString(), after: text });
    }
    new StageThreeBatch008ReleaseTransition(root).validate(transition);
    return { transition, writes };
  }
}
if (require.main === module) process.stdout.write(JSON.stringify(new Batch008ReleaseProjection().run(path.resolve(__dirname, "../.."))));
module.exports = { Batch008ReleaseProjection };
