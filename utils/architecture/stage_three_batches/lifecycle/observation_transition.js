"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeObservationManifestTransition } = require("../../domain_batches/stage_three_observation_manifest_transition");
const { fingerprint } = require("../../domain_batches/stage_three_pending_target_manifest");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const RUNTIME = "architecture/migration/stage_3_compatibility_runtime.json";
const observationKind = definition => definition.context.kind("observation-reconciliation");
const observationNext = definition => `stage-${definition.context.step(8)}-full-acceptance-and-browser-smoke`;

function observationProfile(definition, prebuild) {
  const PROFILE = definition.profile;
  assert.equal(prebuild.batchId, PROFILE.batchId);
  return {
    batchId: prebuild.batchId,
    completedPrefix: prebuild.lifecycle.completedBatchIds,
    executionProfile: PROFILE.executionProfile,
    // A class family exposes several classes; only its activated class keeps a legacy global.
    legacyExposureBySource: Object.fromEntries(Object.entries(PROFILE.reviewedContracts)
      .filter(([, contract]) => contract.legacyExposure || contract.classFamily)
      .map(([source, contract]) => [source, contract.legacyExposure
        ? { symbol: contract.legacyExposure.symbol,
          mechanism: contract.legacyExposure.mechanism || "global-this-property" }
        : { symbol: prebuild.preliminaryMetadata.plannedActivationPositions
          .find(activation => activation.sourceProvider === source).legacySymbol,
        mechanism: "global-this-property" }])),
  };
}

class StageThreeBatchObservationManifestTransition extends StageThreeObservationManifestTransition {
  constructor(definition, { prebuild, cutover, runtime }) {
    const PROFILE = definition.profile;
    const record = cutover.writes.find(item => item.path === MANIFEST);
    assert(record && record.beforeBase64);
    const historical = Buffer.from(record.beforeBase64, "base64");
    assert.equal(fingerprint(historical), record.beforeSha256);
    assert.equal(record.beforeSha256, prebuild.evidence.manifestBefore.sha256);
    const paths = new Set(prebuild.preliminaryMetadata.targets.map(item => item.currentPath));
    const previousProviders = JSON.parse(historical).modules.filter(item => paths.has(item.currentPath));
    assert.equal(previousProviders.length, paths.size);
    super({
      prebuild, runtime, profile: observationProfile(definition, prebuild), kind: observationKind(definition),
      cutover: { ...cutover, manifestTransition: { ...cutover.manifestTransition, previousProviders } },
    });
    // Every provider drops its reviewed `globalThis.X = X` exposure in the ESM target.
    this.removedTargetBuiltinsBySource = Object.fromEntries(
      Object.entries(PROFILE.reviewedContracts).filter(([, contract]) =>
        contract.classFamily || contract.legacyExposure?.mechanism === "global-this-property")
        .map(([source]) => [source, ["globalThis"]]));
    this.removedTargetBrowserApisBySource = Object.fromEntries(
      Object.entries(PROFILE.reviewedContracts).filter(([, contract]) =>
        contract.legacyExposure?.mechanism === "window-property")
        .map(([source]) => [source, ["window"]]));
  }
}

function beforeBatchObservations(definition, bytes, root) {
  const { observation: OUTPUT, prebuild: PREBUILD, cutover: CUTOVER } = definition.context.paths;
  const file = path.join(root, OUTPUT);
  if (!fs.existsSync(file)) return Buffer.from(bytes);
  const artifact = JSON.parse(fs.readFileSync(file));
  if (fingerprint(bytes) !== artifact.manifestTransition.afterSha256) return Buffer.from(bytes);
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative)));
  return new StageThreeBatchObservationManifestTransition(definition, {
    prebuild: read(PREBUILD), cutover: read(CUTOVER), runtime: read(RUNTIME),
  }).reverse(Buffer.from(bytes), artifact);
}

module.exports = {
  StageThreeBatchObservationManifestTransition, beforeBatchObservations,
  observationProfile, observationKind, observationNext, MANIFEST, RUNTIME,
};
