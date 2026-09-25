"use strict";

const assert = require("node:assert/strict");
const { immutableRecord } = require("../guards/core/guard_models");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { StageThreeObservationReconciliation, StageThreeObservationContract } = require("./stage_three_observation_reconciliation");
const { Batch014ObservationManifestTransition, observationProfile, KIND, NEXT } = require("./stage_three_batch_014_observation_transition");

class Batch014ObservationReconciliation {
  build(inputs) {
    assert.equal(fingerprint(canonicalBytes(inputs.approved)), inputs.state.approvedPlanSha256);
    const approved = inputs.approved.batches.find(batch => batch.id === inputs.prebuild.batchId);
    assert.equal(approved.status, "approved-frozen");
    assert.deepEqual(inputs.state.completedBatchIds,
      inputs.approved.batches.slice(0, inputs.approved.batches.indexOf(approved)).map(batch => batch.id));
    const result = new StageThreeObservationReconciliation({
      profile: observationProfile(inputs.prebuild),
      transitionFactory: data => new Batch014ObservationManifestTransition(data),
    }).build(inputs);
    const record = inputs.cutover.writes.find(item =>
      item.path === "architecture/migration/module_migration_manifest.json");
    const historical = JSON.parse(Buffer.from(record.beforeBase64, "base64"));
    const providers = manifest => manifest.modules.flatMap(module => module.observed.providers.items
      .map(provider => ({ currentPath: module.currentPath, ...provider })));
    const expectedManifest = structuredClone(historical);
    for (const item of inputs.prebuild.preliminaryMetadata.plannedActivationPositions) {
      const source = expectedManifest.modules.find(module => module.currentPath === item.sourceProvider);
      const old = source.observed.providers.items.filter(provider => provider.symbol === item.legacySymbol);
      const exposure = observationProfile(inputs.prebuild).legacyExposureBySource[item.sourceProvider];
      assert.deepEqual(old.map(provider => provider.mechanism), exposure?.symbol === item.legacySymbol
        ? ["global-lexical", exposure.mechanism] : ["global-lexical"]);
      source.observed.providers.items = source.observed.providers.items.filter(provider =>
        provider.symbol !== item.legacySymbol);
      source.observed.providers.items.push({ symbol: item.legacySymbol,
        mechanism: "global-this-property", availability: "program-init" });
      source.observed.providers.items.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
    assert.deepEqual(providers(result.manifest), providers(expectedManifest),
      "Unexpected global namespace change");
    const removals = approved.compatibility.newActivations.map(item => {
      const activation = inputs.runtime.activationPositions.find(value => value.id === item.contract.id);
      assert.deepEqual(activation, item.contract);
      const consumers = inputs.registry.bridges.filter(bridge => bridge.bridge === activation.sourceProvider)
        .map(bridge => bridge.source).sort();
      assert.deepEqual(consumers, [...item.legacyConsumers].sort());
      return {
        activationId: activation.id, source: activation.sourceProvider, consumers,
        owner: activation.owner, removalStage: activation.removalStage,
        removalCondition: item.removalCondition, newBridgeApproved: false,
      };
    });
    return {
      manifest: result.manifest,
      facts: immutableRecord({
        ...result.facts,
        globalNamespace: {
          newGlobals: [], removedSymbols: [],
          mechanismTransitions: result.facts.controlledGlobalTransitions,
        },
        removalDependencies: removals,
      }),
    };
  }
}

class Batch014ObservationContract extends StageThreeObservationContract {
  constructor(prebuild) {
    super({ profile: observationProfile(prebuild), kind: KIND, nextGate: NEXT });
  }
}

module.exports = { Batch014ObservationReconciliation, Batch014ObservationContract };
