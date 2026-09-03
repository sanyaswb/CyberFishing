"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StageThreeBatch007ObservationApplication } = require("./finalize-stage-3-batch-007-observations");
const { StageThreeBatch007ObservationReconciliation, StageThreeBatch007ReconciliationValidator } =
  require("./domain_batches/stage_three_batch_007_observation_reconciliation");
const { verifyBatch007ManifestEvidence, manifestBytes } = require("./domain_batches/stage_three_batch_007_manifest_transition");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");

class StageThreeBatch007ObservationFixtures {
  run() {
    const app = new StageThreeBatch007ObservationApplication();
    const before = app.protectedSnapshot({ includeManifest: true, includeArtifact: true });
    const valid = app.prepare();
    const validator = new StageThreeBatch007ReconciliationValidator();
    validator.validate(valid.artifact, valid.artifact);
    let negativeCases = 0;
    const rejectInput = (mutate) => {
      const inputs = structuredClone(valid.inputs);
      mutate(inputs);
      assert.throws(() => new StageThreeBatch007ObservationReconciliation().build(inputs));
      negativeCases += 1;
    };
    rejectInput((value) => value.state.completedBatchIds.push(value.batch.id));
    rejectInput((value) => value.state.activeBatchPhase = "prebuild");
    rejectInput((value) => value.observedManifest.modules.pop());
    rejectInput((value) => value.registry.bridges.push(value.registry.bridges.at(-1)));
    rejectInput((value) => value.registry.bridges.pop());
    rejectInput((value) => value.runtime.activationPositions.pop());
    rejectInput((value) => value.fallback.diResultsEqual = false);
    rejectInput((value) => value.fallback.standaloneAddedRows.push("unapproved-third-row"));
    rejectInput((value) => delete value.fallbackReview);
    rejectInput((value) => value.fallbackReview.status = "pending-user-review");
    rejectInput((value) => value.fallbackReview.productionDIBehaviorChanged = true);
    rejectInput((value) => value.fallbackReview.gameplaySemanticsChanged = true);
    rejectInput((value) => value.fallbackReview.scope = "all UI");
    rejectInput((value) => value.fallbackReview.authorizesBatchCompletion = true);
    rejectInput((value) => value.fallbackReview.removalDependencyRetained = false);
    rejectInput((value) => value.fallbackReview.observedBehaviorSha256 = "0".repeat(64));
    rejectInput((value) => value.fallbackReview.evidence.calculatorTarget.sha256 = "0".repeat(64));
    rejectInput((value) => value.fallbackReview.additionalTooltipRows.push("unapproved-third-row"));
    rejectInput((value) => value.historicalRepair.releaseNotesRewritten = true);
    rejectInput((value) => value.fallback.regressionCases[0].afterSha256 = "0".repeat(64));
    rejectInput((value) => value.fallback.regressionCases[1].existingRowsAndSectionsUnchanged = false);
    rejectInput((value) => value.baseline.providers = []);
    rejectInput((value) => value.batch.externalLegacyConsumers.pop());
    const source = valid.inputs.batch.modules[0].currentPath;
    rejectInput((value) => value.observedManifest.modules.find((item) => item.currentPath === source)
      .observed.providers.items[0].mechanism = "global-lexical");
    rejectInput((value) => value.observedManifest.modules.find((item) => item.currentPath === source)
      .analysis.dependencies.unresolved = []);
    rejectInput((value) => value.observedManifest.modules[0].analysis.dependencies.ambiguous.push({ symbol: "Speculative" }));
    rejectInput((value) => value.observedManifest.modules[0].analysis.dependencies.items.push({ target: source }));

    for (const mutate of [
      (value) => value.evidence.live.sha256 = "0".repeat(64),
      (value) => value.releaseGate.status = "blocked",
      (value) => value.releaseGate.authorizesReleaseClosure = true,
      (value) => value.derivedIncomingConsumers.pop(),
      (value) => value.additionalGuardedConsumer.accessRequirement = "required",
      (value) => value.removalDependencies = [],
      (value) => value.removalDependencies[0].removalStage = "never",
      (value) => value.controlledGlobalTransitions.pop(),
      (value) => value.controlledGlobalTransitions[0].toMechanism = "implicit-global",
    ]) {
      const changed = structuredClone(valid.artifact);
      mutate(changed);
      assert.throws(() => validator.validate(changed, valid.artifact));
      negativeCases += 1;
    }
    assert.throws(() => { valid.artifact.lifecycle.batchCompleted = true; }, TypeError);
    validator.assertAcceptanceAllowed(valid.artifact);
    assert.throws(() => validator.assertReleaseAllowed(valid.artifact), /Release blocked/u);
    const unapproved = structuredClone(valid.artifact);
    unapproved.semanticReview.status = "pending-user-review";
    assert.throws(() => validator.assertAcceptanceAllowed(unapproved), /explicitly approved/u);
    for (const mutate of [
      (record) => record.source.blob = "0".repeat(40),
      (record) => record.restoredSha256 = "0".repeat(64),
      (record) => record.beforeByteLength -= 1,
      (record) => record.releaseNotesRewritten = true,
      (record) => record.restoredLineCount += 1,
    ]) {
      const corruptedRepair = structuredClone(valid.inputs.historicalRepair);
      mutate(corruptedRepair);
      assert.throws(() => app.verifyHistoricalRepair(corruptedRepair));
      negativeCases += 1;
    }
    assert.throws(() => validator.assertActivationRemovalAllowed(valid.artifact, valid.manifest,
      valid.artifact.removalDependencies[0].activationId), /Activation removal blocked/u);
    const removed = structuredClone(valid.manifest);
    const removal = valid.artifact.removalDependencies[0];
    removed.modules.find((item) => item.currentPath === removal.source).observed.consumers.items = [];
    validator.assertActivationRemovalAllowed(valid.artifact, removed, removal.activationId);
    const partial = structuredClone(removed);
    partial.modules.find((item) => item.currentPath === removal.source).observed.consumers.status = "partial";
    assert.throws(() => validator.assertActivationRemovalAllowed(valid.artifact, partial,
      removal.activationId), /verified consumer/u);
    const changedMechanism = structuredClone(valid.manifest);
    changedMechanism.modules.find((item) => item.currentPath === removal.source).observed.consumers.items
      .find((item) => item.symbol === removal.symbol).mechanism = "identifier";
    assert.throws(() => validator.assertActivationRemovalAllowed(valid.artifact, changedMechanism,
      removal.activationId), /Activation removal blocked/u);

    const historicalSha = valid.artifact.historicalManifestSha256;
    assert.equal(verifyBatch007ManifestEvidence(manifestBytes(valid.manifest), historicalSha), "verified");
    assert.throws(() => verifyBatch007ManifestEvidence(Buffer.from(JSON.stringify(valid.manifest)), historicalSha));
    const reversed = structuredClone(valid.manifest);
    for (const target of valid.artifact.metadataTransition.targets) {
      reversed.modules.find((item) => item.currentPath === target).architecture.migrationStatus = "esm";
    }
    assert.equal(verifyBatch007ManifestEvidence(manifestBytes(reversed), historicalSha), "esm");
    reversed.modules.find((item) => item.currentPath === valid.artifact.metadataTransition.targets[0])
      .architecture.migrationStatus = "verified";
    assert.throws(() => verifyBatch007ManifestEvidence(manifestBytes(reversed), historicalSha));
    const unauthorized = structuredClone(valid.manifest);
    unauthorized.modules[0].architecture.roles.push("unauthorized");
    assert.throws(() => verifyBatch007ManifestEvidence(manifestBytes(unauthorized), historicalSha));
    const changedFact = structuredClone(valid.manifest);
    changedFact.modules[0].analysis.dependencies.confirmed = [];
    changedFact.modules[0].analysis.dependencies.unresolved.push({ symbol: "invented" });
    assert.throws(() => verifyBatch007ManifestEvidence(manifestBytes(changedFact), historicalSha));
    this.#transactionFixtures(valid);
    assert.deepEqual(app.protectedSnapshot({ includeManifest: true, includeArtifact: true }), before);
    console.log(`Stage 3.7.7 fixtures passed: ${negativeCases} input/evidence mutations rejected; ` +
      "exact status-only history, mutation protection, removal/release blocks and transaction rollback verified.");
  }

