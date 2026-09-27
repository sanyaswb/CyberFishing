"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DIRECTORY = "architecture/migration/stage_3_prerequisites";
const KIND = "cyber-fishing-stage-3-prerequisite-transition";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Ledger of recorded Stage 3 prerequisite transitions: behavior-preserving structural changes of
// classic sources and their metadata, recorded between two batches. Each transition keeps the exact
// before-image and after fingerprint of every file it changed, so history replays peel transitions
// recorded after a batch (newest first) before they peel that batch itself.
class StageThreePrerequisiteLedger {
  constructor(root) {
    this.root = path.resolve(root);
  }

  static fileName(record) {
    return `${DIRECTORY}/${String(record.sequence).padStart(3, "0")}_${record.slug}.json`;
  }

  records() {
    const directory = path.join(this.root, DIRECTORY);
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter(name => /^\d{3}_[a-z0-9-]+\.json$/u.test(name)).sort()
      .map(name => {
        const record = JSON.parse(fs.readFileSync(path.join(directory, name)));
        StageThreePrerequisiteLedger.validate(record);
        assert.equal(StageThreePrerequisiteLedger.fileName(record), `${DIRECTORY}/${name}`,
          `prerequisite transition file name differs from its record: ${name}`);
        return record;
      });
  }

  static validate(record) {
    assert.equal(record?.kind, KIND, "prerequisite transition kind is invalid");
    assert(Number.isInteger(record.sequence) && record.sequence > 0, "prerequisite sequence is invalid");
    assert.match(record.slug, /^[a-z0-9-]+$/u);
    assert.match(record.afterBatch, /^\d{3}$/u, "prerequisite afterBatch must name a batch");
    assert(Array.isArray(record.writes) && record.writes.length > 0, "prerequisite transition has no writes");
    const paths = record.writes.map(write => write.path);
    assert.equal(new Set(paths).size, paths.length, "prerequisite write paths must be unique");
    for (const write of record.writes) {
      assert(write.beforeSha256 === null || /^[a-f0-9]{64}$/u.test(write.beforeSha256));
      assert(write.afterSha256 === null || /^[a-f0-9]{64}$/u.test(write.afterSha256));
      assert.notEqual(write.beforeSha256, write.afterSha256, `prerequisite write changes nothing: ${write.path}`);
      if (write.beforeSha256 === null) assert.equal(write.beforeBase64, null);
      else assert.equal(sha(Buffer.from(write.beforeBase64, "base64")), write.beforeSha256, `before-image drift: ${write.path}`);
    }
    return record;
  }

  // Transitions recorded after the given batch, in recording order.
  after(batchNumber) {
    return this.records().filter(record => record.afterBatch === batchNumber);
  }

  // Reverses on a workspace copy every transition recorded after the batch, newest first.
  peel(batchNumber) {
    this.#reverse(this.after(batchNumber));
  }

  // Reverses on a workspace copy the transition with the given sequence and every later one.
  peelFrom(sequence) {
    this.#reverse(this.records().filter(record => record.sequence >= sequence));
  }

  #reverse(records) {
    for (const record of [...records].reverse()) {
      for (const write of record.writes) {
        const target = path.join(this.root, write.path);
        const current = fs.existsSync(target) ? sha(fs.readFileSync(target)) : null;
        assert.equal(current, write.afterSha256, `prerequisite ${record.sequence} drift: ${write.path}`);
        if (write.beforeBase64 === null) fs.unlinkSync(target);
        else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, Buffer.from(write.beforeBase64, "base64"));
        }
      }
      fs.unlinkSync(path.join(this.root, StageThreePrerequisiteLedger.fileName(record)));
    }
  }

  // Bytes of one file before the transitions recorded after the batch (a file a transition created
  // keeps the given bytes, as for cutover creations).
  before(file, bytes, batchNumber) {
    let result = Buffer.from(bytes);
    for (const record of this.after(batchNumber).reverse()) {
      const write = record.writes.find(item => item.path === file);
      if (write && write.afterSha256 !== null && sha(result) === write.afterSha256 && write.beforeBase64 !== null) {
        result = Buffer.from(write.beforeBase64, "base64");
      }
    }
    return result;
  }
}

module.exports = { StageThreePrerequisiteLedger, DIRECTORY, KIND };
