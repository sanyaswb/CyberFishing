"use strict";

const assert = require("node:assert/strict");
const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_007_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const { FALLBACK_SOURCE, FALLBACK_TARGET } = require("./stage_three_batch_007_fallback_probe");
const { manifestBytes, sha256, verifyBatch007ManifestEvidence } = require("./stage_three_batch_007_manifest_transition");
const { StageThreeBatch007FallbackReviewValidator } = require("./stage_three_batch_007_fallback_review");

const sort = (records) => [...records].sort((a, b) => {
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
});
const relationship = (source, target, symbol) => ({ source, target, symbol });

class StageThreeBatch007ObservationReconciliation {
  build({ manifest, observedManifest, batch, runtime, registry, baseline, state,
    prebuild, cutover, fallback, fallbackReview, historicalRepair, evidence }) {
    assert.equal(batch.id, PROFILE.batchId);
    assert.equal(batch.status, "approved-frozen");
    assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
    assert.equal(state.activeBatchId, batch.id);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.releaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.deepEqual(observedManifest, manifest,
      "Mechanical observations changed beyond reviewed cutover; do not auto-approve new facts");
    const historicalSha = cutover.evidence.manifestAfterMechanicalObservation.sha256;
    verifyBatch007ManifestEvidence(manifestBytes(manifest), historicalSha);
    const next = structuredClone(observedManifest);
    const entries = new Map(next.modules.map((entry) => [entry.currentPath, entry]));
    const activations = runtime.activationPositions.filter((item) => item.owner === batch.id);
    const bridges = registry.bridges.filter((item) => item.owner === batch.id);
    assert.deepEqual(sort(bridges), sort(prebuild.preliminaryMetadata.plannedBridges),
      "bridge records must match exact frozen records, not merely their count");
    assert.deepEqual(activations.map((item) => item.id).sort(),
      prebuild.preliminaryMetadata.plannedActivationPositions.map((item) => item.id).sort());
    assert.deepEqual(registry.bridges.map((item) => item.id).sort(), prebuild.plannedTopology.bridgeIds);
    assert.deepEqual(runtime.activationPositions.map((item) => item.id).sort(), prebuild.plannedTopology.activationIds);
    assert.equal(activations.length, batch.modules.length);
    const transport = runtime.transport.symbol;
    assert.equal(typeof transport, "string");
    const transitions = [];
    for (const module of batch.modules) {
      const source = entries.get(module.currentPath);
      const target = entries.get(module.targetPath);
      assert(source && target, "missing exact source/target pair");
      const activation = activations.find((item) => item.sourceProvider === module.currentPath);
      assert(activation, "missing exact activation");
      assert.equal(activation.targetModule, module.targetPath);
      assert.deepEqual(source.architecture.roles, ["compatibility-bridge"]);
      assert.equal(source.architecture.targetPath, module.targetPath);
      assert.equal(source.observed.legacyLoadOrder, activation.legacyScriptIndex);
      assert.deepEqual(source.observed.providers, { status: "verified", items: [{
        symbol: activation.legacySymbol, mechanism: "global-this-property", availability: "program-init",
      }], issues: [] });
      const consumer = { symbol: transport, mechanism: "global-this-property",
        accessRequirement: "required", executionPhase: "eager" };
      assert.deepEqual(source.observed.consumers, { status: "verified", items: [consumer], issues: [] });
      assert.deepEqual(source.analysis.dependencies, { status: "verified", confirmed: [], items: [],
        unresolved: [{ ...consumer, resolution: "unresolved" }], ambiguous: [], issues: [] });
      assert.equal(target.architecture.targetBoundary, "game-domain");
      assert.equal(target.architecture.targetPath, module.targetPath);
      assert.deepEqual(target.architecture.roles, module.roles);
      assert.equal(target.observed.legacyLoadOrder, null);
      for (const group of [target.observed.providers, target.observed.consumers]) {
        assert.deepEqual(group, { status: "verified", items: [], issues: [] });
      }
      assert.deepEqual(target.analysis.dependencies, { status: "verified", confirmed: [], items: [],
        unresolved: [], ambiguous: [], issues: [] });
      assert.equal(target.observed.environment.status, "verified");
      for (const field of ["browserApis", "dynamicConstructs", "issues"]) {
        assert.deepEqual(target.observed.environment[field], []);
      }
      const original = baseline.providers.filter((item) => item.currentPath === module.currentPath &&
        item.symbol === activation.legacySymbol);
      assert.equal(original.length, 1);
      assert.equal(original[0].mechanism, "global-lexical");
      assert(bridges.some((item) => item.bridge === module.currentPath &&
        item.target === module.targetPath && item.globalProviders.some((provider) =>
          provider.symbol === activation.legacySymbol && provider.mechanism === "global-this-property")));
      target.architecture.migrationStatus = "verified";
      transitions.push({ source: module.currentPath, target: module.targetPath,
        symbol: activation.legacySymbol, activationId: activation.id,
        fromMechanism: original[0].mechanism, toMechanism: "global-this-property" });
    }
    verifyBatch007ManifestEvidence(manifestBytes(next), historicalSha);
    const expected = batch.externalLegacyConsumers.flatMap((item) => item.symbols.map((symbol) =>
      relationship(item.source, item.provider, symbol)));
    const registered = bridges.flatMap((item) => item.globalProviders.map((provider) =>
      relationship(item.source, item.bridge, provider.symbol)));
    assert.deepEqual(sort(registered), sort(expected));
    const providers = new Set(batch.modules.map((item) => item.currentPath));
    const incoming = next.modules.flatMap((item) => item.analysis.dependencies.confirmed
      .filter((fact) => providers.has(fact.target)).map((fact) => ({ source: item.currentPath, ...fact })));
    const optional = incoming.filter((item) => item.source === FALLBACK_SOURCE);
    assert.equal(optional.length, 1);
    const activation = activations.find((item) => item.sourceProvider === FALLBACK_TARGET);
    assert.deepEqual(optional[0], { source: FALLBACK_SOURCE, symbol: activation.legacySymbol,
      mechanism: "global-this-property", accessRequirement: "guarded", executionPhase: "deferred",
      target: FALLBACK_TARGET, resolution: "confirmed" });
    assert.equal(cutover.dependencyObservation.confirmedEdgeDelta, 1);
    assert.equal(cutover.dependencyObservation.confirmedInterFileEdgesAfter -
      cutover.dependencyObservation.confirmedInterFileEdgesBefore, 1);
    assert.deepEqual(cutover.dependencyObservation.newlyConfirmedEdges.map((item) => ({
      source: item.source, target: item.target, symbols: item.symbols,
    })), [{ source: FALLBACK_SOURCE, target: FALLBACK_TARGET, symbols: [activation.legacySymbol] }]);
    assert.deepEqual(sort(incoming.map((item) => relationship(item.source, item.target, item.symbol))),
      sort([...expected, relationship(FALLBACK_SOURCE, FALLBACK_TARGET, activation.legacySymbol)]),
      "derived consumer set must equal frozen relationships plus exact reviewed fallback observation");
    const totals = next.modules.reduce((acc, item) => {
      const deps = item.analysis.dependencies;
      acc.providers += item.observed.providers.items.length;
      acc.consumers += item.observed.consumers.items.length;
      acc.confirmed += deps.confirmed.length;
      acc.unresolved += deps.unresolved.length;
      acc.ambiguous += deps.ambiguous.length;
      acc.edges += deps.items.length;
      return acc;
    }, { modules: next.modules.length, providers: 0, consumers: 0, confirmed: 0,
      unresolved: 0, ambiguous: 0, edges: 0 });
    assert.equal(totals.edges, cutover.dependencyObservation.confirmedInterFileEdgesAfter);
    assert.equal(totals.ambiguous, 0);
    assert.equal(totals.consumers, totals.confirmed + totals.unresolved + totals.ambiguous);
    new StageThreeBatch007FallbackReviewValidator().validate({ review: fallbackReview, fallback, activation, evidence });
    assert.equal(historicalRepair.status, "exact-restoration-verified");
    assert.equal(historicalRepair.restoredSha256, evidence.changelog.sha256);
    assert.equal(historicalRepair.operation, "restore-deleted-suffix-only");
    assert.equal(historicalRepair.retainedPrefixUnchanged, true);
    assert.equal(historicalRepair.releaseNotesRewritten, false);
    const artifact = immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-observation-reconciliation",
      status: "verified",
      batchId: batch.id,
      releaseVersion: state.releaseVersion,
      evidence: { ...evidence, manifest: { path: "architecture/migration/module_migration_manifest.json",
        sha256: sha256(manifestBytes(next)) } },
      historicalManifestSha256: historicalSha,
      metadataTransition: { field: "architecture.migrationStatus", from: "esm", to: "verified",
        targets: batch.modules.map((item) => item.targetPath).sort() },
      totals,
      cutoverDependencyDelta: cutover.dependencyObservation,
      transportUnresolved: { batch: batch.modules.length, elsewhere: totals.unresolved - batch.modules.length,
        isProjectEdge: false },
      controlledGlobalTransitions: sort(transitions),
      frozenBridgeRelationships: sort(registered),
      derivedIncomingConsumers: sort(incoming),
      additionalGuardedConsumer: { classification: "guarded-optional-fallback-consumer", ...optional[0] },
      removalDependencies: [{ ...optional[0], activationId: activation.id, owner: batch.id,
        removalStage: activation.removalStage,
        sourceSha256: evidence.fallbackSource.sha256,
        condition: "Remove the global fallback through reviewed explicit DI and rerun consumer/behavior checks before removing this activation.",
        autoBridgeApproval: false }],
      fallback,
      semanticReview: fallbackReview,
      historicalRepair,
      lifecycle: { activeBatchId: state.activeBatchId, activeBatchPhase: state.activeBatchPhase,
        completedBatchIds: state.completedBatchIds, batchCompleted: false },
      releaseGate: { status: "approved", scope: "stage-3.7.7-reconciliation-only",
        decisionId: fallbackReview.id, authorizesReleaseClosure: false },
      nextGate: "stage-3.7.8-full-acceptance-and-browser-smoke",
    });
    return { manifest: next, artifact };
  }
}

