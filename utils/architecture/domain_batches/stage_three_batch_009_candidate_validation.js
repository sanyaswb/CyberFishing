"use strict";
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { PROFILE, PATHS } = require("./stage_three_batch_009_planning");
const { ClassicClassLoader, DomainBehaviorParityHarness } = require("./stage_three_batch_focused_harness");
const { BATCH_009_EXECUTABLE_CASES: cases } = require("./stage_three_batch_009_behavior_cases");
const { Batch009FocusedValidation } = require("../stage-3-batch-009-planning-check");
const { ActivationShimRenderer, ActivationShimContractValidator } = require("../../build/compat_runtime/activation_shim");

class Batch009CandidateValidation {
  run({ app, report, contract, readOutput, instrumented = false }) {
    const counts = new Map();
    const context = vm.createContext(instrumented ? { __recordEvaluation: source => counts.set(source, (counts.get(source) || 0) + 1) } : {});
    const beforeKeys = Object.keys(context);
    const runtimeCode = readOutput(contract.output.directory + contract.output.runtimeFile);
    const plan = app.json(PROFILE.executionPlanPath), published = new Set();
    const records = [...contract.activationPositions].sort((a, b) => a.legacyScriptIndex - b.legacyScriptIndex || a.id.localeCompare(b.id));
    const renderer = new ActivationShimRenderer(), validator = new ActivationShimContractValidator();
    for (let position = 1; position <= plan.scriptTopology.before.logicalLegacyPositionCount; position++) {
      if (position < plan.runtimeRelocation.afterLogicalPosition) assert.equal(context[contract.transport.symbol], undefined);
      if (position === plan.runtimeRelocation.afterLogicalPosition) {
        vm.runInContext(runtimeCode, context, { timeout: 5000 });
        assert.deepEqual(Object.keys(context).sort(), [...beforeKeys, contract.transport.symbol].sort(), "Unexpected eager global");
        assert.deepEqual(Object.keys(context[contract.transport.symbol].modules).sort(), report.projectModules);
      }
      for (const a of records) if (!published.has(a.id)) assert.equal(context[a.legacySymbol], undefined, `Early global: ${a.id}`);
      for (const a of records.filter(a => a.legacyScriptIndex === position)) {
        const output = report.activationOutputs.find(o => o.activationId === a.id);
        assert(output, "Missing generated activation");
        const code = readOutput(output.path);
        assert.equal(code, renderer.render(a, contract.transport.symbol));
        validator.validate({ code, activation: a, transportSymbol: contract.transport.symbol });
        vm.runInContext(code, context, { timeout: 1000 });
        assert.equal(context[a.legacySymbol], context[contract.transport.symbol].modules[a.targetModule][a.exportName]);
        published.add(a.id);
      }
    }
    assert.equal(published.size, records.length);
    const namespaces = context[contract.transport.symbol].modules;
    const classic = {}, candidate = {}, behavior = [], loader = new ClassicClassLoader();
    for (const m of PROFILE.expectedTargets) {
      const symbol = m.exports[0];
      classic[symbol] = loader.load(app.read(m.currentPath), symbol, m.currentPath);
      candidate[symbol] = namespaces[m.targetPath][symbol];
      assert.deepEqual(Object.keys(namespaces[m.targetPath]), [symbol]);
      assert.equal(candidate[symbol].name, symbol);
      behavior.push(...new DomainBehaviorParityHarness().run({ exportName: symbol, classicClass: classic[symbol],
        esmClass: candidate[symbol], cases: cases[symbol] }));
    }
    const di = new Batch009FocusedValidation().fixedCatch(app, classic, candidate, loader);
    for (const b of plan.compatibility.plannedBridgeRecords) {
      assert.equal(b.source, "src/app/bootstrap.js");
      assert(!app.read(b.source).includes(contract.transport.symbol));
      for (const p of b.globalProviders) {
        assert(app.read(b.source).includes(`new ${p.symbol}(`));
        assert.equal(context[p.symbol], candidate[p.symbol]);
      }
    }
    const oldContract = app.json(PATHS.runtimeContract), old = vm.createContext({});
    vm.runInContext(app.read(oldContract.output.directory + oldContract.output.runtimeFile), old);
    for (const a of oldContract.activationPositions) {
      assert.deepEqual(contract.activationPositions.find(n => n.id === a.id), a, "Previous exposure contract changed");
      const previous = old[oldContract.transport.symbol].modules[a.targetModule][a.exportName];
      assert.equal(context[a.legacySymbol].toString(), previous.toString(), "Existing bundled implementation changed");
    }
    if (instrumented) {
      assert.deepEqual([...counts.keys()].sort(), report.projectModules);
      for (const n of counts.values()) assert.equal(n, 1, "Duplicate module evaluation");
    }
    return { behavior, fixedCatchOutputs: di, activationsVerified: published.size,
      exactClassicConsumerRelationships: plan.compatibility.plannedBridgeRecords.length,
      priorExportsImplementationPreserved: oldContract.activationPositions.length,
      globalsAbsentBeforeApprovedPosition: true, exactExportIdentityAfterActivation: true,
      moduleEvaluationCounts: instrumented ? Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))) : null,
      validationScope: instrumented ? "test-only-transform-instrumented-IIFE" : "actual-unmodified-candidate-IIFE" };
  }
}
module.exports = { Batch009CandidateValidation };
