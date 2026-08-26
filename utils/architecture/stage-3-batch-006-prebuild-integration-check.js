"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  CumulativeRuntimeContractValidator,
} = require("../build/compat_runtime/cumulative_runtime_contract");
const {
  MigrationBridgeRegistryValidator,
} = require("./guards/contracts/guard_artifact_repository");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch006PrebuildIntegrationCheck {
  run() {
    const artifact = this.#json("architecture/migration/stage_3_batch_006_prebuild_contract.json");
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    new StageThreeBatchPrebuildContractValidator().validate(artifact);
    new CumulativeRuntimeContractValidator().validate(runtime);
    new MigrationBridgeRegistryValidator().validate(registry);
    assert.equal(state.compatibilityRuntimeActivated, true);
    const cutoverStarted = state.activeBatchPhase === "runtime-active" ||
      state.completedBatchIds.includes(artifact.batchId);
    if (cutoverStarted) {
      assert.equal(
        state.activeBatchId === artifact.batchId ||
          state.completedBatchIds.includes(artifact.batchId),
        true,
      );
      assert.deepEqual(
        runtime.activationPositions.filter((record) => record.owner === artifact.batchId),
        artifact.preliminaryMetadata.plannedActivationPositions,
      );
      assert.deepEqual(
        registry.bridges.filter((record) => record.owner === artifact.batchId),
        artifact.preliminaryMetadata.plannedBridges,
      );
      assert.equal(runtime.plannedActivationPositions, undefined);
      assert.equal(registry.plannedBridges, undefined);
      for (const target of artifact.preliminaryMetadata.targets) {
        assert.equal(fs.existsSync(path.join(PROJECT_ROOT, target.targetPath)), true);
        const entry = manifest.modules.find((record) =>
          record.currentPath === target.targetPath);
        assert.equal(entry?.architecture?.migrationStatus, "verified");
      }
    } else {
      assert.deepEqual(state.completedBatchIds, artifact.lifecycle.completedBatchIds);
      assert.equal(state.activeBatchId, artifact.batchId);
      assert.equal(state.activeBatchPhase, "prebuild");
      assert.deepEqual(manifest.preliminaryMigration.targets, artifact.preliminaryMetadata.targets);
      assert.equal(manifest.preliminaryMigration.observationsFinal, false);
      assert.deepEqual(runtime.plannedActivationPositions, artifact.preliminaryMetadata.plannedActivationPositions);
      assert.deepEqual(registry.plannedBridges, artifact.preliminaryMetadata.plannedBridges);
      assert.equal(runtime.activationPositions.length, artifact.activeRuntimeTopology.activationCount);
      assert.equal(registry.bridges.length, 41);
      for (const target of artifact.preliminaryMetadata.targets) {
        assert.equal(fs.existsSync(path.join(PROJECT_ROOT, target.targetPath)), false);
        assert.equal(this.#sha256(this.#bytes(target.currentPath)), target.sourceSha256);
      }
    }
    assert.equal(this.#scriptSources().filter((source) => source.includes("stage-3-compat-runtime/compat_runtime.iife.js")).length, 1);
    assert.equal(this.#scriptSources().length, artifact.activeRuntimeTopology.physicalClassicScriptCount);
    assert.equal(this.#bytes("index.html").includes(Buffer.from('type="module"')), false);
    console.log(
      `Stage 3.6.4 prebuild integration passed: exact 6-target/6-activation/7-consumer evidence remains valid${cutoverStarted ? " after atomic cutover" : " with batch 006 open and runtime unchanged"}.`,
    );
  }

  #scriptSources() {
    const html = this.#bytes("index.html").toString("utf8");
    return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/giu)]
      .map((match) => match[1].split("?")[0]);
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

new StageThreeBatch006PrebuildIntegrationCheck().run();
