"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const espree = require("espree");
const { immutableRecord } = require("../guards/core/guard_models");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { validateCutoverArtifact } = require("./stage_three_batch_008_cutover");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const { ClassicClassLoader, DomainBehaviorParityHarness, RepresentationEquivalenceGuard } = require("./stage_three_batch_focused_harness");
const { StageThreeBatchSourceObserver } = require("./stage_three_batch_source_observer");
const { BATCH_008_EXECUTABLE_CASES } = require("./stage_three_batch_008_behavior_cases");
const { BATCH_007_EXECUTABLE_CASES } = require("./stage_three_batch_007_behavior_cases");
const { EagerClassModuleEvaluationProbe } = require("./eager_class_module_evaluation_probe");
const { CumulativeLiveActivationProbe } = require("./cumulative_live_activation_probe");
const { StageThreeBatch008StateProbe } = require("./stage_three_batch_008_state_probe");

const PREFIX = "architecture/migration/";
const PATHS = Object.freeze({ audit: `${PREFIX}stage_3_batch_008_audit.json`,
  plan: `${PREFIX}stage_3_batch_008_execution_plan.json`, matrix: `${PREFIX}stage_3_batch_008_test_matrix.json`,
  prebuild: `${PREFIX}stage_3_batch_008_prebuild_contract.json`, sourceBuild: `${PREFIX}stage_3_batch_008_source_build_validation.json`,
  cutover: `${PREFIX}stage_3_batch_008_runtime_cutover.json`, state: `${PREFIX}stage_3_execution_state.json`,
  runtime: `${PREFIX}stage_3_compatibility_runtime.json`, registry: "architecture/guards/migration_bridge_registry.json",
  manifest: `${PREFIX}module_migration_manifest.json`, index: "index.html", package: "package.json" });
const OUTPUT = `${PREFIX}stage_3_batch_008_live_runtime_validation.json`;

// Read-only orchestration. Probe responsibilities (evaluation, exposure, state)
// are separate; only the explicit CLI generator can persist the returned report.
class StageThreeBatch008LiveValidation {
  constructor(root, { read } = {}) {
    this.root = path.resolve(root);
    const actualRead = read || ((relative) => fs.readFileSync(path.join(this.root, relative)));
    // Preserve the accepted 3.8.6 evidence language. Only the exact, separately
    // validated Manifest observation delta is reversed; runtime/source are live.
    this.read = (relative) => {
      const { beforeBatch008Release } = require("./stage_three_batch_008_release_transition");
      const bytes = beforeBatch008Release(relative, actualRead(relative), this.root);
      if (relative !== PATHS.manifest) return bytes;
      const { beforeBatch008Observations } = require("./stage_three_batch_008_observation_transition");
      return beforeBatch008Observations(bytes, this.root);
    };
  }

