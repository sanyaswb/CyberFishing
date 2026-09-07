"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StageThreeBatch008AtomicCutover, validateCutoverArtifact } = require("./domain_batches/stage_three_batch_008_cutover");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { snapshot } = require("./stage-3-batch-008-source-build-integration-check");
const ROOT = path.resolve(__dirname, "../..");

async function run() {
  const before = snapshot();
  const prepared = await new StageThreeBatch008AtomicCutover(ROOT).prepare({ replay: true });
  const prebuild = require("../../architecture/migration/stage_3_batch_008_prebuild_contract.json");
  const sourceBuild = require("../../architecture/migration/stage_3_batch_008_source_build_validation.json");
  const locked = validateCutoverArtifact(prepared.artifact, prebuild, sourceBuild);
  assert.throws(() => { locked.lifecycle.activeBatchPhase = "completed"; }, TypeError);
  for (const mutate of [
    (x) => { x.schemaVersion = 1; },
    (x) => { x.lifecycle.batchCompleted = true; }, (x) => { x.releaseVersion = "0.24.45"; },
    (x) => x.topology.projectModules.pop(), (x) => x.topology.bridgeIds.pop(),
    (x) => { x.manifestTransition.observations = "verified"; },
    (x) => { x.build.runtimeSha256 = "0".repeat(64); },
    (x) => { x.rollback.partialRollbackAllowed = true; },
  ]) {
    const changed = structuredClone(prepared.artifact); mutate(changed);
    assert.throws(() => validateCutoverArtifact(changed, prebuild, sourceBuild));
  }
  await assert.rejects(new StageThreeBatch008AtomicCutover(ROOT, {
    viteLoader: async () => { throw new Error("injected-prepublication-build-failure"); },
  }).prepare({ replay: true }), /injected-prepublication-build-failure/u);
  assert.deepEqual(snapshot(), before);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-batch-008-cutover-"));
  try {
    const originals = new Map();
    for (const item of prepared.writes) {
      const source = path.join(ROOT, item.relativePath), target = path.join(temporary, item.relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const entry = prepared.artifact.writes.find((entry) => entry.path === item.relativePath);
      const bytes = entry?.beforeSha256 ? new (require("./domain_batches/stage_three_batch_008_cutover_history").Batch008CutoverHistory)(ROOT)
        .before(item.relativePath) : null;
      originals.set(item.relativePath, bytes);
      if (bytes) fs.writeFileSync(target, bytes);
    }
    const phases = [["after-staging", 0], ...prepared.writes.map((_, i) => ["after-replacement", i + 1]),
      ["after-final-validation", prepared.writes.length]];
    for (const [phase, count] of phases) {
      let injected = false;
      const transaction = new ControlledMetadataTransaction({ projectRoot: temporary, failureInjector: (event) => {
        if (event.phase === phase && event.count === count) { injected = true; throw new Error("injected-cutover-failure"); }
      } });
      assert.throws(() => transaction.commit(prepared.writes, () => {}), /injected-cutover-failure/u);
      assert(injected);
      for (const [relative, bytes] of originals) {
        const target = path.join(temporary, relative);
        if (bytes) assert.deepEqual(fs.readFileSync(target), bytes, `Partial rollback: ${relative}`);
        else assert(!fs.existsSync(target), `Rollback retained ${relative}`);
      }
    }
    new ControlledMetadataTransaction({ projectRoot: temporary }).commit(prepared.writes, () => {
      for (const item of prepared.writes) assert.deepEqual(fs.readFileSync(path.join(temporary, item.relativePath)), item.bytes);
    });
    console.log(`Stage 3.8.5 fixtures: ${phases.length} real-write failure boundaries and complete synthetic cutover PASS.`);
  } finally {
    const resolved = path.resolve(temporary);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith("cyber-batch-008-cutover-"));
    assert.notEqual(resolved, ROOT);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  assert.deepEqual(snapshot(), before, "Cutover fixture mutated the live repository");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
