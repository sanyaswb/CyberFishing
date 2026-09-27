"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { serialize } = require("./domain_batches/stage_three_live_preflight");
const { StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
const { StageThreeSideEffectReview } = require("./stage_three_batches/lifecycle/side_effect_review");
const { StageThreeBatchPlanning } = require("./stage_three_batches/lifecycle/planning");
const { StageThreeFocusedParityCheck } = require("./stage_three_batches/lifecycle/parity_check");
const { StageThreeBatchPrebuild } = require("./stage_three_batches/lifecycle/prebuild");
const { StageThreeBatchSourceBuild } = require("./stage_three_batches/lifecycle/source_build");
const { StageThreeAtomicCutover } = require("./stage_three_batches/lifecycle/cutover");
const { StageThreeBatchLiveValidation } = require("./stage_three_batches/lifecycle/live_validation");
const { StageThreeKnownDebtResolution } = require("./stage_three_batches/lifecycle/known_debt");
const { StageThreeBatchObservationApplication } = require("./stage_three_batches/lifecycle/observation_application");
const { StageThreeAutomatedAcceptance } = require("./stage_three_batches/lifecycle/automated_acceptance");
const { StageThreeBrowserAcceptanceRecorder } = require("./stage_three_batches/lifecycle/browser_acceptance");
const { StageThreeBatchReleaseProjection, StageThreeBatchReleasePublisher, StageThreeBatchReleaseRegression,
  StageThreeBatchReleaseFinalizer } = require("./stage_three_batches/lifecycle/release");
const { StageThreeBatchRollback } = require("./stage_three_batches/lifecycle/rollback");
const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");
const { StageThreeBatchArchitectureCheck } = require("./stage_three_batches/lifecycle/architecture_check");

const ROOT = path.resolve(__dirname, "../..");

// One command for every lifecycle step of a continuation batch defined under
// utils/architecture/stage_three_batches/definitions/NNN. Each step verifies its predecessor
// artifacts; no step proceeds to cutover or release on its own.
//   node utils/architecture/stage-3-batch.js --batch 026 --step <step> [options]
class StageThreeBatchCommand {
  constructor(argv) {
    this.argv = argv;
    const number = this.option("--batch");
    assert(number, "--batch <NNN> is required");
    this.definition = StageThreeBatchRegistry.load(number);
    this.paths = this.definition.context.paths;
  }

  option(name) {
    const index = this.argv.indexOf(name);
    return index < 0 ? null : this.argv[index + 1];
  }

  exists(file) { return fs.existsSync(path.join(ROOT, file)); }

  requires(...files) {
    for (const file of files) assert(this.exists(file), `Predecessor artifact is missing: ${file}`);
  }

  // Records an immutable artifact once; a later run must reproduce it byte-for-byte.
  record(file, bytes, verify = () => {}) {
    const target = path.join(ROOT, file);
    if (fs.existsSync(target)) {
      assert.deepEqual(fs.readFileSync(target), bytes, `Immutable artifact drift: ${file}`);
      return "verified";
    }
    new ControlledMetadataTransaction({ projectRoot: ROOT }).commit([{ relativePath: file, bytes }], verify);
    return "recorded";
  }

  steps() {
    const d = this.definition, p = this.paths, execution = d.execution, registry = StageThreeBatchRegistry;
    const planning = () => new StageThreeBatchPlanning(ROOT, d);
    return {
      "side-effect-review": async () => new StageThreeSideEffectReview(ROOT, d).run(),
      audit: async () => {
        this.requires(p.sideEffectReview);
        const preflight = planning().preflight;
        const audit = preflight.build();
        return this.record(execution.auditPath, serialize(audit),
          () => preflight.verifyReplay(JSON.parse(fs.readFileSync(path.join(ROOT, execution.auditPath)))));
      },
      plan: async () => {
        this.requires(execution.auditPath);
        const app = planning();
        return this.record(execution.executionPlanPath, app.projector.serialize(app.plan()));
      },
      matrix: async () => {
        this.requires(execution.executionPlanPath);
        return this.record(execution.testMatrixPath, serialize(planning().matrix()));
      },
      parity: async () => {
        this.requires(execution.testMatrixPath);
        const history = new StageThreeHistoricalWorkspace(d, registry);
        return history.run(ROOT, root => new StageThreeFocusedParityCheck(d).run(root)).then(() => "passed");
      },
      prebuild: async () => {
        this.requires(execution.testMatrixPath);
        return new StageThreeBatchPrebuild(ROOT, d).open().verdict;
      },
      "source-build": async () => {
        this.requires(p.prebuild);
        return (await new StageThreeBatchSourceBuild(ROOT, d).run({ persist: true })).verdict;
      },
      cutover: async () => {
        this.requires(p.sourceBuild);
        return (await new StageThreeAtomicCutover(ROOT, d).run()).status;
      },
      live: async () => {
        this.requires(p.cutover);
        return (await new StageThreeBatchLiveValidation(ROOT, d, registry).run({ persist: true })).status;
      },
      "known-debt": async () => {
        this.requires(p.live);
        return new StageThreeKnownDebtResolution(ROOT, d).run()?.status || "no-debt-to-resolve";
      },
      reconcile: async () => {
        this.requires(p.live);
        assert(d.resolvedDebtIds.length === 0 || this.exists(p.knownDebt), "Resolve the reviewed known debt first");
        return (await new StageThreeBatchObservationApplication(ROOT, d, registry).run()).artifact.verdict;
      },
      "automated-acceptance": async () => {
        this.requires(p.observation);
        const evidence = this.option("--suite-evidence");
        assert(evidence, "--suite-evidence <json file> is required");
        const suiteEvidence = JSON.parse(fs.readFileSync(evidence, "utf8"));
        return (await new StageThreeAutomatedAcceptance(ROOT, d, registry).run({ suiteEvidence })).status;
      },
      "browser-acceptance": async () => {
        this.requires(p.automatedAcceptance);
        const statement = this.option("--statement"), consoleStatement = this.option("--console");
        const errors = Number(this.option("--errors")), warnings = Number(this.option("--warnings"));
        assert(statement && consoleStatement, "--statement and --console are required (the owner's words)");
        return new StageThreeBrowserAcceptanceRecorder(ROOT, d)
          .run({ sessionStatement: statement, consoleStatement, errors, warnings }).acceptance.status;
      },
      "release-transition": async () => {
        this.requires(p.acceptance, p.browser);
        if (this.argv.includes("--publish")) {
          new StageThreeBatchReleasePublisher(d).run(ROOT);
          return `published v${d.context.toRelease}`;
        }
        return `projected ${new StageThreeBatchReleaseProjection(d).run(ROOT).writes.length} files; add --publish to write`;
      },
      "release-closure": async () => {
        this.requires(p.releaseTransition);
        if (!this.exists(p.releaseRegression)) new StageThreeBatchReleaseRegression(d).run(ROOT);
        return new StageThreeBatchReleaseFinalizer(d).run(ROOT).status;
      },
      rollback: async () => {
        assert(this.argv.includes("--confirm"), "Rollback rewrites the live tree; add --confirm");
        return `${new StageThreeBatchRollback(ROOT, d).run().length} files restored or removed`;
      },
      history: async () => {
        await new StageThreeBatchArchitectureCheck(d, registry).run(ROOT);
        return "replayed";
      },
    };
  }

  async run() {
    const step = this.option("--step");
    const steps = this.steps();
    assert(Object.hasOwn(steps, step), `--step must be one of: ${Object.keys(steps).join(", ")}`);
    const result = await steps[step]();
    console.log(`${this.definition.context.label(0).replace(/\.0$/u, "")} batch ${this.definition.context.number} ${step}: ${result}`);
    return result;
  }
}

if (require.main === module) {
  Promise.resolve().then(() => new StageThreeBatchCommand(process.argv.slice(2)).run())
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { StageThreeBatchCommand };
