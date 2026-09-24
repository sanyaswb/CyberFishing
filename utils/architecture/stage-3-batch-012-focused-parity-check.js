"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { ActivationShimRenderer } = require("../build/compat_runtime/activation_shim");
const { RepresentationOnlyNamedEsmTarget } = require("./domain_batches/stage_three_representation_target");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_012_preflight_profile");
const { BATCH_012_EXECUTABLE_CASES } =
  require("./domain_batches/stage_three_batch_012_behavior_cases");
const { Batch012Planning } = require("./domain_batches/stage_three_batch_012_planning");

class Batch012FocusedParityCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const planning = new Batch012Planning(root);
    const plan = planning.plan();
    const matrix = planning.matrix();
    assert.equal(matrix.behaviorCases.length, 6);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-batch012-parity-"));
    try {
      const renderer = new RepresentationOnlyNamedEsmTarget();
      const shim = new ActivationShimRenderer();
      for (const module of plan.scope.modules) {
        const exportName = module.exports[0];
        const source = fs.readFileSync(path.join(root, module.currentPath), "utf8");
        const legacyExposure = PROFILE.reviewedContracts[module.currentPath].legacyExposure;
        const target = renderer.project({ source, currentPath: module.currentPath,
          targetPath: module.targetPath, exportName, sourceSha256: module.sourceSha256,
          legacyExposure });
        const targetFile = path.join(temp, `${exportName}.mjs`);
        fs.writeFileSync(targetFile, target.targetSource);
        const namespace = await import(pathToFileURL(targetFile).href);
        assert.deepEqual(Object.keys(namespace), [exportName]);
        const classic = vm.createContext({});
        vm.runInContext(source, classic, { filename: module.currentPath });
        const esmClass = namespace[exportName];
        assert.notStrictEqual(classic[exportName], esmClass);
        for (const [name, behavior] of Object.entries(BATCH_012_EXECUTABLE_CASES[exportName])) {
          const expected = behavior(classic[exportName]);
          const actual = behavior(esmClass);
          assert.deepEqual(actual, expected, `classic↔ESM mismatch: ${exportName}/${name}`);
        }
        const activation = plan.compatibility.activations.find(item => item.exportName === exportName);
        assert(activation);
        const context = vm.createContext({ __CYBER_FISHING_COMPAT_RUNTIME__: {
          modules: { [module.targetPath]: { [exportName]: esmClass } },
        } });
        assert.equal(context[exportName], undefined);
        vm.runInContext(shim.render(activation), context);
        assert.strictEqual(context[exportName], esmClass);
      }
      console.log("Stage 3.12.2 focused parity PASS: 6 classic↔ESM behavior cases, exact global exposure only at two approved activation shims; live runtime untouched.");
      return matrix;
    } finally {
      const resolved = fs.realpathSync(temp);
      assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
      assert(path.basename(resolved).startsWith("cyber-batch012-parity-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_012_historical_workspace").Batch012HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch012FocusedParityCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012FocusedParityCheck };
