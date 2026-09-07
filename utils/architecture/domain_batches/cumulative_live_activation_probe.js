"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageThreeRuntimeScriptAliasResolver } = require("../migration/stage_three_runtime_script_alias_resolver");
const { ActivationShimRenderer, ActivationShimContractValidator } = require("../../build/compat_runtime/activation_shim");

class CumulativeLiveActivationProbe {
  run({ code, runtime, index, read, projectModules }) {
    let transport, assignments = 0, reads = 0;
    const sandbox = {};
    Object.defineProperty(sandbox, runtime.transport.symbol, {
      get() { reads += 1; return transport; },
      set(value) { assignments += 1; transport = value; },
    });
    const context = vm.createContext(sandbox);
    vm.runInContext(code, context, { timeout: 5000 });
    assert.equal(assignments, 1);
    assert.equal(reads, 0, "Early transport dependency during module evaluation");
    assert.equal(transport.ownsGameState, false);
    assert(Object.isFrozen(transport) && Object.isFrozen(transport.modules));
    assert.deepEqual(Object.keys(transport).sort(), ["kind", "modules", "ownsGameState"]);
    assert.deepEqual(Object.keys(transport.modules).sort(), projectModules);
    const logical = new LegacyScriptOrderReader(null, { scriptAliases:
      new StageThreeRuntimeScriptAliasResolver().resolve(runtime) }).parse(index);
    const physical = new LegacyScriptOrderReader(null).parse(index);
    assert(physical.every((item) => item.type === "classic"));
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    assert.equal(physical.filter((item) => item.currentPath === runtimePath).length, 1);
    const firstActivation = Math.min(...runtime.activationPositions.map((item) => item.legacyScriptIndex));
    const firstShim = logical.find((item) => item.legacyLoadOrder === firstActivation)?.source;
    assert.equal(physical.findIndex((item) => item.currentPath === firstShim),
      physical.findIndex((item) => item.currentPath === runtimePath) + 1,
      "Cumulative evaluation must immediately precede the first approved exposure");
    const pending = new Map(runtime.activationPositions.map((item) => [item.id, item]));
    assert.equal(pending.size, runtime.activationPositions.length, "Duplicate activation ID");
    const exposed = new Map(), timing = [];
    // Walk real logical positions, but execute only compatibility scripts here.
    // This is VM identity/timing validation, not a browser/gameplay simulation.
    for (const script of logical) {
      for (const item of pending.values()) assert.equal(context[item.legacySymbol], undefined,
        `Early exposure before logical position ${item.legacyScriptIndex}: ${item.legacySymbol}`);
      for (const [symbol, value] of exposed) assert.equal(context[symbol], value, "Existing identity overwritten");
      const atPosition = [...pending.values()].filter((item) => item.legacyScriptIndex === script.legacyLoadOrder);
      const shims = new Set();
      for (const item of atPosition) {
        const shimPath = `${runtime.output.directory}${item.shimFile}`;
        // A shared logical position may have several exact exposure statements.
        assert.equal(script.currentPath, item.sourceProvider, "Activation provider moved logical position");
        assert.equal(physical.filter((entry) => entry.currentPath === shimPath).length, 1);
        const shim = read(shimPath).toString("utf8");
        assert.equal(shim, new ActivationShimRenderer().render(item, runtime.transport.symbol));
        new ActivationShimContractValidator().validate({ code: shim, activation: item, transportSymbol: runtime.transport.symbol });
        if (!shims.has(shimPath)) vm.runInContext(shim, context, { timeout: 1000 });
        shims.add(shimPath);
        const exact = transport.modules[item.targetModule]?.[item.exportName];
        assert.equal(typeof exact, "function");
        assert.equal(context[item.legacySymbol], exact);
        assert(!exposed.has(item.legacySymbol), "Duplicate/conflicting activation");
        exposed.set(item.legacySymbol, exact);
        pending.delete(item.id);
        timing.push({ activationId: item.id, symbol: item.legacySymbol, targetModule: item.targetModule,
          legacyScriptIndex: script.legacyLoadOrder, globalAbsentBeforeActivation: true,
          globalExactAfterActivation: true, shimMatchesRenderer: true });
      }
    }
    assert.equal(pending.size, 0, "Some approved activations never executed");
    for (const [symbol, value] of exposed) assert.equal(context[symbol], value);
    return { context, transport, transportReads: () => reads,
      evidence: { transportAssignmentCount: assignments, transportOwnsGameState: false,
        projectModules: Object.keys(transport.modules).sort(), activationTiming: timing,
        physicalClassicScripts: physical.length, logicalPositions: logical.length, moduleScripts: 0,
        cumulativeRuntimeScripts: 1 } };
  }
}

module.exports = { CumulativeLiveActivationProbe };
