"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch007PrebuildIntegrationCheck {
  run() {
    const artifact = this.#json(BATCH_007_PREBUILD_PROFILE.artifactPath);
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const plan = this.#json(BATCH_007_PREBUILD_PROFILE.executionProfile.executionPlanPath);
    new StageThreeBatchPrebuildContractValidator(BATCH_007_PREBUILD_PROFILE).validate(artifact);

    assert.deepEqual(state.completedBatchIds, BATCH_007_PREBUILD_PROFILE.completedPrefix);
    assert.equal(state.activeBatchId, BATCH_007_PREBUILD_PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "prebuild");
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.equal(manifest.preliminaryMigration, undefined);
    assert.equal(runtime.plannedActivationPositions, undefined);
    assert.equal(registry.plannedBridges, undefined);
    assert.equal(runtime.activationPositions.length, 26);
    assert.equal(registry.bridges.length, 48);
    assert.equal(artifact.activeTopology.counts.modules, 25);
    assert.equal(artifact.plannedDelta.counts.modules, 6);
    assert.equal(artifact.plannedDelta.counts.activations, 6);
    assert.equal(artifact.plannedDelta.counts.bridges, 9);
    assert.equal(artifact.plannedTopology.counts.modules, 31);
    assert.equal(artifact.plannedTopology.counts.activations, 32);
    assert.equal(artifact.plannedTopology.counts.bridges, 57);

    for (const [key, relativePath] of [
      ["audit", BATCH_007_PREBUILD_PROFILE.executionProfile.auditPath],
      ["executionPlan", BATCH_007_PREBUILD_PROFILE.executionProfile.executionPlanPath],
      ["testMatrix", BATCH_007_PREBUILD_PROFILE.executionProfile.testMatrixPath],
      ["manifestBefore", "architecture/migration/module_migration_manifest.json"],
      ["runtimeContractBefore", "architecture/migration/stage_3_compatibility_runtime.json"],
      ["bridgeRegistryBefore", "architecture/guards/migration_bridge_registry.json"],
    ]) {
      assert.equal(this.#sha256(this.#bytes(relativePath)), artifact.evidence[key].sha256,
        `${relativePath} changed during prebuild open`);
    }
    assert.deepEqual(
      artifact.activeTopology.activationIds,
      runtime.activationPositions.map((record) => record.id).sort(),
      "active activation identity set differs from runtime truth",
    );
    assert.deepEqual(
      artifact.activeTopology.bridgeIds,
      registry.bridges.map((record) => record.id).sort(),
      "active bridge identity set differs from registry truth",
    );
    for (const target of artifact.preliminaryMetadata.targets) {
      assert.equal(fs.existsSync(this.#absolute(target.targetPath)), false);
      assert.equal(this.#sha256(this.#bytes(target.currentPath)), target.sourceSha256);
    }
    const manifestPaths = manifest.modules.map((record) => record.currentPath).sort();
    assert.deepEqual(manifestPaths, this.#sourceFiles(), "Manifest/file equality changed");
    const html = this.#bytes("index.html").toString("utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/giu)];
    assert.equal(scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length, 0);
    assert.equal(scripts.length, plan.scriptTopology.before.physicalClassicScriptCount);
    assert.equal(this.#sha256(this.#bytes("index.html")),
      plan.rollback.baselineEvidence.files.find((record) => record.path === "index.html").sha256);
    assert.deepEqual(this.#runtimeOutputEvidence(), plan.rollback.baselineEvidence.runtimeOutput.files);
    console.log(
      "Stage 3.7.3 prebuild integration passed: batch 007 is open in prebuild phase; active runtime remains 25 modules / 26 activations / 48 bridges, planned delta is +6/+6/+9, zero targets exist and all executable bytes remain frozen.",
    );
  }

  #runtimeOutputEvidence() {
    const root = this.#absolute("dist/stage-3-compat-runtime");
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    return walk(root).map((absolutePath) => ({
      path: path.relative(PROJECT_ROOT, absolutePath).replaceAll("\\", "/"),
      sha256: this.#sha256(fs.readFileSync(absolutePath)),
    })).sort((left, right) => left.path.localeCompare(right.path));
  }

  #sourceFiles() {
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : (entry.name.endsWith(".js") ? [item] : []);
      });
    return walk(this.#absolute("src"))
      .map((item) => path.relative(PROJECT_ROOT, item).replaceAll("\\", "/"))
      .sort();
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

new StageThreeBatch007PrebuildIntegrationCheck().run();
