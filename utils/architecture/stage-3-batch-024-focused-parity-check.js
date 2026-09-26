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
const { BATCH_024_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_024_preflight_profile");
const { BATCH_024_EXECUTABLE_CASES } =
  require("./domain_batches/stage_three_batch_024_behavior_cases");
const { Batch024Planning } = require("./domain_batches/stage_three_batch_024_planning");

class Batch024FocusedParityCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const planning = new Batch024Planning(root);
    const plan = planning.plan();
    const matrix = planning.matrix();
    assert.equal(matrix.behaviorCases.length, 2);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-batch024-parity-"));
    try {
      // The temporary tree mirrors project paths so reviewed relative imports resolve exactly.
      fs.writeFileSync(path.join(temp, "package.json"), '{ "type": "module" }\n');
      const place = (relative, text) => {
        const file = path.join(temp, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
        return file;
      };
      for (const module of plan.scope.modules) {
        const source = planning.read(module.currentPath);
        for (const record of module.importsAllowed) place(record.from, planning.read(record.from));
        const target = new RepresentationOnlyReviewedEsmTarget().project({ source,
          currentPath: module.currentPath, targetPath: module.targetPath,
          exports: module.exports, sourceSha256: module.sourceSha256,
          contract: PROFILE.reviewedContracts[module.currentPath], imports: module.importsAllowed });
        const targetFile = place(module.targetPath, target.targetSource);
        const first = await import(pathToFileURL(targetFile).href);
        const second = await import(pathToFileURL(targetFile).href);
        assert.strictEqual(first, second, "Native ESM evaluated twice");
        assert.deepEqual(Object.keys(first).sort(), module.exports);
        // The classic baseline reads the same completed-prefix instance the target imports, as the
        // production activation shim exposes one cumulative instance to both.
        const imported = {};
        for (const record of module.importsAllowed) {
          const namespace = await import(pathToFileURL(path.join(temp, record.from)).href);
          imported[record.exportName] = namespace[record.exportName];
          assert.equal(typeof imported[record.exportName], "function");
        }
        const classic = vm.createContext({ Map, Set, ...imported });
        vm.runInContext(source, classic, { filename: module.currentPath });
        for (const symbol of module.exports) {
          const legacy = vm.runInContext(symbol, classic);
          const esm = first[symbol];
          new DomainBehaviorParityHarness().run({ exportName: symbol,
            classicClass: legacy, esmClass: esm, cases: BATCH_024_EXECUTABLE_CASES[symbol] });
          const activation = plan.compatibility.activations.find(item => item.exportName === symbol);
          assert(activation, `Missing activation: ${symbol}`);
          const context = vm.createContext({ __CYBER_FISHING_COMPAT_RUNTIME__: {
            modules: { [module.targetPath]: first },
          } });
          assert.equal(context[symbol], undefined);
          vm.runInContext(new ActivationShimRenderer().render(activation), context);
          assert.strictEqual(context[symbol], esm);
        }
      }
      console.log("Stage 3.25.2 focused parity PASS: 2 cases, 1 native ESM export, 1 reviewed import " +
        "and exact activation identity.");
      return matrix;
    } finally {
      const resolved = fs.realpathSync(temp);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert(path.basename(resolved).startsWith("cyber-batch024-parity-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_024_historical_workspace").Batch024HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch024FocusedParityCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch024FocusedParityCheck };