  #transactionFixtures(valid) {
    const parent = path.resolve(os.tmpdir());
    const root = fs.mkdtempSync(path.join(parent, "cyber-fishing-reconcile-007-"));
    try {
      const original = manifestBytes(valid.inputs.manifest);
      fs.writeFileSync(path.join(root, "manifest.json"), original);
      const writes = [{ relativePath: "manifest.json", bytes: manifestBytes(valid.manifest) },
        { relativePath: "evidence.json", bytes: manifestBytes(valid.artifact) }];
      for (const boundary of ["after-staging:0", "after-replacement:1", "after-replacement:2",
        "after-final-validation:2", "validator"]) {
        const transaction = new ControlledMetadataTransaction({ projectRoot: root,
          failureInjector: ({ phase, count }) => {
            if (`${phase}:${count}` === boundary) throw new Error("injected-transaction-failure");
          } });
        assert.throws(() => transaction.commit(writes, () => {
          if (boundary === "validator") throw new Error("injected-validator-failure");
        }), /injected/u);
        assert.deepEqual(fs.readFileSync(path.join(root, "manifest.json")), original);
        assert.deepEqual(fs.readdirSync(root), ["manifest.json"]);
      }
      new ControlledMetadataTransaction({ projectRoot: root }).commit(writes, () => {});
      assert.deepEqual(fs.readFileSync(path.join(root, "manifest.json")), manifestBytes(valid.manifest));
    } finally {
      const resolved = path.resolve(root);
      assert.equal(path.dirname(resolved), parent);
      assert(path.basename(resolved).startsWith("cyber-fishing-reconcile-007-"));
      assert.notEqual(resolved, parent);
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

new StageThreeBatch007ObservationFixtures().run();
