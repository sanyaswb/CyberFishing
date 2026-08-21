const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageOneClosureValidator,
  StageTwoSemanticClosureTransition,
} = require("./closure/stage_one_closure_validator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CLOSURE_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "stage_1_closure.json",
);

class StageOneClosureCheck {
  constructor(projectRoot, closurePath) {
    this.projectRoot = projectRoot;
    this.closurePath = closurePath;
  }

  run() {
    const closureBytes = fs.readFileSync(this.closurePath, "utf8");
    const closure = JSON.parse(closureBytes);
    const validator = new StageOneClosureValidator(this.projectRoot);
    const first = validator.validate(closure);
    const second = validator.validate(closure);

    assert.deepEqual(second, first, "Stage 1 closure validation must be deterministic");
    assert.equal(
      fs.readFileSync(this.closurePath, "utf8"),
      closureBytes,
      "Stage 1 closure validation must be read-only",
    );
    this.#assertChangedEvidenceFails(validator, closure);
    this.#assertChangedBaselineFails(validator, closure);
    this.#assertPrematureBridgeFails(validator, closure);
    this.#assertArbitraryReleaseDeltaFails(closure);

    console.log(
      `Stage 1 closure passed for v${first.version}: ` +
        `${first.moduleCount} classified modules, ${first.edgeCount} edges, ` +
        `${first.knownDebtCount} exact known-debt records, ` +
        `${first.approvedBatchCount} approved Stage 2 batches / ` +
        `${first.approvedModuleCount} modules.`,
    );
  }

  #assertChangedEvidenceFails(validator, closure) {
    const fixture = this.#clone(closure);
    fixture.immutableEvidence[0].sha256 = "0".repeat(64);
    assert.throws(() => validator.validate(fixture), /immutable evidence changed/);
  }

  #assertChangedBaselineFails(validator, closure) {
    const fixture = this.#clone(closure);
    fixture.runtimeBaseline.classicScriptCount += 1;
    assert.throws(() => validator.validate(fixture), /classic script count changed/);
  }

  #assertPrematureBridgeFails(validator, closure) {
    const fixture = this.#clone(closure);
    fixture.architectureBaseline.activeBridgeCount = 1;
    assert.throws(
      () => validator.validate(fixture),
      /migration bridges were activated before Stage 2/,
    );
  }

  #assertArbitraryReleaseDeltaFails(closure) {
    const state = this.#readJson(
      "architecture/migration/stage_2_execution_state.json",
    );
    const transition = new StageTwoSemanticClosureTransition({
      projectRoot: this.projectRoot,
      closure,
      state,
    });
    const packagePath = "package.json";
    const source = fs.readFileSync(path.join(this.projectRoot, packagePath), "utf8");
    const unexpected = source.replace(
      '  "private": true,',
      '  "private": true,\n  "unexpectedStageTwoMetadata": true,',
    );
    const expected = closure.immutableEvidence.find(
      (item) => item.path === packagePath,
    ).sha256;
    assert.notEqual(
      transition.normalizedSha256(packagePath, unexpected),
      expected,
      "Semantic closure must not normalize arbitrary release-file changes",
    );
  }

  #readJson(relativePath) {
    return JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8"),
    );
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

new StageOneClosureCheck(PROJECT_ROOT, CLOSURE_PATH).run();
