"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { historicalManifestBytes, canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");

// Historical replay is read-only. Only the reviewed lifecycle deltas are reversed;
// callers still compare the complete resulting bytes with their frozen evidence.
class StageThreeBatch008HistoricalInputs {
  constructor(root) { this.root = root; }
  bytes(relative) {
    const { historicalCutoverBytes } = require("./stage_three_batch_008_cutover_history");
    const bytes = historicalCutoverBytes(relative, fs.readFileSync(path.join(this.root, relative)), this.root);
    if (relative === "architecture/migration/module_migration_manifest.json") {
      return historicalManifestBytes(bytes, this.root);
    }
    if (relative === "architecture/migration/stage_3_execution_state.json") {
      const state = JSON.parse(bytes);
      assert.equal(state.activeBatchId, PROFILE.batchId);
      assert.equal(state.activeBatchPhase, "prebuild");
      assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
      state.activeBatchId = null;
      delete state.activeBatchPhase;
      return canonicalBytes(state);
    }
    if (relative === "refactor_Task.txt") {
      return Buffer.from(bytes.toString("utf8").replace(
        /\*\*Поточний наступний етап:\*\* `Stage 3\.8\.(?:[345678] — [^`]+|9 — Release Closure v0\.24\.45)`/u,
        "**Поточний наступний етап:** `Stage 3.8.3 — Pre-build Contract`"), "utf8");
    }
    return bytes;
  }
  verifyTargets() {
    const targets = PROFILE.executionProfile.expectedTargets;
    const present = targets.filter((item) => fs.existsSync(path.join(this.root, item.targetPath)));
    assert([0, targets.length].includes(present.length), "Partial target source preparation is forbidden");
    for (const target of present) {
      const source = this.bytes(target.currentPath).toString("utf8");
      const projection = new RepresentationOnlyNamedEsmTarget().project({ ...target, source,
        sourceSha256: fingerprint(Buffer.from(source)), exportName: target.exports[0] });
      assert.equal(this.bytes(target.targetPath).toString("utf8"), projection.targetSource,
        "Prepared target changed beyond the named export token");
    }
    return present.length;
  }
}

module.exports = { StageThreeBatch008HistoricalInputs };
