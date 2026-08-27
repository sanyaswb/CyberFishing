"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_007_EXECUTABLE_CASES,
} = require("./domain_batches/stage_three_batch_007_behavior_cases");
const {
  ActivationTimingHarness,
  ClassicClassLoader,
  DomainBehaviorParityHarness,
  RepresentationEquivalenceGuard,
  TemporaryEsmModuleFixtureBoundary,
} = require("./domain_batches/stage_three_batch_focused_harness");
const {
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");
const {
  PATHS,
  buildMatrix,
  matrixDependencies,
  serialize,
} = require("./generate-stage-3-batch-007-test-matrix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PROTECTED_PATHS = Object.freeze([
  "src",
  "index.html",
  "architecture/migration/module_migration_manifest.json",
  "architecture/migration/stage_3_execution_state.json",
  "architecture/migration/stage_3_compatibility_runtime.json",
  "architecture/guards/migration_bridge_registry.json",
]);

class StageThreeBatch007FocusedTestMatrixCheck {
  async run() {
    const before = this.#snapshotProtectedPaths();
    const fixtureBoundary = new TemporaryEsmModuleFixtureBoundary();
    try {
      const matrix = new StageThreeBatchFocusedTestMatrixValidator(matrixDependencies())
        .validate(buildMatrix());
      assert.deepEqual(this.#readBytes(PATHS.output), serialize(matrix));

      const planBytes = this.#readBytes(matrix.sourceExecutionPlan.path);
      assert.equal(this.#sha256(planBytes), matrix.sourceExecutionPlan.sha256);
      const plan = JSON.parse(planBytes.toString("utf8"));
      const audit = JSON.parse(this.#readText("architecture/migration/stage_3_batch_007_audit.json"));
      const runtimeContract = JSON.parse(this.#readText(
        "architecture/migration/stage_3_compatibility_runtime.json",
      ));

      const definitions = this.#moduleDefinitions(plan);
      const temporaryModules = await fixtureBoundary.load(definitions);
      const behaviorResults = this.#verifyBehaviorParity({
        definitions,
        temporaryModules,
        matrix,
        transportSymbol: runtimeContract.transport.symbol,
      });
      const timingResults = this.#verifyActivationTiming({
        plan,
        runtimeContract,
        temporaryModules,
      });
      this.#verifyConsumers({ plan, audit, transportSymbol: runtimeContract.transport.symbol });
      this.#verifyStateAndPerformance({ matrix, audit, definitions, temporaryModules });
      this.#verifyCompatibilityCoverage(matrix, timingResults);

