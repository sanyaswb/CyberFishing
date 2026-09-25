"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { ActivationShimRenderer } = require("../build/compat_runtime/activation_shim");
const { RepresentationOnlyReviewedEsmTarget } = require("./domain_batches/stage_three_reviewed_representation_target");
const { DomainBehaviorParityHarness } = require("./domain_batches/stage_three_batch_focused_harness");
const { BATCH_015_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_015_preflight_profile");
const { BATCH_015_EXECUTABLE_CASES } =
  require("./domain_batches/stage_three_batch_015_behavior_cases");
const { Batch015Planning } = require("./domain_batches/stage_three_batch_015_planning");

class Batch015FocusedParityCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const planning = new Batch015Planning(root);
    const plan = planning.plan();
    const matrix = planning.matrix();
    assert.equal(matrix.behaviorCases.length, 12);
    const effectReview = planning.json(PROFILE.sideEffectEvidence.path);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-batch015-parity-"));
    try {
      for (const module of plan.scope.modules) {
        const source = planning.read(module.currentPath);
        const target = new RepresentationOnlyReviewedEsmTarget().project({ source,
          currentPath: module.currentPath, targetPath: module.targetPath,
          exports: module.exports, sourceSha256: module.sourceSha256,
          contract: PROFILE.reviewedContracts[module.currentPath],
          targetEvaluation: PROFILE.reviewedContracts[module.currentPath].frozenStaticFields
            ? effectReview.targetEvaluation : null });
        const targetFile = path.join(temp, path.basename(module.targetPath) + ".mjs");
        fs.writeFileSync(targetFile, target.targetSource);
        const first = await import(pathToFileURL(targetFile).href);
        const second = await import(pathToFileURL(targetFile).href);
        assert.strictEqual(first, second, "Native ESM evaluated twice");
        assert.deepEqual(Object.keys(first).sort(), module.exports);
        const classic = vm.createContext({});
        vm.runInContext(source, classic, { filename: module.currentPath });
        for (const symbol of module.exports) {
          const legacy = vm.runInContext(symbol, classic);
          const esm = first[symbol];
          new DomainBehaviorParityHarness().run({ exportName: symbol,
            classicClass: legacy, esmClass: esm, cases: BATCH_015_EXECUTABLE_CASES[symbol] });
          const activation = plan.compatibility.activations.find(item => item.exportName === symbol);
          assert(activation);
          const context = vm.createContext({ __CYBER_FISHING_COMPAT_RUNTIME__: {
            modules: { [module.targetPath]: first },
          } });
          assert.equal(context[symbol], undefined);
          vm.runInContext(new ActivationShimRenderer().render(activation), context);
          assert.strictEqual(context[symbol], esm);
        }
      }
      console.log("Stage 3.15.2 focused parity PASS: 12 cases, 6 native ESM exports and exact activation identity.");
      return matrix;
    } finally {
      const resolved = fs.realpathSync(temp);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert(path.basename(resolved).startsWith("cyber-batch015-parity-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_015_historical_workspace").Batch015HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch015FocusedParityCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch015FocusedParityCheck };
