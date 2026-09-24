"use strict";

const assert = require("node:assert/strict");
const { immutableRecord } = require("../guards/core/guard_models");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { StageThreeObservationReconciliation, StageThreeObservationContract } = require("./stage_three_observation_reconciliation");
const { Batch012ObservationManifestTransition, observationProfile, KIND, NEXT } = require("./stage_three_batch_012_observation_transition");

class Batch012ObservationReconciliation {
  build(inputs) {
    assert.equal(fingerprint(canonicalBytes(inputs.approved)), inputs.state.approvedPlanSha256);
    const approved = inputs.approved.batches.find(batch => batch.id === inputs.prebuild.batchId);
    assert.equal(approved.status, "approved-frozen");
    assert.deepEqual(inputs.state.completedBatchIds,
      inputs.approved.batches.slice(0, inputs.approved.batches.indexOf(approved)).map(batch => batch.id));
    const result = new StageThreeObservationReconciliation({
      profile: observationProfile(inputs.prebuild),
      transitionFactory: data => new Batch012ObservationManifestTransition(data),
    }).build(inputs);
    const record = inputs.cutover.writes.find(item =>
      item.path === "architecture/migration/module_migration_manifest.json");
    const historical = JSON.parse(Buffer.from(record.beforeBase64, "base64"));
    const providers = manifest => manifest.modules.flatMap(module => module.observed.providers.items
      .map(provider => ({ currentPath: module.currentPath, ...provider })));
    const expected = providers(historical);
    for (const item of inputs.prebuild.preliminaryMetadata.plannedActivationPositions) {
      const old = expected.filter(provider =>
        provider.currentPath === item.sourceProvider && provider.symbol === item.legacySymbol);
      assert.deepEqual(old.map(provider => provider.mechanism),
        ["global-lexical", "global-this-property"]);
      expected.splice(expected.indexOf(old[0]), 1);
    }
    assert.deepEqual(providers(result.manifest), expected, "Unexpected global namespace change");
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

class Batch012ObservationContract extends StageThreeObservationContract {
  constructor(prebuild) {
    super({ profile: observationProfile(prebuild), kind: KIND, nextGate: NEXT });
  }
}

module.exports = { Batch012ObservationReconciliation, Batch012ObservationContract };
