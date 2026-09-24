"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const { PROFILE, PATHS } = require("./stage_three_batch_010_preflight");
const { ClassicClassLoader, DomainBehaviorParityHarness } = require("./stage_three_batch_focused_harness");
const { BATCH_010_EXECUTABLE_CASES } = require("./stage_three_batch_010_behavior_cases");
const { ActivationShimRenderer, ActivationShimContractValidator } = require("../../build/compat_runtime/activation_shim");
const { Batch010ProductionConsumerProbe } = require("../stage-3-batch-010-planning-check");

class Batch010CandidateValidation {
  run({ app, report, contract, readOutput, instrumented = false,
    classicSource = null, previousRuntimeContract = null, previousRuntimeCode = null }) {
    const counts = new Map();
    const context = vm.createContext(instrumented ? {
      __recordEvaluation: source => counts.set(source, (counts.get(source) || 0) + 1),
    } : {});
    const initialKeys = Object.keys(context);
    const runtimeCode = readOutput(contract.output.directory + contract.output.runtimeFile);
    const plan = app.json(PROFILE.executionProfile.executionPlanPath);
    const records = [...contract.activationPositions].sort((a, b) =>
      a.legacyScriptIndex - b.legacyScriptIndex || a.id.localeCompare(b.id));
    const published = new Set();
    const renderer = new ActivationShimRenderer();
    const validator = new ActivationShimContractValidator();
    const runtimePosition = Math.min(...app.json(PATHS.runtimeContract).activationPositions.map(a => a.legacyScriptIndex));
    // The cumulative runtime already loads before the batch 010 provider position.
    assert(runtimePosition < 148);
    for (let position = 1; position <= plan.scriptTopology.before.logicalLegacyPositionCount; position++) {
      if (position < runtimePosition) assert.equal(context[contract.transport.symbol], undefined);
      if (position === runtimePosition) {
        vm.runInContext(runtimeCode, context, { timeout: 5000 });
        assert.deepEqual(Object.keys(context).sort(), [...initialKeys, contract.transport.symbol].sort());
        assert.deepEqual(Object.keys(context[contract.transport.symbol].modules).sort(), report.projectModules);
      }
      for (const activation of records) if (!published.has(activation.id)) {
        assert.equal(context[activation.legacySymbol], undefined, `Early global: ${activation.id}`);
      }
      for (const activation of records.filter(a => a.legacyScriptIndex === position)) {
        const output = report.activationOutputs.find(a => a.activationId === activation.id);
        assert(output, `Missing activation: ${activation.id}`);
        const code = readOutput(output.path);
        assert.equal(code, renderer.render(activation, contract.transport.symbol));
        validator.validate({ code, activation, transportSymbol: contract.transport.symbol });
        vm.runInContext(code, context, { timeout: 1000 });
        assert.equal(context[activation.legacySymbol],
          context[contract.transport.symbol].modules[activation.targetModule][activation.exportName]);
        published.add(activation.id);
      }
    }
    assert.equal(published.size, records.length);
    const target = PROFILE.executionProfile.expectedTargets[0];
    const symbol = target.exports[0];
    const namespace = context[contract.transport.symbol].modules[target.targetPath];
    assert.deepEqual(Object.keys(namespace), [symbol]);
    const classic = new ClassicClassLoader().load(classicSource ?? app.read(target.currentPath), symbol, target.currentPath);
    const candidate = namespace[symbol];
    assert.equal(candidate.name, symbol);
    const behavior = new DomainBehaviorParityHarness().run({
      exportName: symbol, classicClass: classic, esmClass: candidate,
      cases: BATCH_010_EXECUTABLE_CASES[symbol],
    });
    const consumers = new Batch010ProductionConsumerProbe();
    assert.deepEqual(consumers.run(app, classic), consumers.run(app, candidate));
    for (const bridge of plan.compatibility.plannedBridgeRecords) {
      assert(!app.read(bridge.source).includes(contract.transport.symbol));
      for (const provider of bridge.globalProviders) {
        assert(app.read(bridge.source).includes(`new ${provider.symbol}(`));
        assert.equal(context[provider.symbol], candidate);
      }
    }
    const oldContract = previousRuntimeContract ?? app.json(PATHS.runtimeContract);
    const old = vm.createContext({});
    vm.runInContext(previousRuntimeCode ?? app.read(oldContract.output.directory + oldContract.output.runtimeFile), old);
    for (const activation of oldContract.activationPositions) {
      assert.deepEqual(contract.activationPositions.find(a => a.id === activation.id), activation);
      const before = old[oldContract.transport.symbol].modules[activation.targetModule][activation.exportName];
      assert.equal(context[activation.legacySymbol].toString(), before.toString(),
        `Previously published implementation changed: ${activation.id}`);
    }
    if (instrumented) {
      assert.deepEqual([...counts.keys()].sort(), report.projectModules);
      for (const count of counts.values()) assert.equal(count, 1, "Duplicate module evaluation");
    }
    return {
      behavior, consumers: { compositionConstructorObserved: true, assemblyDefaultExecuted: true },
      activationsVerified: published.size,
      exactClassicConsumerRelationships: plan.compatibility.plannedBridgeRecords.length,
      priorExportsImplementationPreserved: oldContract.activationPositions.length,
      globalsAbsentBeforeApprovedPosition: true, exactExportIdentityAfterActivation: true,
      moduleEvaluationCounts: instrumented ? Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))) : null,
      validationScope: instrumented ? "test-only-transform-instrumented-IIFE" : "actual-unmodified-candidate-IIFE",
    };
  }
}

module.exports = { Batch010CandidateValidation };
