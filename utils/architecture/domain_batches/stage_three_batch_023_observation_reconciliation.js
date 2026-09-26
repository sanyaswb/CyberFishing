"use strict";

const assert = require("node:assert/strict");
const { immutableRecord } = require("../guards/core/guard_models");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { StageThreeObservationReconciliation, StageThreeObservationContract } = require("./stage_three_observation_reconciliation");
const { Batch023ObservationManifestTransition, observationProfile, KIND, NEXT } = require("./stage_three_batch_023_observation_transition");
const { BATCH_023_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_023_preflight_profile");

class Batch023ObservationReconciliation {
  build(inputs) {
    assert.equal(inputs.approved.continuation.path, inputs.state.continuationPlan.path);
    const approved = inputs.approved.batches.find(batch => batch.id === inputs.prebuild.batchId);
    assert.equal(approved.status, "approved-frozen");
    assert.deepEqual(inputs.state.completedBatchIds,
      inputs.approved.batches.slice(0, inputs.approved.batches.indexOf(approved)).map(batch => batch.id));
    const result = new StageThreeObservationReconciliation({
      profile: observationProfile(inputs.prebuild),
      transitionFactory: data => new Batch023ObservationManifestTransition(data),
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
    // An unactivated class of a reviewed class family loses its classic global. The frozen plan
    // gives it no activation; it must have no consumer anywhere in the historical graph.
    const removedSymbols = [];
    for (const [currentPath, contract] of Object.entries(PROFILE.reviewedContracts)) {
      if (!contract.classFamily) continue;
      const activated = inputs.prebuild.preliminaryMetadata.plannedActivationPositions
        .filter(item => item.sourceProvider === currentPath).map(item => item.legacySymbol);
      for (const symbol of contract.classFamily.classes.filter(name => !activated.includes(name))) {
        const consumers = historical.modules.flatMap(module => module.analysis.dependencies.confirmed
          .filter(fact => fact.target === currentPath && fact.symbol === symbol)
          .map(() => module.currentPath));
        assert.deepEqual(consumers, [], `Unactivated class still has consumers: ${symbol}`);
        const source = expectedManifest.modules.find(module => module.currentPath === currentPath);
        const old = source.observed.providers.items.filter(provider => provider.symbol === symbol);
        assert.deepEqual(old.map(provider => provider.mechanism), ["global-lexical", "global-this-property"]);
        source.observed.providers.items = source.observed.providers.items.filter(provider =>
          provider.symbol !== symbol);
        removedSymbols.push({ symbol, source: currentPath, consumers: 0,
          reason: "unactivated-class-family-member-kept-as-esm-export-only" });
      }
    }
    assert.deepEqual(providers(result.manifest), providers(expectedManifest),
      "Unexpected global namespace change");
    const removals = approved.compatibility.newActivations.map(item => {
      const activation = inputs.runtime.activationPositions.find(value => value.id === item.contract.id);
      assert.deepEqual(activation, item.contract);
      // Two activations share one provider here, so each owns only the bridges naming its symbol.
      const consumers = inputs.registry.bridges.filter(bridge => bridge.bridge === activation.sourceProvider &&
        bridge.globalProviders.some(provider => provider.symbol === activation.legacySymbol))
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
          newGlobals: [], removedSymbols,
          mechanismTransitions: result.facts.controlledGlobalTransitions,
        },
        removalDependencies: removals,
      }),
    };
  }
}

class Batch023ObservationContract extends StageThreeObservationContract {
  constructor(prebuild) {
    super({ profile: observationProfile(prebuild), kind: KIND, nextGate: NEXT });
  }
}

module.exports = { Batch023ObservationReconciliation, Batch023ObservationContract };
