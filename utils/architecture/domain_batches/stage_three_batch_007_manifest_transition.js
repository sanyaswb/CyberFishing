"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { BATCH_007_EXECUTION_PROFILE } = require("./stage_three_batch_execution_profile");

const manifestBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Historical evidence is immutable. Only the exact reviewed semantic deltas may
// be reverse-normalized, and all other bytes must reproduce its original hash.
function verifyBatch007ManifestEvidence(bytes, historicalSha256) {
  if (sha256(bytes) === historicalSha256) return "esm";
  const manifest = JSON.parse(bytes);
  assert(manifestBytes(manifest).equals(Buffer.from(bytes)), "Manifest must retain canonical JSON bytes");
  const entries = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
  const statuses = BATCH_007_EXECUTION_PROFILE.expectedTargets.map((record) =>
    entries.get(record.targetPath)?.architecture.migrationStatus);
  const resultStatus = statuses.every((status) => status === "verified")
    ? "verified"
    : statuses.every((status) => status === "esm")
      ? "esm"
      : null;
  assert(resultStatus, "partial or invalid status transition");
  for (const record of BATCH_007_EXECUTION_PROFILE.expectedTargets) {
    const entry = entries.get(record.targetPath);
    if (resultStatus === "verified") entry.architecture.migrationStatus = "esm";
  }
  const hydrationBoundary = entries.get(
    "src/application/inventory/equipment_read_model_factory.js",
  );
  const builtins = hydrationBoundary?.observed.environment.builtins;
  const typeErrorIndex = builtins?.indexOf("TypeError") ?? -1;
  if (typeErrorIndex !== -1) builtins.splice(typeErrorIndex, 1);
  assert.equal(sha256(manifestBytes(manifest)), historicalSha256,
    "Manifest differs beyond exact batch-007 status/hydration transitions");
  return resultStatus;
}

module.exports = { verifyBatch007ManifestEvidence, manifestBytes, sha256 };
