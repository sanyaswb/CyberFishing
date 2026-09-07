"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const OUTPUT = "architecture/migration/stage_3_batch_008_observation_reconciliation.json";
const CUTOVER = "architecture/migration/stage_3_batch_008_runtime_cutover.json";
const empty = () => ({ status: "verified", items: [], issues: [] });

// The only permitted delta is observed facts for six exact source/shim records,
// plus migrating -> verified for the three approved targets. Everything else is
// compared as a complete document, including blockers and architecture decisions.
class Batch008ObservationManifestTransition {
  constructor({ prebuild, cutover, runtime }) {
    this.prebuild = prebuild;
    this.cutover = cutover;
    this.runtime = runtime;
    assert.equal(prebuild.batchId, PROFILE.batchId);
    assert.equal(cutover.batchId, PROFILE.batchId);
    this.activations = prebuild.preliminaryMetadata.plannedActivationPositions;
    this.paths = this.activations.flatMap((item) => [item.sourceProvider, item.targetModule]).sort();
    assert.equal(new Set(this.paths).size, this.paths.length);
    this.beforeSha256 = cutover.writes.find((item) => item.path === MANIFEST).afterSha256;
  }

  project(before, observed) {
    assert.equal(fingerprint(canonicalBytes(before)), this.beforeSha256, "Expected exact pending cutover Manifest");
    const next = structuredClone(observed);
    const old = new Map(before.modules.map((item) => [item.currentPath, item]));
    assert.deepEqual(next.modules.map((item) => item.currentPath), before.modules.map((item) => item.currentPath),
      "Reconciliation cannot add/remove/reorder source records");
    for (const activation of this.activations) {
      const target = next.modules.find((item) => item.currentPath === activation.targetModule);
      assert.equal(old.get(target.currentPath).architecture.migrationStatus, "migrating");
      assert.deepEqual(target.architecture, old.get(target.currentPath).architecture, "Scanner changed target classification");
      target.architecture.migrationStatus = "verified";
    }
    this.validateDelta(before, next);
    const records = this.paths.map((currentPath) => ({ currentPath,
      before: old.get(currentPath), afterSha256: fingerprint(canonicalBytes(next.modules.find((item) => item.currentPath === currentPath))) }));
    return { manifest: next, transition: { beforeSha256: this.beforeSha256,
      afterSha256: fingerprint(canonicalBytes(next)), records } };
  }

  validateDelta(before, after) {
    const byPath = new Map(after.modules.map((item) => [item.currentPath, item]));
    for (const activation of this.activations) {
      const source = byPath.get(activation.sourceProvider), target = byPath.get(activation.targetModule);
      const previous = this.cutover.manifestTransition.previousProviders.find((item) => item.currentPath === activation.sourceProvider);
      assert(source && target && previous, "Missing exact observation scope");
      assert.deepEqual(source.architecture.roles, ["compatibility-bridge"]);
      assert.equal(source.observed.legacyLoadOrder, activation.legacyScriptIndex);
      assert.deepEqual(source.observed.providers, { status: "verified", items: [{ symbol: activation.legacySymbol,
        mechanism: "global-this-property", availability: "program-init" }], issues: [] });
      const transport = { symbol: this.runtime.transport.symbol, mechanism: "global-this-property",
        accessRequirement: "required", executionPhase: "eager" };
      assert.deepEqual(source.observed.consumers, { status: "verified", items: [transport], issues: [] });
      assert.deepEqual(source.observed.environment, { status: "verified", builtins: ["globalThis"],
        browserApis: [], dynamicConstructs: [], issues: [] });
      assert.deepEqual(source.analysis.dependencies, { status: "verified", confirmed: [], items: [],
        unresolved: [{ ...transport, resolution: "unresolved" }], ambiguous: [], issues: [] });
      assert.equal(target.observed.legacyLoadOrder, null);
      assert.deepEqual(target.observed.providers, empty());
      assert.deepEqual(target.observed.consumers, empty());
      assert.deepEqual(target.observed.environment, previous.observed.environment,
        "ESM target acquired a new environment dependency");
      assert.deepEqual(target.observed.environment.browserApis, []);
      assert.deepEqual(target.observed.environment.dynamicConstructs, []);
      assert.deepEqual(target.observed.environment.issues, []);
      assert.equal(target.observed.environment.status, "verified");
      assert.deepEqual(target.analysis.dependencies, { status: "verified", confirmed: [], items: [],
        unresolved: [], ambiguous: [], issues: [] });
      assert.equal(target.architecture.migrationStatus, "verified");
      assert.equal(target.architecture.targetBoundary, "game-domain");
      assert.equal(target.architecture.targetPath, target.currentPath);
    }
    const paths = new Set(this.paths);
    const normalized = structuredClone(after);
    const old = new Map(before.modules.map((item) => [item.currentPath, item]));
    for (const item of normalized.modules) {
      if (!paths.has(item.currentPath)) continue;
      const original = old.get(item.currentPath);
      item.observed = structuredClone(original.observed);
      item.analysis.dependencies = structuredClone(original.analysis.dependencies);
      item.architecture.migrationStatus = original.architecture.migrationStatus;
    }
    assert.deepEqual(normalized, before, "Unapproved metadata/facts changed outside exact reconciliation delta");
    // Source bridge status is not part of the approved metadata transition.
    for (const activation of this.activations) assert.equal(byPath.get(activation.sourceProvider).architecture.migrationStatus,
      old.get(activation.sourceProvider).architecture.migrationStatus);
  }

