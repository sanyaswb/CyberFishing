"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { StageThreeBatchCandidateBuild } = require("./stage_three_batch_candidate_build");
const { ClassicClassLoader, DomainBehaviorParityHarness } = require("./stage_three_batch_focused_harness");
const { BATCH_008_EXECUTABLE_CASES } = require("./stage_three_batch_008_behavior_cases");
const { BATCH_008_EXECUTION_PROFILE: PROFILE } = require("./stage_three_batch_008_execution_profile");

class StageThreeBatch008CandidateBuild {
  constructor(projectRoot, { viteLoader, verifyOutput } = {}) {
    this.root = path.resolve(projectRoot);
    this.viteLoader = viteLoader;
    this.verifyOutput = verifyOutput;
  }

  async run(inputs) {
    let validation;
    const build = new StageThreeBatchCandidateBuild({
      projectRoot: this.root, batchNumber: PROFILE.batchNumber, additionalVirtualModules: [],
      indexHtml: require("./stage_three_batch_008_cutover_history").historicalCutoverBytes(
        "index.html", fs.readFileSync(path.join(this.root, "index.html")), this.root).toString("utf8"),
      viteLoader: this.viteLoader,
      verifyOutput: async (output) => {
        validation = this.validateOutput(output);
        if (this.verifyOutput) await this.verifyOutput(output);
      },
    });
    const report = await build.run(inputs);
    return Object.freeze({ ...report, validation });
  }

  validateOutput({ report, contract, readOutput }) {
    const context = vm.createContext({});
    const runtimePath = `${contract.output.directory}${contract.output.runtimeFile}`;
    vm.runInContext(readOutput(runtimePath), context, { timeout: 5000 });
    const transport = context[contract.transport.symbol];
    assert(transport && transport.modules, "Candidate transport is missing");
    assert.deepEqual(Object.keys(transport.modules).sort(), report.projectModules,
      "Actual candidate namespaces differ from actual bundled module set");
    const cases = [];
    const identities = [];
    for (const target of PROFILE.expectedTargets) {
      const exportName = target.exports[0];
      const candidateClass = transport.modules[target.targetPath][exportName];
      assert.equal(candidateClass.name, exportName, "Bundler changed observable Class.name");
      const { historicalCutoverBytes } = require("./stage_three_batch_008_cutover_history");
      const classic = new ClassicClassLoader().load(historicalCutoverBytes(target.currentPath, fs.readFileSync(
        path.join(this.root, target.currentPath)), this.root).toString("utf8"), exportName, target.currentPath);
      cases.push(...new DomainBehaviorParityHarness().run({ exportName,
        classicClass: classic, esmClass: candidateClass, cases: BATCH_008_EXECUTABLE_CASES[exportName] }));
      const activation = report.activationOutputs.find((record) => record.targetModule === target.targetPath);
      assert(activation, "Candidate activation missing");
      assert.equal(context[exportName], undefined, "Global exposed before its activation");
      vm.runInContext(readOutput(activation.path), context, { timeout: 1000 });
      assert.equal(context[exportName], candidateClass, "Activation copied or replaced the export identity");
      identities.push({ targetPath: target.targetPath, exportName, activationId: activation.activationId,
        legacyScriptIndex: activation.legacyScriptIndex, globalAbsentBeforeActivation: true,
        exactExportAfterActivation: true, classNamePreserved: true });
    }
    return { behaviorCases: cases, identities,
      topology: "single-cumulative-module-graph", transportOwnsGameState: contract.transport.ownsGameState };
  }
}

module.exports = { StageThreeBatch008CandidateBuild };
