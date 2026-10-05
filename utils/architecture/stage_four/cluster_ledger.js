"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { CanonicalBridgeIdentity } = require("../../build/legacy_bridge_build_config");
const { CanonicalActivationIdentity } = require("../../build/compat_runtime/cumulative_runtime_contract");

const CLUSTER_DIRECTORY = "architecture/migration/stage_4/clusters";
const RECORD_KIND = "cyber-fishing-stage-4-cluster";
const RECORD_NAME = /^(\d{3})_[a-z0-9-]+\.json$/u;
// Stage 5 reuses this mechanism (graph review stage_5 v1, toolingTransition): each stage keeps its own record
// directory, kind and owner prefix; Stage 4 stays the default so its frozen readers and closure pins are unchanged.
const LEDGER_STAGES = Object.freeze([4, 5, 6]);
const stageDirectories = (stage) => Object.freeze({
  clusters: `architecture/migration/stage_${stage}/clusters`,
  preparations: `architecture/migration/stage_${stage}/preparations`,
  evidence: `architecture/migration/stage_${stage}/evidence`,
});
const recordKind = (stage) => `cyber-fishing-stage-${stage}-cluster`;
const preparationKind = (stage) => `cyber-fishing-stage-${stage}-preparation`;
// The stage a cluster record belongs to, from its kind (stage-qualified identity).
const recordStage = (record) => {
  const stage = Number(/^cyber-fishing-stage-(\d)-cluster$/u.exec(record?.kind || "")?.[1]);
  assert(LEDGER_STAGES.includes(stage), `unknown cluster record kind: ${record?.kind}`);
  return stage;
};

// The Stage 4 cluster ledger (owner decision 0.3): one small JSON record per cluster, read in id order.
// Applied records add ESM targets to the cumulative runtime, reviewed import edges to the guard corpus and
// the stage label to the package contract. An empty ledger leaves every Stage 3 reader unchanged.
class StageFourClusterLedger {
  #records;
  #retirementUpdates;
  #removedModules;

  constructor(records, retirementUpdates = [], removedModules = []) {
    this.#records = Object.freeze([...records]);
    this.#retirementUpdates = Object.freeze([...retirementUpdates]);
    this.#removedModules = Object.freeze([...removedModules]);
  }