  run() {
    const evidence = new Map();
    const read = (file) => {
      const bytes = this.read(file);
      const sha256 = fingerprint(bytes);
      if (evidence.has(file)) assert.equal(evidence.get(file), sha256, `Input changed during validation: ${file}`);
      evidence.set(file, sha256);
      return bytes;
    };
    const json = (file) => JSON.parse(read(file));
    const inputs = Object.fromEntries(Object.entries(PATHS).map(([key, file]) =>
      [key, key === "index" ? read(file).toString("utf8") : json(file)]));
    const { audit, plan, matrix, prebuild, sourceBuild, cutover, state, runtime, registry, manifest, index } = inputs;
    validateCutoverArtifact(cutover, prebuild, sourceBuild);
    for (const item of [audit, plan, matrix, prebuild, sourceBuild, cutover]) assert.equal(item.batchId, PROFILE.batchId);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
    assert.equal(state.releaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
    assert.equal(inputs.package.version, state.releaseVersion);
    assert.deepEqual(sourceBuild.sources.map((item) => item.targetPath).sort(),
      PROFILE.executionProfile.expectedTargets.map((item) => item.targetPath).sort());
    assert.deepEqual(runtime.activationPositions.filter((item) => item.owner === PROFILE.batchId),
      prebuild.preliminaryMetadata.plannedActivationPositions);
    assert.deepEqual(registry.bridges.filter((item) => item.owner === PROFILE.batchId), prebuild.preliminaryMetadata.plannedBridges);
    assert.deepEqual(runtime.activationPositions.map((item) => item.id).sort(), cutover.topology.activationIds);
    assert.deepEqual(registry.bridges.map((item) => item.id).sort(), cutover.topology.bridgeIds);
    // Exact post-cutover source/runtime metadata, without reconciling pending facts.
    for (const write of cutover.writes) assert.equal(fingerprint(read(write.path)), write.afterSha256,
      `Active runtime changed since accepted cutover: ${write.path}`);
    for (const source of sourceBuild.sources) {
      const item = manifest.modules.find((entry) => entry.currentPath === source.targetPath);
      assert.equal(item?.architecture.migrationStatus, "migrating");
      assert.equal(item.analysis.dependencies.status, "pending");
    }
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    const code = read(runtimePath).toString("utf8");
    assert.equal(fingerprint(Buffer.from(code)), cutover.build.runtimeSha256);
    const evaluation = new EagerClassModuleEvaluationProbe().run(code, runtime.transport.symbol, sourceBuild.sources);
    const live = new CumulativeLiveActivationProbe().run({ code, runtime, index, read,
      projectModules: cutover.topology.projectModules });
    const readsBeforeBehavior = live.transportReads();
    const performance = [], behavior = [], types = {};
    for (const [batch, catalog] of [["008", BATCH_008_EXECUTABLE_CASES], ["007", BATCH_007_EXECUTABLE_CASES]]) {
      const proof = batch === "008" ? sourceBuild : json(`${PREFIX}stage_3_batch_007_source_build_validation.json`);
      for (const source of proof.sources) {
        const target = read(source.targetPath).toString("utf8");
        const classic = target.replace(`export class ${source.exportName}`, `class ${source.exportName}`);
        assert.equal(fingerprint(Buffer.from(target)), source.targetSha256);
        assert.equal(fingerprint(Buffer.from(classic)), source.sourceSha256);
        new RepresentationEquivalenceGuard().validate({ classicSource: classic, candidateSource: target,
          exportName: source.exportName, transportSymbol: runtime.transport.symbol });
        const type = live.transport.modules[source.targetPath][source.exportName];
        assert.equal(live.context[source.exportName], type);
        assert.equal(type.name, source.exportName, "Bundling changed observable Class.name");
        types[source.exportName] = type;
        const cases = new DomainBehaviorParityHarness().run({ exportName: source.exportName,
          classicClass: new ClassicClassLoader().load(classic, source.exportName, source.currentPath),
          esmClass: type, cases: catalog[source.exportName] });
        behavior.push(...cases.map((item) => ({ batch, ...item })));
        if (batch !== "008") continue;
        const frozen = audit.scope.modules.find((item) => item.targetPath === source.targetPath);
        const shape = new StageThreeBatchSourceObserver().observe(classic, source.currentPath);
        assert.deepEqual(shape, frozen.sourceShape);
        assert.deepEqual(shape.forbiddenReads, []);
        assert.deepEqual(shape.topLevelEffects, []);
        assert.deepEqual(shape.topLevelBindings, []);
        assert.equal(target.includes(runtime.transport.symbol), false);
        performance.push({ source: source.targetPath, allocationSites: shape.allocationTotals,
          methods: shape.methods, additionalMigrationAllocationSites: 0, domainTransportReads: 0,
          proof: "exact-classic-sha-and-export-only-ast-equality" });
      }
    }
    assert.deepEqual(behavior.filter((item) => item.batch === "008").map((item) => `${item.exportName}/${item.caseName}`).sort(),
      matrix.behaviorCases.map((item) => `${item.exportName}/${item.caseName}`).sort());
    const stateProbe = new StageThreeBatch008StateProbe();
    const stateEvidence = stateProbe.run(types);
    stateEvidence.actualLineSystem = stateProbe.lineSystem({ context: live.context, type: types.LineSpoolState,
      source: read("src/systems/line_system.js").toString("utf8") });
    const consumers = this.#consumers({ read, prebuild, context: live.context, types, runtime });
    assert.equal(live.transportReads(), readsBeforeBehavior, "Domain/consumer work performed a transport lookup");
    for (const [file, sha256] of evidence) assert.equal(fingerprint(this.read(file)), sha256, "Read-only probe mutated input");
    return immutableRecord({ schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-008-live-validation",
      status: "verified", batchId: PROFILE.batchId, releaseVersion: state.releaseVersion,
      evidence: [...evidence].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, sha256]) => ({ path: file, sha256 })),
      lifecycle: { completedBatchIds: state.completedBatchIds, activeBatchId: state.activeBatchId,
        activeBatchPhase: state.activeBatchPhase, batchCompleted: false },
      runtime: { ...live.evidence, virtualBuildModules: cutover.build.virtualBuildModules,
        bridgeCount: registry.bridges.length, bundleSha256: cutover.build.runtimeSha256 },
      evaluation: { method: "in-memory-namespace-and-class-initialization-probes-on-exact-bundle",
        scope: "three-eager-single-class-leaf-modules", productionBytesChanged: false, modules: evaluation },
      behavior: { method: "uninstrumented-actual-bundle-vs-hash-pinned-classic", cases: behavior },
      state: stateEvidence, consumers, performance: { modules: performance,
        transportReadsDuringBehaviorStateAndConsumers: live.transportReads() - readsBeforeBehavior,
        scope: "allocation-site-equivalence-not-heap-or-frame-time-benchmark" },
      verdict: "eligible-for-observation-reconciliation", nextGate: "stage-3.8.7-observation-and-manifest-reconciliation" });
  }

  #consumers({ read, prebuild, context, types, runtime }) {
    return prebuild.preliminaryMetadata.plannedBridges.map((bridge) => {
      const symbol = bridge.globalProviders[0].symbol;
      const code = read(bridge.source).toString("utf8");
      assert.equal(code.includes(runtime.transport.symbol), false);
      assert.equal(context[symbol], types[symbol]);
      const tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "script", range: true });
      const consumer = tree.body.find((node) => node.type === "ClassDeclaration");
      assert(consumer, "Expected exact classic consumer class");
      // Execute the actual dependent field initializer, preserving its guarded
      // expression. Avoid constructing the unrelated FightPhysics dependency graph.
      let fieldInitializerChecked = false;
      const fields = consumer.body.body.filter((node) => node.type === "PropertyDefinition" &&
        node.value && code.slice(node.value.start, node.value.end).includes(symbol));
      if (symbol !== "LineSpoolState") {
        assert.equal(fields.length, 1);
        const field = fields[0];
        const value = vm.runInContext(`(${code.slice(field.value.start, field.value.end)})`, context, { timeout: 1000 });
        assert.equal(Object.getPrototypeOf(value), types[symbol].prototype);
        assert.equal(value.constructor, types[symbol]);
        fieldInitializerChecked = true;
      }
      return { bridgeId: bridge.id, source: bridge.source, target: bridge.target, symbol,
        sourceSha256: fingerprint(Buffer.from(code)), exactGlobalClass: true, transportReads: 0,
        proof: fieldInitializerChecked ? "actual-classic-field-initializer" : "actual-LineSystem-construction-and-mutation" };
    });
  }
}

// Exact deterministic replay is the executable report schema: rejects omissions,
// extra claims, stale input hashes and forged measurements, not just false flags.
class StageThreeBatch008LiveValidationContract {
  validate(value, observed) {
    assert.equal(observed.kind, "cyber-fishing-stage-3-batch-008-live-validation");
    assert.equal(observed.status, "verified");
    assert.deepEqual(value, JSON.parse(canonicalBytes(observed)), "Live evidence differs from independently replayed observations");
    return immutableRecord(value);
  }
}

module.exports = { StageThreeBatch008LiveValidation, StageThreeBatch008LiveValidationContract, OUTPUT };
