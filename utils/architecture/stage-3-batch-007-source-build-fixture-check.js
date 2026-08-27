"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  StageThreeBatch007SourceBuildContractValidator,
} = require("./domain_batches/stage_three_batch_007_source_build_contract");
const {
  StageThreeCandidateOutputManager,
} = require("./domain_batches/stage_three_candidate_output_manager");
const {
  RepresentationOnlyNamedEsmTarget,
} = require("./domain_batches/stage_three_representation_target");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch007SourceBuildFixtureCheck {
  run() {
    this.#targetFixtures();
    this.#contractFixtures();
    this.#outputSafetyFixtures();
    console.log(
      "Stage 3.7.4 source/build fixtures passed: exact export-only representation, " +
      "forbidden dependency/state/allocation deltas, candidate topology locks and " +
      "candidate-output path safety are enforced.",
    );
  }

  #targetFixtures() {
    const source = "class Example { value() { return 1; } }\n";
    const projector = new RepresentationOnlyNamedEsmTarget();
    const projected = projector.project({
      source,
      currentPath: "src/core/example.js",
      targetPath: "src/game/domain/example.js",
      exportName: "Example",
      sourceSha256: this.#sha256(source),
    });
    assert.equal(projected.targetSource,
      "export class Example { value() { return 1; } }\n");
    assert.equal(projected.validation.behaviorDelta, "none");
    this.#reject(() => projector.validate({
      source: `import { Other } from "./other.js";\n${projected.targetSource}`,
      classicSource: source,
      currentPath: "src/core/example.js",
      targetPath: "src/game/domain/example.js",
      exportName: "Example",
    }));
    this.#reject(() => projector.validate({
      source: projected.targetSource.replace("return 1", "return 2"),
      classicSource: source,
      currentPath: "src/core/example.js",
      targetPath: "src/game/domain/example.js",
      exportName: "Example",
    }));
    this.#reject(() => projector.project({
      source: "class Example { value() { return globalThis.Example; } }\n",
      currentPath: "src/core/example.js",
      targetPath: "src/game/domain/example.js",
      exportName: "Example",
      sourceSha256: this.#sha256("class Example { value() { return globalThis.Example; } }\n"),
    }));
  }

  #contractFixtures() {
    const artifact = JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      "architecture/migration/stage_3_batch_007_source_build_validation.json",
    ), "utf8"));
    const validator = new StageThreeBatch007SourceBuildContractValidator();
    validator.validate(artifact);
    this.#rejectMutation(validator, artifact, (value) => value.sources.pop());
    this.#rejectMutation(validator, artifact, (value) => value.sources[0].behaviorDelta = "changed");
    this.#rejectMutation(validator, artifact, (value) => value.candidateBuild.moduleCount = 30);
    this.#rejectMutation(validator, artifact, (value) => value.candidateBuild.projectModules.pop());
    this.#rejectMutation(validator, artifact, (value) => value.activeRuntimeLocks.indexChanged = true);
    this.#rejectMutation(validator, artifact, (value) => value.runtimeCutoverAllowed = true);
  }

  #outputSafetyFixtures() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage-3-candidate-output-"));
    const manager = new StageThreeCandidateOutputManager(root, "fixture");
    try {
      const staging = manager.createStagingDirectory();
      assert.throws(() => manager.assertControlledChild(
        staging,
        path.resolve(staging, "..", "escape"),
        ".input",
      ));
      manager.discard(staging);
      assert.equal(fs.existsSync(path.join(root, "dist")), false);
    } finally {
      manager.cleanup();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  #rejectMutation(validator, artifact, mutate) {
    const clone = structuredClone(artifact);
    mutate(clone);
    this.#reject(() => validator.validate(clone));
  }

  #reject(operation) {
    assert.throws(operation, /Stage 3/u);
  }

  #sha256(value) {
    return require("node:crypto").createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch007SourceBuildFixtureCheck().run();
