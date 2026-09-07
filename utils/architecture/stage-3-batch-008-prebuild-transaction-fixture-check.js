"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ControlledMetadataTransaction,
} = require("./domain_batches/controlled_metadata_transaction");

class StageThreeBatch008PrebuildTransactionFixtureCheck {
  run() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-batch-008-prebuild-"));
    try {
      fs.mkdirSync(path.join(root, "architecture/migration"), { recursive: true });
      const statePath = path.join(root, "architecture/migration/stage_3_execution_state.json");
      const artifactPath = path.join(root, "architecture/migration/stage_3_batch_008_prebuild_contract.json");
      const original = Buffer.from(
        '{"completedBatchIds":["001","002","003","004","005","006","007"],"activeBatchId":null}\n',
        "utf8",
      );
      fs.writeFileSync(statePath, original);
      for (const failure of [
        { phase: "after-staging", count: 0 },
        { phase: "after-replacement", count: 1 },
        { phase: "after-replacement", count: 2 },
        { phase: "after-final-validation", count: 2 },
      ]) {
        const transaction = new ControlledMetadataTransaction({
          projectRoot: root,
          failureInjector: (event) => {
            if (event.phase === failure.phase && event.count === failure.count) {
              throw new Error(`injected-${failure.phase}-${failure.count}`);
            }
          },
        });
        assert.throws(() => transaction.commit(this.#writes(), () => {}), /injected-/u);
        assert.deepEqual(fs.readFileSync(statePath), original,
          "failed open must restore exact execution-state bytes");
        assert.equal(fs.existsSync(artifactPath), false,
          "failed open must remove the newly-created prebuild evidence");
        assert.deepEqual(this.#transactionFiles(root), []);
      }
      new ControlledMetadataTransaction({ projectRoot: root }).commit(this.#writes(), () => {
        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        assert.equal(state.activeBatchId, "008");
        assert.equal(state.activeBatchPhase, "prebuild");
        assert.equal(JSON.parse(fs.readFileSync(artifactPath, "utf8")).status, "prebuild-open");
      });
      assert.deepEqual(this.#transactionFiles(root), []);
      assert.throws(() => new ControlledMetadataTransaction({ projectRoot: root }).commit([
        { relativePath: "../escape.json", bytes: Buffer.from("{}") },
      ], () => {}), /Invalid controlled metadata path/u);
      console.log(
        "Stage 3.8.3 transaction fixtures passed: the two-file prebuild open is atomic, every failure boundary restores exact prior bytes, removes new evidence and rejects traversal.",
      );
    } finally {
      const resolved = path.resolve(root);
      if (path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
          !path.basename(resolved).startsWith("cyber-fishing-batch-008-prebuild-")) {
        throw new Error(`Refusing to remove unsafe fixture root: ${resolved}`);
      }
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  #writes() {
    return [
      {
        relativePath: "architecture/migration/stage_3_batch_008_prebuild_contract.json",
        bytes: Buffer.from('{"status":"prebuild-open"}\n'),
      },
      {
        relativePath: "architecture/migration/stage_3_execution_state.json",
        bytes: Buffer.from('{"activeBatchId":"008","activeBatchPhase":"prebuild"}\n'),
      },
    ];
  }

  #transactionFiles(root) {
    return fs.readdirSync(path.join(root, "architecture/migration"))
      .filter((name) => name.startsWith("."))
      .sort();
  }
}

new StageThreeBatch008PrebuildTransactionFixtureCheck().run();
