"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Batch011ReleaseProjection } = require("./project-stage-3-batch-011-release");
const { Batch011ReleaseTransition, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_011_release_transition");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_011_preflight_profile");
const { sha, serialize } = require("./domain_batches/stage_three_batch_011_planning");

class Batch011ReleaseProjectionFixtures {
  run(root = path.resolve(__dirname, "../..")) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-batch011-release-fixture-"));
    try {
      const required = [...RELEASE_PATHS, "architecture/migration/stage_3_approved_batches.json"];
      for (const file of required) {
        const target = path.join(temp, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
      }
      const acceptancePath = "architecture/migration/stage_3_batch_011_acceptance_pass.json";
      const browserPath = "architecture/migration/stage_3_batch_011_browser_confirmation.json";
      const reference = "package.json";
      const acceptance = {
        batchId: PROFILE.batchId, verdict: "eligible-for-release-closure",
        recordedAt: "2026-09-24T00:00:00.000Z",
        completes: { path: reference, sha256: sha(fs.readFileSync(path.join(temp, reference))) },
        protectedEvidence: [],
      };
      const acceptanceBytes = serialize(acceptance);
      const browser = {
        batchId: PROFILE.batchId, status: "passed", console: { errors: 0, warnings: 0 },
        supplements: { sha256: sha(acceptanceBytes) },
      };
      fs.writeFileSync(path.join(temp, acceptancePath), acceptanceBytes);
      fs.writeFileSync(path.join(temp, browserPath), serialize(browser));
      const projection = new Batch011ReleaseProjection().run(temp);
      assert.deepEqual(projection.writes.map(item => item.path), RELEASE_PATHS);
      const transition = new Batch011ReleaseTransition(temp);
      for (const record of projection.transition.records) {
        const projected = projection.writes.find(item => item.path === record.path);
        assert.deepEqual(transition.reverse(projected.after, record),
          fs.readFileSync(path.join(temp, record.path)));
      }
      for (const mutate of [
        artifact => { artifact.fromRelease = "0.24.46"; },
        artifact => { artifact.records.pop(); },
        artifact => { artifact.browserProof.sha256 = "0".repeat(64); },
      ]) {
        const invalid = structuredClone(projection.transition);
        mutate(invalid);
        assert.throws(() => transition.validate(invalid));
      }
      console.log("Stage 3.11.9 synthetic release projection fixture PASS: seven exact reversals and three rejected evidence mutations; no live acceptance or publication.");
      return projection;
    } finally {
      const resolved = fs.realpathSync(temp);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert(path.basename(resolved).startsWith("cyber-batch011-release-fixture-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  try { new Batch011ReleaseProjectionFixtures().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch011ReleaseProjectionFixtures };
