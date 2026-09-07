"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const canonical = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const PREFIX = "architecture/migration/";
const cache = new Map();
const CONTROLLED_INPUTS = new Set([
  `${PREFIX}stage_3_execution_state.json`, `${PREFIX}stage_3_compatibility_runtime.json`,
  `${PREFIX}module_migration_manifest.json`, "architecture/guards/migration_bridge_registry.json",
  "architecture/build/package_contract.json", "index.html",
  ...PROFILE.executionProfile.expectedTargets.map((item) => item.currentPath),
]);

// Explicit historical view, never a live-runtime source of truth. Every reversed
// file must reproduce a previously frozen SHA; no wildcard or ignored evidence.
class Batch008CutoverHistory {
  constructor(root) { this.root = path.resolve(root); }
  read(relative) { return fs.readFileSync(path.join(this.root, relative)); }
  json(relative) { return JSON.parse(this.read(relative)); }
  active() {
    const { beforeBatch008Release } = require("./stage_three_batch_008_release_transition");
    const state = JSON.parse(beforeBatch008Release(`${PREFIX}stage_3_execution_state.json`, this.read(`${PREFIX}stage_3_execution_state.json`), this.root));
    return state.activeBatchId === PROFILE.batchId && state.activeBatchPhase === "runtime-active";
  }
  before(relative, provided) {
    const { beforeBatch008Release } = require("./stage_three_batch_008_release_transition");
    let bytes = beforeBatch008Release(relative, provided === undefined ? this.read(relative) : Buffer.from(provided), this.root);
    if (!CONTROLLED_INPUTS.has(relative) && !relative.startsWith("dist/stage-3-compat-runtime/")) return bytes;
    if (!this.active()) return bytes;
    const evidence = this.json(`${PREFIX}stage_3_batch_008_source_build_validation.json`);
    const prebuild = this.json(PROFILE.artifactPath);
    const cutover = this.json(`${PREFIX}stage_3_batch_008_runtime_cutover.json`);
    const entry = cutover.writes.find((item) => item.path === relative);
    if (!entry || entry.beforeSha256 === null) return bytes;
    if (hash(bytes) === entry.beforeSha256) return bytes;
    if (relative === `${PREFIX}module_migration_manifest.json` && hash(bytes) !== entry.afterSha256) {
      const { beforeBatch008Observations } = require("./stage_three_batch_008_observation_transition");
      bytes = beforeBatch008Observations(bytes, this.root);
    }
    assert.equal(hash(bytes), entry.afterSha256, `Live cutover file changed: ${relative}`);
    let restored;
    if (relative.startsWith("dist/stage-3-compat-runtime/")) {
      restored = Buffer.from(this.historicalBuild().files[relative], "base64");
    } else if (relative === `${PREFIX}stage_3_execution_state.json`) {
      const state = JSON.parse(bytes); state.activeBatchPhase = "prebuild"; restored = canonical(state);
    } else if (relative === `${PREFIX}stage_3_compatibility_runtime.json`) {
      const value = JSON.parse(bytes);
      const ids = new Set(prebuild.preliminaryMetadata.plannedActivationPositions.map((item) => item.id));
      assert.deepEqual(value.activationPositions.filter((item) => ids.has(item.id)), prebuild.preliminaryMetadata.plannedActivationPositions);
      value.activationPositions = value.activationPositions.filter((item) => !ids.has(item.id)); restored = canonical(value);
    } else if (relative === "architecture/guards/migration_bridge_registry.json") {
      const value = JSON.parse(bytes);
      const ids = new Set(prebuild.preliminaryMetadata.plannedBridges.map((item) => item.id));
      assert.deepEqual(value.bridges.filter((item) => ids.has(item.id)), prebuild.preliminaryMetadata.plannedBridges);
      value.bridges = value.bridges.filter((item) => !ids.has(item.id)); restored = canonical(value);
    } else if (relative === `${PREFIX}module_migration_manifest.json`) {
      const value = JSON.parse(bytes);
      const previous = new Map(cutover.manifestTransition.previousProviders.map((item) => [item.currentPath, item]));
      value.modules = value.modules.map((item) => previous.get(item.currentPath) || item);
      restored = canonical(value);
      assert.equal(hash(restored), evidence.manifestTransition.afterSha256);
    } else if (relative === "architecture/build/package_contract.json") {
      const value = JSON.parse(bytes);
      assert.equal(value.stage.current, "3.8");
      assert.equal(value.stage.cumulativeRuntimeBuild.runtimeInputs, prebuild.plannedTopology.counts.modules);
      assert.equal(value.stage.cumulativeRuntimeBuild.activationInputs, prebuild.plannedTopology.counts.activations);
      value.stage.current = "3.7";
      value.stage.cumulativeRuntimeBuild.runtimeInputs = prebuild.activeTopology.counts.modules;
      value.stage.cumulativeRuntimeBuild.activationInputs = prebuild.activeTopology.counts.activations;
      restored = canonical(value);
    } else if (relative === "index.html") {
      let html = bytes.toString("utf8");
      const runtime = JSON.parse(this.before(`${PREFIX}stage_3_compatibility_runtime.json`));
      for (const activation of prebuild.preliminaryMetadata.plannedActivationPositions) {
        const marker = `src="${runtime.output.directory}${activation.shimFile}"`;
        assert.equal(html.split(marker).length - 1, 1);
        html = html.replace(marker, `src="${activation.sourceProvider}"`);
      }
      restored = Buffer.from(html);
    } else {
      const source = evidence.sources.find((item) => item.currentPath === relative);
      assert(source, `Unapproved historical reversal: ${relative}`);
      const target = this.read(source.targetPath);
      assert.equal(hash(target), source.targetSha256);
      restored = Buffer.from(target.toString("utf8").replace(`export class ${source.exportName}`, `class ${source.exportName}`));
      assert.equal(hash(restored), source.sourceSha256);
    }
    assert.equal(hash(restored), entry.beforeSha256, `Cutover delta does not reverse exactly: ${relative}`);
    const frozen = evidence.evidence && Object.values(evidence.evidence).find((item) => item.path === relative);
    if (frozen) assert.equal(hash(restored), frozen.sha256);
    return restored;
  }
  historicalBuild() {
    const key = `${this.root}:${hash(this.read(`${PREFIX}stage_3_batch_008_source_build_validation.json`))}`;
    if (!cache.has(key)) {
      const result = spawnSync(process.execPath, [path.resolve(__dirname, "../replay-stage-3-batch-008-precutover-build.js"), this.root],
        { cwd: this.root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, shell: false });
      assert.equal(result.status, 0, `Historical isolated build failed: ${result.stderr}`);
      cache.set(key, JSON.parse(result.stdout));
    }
    return cache.get(key);
  }
}
function historicalCutoverBytes(relative, bytes, root = path.resolve(__dirname, "../../..")) {
  return new Batch008CutoverHistory(root).before(relative, bytes);
}
module.exports = { Batch008CutoverHistory, historicalCutoverBytes };
