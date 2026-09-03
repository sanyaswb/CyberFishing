"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { BATCH_007_EXECUTION_PROFILE } = require("./stage_three_batch_execution_profile");

const manifestBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Historical evidence is immutable. Only the exact six esm -> verified deltas
// may be reverse-normalized, and all other bytes must reproduce its original hash.
function verifyBatch007ManifestEvidence(bytes, historicalSha256) {
  if (sha256(bytes) === historicalSha256) return "esm";
  const manifest = JSON.parse(bytes);
  assert(manifestBytes(manifest).equals(Buffer.from(bytes)), "Manifest must retain canonical JSON bytes");
  const entries = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
  for (const record of BATCH_007_EXECUTION_PROFILE.expectedTargets) {
    const entry = entries.get(record.targetPath);
    assert.equal(entry?.architecture.migrationStatus, "verified", "partial or invalid status transition");
    entry.architecture.migrationStatus = "esm";
  }
  assert.equal(sha256(manifestBytes(manifest)), historicalSha256,
    "Manifest differs beyond exact batch-007 esm -> verified transition");
  return "verified";
}

module.exports = { verifyBatch007ManifestEvidence, manifestBytes, sha256 };
