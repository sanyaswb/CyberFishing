"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const CUTOVER = "architecture/migration/stage_3_batch_009_runtime_cutover.json";
const STATE = "architecture/migration/stage_3_execution_state.json";
const BATCH = "stage-3.candidate-009-fish-444e8034";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const cache = new Map();

// Exact before-images are evidence for historical readers, never active runtime inputs.
class Batch009CutoverHistory {
  constructor(root) { this.root = path.resolve(root); }
  raw(file) { return fs.readFileSync(path.join(this.root, file)); }
  exists() { return fs.existsSync(path.join(this.root, CUTOVER)); }
  active() {
    if (!this.exists()) return false;
    const state = JSON.parse(this.raw(STATE));
    return state.activeBatchId === BATCH && state.activeBatchPhase === "runtime-active";
  }
  artifact() {
    const dependencies=[CUTOVER,"architecture/migration/stage_3_batch_009_prebuild_contract.json","architecture/migration/stage_3_batch_009_source_build_validation.json"];
    const signature=dependencies.map(f=>{const s=fs.statSync(path.join(this.root,f));return `${s.size}:${s.mtimeMs}:${s.ctimeMs}`;}).join("|");
    if(cache.get(this.root)?.signature===signature)return cache.get(this.root).artifact;
    const a = JSON.parse(this.raw(CUTOVER));
    assert.equal(a.schemaVersion, 3); assert.equal(a.batchId, BATCH);
    const pre = JSON.parse(this.raw(a.evidence.prebuild.path));
    assert.equal(hash(this.raw(a.evidence.prebuild.path)), a.evidence.prebuild.sha256);
    assert.equal(hash(this.raw(a.evidence.sourceBuild.path)), a.evidence.sourceBuild.sha256);
    assert.deepEqual(a.topology,pre.plannedTopology);
    assert.deepEqual(a.manifestTransition.pendingPaths,[...pre.plannedDelta.projectModules,...pre.preliminaryMetadata.targets.map(t=>t.currentPath)].sort());
    assert.equal(a.manifestTransition.observations,"pending");
    assert.equal(a.releaseVersion,"0.24.45");
    assert.equal(new Set(a.writes.map(w => w.path)).size, a.writes.length);
    for (const w of a.writes) {
      assert(!path.isAbsolute(w.path) && !/[\\*?]/u.test(w.path) && !w.path.split("/").some(p => ["", ".", ".."].includes(p)));
      assert.equal(hash(Buffer.from(w.afterBase64, "base64")), w.afterSha256);
      if (w.beforeSha256 !== null) {
        assert.equal(hash(Buffer.from(w.beforeBase64, "base64")), w.beforeSha256);
        const expected = w.path === STATE ? pre.stateTransition.afterSha256 : pre.protectedFiles.find(f => f.path === w.path)?.sha256;
        assert.equal(w.beforeSha256, expected, `Unanchored historical before-image: ${w.path}`);
      } else {
        assert.equal(w.beforeBase64, null);
        const allowed = [...pre.plannedDelta.projectModules, ...pre.preliminaryMetadata.plannedActivationPositions
          .map(p => `dist/stage-3-compat-runtime/${p.shimFile}`)];
        assert(allowed.includes(w.path), `Unexpected new cutover file: ${w.path}`);
      }
    }
    const frozen=require("../guards/core/guard_models").immutableRecord(a);
    cache.set(this.root,{signature,artifact:frozen});return frozen;
  }
  before(file, bytes) {
    bytes = new (require("./stage_three_batch_010_history").Batch010History)(this.root).before(file, bytes);
    bytes = new (require("./stage_three_batch_009_release_transition").StageThreeBatch009ReleaseTransition)(this.root)
      .before(file, bytes);
    if (!this.exists()) return Buffer.from(bytes);
    const manifest = "architecture/migration/module_migration_manifest.json";
    const normalize = value => file === manifest
      ? require("./stage_three_batch_009_observation_transition").beforeBatch009Observations(value, this.root)
      : Buffer.from(value);
    bytes = normalize(bytes);
    const a = this.artifact(), item = a.writes.find(w => w.path === file);
    if (!item) return Buffer.from(bytes);
    const digest = hash(bytes);
    if (digest === item.beforeSha256) return Buffer.from(bytes);
    if (digest !== item.afterSha256) {
      // A composed historical reader may already have reversed the preceding
      // accepted batch. Permit only its exact recorded states, never arbitrary bytes.
      const currentBeforeSuccessor = new (require("./stage_three_batch_010_history").Batch010History)(this.root)
        .before(file, this.raw(file));
      assert.equal(hash(normalize(currentBeforeSuccessor)),item.afterSha256,`Actual batch-009 file drift: ${file}`);
      const prior=["stage_3_batch_008_runtime_cutover.json","stage_3_batch_008_release_transition.json"]
        .flatMap(name=>{const p=JSON.parse(this.raw(`architecture/migration/${name}`));return p.writes||p.records;})
        .filter(r=>r.path===file).flatMap(r=>[r.beforeSha256,r.afterSha256]);
      assert(prior.includes(digest),`Unknown historical predecessor: ${file}`);
      return Buffer.from(bytes);
    }
    assert.equal(digest, item.afterSha256, `Unknown batch-009 delta: ${file}`);
    if(item.beforeBase64===null)return Buffer.from(bytes); // No predecessor; historical corpus views exclude this exact new path.
    return Buffer.from(item.beforeBase64, "base64");
  }
}
module.exports = { Batch009CutoverHistory, CUTOVER, STATE, BATCH, hash };
