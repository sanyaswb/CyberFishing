"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch011CutoverProjection, CUTOVER } = require("./stage_three_batch_011_cutover");
const { Batch011HistoricalWorkspace } = require("./stage_three_batch_011_historical_workspace");
const { Batch011CandidateValidation } = require("./stage_three_batch_011_candidate_validation");
const { Batch011Planning, sha, serialize } = require("./stage_three_batch_011_planning");
const { PATHS } = require("./stage_three_live_preflight");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_011_preflight_profile");
const { CumulativeLiveActivationProbe } = require("./cumulative_live_activation_probe");
const { EagerClassModuleEvaluationProbe } = require("./eager_class_module_evaluation_probe");
const { StageThreeBatchSourceObserver } = require("./stage_three_batch_source_observer");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");
const { BATCH_011_EXECUTABLE_CASES } = require("./stage_three_batch_011_behavior_cases");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");

const OUTPUT = "architecture/migration/stage_3_batch_011_live_runtime_validation.json";

class Batch011LiveValidation {
  constructor(root) { this.root = path.resolve(root); }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  verifyPublished() {
    const cutover = this.json(CUTOVER);
    const state = this.json(PATHS.executionState);
    assert.equal(cutover.batchId, PROFILE.batchId);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    const prebuild = this.json(cutover.evidence.prebuild.path);
    const proof = this.json(cutover.evidence.sourceBuild.path);
    assert.equal(sha(this.bytes(cutover.evidence.prebuild.path)), cutover.evidence.prebuild.sha256);
    assert.equal(sha(this.bytes(cutover.evidence.sourceBuild.path)), cutover.evidence.sourceBuild.sha256);
    assert.deepEqual(cutover.topology, prebuild.plannedTopology);
    assert.deepEqual(cutover.build, proof.report);
    for (const write of cutover.writes) {
      assert.equal(sha(Buffer.from(write.afterBase64, "base64")), write.afterSha256);
      const actual = write.path === PATHS.manifest
        ? require("./stage_three_batch_011_observation_transition").beforeBatch011Observations(this.bytes(write.path), this.root)
        : this.bytes(write.path);
      assert.equal(sha(actual), write.afterSha256, `Published bytes differ: ${write.path}`);
    }
    const runtime = this.json(PATHS.runtimeContract);
    const code = this.bytes(runtime.output.directory + runtime.output.runtimeFile).toString("utf8");
    assert.equal(sha(Buffer.from(code)), proof.report.runtimeSha256);
    for (const effect of proof.effects.records) {
      assert.equal(sha(this.bytes(effect.target)), effect.candidateSha256);
    }
    const oldRuntimeWrite = cutover.writes.find(write => write.path === PATHS.runtimeContract);
    const oldCodeWrite = cutover.writes.find(write =>
      write.path === runtime.output.directory + runtime.output.runtimeFile);
    assert(oldRuntimeWrite && oldCodeWrite);
    const oldContract = JSON.parse(Buffer.from(oldRuntimeWrite.beforeBase64, "base64"));
    const oldCode = Buffer.from(oldCodeWrite.beforeBase64, "base64").toString("utf8");
    const classicSources = Object.fromEntries(PROFILE.executionProfile.expectedTargets.map(target => {
      const write = cutover.writes.find(item => item.path === target.currentPath);
      assert(write?.beforeBase64, `Missing classic before-image: ${target.currentPath}`);
      return [target.currentPath, Buffer.from(write.beforeBase64, "base64").toString("utf8")];
    }));
    const app = new Batch011Planning(this.root);
    const outputValidation = new Batch011CandidateValidation().run({
      app, report: proof.report, contract: runtime, readOutput: file => this.bytes(file).toString("utf8"),
      classicSources, previousRuntimeContract: oldContract, previousRuntimeCode: oldCode,
    });
    assert.deepEqual(outputValidation, proof.validation,
      "Published runtime differs from approved candidate behavior");
    const activation = new CumulativeLiveActivationProbe().run({
      code, runtime, index: this.bytes(PATHS.index).toString("utf8"),
      read: file => this.bytes(file), projectModules: proof.report.projectModules,
    });
    const evaluation = new EagerClassModuleEvaluationProbe().run(code, runtime.transport.symbol, proof.sources);
    const readsBefore = activation.transportReads();
    const shapes = [];
    for (const source of proof.sources) {
      const classicSource = classicSources[source.currentPath];
      const targetSource = this.bytes(source.targetPath).toString("utf8");
      new RepresentationOnlyNamedEsmTarget().validate({
        ...source, source: targetSource, classicSource,
      });
      const observer = new StageThreeBatchSourceObserver();
      const before = observer.observe(classicSource, source.currentPath);
      const after = observer.observe(
        targetSource.replace(`export class ${source.exportName}`, `class ${source.exportName}`),
        source.currentPath);
      assert.deepEqual(after, before, "Allocation, state or method shape changed");
      const Type = activation.transport.modules[source.targetPath][source.exportName];
      for (const test of Object.values(BATCH_011_EXECUTABLE_CASES[source.exportName])) test(Type);
      shapes.push({ source: source.targetPath, fields: after.fields,
        methods: after.methods, allocationTotals: after.allocationTotals });
    }
    assert.equal(activation.transportReads(), readsBefore);
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-live-runtime-validation",
      batchId: PROFILE.batchId, status: "verified", releaseVersion: state.releaseVersion,
      cutoverSha256: sha(this.bytes(CUTOVER)), runtimeSha256: sha(Buffer.from(code)),
      topology: prebuild.plannedTopology.counts,
      evaluation, activation: activation.evidence, outputValidation,
      stateAndAllocationShapes: shapes, postActivationTransportReads: 0,
      performanceProof: "exact-source-allocation-sites-and-result-identity; not a frame-time benchmark",
      browserAcceptanceClaimed: false, batchCompleted: false, observationsFinal: false,
      nextGate: "stage-3.11.7-observation-reconciliation",
    };
  }

  async run({ persist = false } = {}) {
    const cutover = this.json(CUTOVER);
    const replay = await new Batch011HistoricalWorkspace().run(this.root,
      root => new Batch011CutoverProjection().prepare(root), { keepPrebuild: true });
    assert.deepEqual(replay.artifact, cutover, "Exact cutover does not reproduce from approved before-images");
    const result = this.verifyPublished();
    const bytes = serialize(result);
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Live evidence replay drift");
    else if (persist) new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    else throw new Error("Live evidence missing; explicit validation generator required");
    return result;
  }
}

module.exports = { Batch011LiveValidation, OUTPUT };
