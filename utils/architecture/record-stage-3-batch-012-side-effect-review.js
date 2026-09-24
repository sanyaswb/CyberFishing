"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeGlobalExposureReview } = require("./domain_batches/stage_three_global_exposure_review");

const OUTPUT = "architecture/migration/stage_3_batch_012_side_effect_review.json";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const serialize = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

class Batch012SideEffectReviewRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Side-effect evidence is immutable");
    const read = file => fs.readFileSync(path.join(root, file));
    const approvedPath = "architecture/migration/stage_3_approved_batches.json";
    const statePath = "architecture/migration/stage_3_execution_state.json";
    const approved = JSON.parse(read(approvedPath));
    const state = JSON.parse(read(statePath));
    const batch = approved.batches[11];
    assert.equal(batch.id, "stage-3.candidate-012-assemblies-2086347a");
    assert.equal(state.releaseVersion, "0.24.48");
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 11).map(item => item.id));
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(batch.sideEffectReviews.length, 2);
    const reviewer = new StageThreeGlobalExposureReview();
    const modules = batch.modules.map(module => {
      const frozen = batch.sideEffectReviews.find(item => item.module === module.targetPath);
      assert(frozen, `Missing frozen effect review: ${module.targetPath}`);
      assert.equal(frozen.observations.length, 1);
      assert.equal(frozen.observations[0].kind, "assignment");
      assert.equal(frozen.observations[0].classification, "observable");
      const symbol = module.providers[0].symbol;
      assert(module.providers.every(provider => provider.symbol === symbol));
      const source = read(module.currentPath).toString("utf8");
      return {
        ...reviewer.review({ source, currentPath: module.currentPath, symbol,
          location: frozen.observations[0].location }),
        targetPath: module.targetPath,
        frozenEvidenceFingerprint: frozen.evidenceFingerprint,
        activation: batch.compatibility.newActivations
          .find(item => item.contract.sourceProvider === module.currentPath).contract,
      };
    }).sort((a, b) => a.currentPath.localeCompare(b.currentPath));
    assert.deepEqual(modules.map(module => module.activation.legacyScriptIndex), [153, 154]);
    const evidence = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-012-side-effect-review",
      batchId: batch.id, stage: "3.12.0", status: "reviewed-compatible-class-exposure-only",
      sourceReleaseVersion: state.releaseVersion,
      inputs: [approvedPath, statePath].map(file => ({ path: file, sha256: sha(read(file)) })),
      modules,
      requiredCutoverProof: [
        "named ESM targets contain class declarations without global assignments",
        "activation shims publish the same class identity at logical positions 153 and 154",
        "candidate and live runtime evaluate each class exactly once",
      ],
      cutoverAllowedByThisEvidenceAlone: false,
    };
    const bytes = serialize(evidence);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(read(OUTPUT), bytes));
    console.log("Stage 3.12.0 side-effect review PASS: two exact class-to-global assignments, positions 153/154, no other evaluation effects; cutover still gated.");
    return evidence;
  }
}

if (require.main === module) {
  try { new Batch012SideEffectReviewRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch012SideEffectReviewRecorder, OUTPUT };
