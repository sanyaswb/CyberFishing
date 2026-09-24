"use strict";

const assert = require("node:assert/strict");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const empty = () => ({ status: "verified", items: [], issues: [] });

// The only permitted delta is observed facts for the exact source/shim records,
// plus migrating -> verified for the approved targets. Everything else is
// compared as a complete document, including blockers and architecture decisions.
class StageThreeObservationManifestTransition {
  constructor({ prebuild, cutover, runtime, profile, kind }) {
    this.profile = profile;
    this.kind = kind;
    this.prebuild = prebuild;
    this.cutover = cutover;
    this.runtime = runtime;
    this.removedTargetBuiltins = [];
    assert.equal(prebuild.batchId, this.profile.batchId);
    assert.equal(cutover.batchId, this.profile.batchId);
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
      const expectedTargetEnvironment = structuredClone(previous.observed.environment);
      for (const builtin of this.removedTargetBuiltins) {
        assert(expectedTargetEnvironment.builtins.includes(builtin), "Reviewed builtin was absent before cutover");
        expectedTargetEnvironment.builtins = expectedTargetEnvironment.builtins.filter(item => item !== builtin);
      }
      assert.deepEqual(target.observed.environment, expectedTargetEnvironment,
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
    assert.equal(artifact.kind, this.kind);
    assert.equal(artifact.batchId, this.profile.batchId);
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


module.exports = { StageThreeObservationManifestTransition };
