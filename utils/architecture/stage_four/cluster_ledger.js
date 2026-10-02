"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { CanonicalBridgeIdentity } = require("../../build/legacy_bridge_build_config");

const CLUSTER_DIRECTORY = "architecture/migration/stage_4/clusters";
const RECORD_KIND = "cyber-fishing-stage-4-cluster";
const RECORD_NAME = /^(\d{3})_[a-z0-9-]+\.json$/u;

// The Stage 4 cluster ledger (owner decision 0.3): one small JSON record per cluster, read in id order.
// Applied records add ESM targets to the cumulative runtime, reviewed import edges to the guard corpus and
// the stage label to the package contract. An empty ledger leaves every Stage 3 reader unchanged.
class StageFourClusterLedger {
  #records;

  constructor(records) {
    this.#records = Object.freeze([...records]);
  }

  static read(projectRoot) {
    const directory = path.join(projectRoot, CLUSTER_DIRECTORY);
    if (!fs.existsSync(directory)) return new StageFourClusterLedger([]);
    const records = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name) => {
      const match = RECORD_NAME.exec(name);
      if (!match) throw new Error(`Stage 4 cluster record name is not canonical: ${name}`);
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      if (record.kind !== RECORD_KIND || record.id !== match[1]) {
        throw new Error(`Stage 4 cluster record identity differs from its file name: ${name}`);
      }
      return Object.freeze({ ...record, file: `${CLUSTER_DIRECTORY}/${name}` });
    });
    records.forEach((record, index) => {
      if (Number(record.id) !== index + 1) throw new Error(`Stage 4 cluster ids must be contiguous: ${record.id}`);
    });
    return new StageFourClusterLedger(records);
  }

  // Preparation records describe exact provider relocations before a cluster. Their bridge pairs
  // retain the old owner, target and surface; only the consuming declaration moved to a split file.
  static preparations(projectRoot) {
    const directory = path.join(projectRoot, "architecture/migration/stage_4/preparations");
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter(name => name.endsWith(".json")).sort().map(name => {
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      assert.equal(record.schemaVersion, 1);
      assert.equal(record.kind, "cyber-fishing-stage-4-preparation");
      assert(record.reason && /^[0-9a-f]{40}$/u.test(record.baseCommit));
      assert(record.gameCycle.identical && record.gameCycle.before === record.gameCycle.after);
      for (const pair of record.replacedBridges || []) StageFourClusterLedger.validateBridgeRelocation(pair);
      return record;
    });
  }

  static validateBridgeRelocation({ before, after }) {
    assert.equal(before.id, CanonicalBridgeIdentity.id(before), "original bridge identity");
    assert.equal(after.id, CanonicalBridgeIdentity.id(after), "relocated bridge identity");
    assert.notEqual(after.source, before.source, "relocation must move the consumer");
    assert.deepEqual({ ...after, id: before.id, source: before.source }, before,
      "relocation may change only consumer path and canonical id");
  }

  get records() {
    return this.#records;
  }

  get applied() {
    return this.#records.filter((record) => record.output?.status === "applied");
  }

  targetModules() {
    return this.applied.flatMap((record) => record.modules.map((module) => module.targetPath)).sort();
  }

  // `target->from` edges in the guard corpus notation.
  reviewedImportEdges() {
    return this.applied.flatMap((record) => record.modules.flatMap((module) =>
      (module.imports || []).map((item) => `${module.targetPath}->${item.from}`)));
  }

  // Stage 4.N after N applied clusters; the Stage 3 label until the first one.
  stageLabel(stageThreeLabel) {
    return this.applied.length > 0 ? `4.${this.applied.length}` : stageThreeLabel;
  }
}

module.exports = { CLUSTER_DIRECTORY, RECORD_KIND, StageFourClusterLedger };
