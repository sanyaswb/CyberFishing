"use strict";

const assert = require("node:assert/strict");
const { immutableRecord } = require("../guards/core/guard_models");
const { Batch008ObservationManifestTransition } = require("./stage_three_batch_008_observation_transition");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const sorted = (items) => [...items].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
const edges = (manifest) => manifest.modules.flatMap((item) => item.analysis.dependencies.items
  .map((edge) => ({ source: item.currentPath, ...edge })));

class StageThreeBatch008ObservationReconciliation {
  build({ before, observed, prebuild, cutover, runtime, registry, baseline, audit, state, esm }) {
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.releaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
    assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
    assert.equal(state.compatibilityRuntimeActivated, true);
    const transition = new Batch008ObservationManifestTransition({ prebuild, cutover, runtime });
    const result = transition.project(before, observed);
    const activations = runtime.activationPositions.filter((item) => item.owner === PROFILE.batchId);
    const bridges = registry.bridges.filter((item) => item.owner === PROFILE.batchId);
    assert.deepEqual(activations, prebuild.preliminaryMetadata.plannedActivationPositions);
    assert.deepEqual(bridges, prebuild.preliminaryMetadata.plannedBridges);
    assert.deepEqual(registry.bridges.map((item) => item.id).sort(), prebuild.plannedTopology.bridgeIds);
    assert.deepEqual(runtime.activationPositions.map((item) => item.id).sort(), prebuild.plannedTopology.activationIds);
    assert.deepEqual(edges(result.manifest), edges(before), "New/removed/changed dependency edge requires review");
    const sourcePaths = new Set(activations.map((item) => item.sourceProvider));
    const incoming = (manifest) => manifest.modules.flatMap((item) => item.analysis.dependencies.confirmed
      .filter((fact) => sourcePaths.has(fact.target)).map((fact) => ({ source: item.currentPath, ...fact })));
    assert.deepEqual(incoming(result.manifest), incoming(before), "New/changed consumer, including guarded, requires review");
    const relationships = incoming(result.manifest);
    const identities = relationships.map((item) => ({ source: item.source, target: item.target, symbol: item.symbol }));
    const approved = bridges.flatMap((item) => item.globalProviders.map((provider) => ({
      source: item.source, target: item.bridge, symbol: provider.symbol })));
    assert.deepEqual(sorted(identities), sorted(approved), "Exact consumer set must equal frozen registry relationships");
    assert.deepEqual(sorted(audit.compatibility.consumers.flatMap((item) => item.symbols.map((symbol) =>
      ({ source: item.source, target: item.provider, symbol })))), sorted(approved));
    const transitions = activations.map((item) => {
      const original = baseline.providers.filter((provider) => provider.currentPath === item.sourceProvider && provider.symbol === item.legacySymbol);
      assert.equal(original.length, 1, "Missing exact approved legacy identity");
      assert.equal(original[0].mechanism, "global-lexical");
      assert(bridges.some((bridge) => bridge.bridge === item.sourceProvider && bridge.target === item.targetModule &&
        bridge.globalProviders.some((provider) => provider.symbol === item.legacySymbol && provider.mechanism === "global-this-property")));
      return { source: item.sourceProvider, target: item.targetModule, symbol: item.legacySymbol, activationId: item.id,
        fromMechanism: original[0].mechanism, toMechanism: "global-this-property", approval: "exact-existing-activation-and-consumer-registry" };
    });
    assert.deepEqual(esm.map((item) => item.source).sort(), activations.map((item) => item.targetModule).sort());
    for (const item of esm) {
      assert.equal(item.status, "verified");
      assert.equal(item.hasEsmSyntax, true);
      assert.deepEqual(item.observations, [], "Unexpected ESM dependency");
      assert.deepEqual(item.globalAssignments, []);
      assert.deepEqual(item.globalMemberReads, []);
      assert.deepEqual(item.issues, []);
      assert.deepEqual(item.exports.map((value) => value.kind), ["named"]);
      const target = result.manifest.modules.find((value) => value.currentPath === item.source);
      assert.deepEqual(item.externalIdentifiers, target.observed.environment.builtins);
    }
    const totals = result.manifest.modules.reduce((sum, item) => {
      sum.providers += item.observed.providers.items.length;
      sum.consumers += item.observed.consumers.items.length;
      sum.confirmed += item.analysis.dependencies.confirmed.length;
      sum.unresolved += item.analysis.dependencies.unresolved.length;
      sum.ambiguous += item.analysis.dependencies.ambiguous.length;
      sum.edges += item.analysis.dependencies.items.length;
      for (const group of [item.observed.providers, item.observed.consumers, item.observed.environment, item.analysis.dependencies]) {
        assert.equal(group.status, "verified", "Unverified live observation group");
      }
      return sum;
    }, { modules: result.manifest.modules.length, providers: 0, consumers: 0, confirmed: 0, unresolved: 0, ambiguous: 0, edges: 0 });
    assert.equal(totals.consumers, totals.confirmed + totals.unresolved + totals.ambiguous);
    assert.equal(totals.ambiguous, 0);
    return { manifest: result.manifest, facts: immutableRecord({ manifestTransition: result.transition,
      totals, esm, controlledGlobalTransitions: transitions, derivedIncomingConsumers: relationships,
      guardedConsumers: relationships.filter((item) => item.accessRequirement === "guarded"),
      additionalConsumers: [], dependencyDelta: { confirmedInterFileEdgesBefore: edges(before).length,
        confirmedInterFileEdgesAfter: totals.edges, newlyConfirmedEdges: [], removedEdges: [] },
      transportUnresolved: { count: activations.length, classification: "compatibility-transport-outside-src-project-graph",
        createsProjectDependencyEdge: false },
      removalDependencies: activations.map((item) => ({ activationId: item.id, source: item.sourceProvider,
        consumers: item.consumers, owner: item.owner, removalStage: item.removalStage,
        removalCondition: item.removalCondition, newBridgeApproved: false })) }) };
  }
}

class StageThreeBatch008ObservationContract {
  validate(artifact, expected) {
    assert.deepEqual(artifact, expected, "Reconciliation evidence differs from mechanical replay");
    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.kind, "cyber-fishing-stage-3-batch-008-observation-reconciliation");
    assert.equal(artifact.status, "verified");
    assert.equal(artifact.batchId, PROFILE.batchId);
    assert.equal(artifact.lifecycle.batchCompleted, false);
    assert.equal(artifact.releaseClosureAuthorized, false);
    assert.equal(artifact.verdict, "eligible-for-full-acceptance");
    assert.equal(artifact.nextGate, "stage-3.8.8-full-acceptance-and-browser-smoke");
    assert.equal(artifact.guards.failureCount, 0);
    return immutableRecord(artifact);
  }
}

module.exports = { StageThreeBatch008ObservationReconciliation, StageThreeBatch008ObservationContract };