  reverse(bytes, artifact) {
    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.kind, "cyber-fishing-stage-3-batch-008-observation-reconciliation");
    assert.equal(artifact.batchId, PROFILE.batchId);
    assert.equal(artifact.status, "verified");
    const transition = artifact.manifestTransition;
    assert.equal(transition.beforeSha256, this.beforeSha256);
    assert.equal(fingerprint(bytes), transition.afterSha256, "Reconciled Manifest fingerprint mismatch");
    assert.deepEqual(transition.records.map((item) => item.currentPath), this.paths, "Non-exact reversal scope");
    const after = JSON.parse(bytes);
    assert.deepEqual(canonicalBytes(after), bytes, "Manifest must remain canonical");
    const before = structuredClone(after);
    for (const record of transition.records) {
      assert.equal(record.before.currentPath, record.currentPath);
      const index = before.modules.findIndex((item) => item.currentPath === record.currentPath);
      assert(index >= 0);
      assert.equal(fingerprint(canonicalBytes(before.modules[index])), record.afterSha256, "Observed record fingerprint mismatch");
      before.modules[index] = structuredClone(record.before);
    }
    const restored = canonicalBytes(before);
    assert.equal(fingerprint(restored), this.beforeSha256, "Observation reversal must reproduce full historical SHA");
    this.validateDelta(before, after);
    return restored;
  }
}

// Historical validators call this exact view; live scanners never do. No facts
// are suppressed in the current Manifest or in the new reconciliation check.
function beforeBatch008Observations(bytes, root) {
  const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative)));
  const cutover = read(CUTOVER);
  if (fingerprint(bytes) === cutover.writes.find((item) => item.path === MANIFEST).afterSha256) return Buffer.from(bytes);
  assert(fs.existsSync(path.join(root, OUTPUT)), "Missing exact observation transition evidence");
  const { StageThreeBatch008ReleaseTransition } = require("./stage_three_batch_008_release_transition");
  const state = new StageThreeBatch008ReleaseTransition(root).runtimeState();
  assert.equal(state.activeBatchId, PROFILE.batchId);
  assert.equal(state.activeBatchPhase, "runtime-active");
  assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
  return new Batch008ObservationManifestTransition({ cutover, prebuild: read(PROFILE.artifactPath),
    runtime: read("architecture/migration/stage_3_compatibility_runtime.json") }).reverse(Buffer.from(bytes), read(OUTPUT));
}

module.exports = { Batch008ObservationManifestTransition, beforeBatch008Observations, MANIFEST, OUTPUT };
