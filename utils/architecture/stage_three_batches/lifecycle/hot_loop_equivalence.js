"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");
const { StageThreeHotLoopSourceReview } = require("../../review_queue/hot_loop_source_review");
const { StageThreeGameCycleTrace } = require("../../review_queue/game_cycle_trace");

const STATE = "architecture/migration/stage_3_execution_state.json";
const HOT_LOOP_KIND = "cyber-fishing-stage-3-review-queue-hot-loop-evidence";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Post-cutover hot-loop gate of a batch whose frozen plan carries performance gates: every ESM
// target class member keeps the body fingerprint recorded by the review-queue evidence (so every
// allocation site is unchanged) and the game-cycle fight scenarios reproduce the recorded traces
// (call counts, deltaTime ranges and ordered argument/result fingerprints) through the activations.
class StageThreeHotLoopEquivalence {
  constructor(root, definition, { sourceReview = new StageThreeHotLoopSourceReview(),
    trace = new StageThreeGameCycleTrace({ root }) } = {}) {
    this.root = path.resolve(root);
    this.definition = definition;
    this.sourceReview = sourceReview;
    this.trace = trace;
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  verify() {
    const plan = new StageThreeApprovedPlanSource({ read: file => this.bytes(file) }).load(this.json(STATE));
    const batch = plan.document.batches.find(record => record.id === this.definition.id);
    assert(batch, `frozen batch missing: ${this.definition.id}`);
    const gated = batch.gates.performance.map(gate => gate.module);
    if (gated.length === 0) return null;
    assert(plan.continuation?.extension, "hot-loop gates need an adopted freeze extension");
    const extension = this.json(plan.continuation.extension.path);
    const [reference, ...others] = extension.sources.evidence.filter(item => this.json(item.path).kind === HOT_LOOP_KIND);
    assert(reference && others.length === 0, "freeze extension must reference exactly one hot-loop evidence document");
    assert.equal(sha(this.bytes(reference.path)), reference.sha256, "hot-loop evidence drift");
    const records = this.json(reference.path).records.filter(record => gated.includes(record.currentPath));
    assert.equal(records.length, gated.length, "hot-loop evidence does not cover every gated module");
    const targets = new Map(batch.modules.map(module => [module.currentPath, module.targetPath]));
    const traces = this.trace.run(records.map(record => record.className));
    const modules = records.map(record => {
      const targetPath = targets.get(record.currentPath);
      const target = this.sourceReview.review({ source: this.bytes(targetPath).toString("utf8"),
        currentPath: targetPath, className: record.className, sourceType: "module" });
      const fingerprints = members => members.map(member => `${member.kind}\0${member.name}\0${member.bodySha256}`);
      assert.deepEqual(fingerprints(target.members), fingerprints(record.members),
        `${targetPath}: class member fingerprints differ from the recorded hot-loop evidence`);
      assert.deepEqual(target.allocationTotals, record.allocationTotals, `${targetPath}: allocation sites differ`);
      assert.deepEqual([target.wallClockReads, target.realmLookups, target.typeofLookups], [[], [], []],
        `${targetPath}: hot-loop lookups were introduced`);
      const trace = traces[record.className];
      assert.equal(trace.sha256, record.gameCycle.traceSha256, `${record.className}: game-cycle trace differs`);
      assert.deepEqual(Object.fromEntries(Object.entries(trace.methods).map(([name, stats]) => [name, stats.calls])),
        record.gameCycle.calls, `${record.className}: game-cycle call counts differ`);
      const deltaTime = Object.fromEntries(Object.entries(trace.methods).filter(([, stats]) => stats.dtMin !== null)
        .map(([name, stats]) => [name, { minSeconds: stats.dtMin, maxSeconds: stats.dtMax }]));
      assert.deepEqual(deltaTime, record.gameCycle.deltaTime, `${record.className}: deltaTime ranges differ`);
      return { currentPath: record.currentPath, targetPath, className: record.className,
        memberCount: target.members.length, memberFingerprints: "equal", allocationSites: "equal",
        gameCycleTraceSha256: trace.sha256, gameCycleCalls: "equal", deltaTime: "equal" };
    });
    return { evidence: reference, modules };
  }
}

module.exports = { StageThreeHotLoopEquivalence };
