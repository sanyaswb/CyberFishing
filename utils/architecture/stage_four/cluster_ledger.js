"use strict";

const fs = require("node:fs");
const path = require("node:path");

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
