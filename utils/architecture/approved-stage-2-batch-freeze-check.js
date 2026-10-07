const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageFourClusterLedger } = require("./stage_four/cluster_ledger");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { NativeDevelopmentRetirement } = require("./stage_six/native_development_retirement");
const {
  ApprovedStageTwoBatchValidator,
} = require("./classification/approved_stage_two_batch_validator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class ApprovedStageTwoBatchFreezeCheck {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.paths = Object.freeze({
      policy: path.join(projectRoot, "architecture", "module_architecture.json"),
      manifest: path.join(
        projectRoot,
        "architecture",
        "migration",
        "module_migration_manifest.json",
      ),
      candidates: path.join(
        projectRoot,
        "architecture",
        "migration",
        "stage_1_6_initial_batches.json",
      ),
      approved: path.join(
        projectRoot,
        "architecture",
        "migration",
        "stage_2_approved_batches.json",
      ),
      bridges: path.join(
        projectRoot,
        "architecture",
        "guards",
        "migration_bridge_registry.json",
      ),
      executionState: path.join(
        projectRoot,
        "architecture",
        "migration",
        "stage_2_execution_state.json",
      ),
      index: LegacyScriptOrderReader.sourcePath(projectRoot),
    });
  }

  run() {
    const before = this.#readBytes();
    const values = this.#readValues();
    values.effectiveBridgePlan = StageFourClusterLedger.cumulative(this.projectRoot).stageTwoPlan(values.approvedPlan);
    values.retiredWrappers = this.#retiredWrappers(values.approvedPlan);
    const validator = new ApprovedStageTwoBatchValidator({
      architecturePolicy: ArchitecturePolicy.load(this.paths.policy),
    });

    const first = validator.validate(values);
    const second = validator.validate(values);
    assert.deepEqual(second, first, "Approved batch validation must be deterministic");
    assert.deepEqual(
      this.#readBytes(),
      before,
      "Approved batch validation must be read-only",
    );

    this.#assertChangedTargetFails(validator, values);
    this.#assertAsyncBridgeFails(validator, values);
    this.#assertStaleConsumerFails(validator, values);
    this.#assertUnapprovedBridgeFails(validator, values);
    this.#assertUnretiredWrapperFails(validator, values);

    console.log(
      "Stage 2 batch freeze passed: " +
        `${first.prerequisiteCount} build prerequisite, ` +
        `${first.batchCount} approved batches, ${first.moduleCount} modules, ` +
        `${first.bridgeCount} planned exact IIFE bridges, ` +
        `${first.confirmedInterFileEdges} source graph edges revalidated.`,
    );
  }

  #readValues() {
    return {
      approvedPlan: this.#readJson(this.paths.approved),
      candidatePlan: this.#readJson(this.paths.candidates),
      manifest: this.#readJson(this.paths.manifest),
      bridgeRegistry: this.#readJson(this.paths.bridges),
      executionState: this.#readJson(this.paths.executionState),
      runtimeFacts: this.#runtimeFacts(fs.readFileSync(this.paths.index, "utf8")),
    };
  }

  #readBytes() {
    return Object.fromEntries(
      Object.entries(this.paths).map(([id, filePath]) => [
        id,
        fs.readFileSync(filePath, "utf8"),
      ]),
    );
  }

  #assertChangedTargetFails(validator, values) {
    const fixture = this.#clone(values);
    fixture.approvedPlan.batches[0].modules[0].targetPath =
      "src/engine/assets/guessed_target.js";
    assert.throws(
      () => validator.validate(fixture),
      /targetPath changed/,
    );
  }

  #assertAsyncBridgeFails(validator, values) {
    const fixture = this.#clone(values);
    fixture.approvedPlan.batches[3].bridgeStrategy.kind = "native-esm-script";
    assert.throws(
      () => validator.validate(fixture),
      /synchronous IIFE bridge strategy/,
    );
  }

  #assertStaleConsumerFails(validator, values) {
    const fixture = this.#clone(values);
    fixture.approvedPlan.batches[2].bridgeStrategy.bridges[0].legacyConsumers = [];
    assert.throws(
      () => validator.validate(fixture),
      /bridge consumer set changed/,
    );
  }

  #assertUnapprovedBridgeFails(validator, values) {
    const fixture = this.#clone(values);
    fixture.bridgeRegistry.bridges.push({
      id: "premature-stage-2-bridge",
      owner: "stage-2.1-engine-asset-contracts",
    });
    assert.throws(
      () => validator.validate(fixture),
      /non-contract fields|registry consumer set differs|does not belong to an allowed batch/,
    );
  }

  // Stage 6 native retirement: the frozen wrappers it removed, each with its exact recorded Manifest entry.
  #retiredWrappers(approvedPlan) {
    const retirement = NativeDevelopmentRetirement.read(this.projectRoot);
    if (!retirement) return [];
    const wrappers = new Set(approvedPlan.batches.flatMap((batch) =>
      (batch.bridgeStrategy?.bridges || []).map((bridge) => bridge.wrapperPath)));
    const retired = retirement.removedModules.filter((item) => wrappers.has(item.path))
      .map((item) => ({ path: item.path, manifest: item.manifest }));
    assert.equal(retired.length, wrappers.size, "native retirement must remove every frozen Stage 2 wrapper exactly");
    return retired;
  }

  // A wrapper missing from the Manifest without its exact retirement record, or retired while live, is rejected.
  #assertUnretiredWrapperFails(validator, values) {
    if (values.retiredWrappers.length === 0) return;
    const missing = this.#clone(values);
    missing.retiredWrappers.shift();
    assert.throws(() => validator.validate(missing), /lifecycle does not match its batch/);
    const live = this.#clone(values);
    live.manifest.modules.push(live.retiredWrappers[0].manifest);
    assert.throws(() => validator.validate(live), /is both retired and live/);
    const status = this.#clone(values);
    status.retiredWrappers[0].manifest.architecture.migrationStatus = "classified";
    assert.throws(() => validator.validate(status), /lifecycle does not match its batch/);
  }

  #runtimeFacts(indexHtml) {
    const scripts = [...indexHtml.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/gi)];
    return Object.freeze({
      moduleScriptCount: scripts.filter((match) =>
        /\btype\s*=\s*["']module["']/i.test(match[1]),
      ).length,
    });
  }

  #readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

new ApprovedStageTwoBatchFreezeCheck(PROJECT_ROOT).run();
