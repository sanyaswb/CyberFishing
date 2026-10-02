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
      StageFourClusterLedger.validatePreparationImports(record);
      for (const pair of record.replacedBridges || []) StageFourClusterLedger.validateBridgeRelocation(pair);
      for (const merge of record.mergedBridges || []) StageFourClusterLedger.validateBridgeMerge(merge);
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

  // Native imports introduced during preparation are approved by exact endpoints, like cluster
  // imports. Two uses: bootstrap's event adapter and UUID capability before inventory migration.
  static validatePreparationImports(record) {
    const files = new Set((record.files || []).map(item => item.path));
    for (const edge of record.importEdges || []) {
      assert(edge.reason, "preparation import needs a written reason");
      assert(files.has(edge.source), "preparation import source must be a recorded edit");
      assert(/^src\/.+\.js$/u.test(edge.source) && /^src\/.+\.js$/u.test(edge.target),
        "preparation import endpoints must be explicit source modules");
    }
    assert.equal(new Set((record.importEdges || []).map(edge => `${edge.source}->${edge.target}`)).size,
      (record.importEdges || []).length, "duplicate preparation import");
  }

  // A relocated consumer may already have a bridge to the same module. Canonical identities are
  // per consumer/module: combine only the two existing surfaces, never create another global.
  static validateBridgeMerge({ from, before, after }) {
    for (const bridge of [from, before, after]) assert.equal(bridge.id, CanonicalBridgeIdentity.id(bridge), "merge bridge identity");
    assert.notEqual(from.source, before.source, "merge must relocate a consumer");
    for (const key of ["owner", "target", "bridge"]) assert.equal(from[key], before[key], "merge must keep the provider and owner");
    const surfaces = [...new Map([...before.globalProviders, ...from.globalProviders]
      .map(surface => [JSON.stringify(surface), surface])).values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
    assert.deepEqual(after, { ...before, globalProviders: surfaces }, "merge may only combine the exact existing surfaces");
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

  // Keep the Stage 2 approval frozen while deriving its remaining classic consumers from exact
  // applied Stage 4 retirements. A missing/changed bridge identity never authorizes retirement.
  stageTwoPlan(plan) {
    if (!this.applied.length) return plan;
    const retired = new Map(this.applied.flatMap(record => (record.output.bridgesRetired || [])
      .map(id => [id, record])));
    return { ...plan, batches: plan.batches.map(batch => ({ ...batch, bridgeStrategy: { ...batch.bridgeStrategy,
      bridges: batch.bridgeStrategy.bridges.map(bridge => ({ ...bridge, legacyConsumers: bridge.legacyConsumers.filter(source => {
        const id = CanonicalBridgeIdentity.id({source,bridge:bridge.wrapperPath,target:bridge.targetModule,owner:batch.id});
        const record = retired.get(id);
        if (!record) return true;
        assert(record.modules.some(module => module.currentPath === source), "Stage 2 retirement has no migrated consumer");
        return false;
      }) })) } })) };
  }

  // Stage 4.N after N applied clusters; the Stage 3 label until the first one.
  stageLabel(stageThreeLabel) {
    return this.applied.length > 0 ? `4.${this.applied.length}` : stageThreeLabel;
  }
}

module.exports = { CLUSTER_DIRECTORY, RECORD_KIND, StageFourClusterLedger };
