"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { beforeBatchObservations, MANIFEST } = require("./observation_transition");
const { sha } = require("./planning");

const STATE = "architecture/migration/stage_3_execution_state.json";

// Batch-only rollback of an unreleased batch on the live tree: every published change is restored
// from its recorded before-image (writes, creations and removals) in one atomic transaction, and
// only this batch's artifacts are removed. A released batch must be reversed by its release first.
class StageThreeBatchRollback {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
  }

  exists(file) { return fs.existsSync(path.join(this.root, file)); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }

  project() {
    const paths = this.definition.context.paths;
    assert(!this.exists(paths.releaseTransition), "A released batch is rolled back through its release transition first");
    assert(this.exists(paths.prebuild), "The batch is not open");
    const current = new Map();
    const read = file => current.has(file) ? current.get(file) : (this.exists(file) ? this.bytes(file) : null);
    const set = (file, bytes) => current.set(file, bytes);
    for (const file of [paths.automatedAcceptance, paths.acceptance, paths.browser]) {
      assert(!this.exists(file), `Acceptance evidence exists; roll back after removing it explicitly: ${file}`);
    }
    if (this.exists(paths.observation)) {
      set(MANIFEST, beforeBatchObservations(this.definition, this.bytes(MANIFEST), this.root));
      set(paths.observation, null);
    }
    if (this.exists(paths.knownDebt)) {
      const registry = JSON.parse(this.bytes(paths.knownDebt)).registry;
      assert.equal(sha(read(registry.path)), registry.afterSha256, "Known debt drift");
      set(registry.path, Buffer.from(registry.beforeBase64, "base64"));
      set(paths.knownDebt, null);
    }
    if (this.exists(paths.live)) set(paths.live, null);
    if (this.exists(paths.cutover)) {
      for (const record of JSON.parse(this.bytes(paths.cutover)).writes) {
        const bytes = read(record.path);
        assert.equal(bytes && sha(bytes), record.afterSha256, `Cutover drift: ${record.path}`);
        set(record.path, record.beforeBase64 === null ? null : Buffer.from(record.beforeBase64, "base64"));
      }
      set(paths.cutover, null);
    }
    if (this.exists(paths.sourceBuild)) set(paths.sourceBuild, null);
    const transition = JSON.parse(this.bytes(paths.prebuild)).stateTransition;
    const stateBytes = read(STATE);
    assert.equal(sha(stateBytes), transition.afterSha256, "Execution state is not the prebuild state");
    set(STATE, Buffer.from(transition.beforeBase64, "base64"));
    set(paths.prebuild, null);
    return [...current].filter(([file, bytes]) => bytes !== null || this.exists(file))
      .map(([relativePath, bytes]) => ({ relativePath, bytes }));
  }

  run({ failureInjector = null } = {}) {
    const writes = this.project();
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector }).commit(writes, () => {
      for (const write of writes) {
        if (write.bytes === null) assert(!this.exists(write.relativePath), `Removal survived: ${write.relativePath}`);
        else assert.deepEqual(this.bytes(write.relativePath), write.bytes);
      }
    });
    return writes.map(write => ({ path: write.relativePath, removed: write.bytes === null }));
  }
}

module.exports = { StageThreeBatchRollback };
