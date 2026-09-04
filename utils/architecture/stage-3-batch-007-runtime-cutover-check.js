"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { verifyBatch007ManifestEvidence } = require("./domain_batches/stage_three_batch_007_manifest_transition");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("../build/compat_runtime/activation_shim");
const {
  EXACT_TRANSPORT_GLOBAL,
} = require("../build/compat_runtime/cumulative_runtime_contract");
const {
  StageThreeCompatibilityBuildApplication,
} = require("../build/build_stage_3_compat_runtime");
const {
  StageThreeBatch007CutoverContractValidator,
} = require("./domain_batches/stage_three_batch_007_cutover_contract");
const {
  StageThreeBatch007SourceBuildContractValidator,
} = require("./domain_batches/stage_three_batch_007_source_build_contract");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatch007LifecycleTransition,
} = require("./domain_batches/stage_three_batch_007_lifecycle_transition");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("./migration/stage_three_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ARTIFACT_PATH = "architecture/migration/stage_3_batch_007_runtime_cutover.json";

class StageThreeBatch007RuntimeCutoverCheck {
  async run() {
    const artifact = this.#json(ARTIFACT_PATH);
    const prebuild = this.#json(BATCH_007_PREBUILD_PROFILE.artifactPath);
    const sourceBuild = this.#json(
      "architecture/migration/stage_3_batch_007_source_build_validation.json",
    );
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const lifecycle = new StageThreeBatch007LifecycleTransition();
    lifecycle.assertCurrentContainsBatch(state);
    const completed = lifecycle.isCompleted(state);
    new StageThreeBatch007CutoverContractValidator().validate(artifact);
    new StageThreeBatch007SourceBuildContractValidator().validate(sourceBuild);
    for (const evidence of Object.values(artifact.evidence)) {
      if (evidence.path === "architecture/migration/stage_3_execution_state.json") {
        lifecycle.verifyRuntimeActiveEvidence(this.#bytes(evidence.path), evidence.sha256);
        continue;
      }
      if (evidence.path === "index.html") {
        lifecycle.verifyIndexEvidence(this.#bytes(evidence.path), evidence.sha256);
        continue;
      }
      if (evidence.path === "architecture/migration/module_migration_manifest.json") {
        verifyBatch007ManifestEvidence(this.#bytes(evidence.path), evidence.sha256);
        continue;
      }
      assert.equal(this.#sha256(this.#bytes(evidence.path)), evidence.sha256,
        `Stage 3.7.5 evidence changed: ${evidence.path}`);
    }
    assert.deepEqual(
      state.completedBatchIds.slice(0, BATCH_007_PREBUILD_PROFILE.completedPrefix.length),
      BATCH_007_PREBUILD_PROFILE.completedPrefix,
    );
    if (!completed) {
      assert.equal(state.activeBatchId, BATCH_007_PREBUILD_PROFILE.batchId);
      assert.equal(state.activeBatchPhase, "runtime-active");
      assert.equal(state.releaseVersion, "0.24.43");
    }
    assert.equal(runtime.activationPositions.length, 32);
    assert.equal(registry.bridges.length, 57);
    assert.deepEqual(runtime.activationPositions.map((record) => record.id).sort(),
      prebuild.plannedTopology.activationIds);
    assert.deepEqual(registry.bridges.map((record) => record.id).sort(),
      prebuild.plannedTopology.bridgeIds);
    this.#verifySources({ prebuild, sourceBuild, runtime, registry, manifest });
    this.#verifyScriptTopology(runtime);
    const outputBefore = this.#outputFingerprint(runtime.output.directory);
    const report = await new StageThreeCompatibilityBuildApplication({ projectRoot: PROJECT_ROOT }).run();
    assert.equal(report.status, "built");
    assert.equal(report.moduleCount, 31);
    assert.equal(report.activationCount, 32);
    const builtRuntime = report.outputs.find((record) => record.kind === "cumulative-runtime");
    assert.equal(builtRuntime.sha256, sourceBuild.candidateBuild.runtimeSha256);
    assert.deepEqual(builtRuntime.projectModules, sourceBuild.candidateBuild.projectModules);
    assert.deepEqual(builtRuntime.virtualBuildModules, sourceBuild.candidateBuild.virtualBuildModules);
    assert.equal(this.#outputFingerprint(runtime.output.directory), outputBefore,
      "deterministic rebuild changed validated runtime output");
    await this.#verifyFailurePreservesOutput(runtime.output.directory);
    console.log(
      "Stage 3.7.5 runtime cutover passed: one 31-module graph, 32 exact activations, " +
      "57 bridges, six representation-only shims, exact candidate bytes and atomic output safety.",
    );
  }

  #verifySources({ prebuild, sourceBuild, runtime, registry, manifest }) {
    const entries = new Map(manifest.modules.map((record) => [record.currentPath, record]));
    const ownerActivations = runtime.activationPositions.filter((record) =>
      record.owner === BATCH_007_PREBUILD_PROFILE.batchId);
    const ownerBridges = registry.bridges.filter((record) =>
      record.owner === BATCH_007_PREBUILD_PROFILE.batchId);
    assert.equal(ownerActivations.length, 6);
    assert.equal(ownerBridges.length, 9);
    assert.deepEqual(ownerBridges.map((record) => record.id).sort(),
      prebuild.preliminaryMetadata.plannedBridges.map((record) => record.id).sort());
    for (const source of sourceBuild.sources) {
      const activation = ownerActivations.find((record) =>
        record.sourceProvider === source.currentPath);
      assert(activation);
      const expectedShim = new ActivationShimRenderer().render(activation, EXACT_TRANSPORT_GLOBAL);
      assert.equal(this.#read(source.currentPath), expectedShim);
      assert.equal(this.#read(`${runtime.output.directory}${activation.shimFile}`), expectedShim);
      new ActivationShimContractValidator().validate({ code: expectedShim, activation,
        transportSymbol: EXACT_TRANSPORT_GLOBAL });
      assert.equal(this.#sha256(this.#bytes(source.targetPath)), source.targetSha256);
      assert.equal(this.#read(source.targetPath).includes(EXACT_TRANSPORT_GLOBAL), false);
      assert.deepEqual(entries.get(source.currentPath).architecture.roles,
        ["compatibility-bridge"]);
      const historical = this.#json(ARTIFACT_PATH).evidence.manifestAfterMechanicalObservation.sha256;
      const expectedStatus = verifyBatch007ManifestEvidence(
        this.#bytes("architecture/migration/module_migration_manifest.json"), historical);
      assert.equal(entries.get(source.targetPath).architecture.migrationStatus, expectedStatus);
      assert.deepEqual(entries.get(source.targetPath).architecture.roles,
        ["domain-behavior"]);
      assert.equal(entries.get(source.currentPath).observed.consumers.items.length, 1);
      assert.equal(entries.get(source.currentPath).observed.consumers.items[0].symbol,
        EXACT_TRANSPORT_GLOBAL);
    }
  }

  #verifyScriptTopology(runtime) {
    const html = this.#read("index.html");
    const scripts = [...html.matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    assert.equal(scripts.length, 426);
    assert.equal(scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length, 0);
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(runtime);
    const logical = new LegacyScriptOrderReader(this.#absolute("index.html"),
      { scriptAliases: aliases }).read();
    assert.equal(logical.length, 424);
  }

  async #verifyFailurePreservesOutput(outputDirectory) {
    const before = this.#outputFingerprint(outputDirectory);
    const failing = new StageThreeCompatibilityBuildApplication({
      projectRoot: PROJECT_ROOT,
      viteLoader: async () => ({ build: async () => { throw new Error("fixture-build-failure"); } }),
    });
    await assert.rejects(() => failing.run(), /fixture-build-failure/u);
    assert.equal(this.#outputFingerprint(outputDirectory), before);
  }

  #outputFingerprint(relativeRoot) {
    const root = this.#absolute(relativeRoot);
    const records = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else records.push({ path: path.relative(root, absolute).replaceAll("\\", "/"),
          sha256: this.#sha256(fs.readFileSync(absolute)) });
      }
    };
    walk(root);
    return this.#sha256(Buffer.from(JSON.stringify(records.sort((left, right) =>
      left.path.localeCompare(right.path))), "utf8"));
  }

  #json(relativePath) { return JSON.parse(this.#read(relativePath)); }
  #read(relativePath) { return this.#bytes(relativePath).toString("utf8"); }
  #bytes(relativePath) { return fs.readFileSync(this.#absolute(relativePath)); }
  #absolute(relativePath) { return path.resolve(PROJECT_ROOT, relativePath); }
  #sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
}

new StageThreeBatch007RuntimeCutoverCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
