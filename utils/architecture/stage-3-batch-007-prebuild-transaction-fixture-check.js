"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ControlledMetadataTransaction,
} = require("./domain_batches/controlled_metadata_transaction");

class StageThreeBatch007PrebuildTransactionFixtureCheck {
  run() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-prebuild-transaction-"));
    try {
      fs.mkdirSync(path.join(root, "architecture/migration"), { recursive: true });
      const statePath = path.join(root, "architecture/migration/state.json");
      const artifactPath = path.join(root, "architecture/migration/prebuild.json");
      const original = Buffer.from('{"activeBatchId":null}\n', "utf8");
      fs.writeFileSync(statePath, original);
      const cases = [
        { phase: "after-staging", count: 0 },
        { phase: "after-replacement", count: 1 },
        { phase: "after-replacement", count: 2 },
        { phase: "after-final-validation", count: 2 },
      ];
      for (const failure of cases) {
        const transaction = new ControlledMetadataTransaction({
          projectRoot: root,
          failureInjector: (event) => {
            if (event.phase === failure.phase && event.count === failure.count) {
              throw new Error(`injected-${failure.phase}-${failure.count}`);
            }
          },
        });
        assert.throws(() => transaction.commit(this.#writes(), () => {}), /injected-/u);
        assert.deepEqual(fs.readFileSync(statePath), original);
        assert.equal(fs.existsSync(artifactPath), false);
        assert.deepEqual(this.#transactionFiles(root), []);
      }
      new ControlledMetadataTransaction({ projectRoot: root }).commit(this.#writes(), () => {
        assert.equal(JSON.parse(fs.readFileSync(artifactPath, "utf8")).status, "prebuild-open");
        assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).activeBatchId, "007");
      });
      assert.deepEqual(this.#transactionFiles(root), []);
      assert.throws(() => new ControlledMetadataTransaction({ projectRoot: root }).commit([
        { relativePath: "../escape.json", bytes: Buffer.from("{}") },
      ], () => {}), /Invalid controlled metadata path/u);
      console.log(
        "Stage 3.7.3 metadata transaction fixtures passed: staged writes, every replacement boundary, final validation, exact rollback, cleanup and path traversal safety are verified.",
      );
    } finally {
      const resolved = path.resolve(root);
      if (path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
          !path.basename(resolved).startsWith("cyber-fishing-prebuild-transaction-")) {
        throw new Error(`Refusing to remove unsafe fixture root: ${resolved}`);
      }
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  #writes() {
    return [
      { relativePath: "architecture/migration/prebuild.json", bytes: Buffer.from('{"status":"prebuild-open"}\n') },
      { relativePath: "architecture/migration/state.json", bytes: Buffer.from('{"activeBatchId":"007"}\n') },
    ];
  }

  #transactionFiles(root) {
    return fs.readdirSync(path.join(root, "architecture/migration"))
      .filter((name) => name.startsWith("."))
      .sort();
  }
}

new StageThreeBatch007PrebuildTransactionFixtureCheck().run();