  static read(projectRoot, stage = 4) {
    assert(LEDGER_STAGES.includes(stage), `no cluster ledger for stage ${stage}`);
    const relative = stageDirectories(stage).clusters;
    const directory = path.join(projectRoot, relative);
    if (!fs.existsSync(directory)) return new StageFourClusterLedger([]);
    const records = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name) => {
      const match = RECORD_NAME.exec(name);
      if (!match) throw new Error(`Stage ${stage} cluster record name is not canonical: ${name}`);
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      if (record.kind !== recordKind(stage) || record.id !== match[1]) {
        throw new Error(`Stage ${stage} cluster record identity differs from its file name: ${name}`);
      }
      return Object.freeze({ ...record, file: `${relative}/${name}` });
    });
    records.forEach((record, index) => {
      if (Number(record.id) !== index + 1) throw new Error(`Stage ${stage} cluster ids must be contiguous: ${record.id}`);
    });
    return new StageFourClusterLedger(records);
  }

  // Every stage's records in stage order: the runtime, guard corpus, package contract and Stage 2 plan consume
  // the cumulative applied facts; Stage 4 closure and release validation keep reading `read(root)` (Stage 4 only).
  static cumulative(projectRoot) {
    return new StageFourClusterLedger(LEDGER_STAGES.flatMap((stage) => StageFourClusterLedger.read(projectRoot, stage).records),
      StageFourClusterLedger.cumulativePreparations(projectRoot).flatMap(record => record.retirementUpdates || []),
      StageFourClusterLedger.cleanupRecords(projectRoot).flatMap(record => record.removedModules));
  }

  // Preparation records describe exact provider relocations before a cluster. Their bridge pairs
  // retain the old owner, target and surface; only the consuming declaration moved to a split file.
  static preparations(projectRoot, stage = 4) {
    assert(LEDGER_STAGES.includes(stage), `no preparation ledger for stage ${stage}`);
    const directory = path.join(projectRoot, stageDirectories(stage).preparations);
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter(name => name.endsWith(".json")).sort().map(name => {
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      assert.equal(record.schemaVersion, 1);
      assert.equal(record.kind, preparationKind(stage));
      assert(record.reason && /^[0-9a-f]{40}$/u.test(record.baseCommit));
      assert(record.gameCycle.identical && record.gameCycle.before === record.gameCycle.after);
      StageFourClusterLedger.validatePreparationImports(record);
      StageFourClusterLedger.validatePreparationRetirements(record);
      StageFourClusterLedger.validateCleanupRecord(record);
      for (const pair of record.replacedBridges || []) StageFourClusterLedger.validateBridgeRelocation(pair);
      for (const merge of record.mergedBridges || []) StageFourClusterLedger.validateBridgeMerge(merge);
      return record;
    });
  }

  static cumulativePreparations(projectRoot) {
    return LEDGER_STAGES.flatMap((stage) => StageFourClusterLedger.preparations(projectRoot, stage));
  }

  // Preserve historical native import approvals while recording an exact importer relocation.
  static reviewedPreparationImportEdges(projectRoot, records = StageFourClusterLedger.cumulativePreparations(projectRoot)) {
    const edges = new Map();
    const key = edge => edge.source + "->" + edge.target;
    for (const record of records) {
      StageFourClusterLedger.validatePreparationImports(record);
      for (const edge of record.importEdges || []) edges.set(key(edge), edge);
      for (const pair of record.replacedImportEdges || []) {
        assert.deepEqual(edges.get(key(pair.before)), pair.before, "relocated preparation import must be an exact approved edge");
        assert(!edges.has(key(pair.after)), "relocated preparation import already exists");
        edges.delete(key(pair.before));
        edges.set(key(pair.after), pair.after);
      }
    }
    return [...edges.values()];
  }

  // Exact subsequent lifecycle metadata; historical owners, surfaces and introduction records stay immutable.
  static validatePreparationRetirements(record) {
    if (!record.retirementUpdates && !record.transportRetirement) return;
    assert(record.kind === preparationKind(5) && record.retirementDecision ===
      "architecture/migration/stage_5/native_production_owner_decision.md", "retirement requires the reviewed Stage 5 decision");
    const ids = new Set();
    for (const update of record.retirementUpdates || []) {
      const { before, after, kind, id, reason } = update;
      assert(["bridge", "activation"].includes(kind) && id === before?.id && id === after?.id &&
        reason && !ids.has(id), "retirement transition identity");
      ids.add(id);
      assert(id === (kind === "bridge" ? CanonicalBridgeIdentity : CanonicalActivationIdentity).id(before),
        "retirement transition canonical identity");
      assert(before.removalStage === "stage-5" && after.removalStage === "stage-6" &&
        after.reason.includes("last listed classic DEV consumer") && after.reason.startsWith(before.reason),
        "retirement transition stage and consumer condition");
      assert.deepEqual(after, { ...before, removalStage: "stage-6", reason: after.reason },
        "retirement transition changed ownership or surface");
    }
    if (record.transportRetirement) {
      const { before, after } = record.transportRetirement;
      assert(before.removalStage === "stage-5" && after.removalStage === "stage-6" &&
        after.lifecycle?.decision === record.retirementDecision, "transport retirement decision");
      assert.deepEqual(after, { ...before, removalStage: "stage-6", lifecycle: after.lifecycle },
        "transport retirement changed ownership or surface");
    }
  }

  static validateRetirementSuccessor(frozen, current, updates) {
    const matches = updates.filter(update => update.id === frozen.id);
    assert(matches.length <= 1, "duplicate retirement successor");
    if (matches.length) {
      assert.deepEqual(matches[0].before, frozen, "retirement successor must extend the exact historical pin");
      assert.deepEqual(current, matches[0].after, "retirement successor metadata drift");
    } else assert.deepEqual(current, frozen, "historical retirement metadata drift");
  }

  // Exact post-closure removal successors; do not alter historical migrations or expose new runtime APIs.
  static cleanupRecords(projectRoot) {
    return StageFourClusterLedger.cumulativePreparations(projectRoot).filter(record => record.postClosureCleanup);
  }

  static validateCleanupRecord(record) {
    if (!record.postClosureCleanup) return;
    assert(record.kind === preparationKind(5) && record.postClosureCleanup.closureTag === "stage5-closed" &&
      record.postClosureCleanup.archiveTag === "stage5-dead-code-archive" &&
      /^[0-9a-f]{40}$/u.test(record.postClosureCleanup.archiveCommit) &&
      record.postClosureCleanup.decision === "architecture/migration/stage_5/post_closure_cleanup_audit.md",
      "cleanup needs exact post-closure recovery and decision");
    const paths = new Set();
    for (const item of record.removedModules) {
      assert(/^src\/.+\.js$/u.test(item.path) && !item.path.includes("..") && !paths.has(item.path) &&
        /^[0-9a-f]{64}$/u.test(item.before) && /^[0-9a-f]{40}$/u.test(item.gitBlob) &&
        item.manifest?.currentPath === item.path,"cleanup module identity and recovery"); paths.add(item.path);
    }
    for (const bridge of record.removedBridges) assert(bridge.id === CanonicalBridgeIdentity.id(bridge) &&
      paths.has(bridge.source),"cleanup bridge must lose its exact consumer");
    for (const activation of record.removedActivations) assert(activation.id === CanonicalActivationIdentity.id(activation) &&
      paths.has(activation.sourceProvider) && record.removedBridges.some(bridge => bridge.target === activation.targetModule &&
        bridge.globalProviders.some(surface => surface.symbol === activation.legacySymbol)),"cleanup activation exact holder");
    assert.deepEqual(record.removedDebtRecords.map(item => item.id),record.resolvedDebts,"cleanup exact resolved debts");
    assert(record.removedDebtRecords.every(item => paths.has(item.source)),"cleanup debt owner still exists");
  }

  removedTargetModules() { return this.#removedModules.map(item => item.path); }

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
    for (const { before, after, reason } of record.replacedImportEdges || []) {
      assert(reason, "preparation import relocation needs a written reason");
      assert(files.has(before.source) && files.has(after.source), "preparation import relocation must record both sources");
      assert.notEqual(before.source, after.source, "preparation import relocation must move the importer");
      assert(/^src\/.+\.js$/u.test(after.source), "preparation import relocation needs an explicit source module");
      assert.deepEqual(after, { ...before, source: after.source }, "preparation import relocation may change only importer");
    }
    assert.equal(new Set((record.replacedImportEdges || []).map(pair => pair.before.source + "->" + pair.before.target)).size,
      (record.replacedImportEdges || []).length, "duplicate preparation import relocation");
    assert.equal(new Set((record.importEdges || []).map(edge => edge.source + "->" + edge.target)).size,
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
    return this.applied.flatMap((record) => record.modules.map((module) => module.targetPath))
      .filter(file => !this.removedTargetModules().includes(file)).sort();
  }

  // `target->from` edges in the guard corpus notation.
  reviewedImportEdges() {
    return this.applied.flatMap((record) => record.modules.flatMap((module) =>
      (module.imports || []).map((item) => `${module.targetPath}->${item.from}`)));
  }

  // Keep the Stage 2 approval frozen while deriving its remaining classic consumers from exact
  // applied Stage 4 retirements. A missing/changed bridge identity never authorizes retirement.
  stageTwoPlan(plan) {
    if (!this.applied.length && !this.#retirementUpdates.length) return plan;
    const retired = new Map(this.applied.flatMap(record => (record.output.bridgesRetired || [])
      .map(id => [id, record])));
    return { ...plan, batches: plan.batches.map(batch => {
      const strategy = batch.bridgeStrategy;
      const bridges = strategy.bridges.map(bridge => ({ ...bridge,
        legacyConsumers: bridge.legacyConsumers.filter(source => {
          const id = CanonicalBridgeIdentity.id({source,bridge:bridge.wrapperPath,target:bridge.targetModule,owner:batch.id});
          const record = retired.get(id);
          if (!record) return true;
          assert(record.modules.some(module => module.currentPath === source), "Stage 2 retirement has no migrated consumer");
          return false;
        }) }));
      const updates = this.#retirementUpdates.filter(update => update.kind === "bridge" && update.before.owner === batch.id);
      if (!updates.length) return { ...batch, bridgeStrategy: { ...strategy, bridges } };
      const consumed = new Set();
      for (const bridge of bridges) for (const source of bridge.legacyConsumers) {
        const id = CanonicalBridgeIdentity.id({source,bridge:bridge.wrapperPath,target:bridge.targetModule,owner:batch.id});
        const matches = updates.filter(update => update.id === id);
        assert.equal(matches.length, 1, "Stage 2 lifecycle requires every exact live consumer once");
        const update = matches[0];
        assert.equal(update.before.removalStage, strategy.removalStage, "Stage 2 lifecycle must extend frozen removal stage");
        assert.deepEqual(update.before.globalProviders, bridge.globalProviders.map(({symbol,mechanism}) => ({symbol,mechanism})),
          "Stage 2 lifecycle changed frozen surface");
        assert.equal(update.after.removalStage, "stage-6", "Stage 2 lifecycle requires native DEV retirement");
        consumed.add(id);
      }
      assert.equal(consumed.size, updates.length, "Stage 2 lifecycle has an unrelated consumer");
      return { ...batch, bridgeStrategy: { ...strategy, removalStage: "stage-6", bridges } };
    }) };
  }

  // Stage S.N after N applied clusters of the latest stage with an applied record; the Stage 3 label until the first.
  stageLabel(stageThreeLabel) {
    const applied = this.applied;
    if (applied.length === 0) return stageThreeLabel;
    const stage = recordStage(applied.at(-1));
    return `${stage}.${applied.filter((record) => recordStage(record) === stage).length}`;
  }
}

module.exports = { CLUSTER_DIRECTORY, LEDGER_STAGES, RECORD_KIND, StageFourClusterLedger, preparationKind, recordKind,
  recordStage, stageDirectories };