      assert.equal(behaviorResults.length, 54);
      assert.equal(timingResults.length, 6);
      assert.equal(matrix.compatibilityCases.length, 8);
      assert.equal(matrix.verdict, "eligible-for-prebuild-open");
      assert.equal(matrix.runtimeCutoverAllowed, false);
    } finally {
      fixtureBoundary.cleanup();
      assert.deepEqual(this.#snapshotProtectedPaths(), before,
        "Stage 3.7.2 changed protected runtime or architecture state");
    }

    console.log(
      "Stage 3.7.2 focused test matrix passed: 54 classic↔temporary-ESM behavior cases, " +
      "8 compatibility contracts, 6 exact module identities and 9 classic consumers verified; " +
      "runtime changes = 0.",
    );
  }

  #moduleDefinitions(plan) {
    return plan.scope.modules.map((module) => {
      assert.equal(module.exports.length, 1, `${module.currentPath} must have one exact export`);
      assert.equal(fs.existsSync(this.#absolute(module.targetPath)), false,
        `${module.targetPath} must not exist before runtime cutover`);
      return Object.freeze({
        ...module,
        exportName: module.exports[0],
        absoluteCurrentPath: this.#absolute(module.currentPath),
      });
    });
  }

  #verifyBehaviorParity({ definitions, temporaryModules, matrix, transportSymbol }) {
    const loader = new ClassicClassLoader();
    const parity = new DomainBehaviorParityHarness();
    const representation = new RepresentationEquivalenceGuard();
    const results = [];
    for (const module of definitions) {
      const loaded = temporaryModules.get(module.exportName);
      assert(loaded, `Temporary ESM module missing: ${module.exportName}`);
      const classicClass = loader.load(loaded.classicSource, module.exportName, module.currentPath);
      const esmClass = loaded.namespace[module.exportName];
      assert.equal(typeof esmClass, "function", `${module.exportName} is not a named class export`);
      representation.validate({
        classicSource: loaded.classicSource,
        candidateSource: loaded.candidateSource,
        exportName: module.exportName,
        transportSymbol,
      });
      const cases = BATCH_007_EXECUTABLE_CASES[module.exportName];
      assert(cases, `Executable behavior cases missing: ${module.exportName}`);
      results.push(...parity.run({ exportName: module.exportName, classicClass, esmClass, cases }));
    }
    const expectedIds = matrix.behaviorCases.map((item) => item.id).sort();
    const actualIds = results
      .map((item) => `behavior/${item.exportName}/${item.caseName}`)
      .sort();
    assert.deepEqual(actualIds, expectedIds, "Executable behavior coverage differs from matrix");
    return results;
  }

  #verifyActivationTiming({ plan, runtimeContract, temporaryModules }) {
    assert.equal(runtimeContract.transport.ownsGameState, false);
    assert.equal(runtimeContract.transport.surface, "module-exports-only");
    const namespacesByTarget = new Map(plan.scope.modules.map((module) => [
      module.targetPath,
      temporaryModules.get(module.exports[0]).namespace,
    ]));
    const results = new ActivationTimingHarness().run({
      contract: runtimeContract,
      activations: plan.compatibility.activations,
      namespacesByTarget,
    });
    const properties = [...new Set(results.map((item) => item.transportSurfaceProperty))];
    assert.deepEqual(properties, ["modules"],
      "Renderer must discover the canonical runtime module surface");
    return results;
  }

  #verifyConsumers({ plan, audit, transportSymbol }) {
    const planned = plan.compatibility.plannedBridgeRecords;
    const observed = audit.compatibility.consumers;
    assert.equal(planned.length, 9);
    assert.equal(observed.length, 9);
    const plannedSet = planned.map((record) =>
      `${record.source}|${record.target}|${record.globalProviders.map((item) => item.symbol).join(",")}`,
    ).sort();
    const observedSet = observed.map((record) => {
      const target = plan.scope.modules.find((module) => module.currentPath === record.provider)?.targetPath;
      return `${record.source}|${target}|${record.symbols.join(",")}`;
    }).sort();
    assert.deepEqual(plannedSet, observedSet, "Nine-consumer set differs from audited facts");
    for (const record of planned) {
      const source = this.#readText(record.source);
      assert.equal(source.includes(transportSymbol), false,
        `${record.source} reads the compatibility transport directly`);
      for (const provider of record.globalProviders) {
        assert.match(source, new RegExp(`\\b${provider.symbol}\\b`, "u"),
          `${record.source} no longer consumes ${provider.symbol}`);
      }
    }
  }

  #verifyStateAndPerformance({ matrix, audit, definitions, temporaryModules }) {
    assert.equal(matrix.statePerformanceContract.modules.length, 6);
    assert.equal(matrix.statePerformanceContract.additionalMigrationAllocationsAllowed, 0);
    assert.equal(matrix.statePerformanceContract.transportLookupsAllowed, 0);
    for (const contract of matrix.statePerformanceContract.modules) {
      const audited = audit.scope.modules.find((module) => module.currentPath === contract.module);
      const definition = definitions.find((module) => module.currentPath === contract.module);
      assert(audited && definition, `State/performance evidence missing: ${contract.module}`);
      assert.equal(contract.authoritativeOwnerPreserved, true);
      assert.equal(contract.duplicateStateCopies, "forbidden");
      assert.equal(contract.additionalMigrationAllocationsAllowed, 0);
      assert.equal(contract.transportLookupsAllowed, 0);
      assert.deepEqual(contract.allocationBaseline, audited.sourceShape.allocationTotals);
      assert.equal(
        temporaryModules.get(definition.exportName).candidateSource.includes(
          "__CYBER_FISHING_COMPAT_RUNTIME__",
        ),
        false,
      );
    }
  }

  #verifyCompatibilityCoverage(matrix, timingResults) {
    const expected = new Set([
      "activation-shims-match-renderer-output",
      "class-and-state-identity-preserved",
      "domain-does-not-read-transport-global",
      "globals-absent-before-activation",
      "globals-equal-contract-derived-module-export-after-activation",
      "module-evaluation-count-equals-one",
      "nine-classic-consumers-retain-api",
      "transport-surface-derived-from-runtime-contract",
    ]);
    assert.deepEqual(
      new Set(matrix.compatibilityCases.map((item) => item.caseName)),
      expected,
    );
    assert.equal(timingResults.every((item) => item.exactExportIdentity), true);
  }

  #snapshotProtectedPaths() {
    const result = {};
    for (const relativePath of PROTECTED_PATHS) {
      const absolutePath = this.#absolute(relativePath);
      if (fs.statSync(absolutePath).isDirectory()) {
        const files = this.#walk(absolutePath);
        result[relativePath] = files.map((file) => [
          path.relative(PROJECT_ROOT, file).replaceAll("\\", "/"),
          this.#sha256(fs.readFileSync(file)),
        ]);
      } else {
        result[relativePath] = this.#sha256(fs.readFileSync(absolutePath));
      }
    }
    return result;
  }

  #walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? this.#walk(item) : [item];
      })
      .sort();
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #readBytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #readText(relativePath) {
    return this.#readBytes(relativePath).toString("utf8");
  }
}

if (require.main === module) {
  new StageThreeBatch007FocusedTestMatrixCheck().run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { StageThreeBatch007FocusedTestMatrixCheck };
