"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeCutoverProjection } = require("./cutover");
const { StageThreeHistoricalWorkspace } = require("./historical_workspace");
const { StageThreeCandidateValidation } = require("./candidate_validation");
const { StageThreeBatchPlanning, sha, serialize } = require("./planning");
const { beforeBatchObservations } = require("./observation_transition");
const { reviewedTargetEvaluation } = require("./target_evaluation");
const { PATHS } = require("../../domain_batches/stage_three_live_preflight");
const { RetiredActivationPlaceholder } = require("../../../build/compat_runtime/activation_retirement");
const { CumulativeLiveActivationProbe } = require("../../domain_batches/cumulative_live_activation_probe");
const { EagerClassModuleEvaluationProbe } = require("../../domain_batches/eager_class_module_evaluation_probe");
const { StageThreeBatchSourceObserver } = require("../../domain_batches/stage_three_batch_source_observer");
const { RepresentationOnlyReviewedEsmTarget } = require("../../domain_batches/stage_three_reviewed_representation_target");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");


// Validates the published runtime after cutover (Stage 3.N.6): exact published bytes, retired
// placeholders, activation identity and timing, one evaluation, behavior and state shapes.
class StageThreeBatchLiveValidation {
  constructor(root, definition, registry) {
    this.root = path.resolve(root);
    this.definition = definition;
    this.registry = registry;
    this.output = definition.context.paths.live;
  }
  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  verifyPublished() {
    const PROFILE = this.definition.profile;
    const context = this.definition.context;
    const CUTOVER = context.paths.cutover;
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
      if (write.afterBase64 === null) {
        assert(!fs.existsSync(path.join(this.root, write.path)), `Removed file is present: ${write.path}`);
        continue;
      }
      assert.equal(sha(Buffer.from(write.afterBase64, "base64")), write.afterSha256);
      const observationPublished = fs.existsSync(path.join(this.root, context.paths.observation));
      const actual = write.path === PATHS.manifest && observationPublished
        ? beforeBatchObservations(this.definition, this.bytes(write.path), this.root)
        : this.bytes(write.path);
      assert.equal(sha(actual), write.afterSha256, `Published bytes differ: ${write.path}`);
    }
    const runtime = this.json(PATHS.runtimeContract);
    // Retired activations: inert placeholder at the classic path, index slot on it, no generated shim.
    const retired = (runtime.retiredActivations || []).filter(record => record.retiredBy === PROFILE.batchId)
      .map(record => record.activation);
    assert.deepEqual(retired.map(activation => activation.id), PROFILE.executionProfile.expectedRetiredActivationIds || []);
    const html = this.bytes(PATHS.index).toString("utf8");
    const retiredActivations = retired.map(activation => {
      new RetiredActivationPlaceholder().validate({
        code: this.bytes(activation.sourceProvider).toString("utf8"), activation });
      assert.equal(html.split(`<script src="${activation.sourceProvider}"></script>`).length, 2,
        `Retired slot is not the classic placeholder: ${activation.id}`);
      assert(!html.includes(activation.shimFile), `Retired shim is still loaded: ${activation.id}`);
      assert(!fs.existsSync(path.join(this.root, runtime.output.directory + activation.shimFile)));
      return { id: activation.id, legacySymbol: activation.legacySymbol, sourceProvider: activation.sourceProvider };
    });
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
    const app = new StageThreeBatchPlanning(this.root, this.definition);
    const outputValidation = new StageThreeCandidateValidation(this.definition).run({
      app, report: proof.report, contract: runtime, readOutput: file => this.bytes(file).toString("utf8"),
      classicSources, previousRuntimeContract: oldContract, previousRuntimeCode: oldCode,
    });
    assert.deepEqual(outputValidation, proof.validation,
      "Published runtime differs from approved candidate behavior");
    const activation = new CumulativeLiveActivationProbe().run({
      code, runtime, index: this.bytes(PATHS.index).toString("utf8"),
      read: file => this.bytes(file), projectModules: proof.report.projectModules,
    });
    const classSources = proof.sources.filter(source =>
      PROFILE.executionProfile.expectedTargets.find(target => target.targetPath === source.targetPath).exports.length === 1);
    const evaluation = new EagerClassModuleEvaluationProbe().run(code, runtime.transport.symbol, classSources);
    assert.deepEqual(Object.keys(proof.evaluationProof.counts).sort(),
      [...proof.report.projectModules].sort());
    assert(Object.values(proof.evaluationProof.counts).every(count => count === 1));
    const readsBefore = activation.transportReads();
    const shapes = [];
    for (const source of proof.sources) {
      const classicSource = classicSources[source.currentPath];
      const targetSource = this.bytes(source.targetPath).toString("utf8");
      const approved = new RepresentationOnlyReviewedEsmTarget().project({
        source: classicSource, currentPath: source.currentPath, targetPath: source.targetPath,
        exports: PROFILE.executionProfile.expectedTargets.find(target =>
          target.targetPath === source.targetPath).exports,
        sourceSha256: source.sourceSha256,
        contract: PROFILE.reviewedContracts[source.currentPath],
        targetEvaluation: reviewedTargetEvaluation(this.definition, file => this.json(file), source.targetPath),
        imports: app.json(PROFILE.executionProfile.executionPlanPath).scope.modules
          .find(module => module.targetPath === source.targetPath).importsAllowed,
      });
      assert.equal(targetSource, approved.targetSource, "Published ESM source changed");
      // The exact-source comparison above guards the migration; this records the reviewed shape.
      const shape = new StageThreeBatchSourceObserver().observe(classicSource, source.currentPath);
      for (const symbol of PROFILE.executionProfile.expectedTargets.find(target =>
        target.targetPath === source.targetPath).exports) {
        const exported = activation.transport.modules[source.targetPath][symbol];
        for (const test of Object.values(this.definition.cases[symbol])) test(exported);
      }
      shapes.push({ source: source.targetPath, fields: shape.fields,
        methods: shape.methods, allocationTotals: shape.allocationTotals });
    }
    assert.equal(activation.transportReads(), readsBefore);
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-live-runtime-validation",
      batchId: PROFILE.batchId, status: "verified", releaseVersion: state.releaseVersion,
      cutoverSha256: sha(this.bytes(CUTOVER)), runtimeSha256: sha(Buffer.from(code)),
      topology: prebuild.plannedTopology.counts,
      evaluation, activation: activation.evidence, outputValidation,
      stateAndAllocationShapes: shapes, postActivationTransportReads: 0, retiredActivations,
      performanceProof: "exact-source-allocation-sites-and-result-identity; not a frame-time benchmark",
      browserAcceptanceClaimed: false, batchCompleted: false, observationsFinal: false,
      nextGate: `stage-${context.step(7)}-observation-reconciliation`,
    };
  }

  async run({ persist = false } = {}) {
    const OUTPUT = this.output;
    const cutover = this.json(this.definition.context.paths.cutover);
    const replay = await new StageThreeHistoricalWorkspace(this.definition, this.registry).run(this.root,
      root => new StageThreeCutoverProjection(this.definition).prepare(root), { keepPrebuild: true });
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

module.exports = { StageThreeBatchLiveValidation };