class StageThreeBatch007ReconciliationValidator {
  validate(artifact, expected) {
    assert.deepEqual(artifact, expected, "Reconciliation evidence is stale or altered");
    this.assertAcceptanceAllowed(artifact);
    assert.equal(artifact.lifecycle.batchCompleted, false);
  }

  assertAcceptanceAllowed(artifact) {
    assert.equal(artifact.status, "verified");
    assert.deepEqual(artifact.releaseGate, { status: "approved", scope: "stage-3.7.7-reconciliation-only",
      decisionId: artifact.semanticReview?.id, authorizesReleaseClosure: false });
    const transition = artifact.controlledGlobalTransitions.find((item) => item.source === FALLBACK_TARGET);
    const removal = artifact.removalDependencies.find((item) => item.activationId === transition?.activationId);
    assert(transition && removal, "Reviewed fallback must retain its exact activation removal dependency");
    new StageThreeBatch007FallbackReviewValidator().validate({ review: artifact.semanticReview,
      fallback: artifact.fallback, evidence: artifact.evidence,
      activation: { targetModule: transition.target,
        legacySymbol: transition.symbol, id: transition.activationId, removalStage: removal.removalStage } });
    assert.equal(artifact.lifecycle.batchCompleted, false);
    assert.equal(artifact.nextGate, "stage-3.7.8-full-acceptance-and-browser-smoke");
  }

  assertReleaseAllowed() {
    throw new Error("Release blocked: Stage 3.7.8 acceptance and Stage 3.7.9 closure are still required");
  }

  assertActivationRemovalAllowed(artifact, manifest, activationId) {
    for (const dependency of artifact.removalDependencies.filter((item) => item.activationId === activationId)) {
      const consumer = manifest.modules.find((item) => item.currentPath === dependency.source);
      assert(consumer, "missing removal dependency consumer");
      assert.equal(consumer.observed.consumers.status, "verified", "Removal requires verified consumer analysis");
      assert.deepEqual(consumer.observed.environment.dynamicConstructs, [], "Dynamic consumer requires removal review");
      assert(!consumer.observed.consumers.items.some((item) => item.symbol === dependency.symbol),
        "Activation removal blocked by live guarded fallback");
    }
  }
}

module.exports = { StageThreeBatch007ObservationReconciliation, StageThreeBatch007ReconciliationValidator };
