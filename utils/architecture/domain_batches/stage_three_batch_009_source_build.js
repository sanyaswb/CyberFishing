"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch009Prebuild } = require("./stage_three_batch_009_prebuild");
const { Batch009Planning, PROFILE, PATHS, sha, serialize } = require("./stage_three_batch_009_planning");
const { PREBUILD, STATE } = require("./stage_three_batch_009_prebuild_history");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");
const { Batch009EarlierEvaluationGate } = require("./stage_three_batch_009_evaluation_gate");
const { Batch009CandidateWorkspace } = require("./stage_three_batch_009_candidate_workspace");
const { Batch009CandidateValidation } = require("./stage_three_batch_009_candidate_validation");
const { StageThreeBatchCandidateBuild } = require("./stage_three_batch_candidate_build");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");
const OUTPUT = "architecture/migration/stage_3_batch_009_source_build_validation.json";

class Batch009SourceBuild {
  constructor(root) { this.root = path.resolve(root); this.app = new Batch009Planning(this.root); this.prebuild = new Batch009Prebuild(this.root); }
  projections() {
    return this.app.json(PROFILE.executionPlanPath).scope.modules.map(m => new RepresentationOnlyNamedEsmTarget().project({
      source: this.app.read(m.currentPath), currentPath: m.currentPath, targetPath: m.targetPath,
      exportName: m.exports[0], sourceSha256: m.sourceSha256 }));
  }
  async candidate({ instrumented = false, failure = null, mutateOutput = output => output, captureOutput = null } = {}) {
    const prebuild = this.prebuild.validate(), before = this.prebuild.protectedSnapshot(), state = this.prebuild.raw(STATE);
    const workspace = new Batch009CandidateWorkspace();
    try {
      const projections = this.projections();
      const prepared = workspace.prepare(this.app, prebuild, projections);
      const read = file => fs.readFileSync(path.join(workspace.root, file), "utf8");
      const effects = new Batch009EarlierEvaluationGate().verify({ projectRoot: workspace.root,
        modules: prebuild.plannedTopology.projectModules.map(p => ({ currentPath: p, targetPath: p })), read,
        reviews: prepared.future.sideEffectReviews });
      let validation;
      const viteLoader = async () => {
        if (failure === "loader") throw new Error("injected candidate loader failure");
        const vite = await import("vite");
        return { build: async options => {
          if (!instrumented) return vite.build(options);
          const modules = new Map(prebuild.plannedTopology.projectModules.map(p => [path.resolve(workspace.root, p).replaceAll("\\", "/"), p]));
          return vite.build({ ...options, plugins: [...options.plugins, { name: "batch009-test-only-evaluation-counter",
            transform(code, id) { const source = modules.get(id.replaceAll("\\", "/"));
              return source ? { code: `${code}\n__recordEvaluation(${JSON.stringify(source)});\n`, map: null } : null; } }] });
        } };
      };
      const report = await new StageThreeBatchCandidateBuild({ projectRoot: workspace.root, batchNumber: "009",
        additionalVirtualModules: [], viteLoader, verifyOutput: output => {
          if (failure === "output") throw new Error("injected candidate output rejection");
          validation = new Batch009CandidateValidation().run({ ...mutateOutput(output), app: this.app, instrumented });
          if (captureOutput) captureOutput(output);
        } }).run({ prebuild, approvedPlan: this.app.json(PATHS.approvedPlan),
          executionState: JSON.parse(state), runtimeContract: this.app.json(PATHS.runtimeContract),
          stageTwoApprovedPlan: this.app.json("architecture/migration/stage_2_approved_batches.json"),
          stageTwoExecutionState: this.app.json("architecture/migration/stage_2_execution_state.json") });
      return { report, validation, effects, sources: projections.map(({ targetSource, ...m }) => m),
        candidateMetadata: { manifestSha256: sha(prepared.manifest), manifestObservations: "pending-targets-only; historical-provider-facts-not-reconciled",
          indexSha256: sha(prepared.html), runtimeContractSha256: sha(serialize(prepared.future)),
          registrySha256: sha(fs.readFileSync(path.join(workspace.root, PATHS.bridgeRegistry))),
          storage: "isolated-candidate-workspace-only", published: false } };
    } finally {
      workspace.cleanup();
      assert.deepEqual(this.prebuild.protectedSnapshot(), before, "Candidate operation mutated live files");
      assert.deepEqual(this.prebuild.raw(STATE), state, "Candidate operation changed live lifecycle");
    }
  }
  async prepare() {
    const first = await this.candidate(), second = await this.candidate();
    assert.deepEqual(second, first, "Different absolute candidate roots produced different evidence/output");
    const instrumented = await this.candidate({ instrumented: true });
    assert.deepEqual(instrumented.report.projectModules, first.report.projectModules);
    assert.deepEqual(instrumented.validation.behavior, first.validation.behavior);
    assert.deepEqual(instrumented.validation.fixedCatchOutputs, first.validation.fixedCatchOutputs);
    return { schemaVersion: 1, kind: "cyber-fishing-stage-3-isolated-source-build-validation",
      status: "candidate-build-verified", batchId: PROFILE.batchId, sourceReleaseVersion: PROFILE.sourceReleaseVersion,
      plannedReleaseVersion: PROFILE.targetReleaseVersion, prebuildSha256: sha(this.prebuild.raw(PREBUILD)),
      ...first, reproducibility: { independentAbsoluteRoots: 2, exactReportAndBytes: true, runtimeSha256: first.report.runtimeSha256 },
      evaluationProof: { scope: instrumented.validation.validationScope, runtimeSha256: instrumented.report.runtimeSha256,
        counts: instrumented.validation.moduleEvaluationCounts, productionSourceChanged: false },
      liveTopology: this.prebuild.validate().activeTopology.counts,
      nextGate: "stage-3.9.5-atomic-runtime-cutover", runtimeCutoverPerformed: false,
      verdict: "eligible-for-atomic-runtime-cutover" };
  }
  async run({ persist = false } = {}) {
    const artifact = await this.prepare(), bytes = serialize(artifact), target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes, "Frozen candidate build evidence drift");
    else if (persist) new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => { assert.deepEqual(fs.readFileSync(target), bytes); this.prebuild.validate(); });
    else throw new Error("Candidate evidence missing; use explicit generation command");
    return artifact;
  }
}
module.exports = { Batch009SourceBuild, OUTPUT };
