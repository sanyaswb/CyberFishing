"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch011Prebuild, PREBUILD } = require("./stage_three_batch_011_prebuild");
const { Batch011Planning, sha, serialize } = require("./stage_three_batch_011_planning");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_011_preflight_profile");
const { PATHS } = require("./stage_three_live_preflight");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");
const { Batch009EarlierEvaluationGate } = require("./stage_three_batch_009_evaluation_gate");
const { Batch011CandidateWorkspace } = require("./stage_three_batch_011_candidate_workspace");
const { Batch011CandidateValidation } = require("./stage_three_batch_011_candidate_validation");
const { StageThreeBatchCandidateBuild } = require("./stage_three_batch_candidate_build");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");

const OUTPUT = "architecture/migration/stage_3_batch_011_source_build_validation.json";

class Batch011SourceBuild {
  constructor(root) {
    this.root = path.resolve(root);
    this.app = new Batch011Planning(this.root);
    this.prebuild = new Batch011Prebuild(this.root);
  }

  projections() {
    return this.app.json(PROFILE.executionProfile.executionPlanPath).scope.modules.map(module =>
      new RepresentationOnlyNamedEsmTarget().project({
        source: this.app.bytes(module.currentPath).toString("utf8"),
        currentPath: module.currentPath, targetPath: module.targetPath,
        exportName: module.exports[0], sourceSha256: module.sourceSha256,
      }));
  }

  snapshot() {
    const paths = [PATHS.executionState, PATHS.manifest, PATHS.runtimeContract,
      PATHS.bridgeRegistry, PATHS.index, "architecture/build/package_contract.json",
      ...PROFILE.executionProfile.expectedTargets.map(target => target.currentPath),
      "dist/stage-3-compat-runtime/compat_runtime.iife.js"];
    return paths.map(file => ({ file, sha256: sha(this.app.bytes(file)) }));
  }

  async candidate({ instrumented = false, failure = null, mutateOutput = output => output,
    captureOutput = null } = {}) {
    const prebuild = this.prebuild.validateOpen();
    const before = this.snapshot();
    const state = this.app.bytes(PATHS.executionState);
    const workspace = new Batch011CandidateWorkspace();
    try {
      const projections = this.projections();
      const prepared = workspace.prepare(this.app, prebuild, projections);
      const read = file => fs.readFileSync(path.join(workspace.root, file), "utf8");
      const effects = new Batch009EarlierEvaluationGate().verify({
        projectRoot: workspace.root,
        modules: prebuild.plannedTopology.projectModules.map(file => ({ currentPath: file, targetPath: file })),
        read, reviews: prepared.future.sideEffectReviews,
      });
      let validation;
      const viteLoader = async () => {
        if (failure === "loader") throw new Error("injected candidate loader failure");
        const vite = await import("vite");
        return { build: async options => {
          if (!instrumented) return vite.build(options);
          const modules = new Map(prebuild.plannedTopology.projectModules.map(file =>
            [path.resolve(workspace.root, file).replaceAll("\\", "/"), file]));
          return vite.build({ ...options, plugins: [...options.plugins, {
            name: "batch011-test-only-evaluation-counter",
            transform(code, id) {
              const source = modules.get(id.replaceAll("\\", "/"));
              return source ? { code: `${code}\n__recordEvaluation(${JSON.stringify(source)});\n`, map: null } : null;
            },
          }] });
        } };
      };
      const report = await new StageThreeBatchCandidateBuild({
        projectRoot: workspace.root, batchNumber: "011", additionalVirtualModules: [], viteLoader,
        verifyOutput: output => {
          if (failure === "output") throw new Error("injected candidate output rejection");
          validation = new Batch011CandidateValidation().run({ ...mutateOutput(output), app: this.app, instrumented });
          if (captureOutput) captureOutput(output);
        },
      }).run({
        prebuild, approvedPlan: this.app.json(PATHS.approvedPlan),
        executionState: JSON.parse(state), runtimeContract: this.app.json(PATHS.runtimeContract),
        stageTwoApprovedPlan: this.app.json("architecture/migration/stage_2_approved_batches.json"),
        stageTwoExecutionState: this.app.json("architecture/migration/stage_2_execution_state.json"),
      });
      return {
        report, validation, effects,
        sources: projections.map(({ targetSource, ...record }) => record),
        candidateMetadata: {
          manifestSha256: sha(prepared.manifest),
          manifestObservations: "pending-targets-only; historical-provider-facts-not-reconciled",
          indexSha256: sha(prepared.html),
          runtimeContractSha256: sha(serialize(prepared.future)),
          registrySha256: sha(fs.readFileSync(path.join(workspace.root, PATHS.bridgeRegistry))),
          storage: "isolated-candidate-workspace-only", published: false,
        },
      };
    } finally {
      workspace.cleanup();
      assert.deepEqual(this.snapshot(), before, "Candidate operation mutated live files");
      assert.deepEqual(this.app.bytes(PATHS.executionState), state, "Candidate operation changed live lifecycle");
    }
  }

  async prepare() {
    const first = await this.candidate();
    const second = await this.candidate();
    assert.deepEqual(second, first, "Different candidate roots produced different evidence/output");
    const instrumented = await this.candidate({ instrumented: true });
    assert.deepEqual(instrumented.report.projectModules, first.report.projectModules);
    assert.deepEqual(instrumented.validation.behavior, first.validation.behavior);
    return {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-isolated-source-build-validation",
      status: "candidate-build-verified", batchId: PROFILE.batchId,
      sourceReleaseVersion: PROFILE.executionProfile.sourceReleaseVersion,
      plannedReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      prebuildSha256: sha(this.app.bytes(PREBUILD)),
      ...first,
      reproducibility: {
        independentAbsoluteRoots: 2, exactReportAndBytes: true,
        runtimeSha256: first.report.runtimeSha256,
      },
      evaluationProof: {
        scope: instrumented.validation.validationScope,
        runtimeSha256: instrumented.report.runtimeSha256,
        counts: instrumented.validation.moduleEvaluationCounts,
        productionSourceChanged: false,
      },
      liveTopology: this.prebuild.validateOpen().activeTopology.counts,
      nextGate: "stage-3.11.5-atomic-runtime-cutover",
      runtimeCutoverPerformed: false,
      verdict: "eligible-for-atomic-runtime-cutover",
    };
  }

  async run({ persist = false } = {}) {
    const artifact = await this.prepare();
    const bytes = serialize(artifact);
    const target = path.join(this.root, OUTPUT);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes, "Frozen candidate build evidence drift");
    else if (persist) new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => {
      assert.deepEqual(fs.readFileSync(target), bytes);
      this.prebuild.validateOpen();
    });
    else throw new Error("Candidate evidence missing; use explicit generation command");
    return artifact;
  }
}

module.exports = { Batch011SourceBuild, OUTPUT };
