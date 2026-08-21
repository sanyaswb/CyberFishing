const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  ClassificationCompletionValidator,
} = require("./classification/classification_completion_validator");
const {
  MigrationBatchPlanValidator,
} = require("./classification/migration_batch_plan_validator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);
const PLAN_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "stage_1_6_initial_batches.json",
);

class StageOneSixMigrationBatchPlanCheck {
  constructor({ policyPath, manifestPath, planPath }) {
    this.policyPath = policyPath;
    this.manifestPath = manifestPath;
    this.planPath = planPath;
  }

  run() {
    const manifestBytes = fs.readFileSync(this.manifestPath, "utf8");
    const planBytes = fs.readFileSync(this.planPath, "utf8");
    const manifest = JSON.parse(manifestBytes);
    const plan = JSON.parse(planBytes);
    const classification = new ClassificationCompletionValidator().validate(
      manifest,
    );
    const validator = new MigrationBatchPlanValidator({
      architecturePolicy: ArchitecturePolicy.load(this.policyPath),
    });

    const first = validator.validate({ plan, manifest });
    const second = validator.validate({ plan, manifest });
    assert.deepEqual(second, first, "Batch plan validation must be deterministic");
    assert.equal(
      fs.readFileSync(this.manifestPath, "utf8"),
      manifestBytes,
      "Batch plan validation must not mutate the manifest",
    );
    assert.equal(
      fs.readFileSync(this.planPath, "utf8"),
      planBytes,
      "Batch plan validation must not mutate the plan",
    );

    this.#assertUnknownModuleFails(validator, plan, manifest);
    this.#assertStaleConsumerListFails(validator, plan, manifest);
    this.#assertIncompleteClassificationFails(manifest);

    console.log(
      "Stage 1.6 completion passed: " +
        `${classification.classifiedCount} classified modules ` +
        `(${classification.blockerCount} with blockers), ` +
        `${first.batchCount} concrete batches, ${first.moduleCount} modules, ` +
        `${first.confirmedInterFileEdges} graph edges verified.`,
    );
  }

  #assertUnknownModuleFails(validator, plan, manifest) {
    const fixture = this.#clone(plan);
    fixture.batches[0].modules[0].currentPath =
      "src/stale_stage_1_6_batch_fixture.js";
    assert.throws(
      () => validator.validate({ plan: fixture, manifest }),
      /unknown currentPath/,
    );
  }

  #assertStaleConsumerListFails(validator, plan, manifest) {
    const fixture = this.#clone(plan);
    fixture.batches[0].modules[0].legacyConsumers = [];
    assert.throws(
      () => validator.validate({ plan: fixture, manifest }),
      /legacyConsumers must match derived reverse consumers/,
    );
  }

  #assertIncompleteClassificationFails(manifest) {
    const fixture = this.#clone(manifest);
    fixture.modules[0].architecture.migrationStatus = "legacy";
    assert.throws(
      () => new ClassificationCompletionValidator().validate(fixture),
      /is not classified/,
    );
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

new StageOneSixMigrationBatchPlanCheck({
  policyPath: POLICY_PATH,
  manifestPath: MANIFEST_PATH,
  planPath: PLAN_PATH,
}).run();
