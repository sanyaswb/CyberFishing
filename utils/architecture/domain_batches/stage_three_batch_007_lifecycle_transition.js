"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./stage_three_batch_prebuild_profile");

const BATCH_ID = BATCH_007_PREBUILD_PROFILE.batchId;
const SOURCE_RELEASE_VERSION = "0.24.43";
const RELEASE_VERSION = "0.24.44";

class StageThreeBatch007LifecycleTransition {
  isCompleted(state) {
    return state.completedBatchIds?.[BATCH_007_PREBUILD_PROFILE.completedPrefix.length] ===
      BATCH_ID;
  }

  isRuntimeAvailable(state) {
    return this.isCompleted(state) || (
      state.activeBatchId === BATCH_ID && state.activeBatchPhase === "runtime-active"
    );
  }

  assertCurrentContainsBatch(state) {
    assert.deepEqual(
      state.completedBatchIds.slice(0, BATCH_007_PREBUILD_PROFILE.completedPrefix.length),
      BATCH_007_PREBUILD_PROFILE.completedPrefix,
      "batch-007 predecessor prefix differs",
    );
    assert.equal(
      this.isCompleted(state) || state.activeBatchId === BATCH_ID,
      true,
      "batch 007 is neither active nor completed",
    );
  }

  projectRuntimeActive(state) {
    this.assertCurrentContainsBatch(state);
    if (!this.isCompleted(state)) {
      assert.equal(state.activeBatchId, BATCH_ID);
      assert.equal(state.activeBatchPhase, "runtime-active");
      assert.equal(state.releaseVersion, SOURCE_RELEASE_VERSION);
      return structuredClone(state);
    }
    return {
      schemaVersion: state.schemaVersion,
      kind: state.kind,
      releaseVersion: SOURCE_RELEASE_VERSION,
      approvedPlanSha256: state.approvedPlanSha256,
      status: "migration-active",
      completedBatchIds: [...BATCH_007_PREBUILD_PROFILE.completedPrefix],
      activeBatchId: BATCH_ID,
      compatibilityRuntimeActivated: true,
      activeBatchPhase: "runtime-active",
    };
  }

  verifyRuntimeActiveEvidence(bytes, historicalSha256) {
    if (this.#sha256(bytes) === historicalSha256) return "runtime-active";
    const current = JSON.parse(bytes);
    const projected = this.projectRuntimeActive(current);
    assert.equal(
      this.#sha256(this.#canonicalBytes(projected)),
      historicalSha256,
      "execution state differs beyond the exact batch-007 completion transition",
    );
    return "completed";
  }

  verifyIndexEvidence(bytes, historicalSha256) {
    if (this.#sha256(bytes) === historicalSha256) return "source-release";
    const current = bytes.toString("utf8");
    const marker = `src/config/project_version.js?v=${RELEASE_VERSION}`;
    assert.equal(current.split(marker).length - 1, 1);
    const normalized = Buffer.from(current.replace(
      marker,
      `src/config/project_version.js?v=${SOURCE_RELEASE_VERSION}`,
    ), "utf8");
    assert.equal(
      this.#sha256(normalized),
      historicalSha256,
      "index.html differs beyond the exact v0.24.44 query transition",
    );
    return "release-closed";
  }

  historicalChangelogBytes(bytes, historicalSha256) {
    if (this.#sha256(bytes) === historicalSha256) return Buffer.from(bytes);
    const current = bytes.toString("utf8");
    const historicalHeading = `## v${SOURCE_RELEASE_VERSION} - `;
    const historicalIndex = current.indexOf(historicalHeading);
    assert(historicalIndex > 0, "Historical v0.24.43 changelog heading is missing");
    const normalized = Buffer.from(
      `# CyberFishing changelog\n\n${current.slice(historicalIndex)}`,
      "utf8",
    );
    assert.equal(
      this.#sha256(normalized),
      historicalSha256,
      "CHANGELOG.md differs below the exact v0.24.44 release prefix",
    );
    return normalized;
  }

  #canonicalBytes(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

module.exports = {
  BATCH_ID,
  SOURCE_RELEASE_VERSION,
  StageThreeBatch007LifecycleTransition,
};
