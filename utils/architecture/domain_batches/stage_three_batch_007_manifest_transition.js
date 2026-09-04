"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { BATCH_007_EXECUTION_PROFILE } = require("./stage_three_batch_execution_profile");

const manifestBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function reverseNormalizeAcceptanceProbe(manifest) {
  const entries = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
  const probe = entries.get("src/debug/modules/reel_hold_gate_live_probe.js");
  const removeOneExact = (records, expected) => {
    if (!Array.isArray(records)) return;
    const index = records.findIndex((record) =>
      Object.entries(expected).every(([key, value]) => record?.[key] === value));
    if (index !== -1) records.splice(index, 1);
  };
  removeOneExact(probe?.observed?.consumers?.items, {
    symbol: "DEBUG_MODULES",
    mechanism: "window-property",
    accessRequirement: "required",
    executionPhase: "deferred",
  });
  removeOneExact(probe?.analysis?.dependencies?.confirmed, {
    symbol: "DEBUG_MODULES",
    mechanism: "window-property",
    accessRequirement: "required",
    executionPhase: "deferred",
    target: "src/debug/debug.js",
    resolution: "confirmed",
  });
  for (const name of ["Date", "Error", "Math", "Object", "Set", "String", "TypeError"]) {
    const index = probe?.observed?.environment?.builtins?.indexOf(name) ?? -1;
    if (index !== -1) probe.observed.environment.builtins.splice(index, 1);
  }
  for (const name of [
    "CustomEvent",
    "addEventListener",
    "cancelAnimationFrame",
    "performance",
    "removeEventListener",
    "requestAnimationFrame",
  ]) {
    const index = probe?.observed?.environment?.browserApis?.indexOf(name) ?? -1;
    if (index !== -1) probe.observed.environment.browserApis.splice(index, 1);
  }
}

function verifyBatch007PostHydrationManifestEvidence(bytes, historicalSha256) {
  if (sha256(bytes) === historicalSha256) return "pre-probe";
  const manifest = JSON.parse(bytes);
  assert(manifestBytes(manifest).equals(Buffer.from(bytes)), "Manifest must retain canonical JSON bytes");
  reverseNormalizeAcceptanceProbe(manifest);
  assert.equal(
    sha256(manifestBytes(manifest)),
    historicalSha256,
    "Manifest differs beyond exact Stage 3.7.8 probe observations",
  );
  return "probe-observed";
}

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

  // Stage 3.7.8 added an opt-in DevTools probe after the immutable Stage 3.7.5
  // and 3.7.6 evidence was captured. Reverse-normalize only its exact
  // mechanically observed facts; the final SHA-256 comparison below rejects
  // every unrelated Manifest delta.
  reverseNormalizeAcceptanceProbe(manifest);
  assert.equal(sha256(manifestBytes(manifest)), historicalSha256,
    "Manifest differs beyond exact batch-007 status/hydration/probe transitions");
  return resultStatus;
}

module.exports = {
  verifyBatch007ManifestEvidence,
  verifyBatch007PostHydrationManifestEvidence,
  manifestBytes,
  sha256,
};
