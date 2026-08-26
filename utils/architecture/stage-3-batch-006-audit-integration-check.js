"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  PATHS,
  buildArtifact,
  serialize,
} = require("./generate-stage-3-batch-006-audit");
const {
  StageThreeBatchDependencyStateAuditValidator,
} = require("./domain_batches/stage_three_batch_dependency_state_audit");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch006AuditIntegrationCheck {
  run() {
    const protectedPaths = [
      "src/core/fishing/hold_opposition_resolver.js",
      "src/core/fishing/landing_lift_tension_calculator.js",
      "src/core/fishing/line_constraint_state_resolver.js",
      "src/core/fishing/pole_fight_sector_geometry.js",
      "src/core/fishing/rod_control_tension_mode_resolver.js",
      "src/core/float_tackle_line_budget_policy.js",
      "index.html",
      "architecture/migration/module_migration_manifest.json",
      "architecture/migration/stage_3_domain_audit.json",
      "architecture/migration/stage_3_approved_batches.json",
      "architecture/migration/stage_3_execution_state.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      "architecture/guards/migration_bridge_registry.json",
    ];
    const before = new Map(protectedPaths.map((relativePath) => [
      relativePath,
      this.#read(relativePath),
    ]));
    const state = JSON.parse(this.#read(
      "architecture/migration/stage_3_execution_state.json",
    ).toString("utf8"));
    const historical = state.activeBatchId === "stage-3.candidate-006-fishing-e48e70d8" ||
      state.completedBatchIds.includes("stage-3.candidate-006-fishing-e48e70d8");
    const generated = historical
      ? JSON.parse(this.#read(PATHS.output).toString("utf8"))
      : buildArtifact();
    new StageThreeBatchDependencyStateAuditValidator().validate(generated);
    if (!historical) {
      assert.deepEqual(this.#read(PATHS.output), serialize(generated));
    }
    assert.equal(generated.scope.targetCount, 6);
    assert.equal(generated.closure.existingCumulativeModuleCount, 19);
    assert.equal(generated.closure.newProjectModuleCount, 6);
    assert.equal(generated.closure.resultingProjectModuleCount, 25);
    assert.deepEqual(generated.closure.internalEdges, []);
    assert.deepEqual(generated.closure.alreadyCumulativeDependencies, []);
    assert.deepEqual(generated.closure.unexpectedDependencies, []);
    assert.equal(generated.evaluation.stronglyConnectedComponents.length, 6);
    assert.deepEqual(generated.evaluation.cycles, []);
    assert.deepEqual(generated.boundaries, {
      forbiddenEdges: [],
      directConfigDependencies: [],
      browserCapabilities: [],
      transportReads: [],
    });
    assert.deepEqual(generated.state.unresolved, []);
    assert.deepEqual(generated.effects.unsafe, []);
    assert.equal(generated.compatibility.providers.length, 6);
    assert.equal(generated.compatibility.consumers.length, 7);
    assert.equal(generated.compatibility.activations.length, 6);
    assert.deepEqual(
      generated.compatibility.activations.map((activation) => activation.legacyScriptIndex)
        .sort((left, right) => left - right),
      [88, 123, 126, 130, 134, 140],
    );
    assert.deepEqual(generated.prerequisites, {
      frozen: [],
      newlyDiscovered: [],
    });
    assert.equal(generated.verdict, "eligible-for-execution-plan");
    for (const [relativePath, bytes] of before) {
      assert.deepEqual(this.#read(relativePath), bytes, `audit mutated ${relativePath}`);
    }
    console.log(
      "Stage 3.6.1 dependency/state audit passed: six depth-zero singleton SCCs add exactly six modules to the 19-module cumulative graph; 0 forbidden edges, 0 unresolved state/effects, six activations and seven classic consumer relationships.",
    );
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }
}

new StageThreeBatch006AuditIntegrationCheck().run();
