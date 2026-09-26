"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch025ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_025_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_025_planning");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

class Batch025ReleaseProjection {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    assert(!fs.existsSync(path.join(root, TRANSITION)), "Release transition already published");
    const acceptancePath = "architecture/migration/stage_3_batch_025_acceptance_pass.json";
    const browserPath = "architecture/migration/stage_3_batch_025_browser_confirmation.json";
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
    add("package.json", '  "version": "0.24.62",', '  "version": "0.24.63",');
    add("package-lock.json", '  "version": "0.24.62",', '  "version": "0.24.63",', 2);
    const state = JSON.parse(read(STATE));
    const approved = new StageThreeApprovedPlanSource({ read }).load(state).document;
    assert.equal(approved.batches[24].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: RELEASE_PROFILE.toRelease,
      completedBatchIds: approved.batches.slice(0, 25).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", '    <script src="src/config/project_version.js?v=0.24.62"></script>',
      '    <script src="src/config/project_version.js?v=0.24.63"></script>');
    const version = "src/config/project_version.js";
    add(version, 'const CURRENT_PROJECT_VERSION = "0.24.62";',
      'const CURRENT_PROJECT_VERSION = "0.24.63";');
    add(version, '  codename: "inventory-reservation-policy-domain",',
      '  codename: "fishing-sector-pressure-retrieve-domain",');
    const oldDate = read(version).toString().match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(version, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = read(version).toString().match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(version, oldNotes, [
      "  notes: Object.freeze([",
      '    "Migrate the pole fight sector constraint, stamina pressure resolver and fish retrieve system",',
      '    "Import their five owner-created collaborators from completed ESM owners",',
      '    "Move the guarded window exposure of StaminaPressureResolver to the exact activation shim",',
      '    "Retire StaminaLateralPositionResolver and FishRetrieveResult activations as inert classic placeholders",',
      '    "Preserve eighty-six project modules, ninety-four activations and one hundred forty-one bridges",',
      "  ]),",
    ].join(eol));
    const changelog = [
      `## v0.24.63 - ${RELEASE_PROFILE.title}`, "", "### Changed", "",
      "- Completed batch 025 of the Stage 3.22 approved prefix: PoleFightSectorConstraint, StaminaPressureResolver and FishRetrieveSystem as named ESM exports.",
      "- Their owner-created collaborators (PoleFightSectorGeometry, StaminaLateralPositionResolver, DragForceCalculator, FishRetrieveResult, SimpleFightForceCalculator) are reviewed imports; a composition-identity review proves each new X at its audited location, and Domain-internal self-composition resolves the constructor-injection review. The guarded window exposure moved to the activation shim.",
      "- Extended the cumulative graph from 83 to 86 project modules and from 93 to 94 activation contracts (3 added, 2 consumer-less activations retired as inert classic placeholders), with 141 exact bridge relationships (4 added, 5 retired).",
      "- The next task is batch 026 preflight.",
      "", "",
    ].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n",
      `# CyberFishing changelog\n\n${changelog}`);
    // refactor_Task.txt is informational (owner decision 2026-09-26) and is not release metadata.
    const transition = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-025-release-transition",
      batchId: acceptance.batchId,
      fromRelease: RELEASE_PROFILE.fromRelease, toRelease: RELEASE_PROFILE.toRelease,
      acceptance: { path: acceptancePath, sha256: sha(read(acceptancePath)) },
      browserProof: { path: browserPath, sha256: sha(read(browserPath)) },
      records: [],
    };
    const writes = [], validator = new Batch025ReleaseTransition(root);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = Batch025ReleaseTransition.replace(after, operation.from, operation.to, operation.count);
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
  const result = new Batch025ReleaseProjection().run();
  console.log(`Stage 3.26.9 release projection PASS: ${result.writes.length} exact reversible metadata files; no writes.`);
}

module.exports = { Batch025ReleaseProjection };
