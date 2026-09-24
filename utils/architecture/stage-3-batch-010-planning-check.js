"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const { Batch010Planning, PLAN_PATHS, serialize } = require("./domain_batches/stage_three_batch_010_planning");
const { PROFILE, PATHS } = require("./domain_batches/stage_three_batch_010_preflight");
const { BATCH_010_EXECUTABLE_CASES } = require("./domain_batches/stage_three_batch_010_behavior_cases");
const {
  TemporaryEsmModuleFixtureBoundary, ClassicClassLoader,
  DomainBehaviorParityHarness, RepresentationEquivalenceGuard, ActivationTimingHarness,
} = require("./domain_batches/stage_three_batch_focused_harness");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");

class Batch010ProductionConsumerProbe {
  run(app, Policy) {
    const composition = app.bytes("src/application/inventory/inventory_v2_composition_root.js").toString("utf8");
    const service = app.bytes("src/core/assemblies/item_assembly_service.js").toString("utf8");
    assert(composition.includes("capacityPolicy: new UnlimitedAssemblyCapacityPolicy()"),
      "composition root no longer injects the exact policy");
    assert(service.includes("capacityPolicy || new UnlimitedAssemblyCapacityPolicy()"),
      "assembly service no longer uses the exact default policy");
    const context = vm.createContext({
      UnlimitedAssemblyCapacityPolicy: Policy,
      InventoryItemLocation: { isInventory: location => location === "inventory" },
    });
    const Service = new vm.Script(`${service}\nItemAssemblyService`, { filename: "item_assembly_service.js" })
      .runInContext(context);
    const source = { itemId: "fixture", instanceId: "item-1", location: "inventory", quantity: 1 };
    const repository = {
      require: id => { assert.equal(id, "item-1"); return source; },
      createSnapshot: () => ({}),
      splitOne: () => ({ instanceId: "item-1" }),
    };
    const stateRepository = {
      has: () => false,
      createSnapshot: () => ({}),
      create: ({ rootInstanceId, profileId }) => {
        assert.equal(rootInstanceId, "item-1");
        assert.equal(profileId, "profile-1");
      },
    };
    const assembly = new Service({
      repository, stateRepository,
      profileRegistry: { resolveProfileIdForItem: () => "profile-1" },
      reader: {}, stackingPolicy: {}, signaturePolicy: {},
    });
    assert.equal(assembly.startAssembly("item-1"), "item-1");
    return { compositionConstructorObserved: true, assemblyDefaultExecuted: true };
  }
}

class Batch010PlanningCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const app = new Batch010Planning(root);
    const snapshot = new RepositoryContentSnapshot(root);
    const before = snapshot.capture();
    const runtimeBefore = app.projector.rollbackEvidence().runtimeOutput;
    const fixture = new TemporaryEsmModuleFixtureBoundary();
    try {
      const plan = app.plan();
      assert.deepEqual(app.bytes(PLAN_PATHS.output), serialize(plan), "execution plan replay drift");
      const matrix = app.matrix();
      assert.deepEqual(app.bytes(PROFILE.executionProfile.testMatrixPath), serialize(matrix),
        "focused matrix replay drift");
      const module = plan.scope.modules[0];
      const symbol = module.exports[0];
      const loaded = await fixture.load([{ ...module, exportName: symbol,
        absoluteCurrentPath: path.join(root, module.currentPath) }]);
      const item = loaded.get(symbol);
      new RepresentationEquivalenceGuard().validate({
        classicSource: item.classicSource, candidateSource: item.candidateSource,
        exportName: symbol, transportSymbol: app.json(PATHS.runtimeContract).transport.symbol,
      });
      assert.deepEqual(Object.keys(item.namespace), [symbol]);
      const classic = new ClassicClassLoader().load(item.classicSource, symbol, module.currentPath);
      const esm = item.namespace[symbol];
      const cases = BATCH_010_EXECUTABLE_CASES[symbol];
      const behavior = new DomainBehaviorParityHarness().run({
        exportName: symbol, classicClass: classic, esmClass: esm, cases,
      });
      assert.deepEqual(behavior.map(record => `behavior/${record.exportName}/${record.caseName}`).sort(),
        matrix.behaviorCases.map(record => record.id).sort());
      const activation = plan.compatibility.activations[0];
      const timing = new ActivationTimingHarness().run({
        contract: app.json(PATHS.runtimeContract), activations: [activation],
        namespacesByTarget: new Map([[module.targetPath, item.namespace]]),
      });
      assert.equal(timing[0].legacyScriptIndex, 148);
      const probe = new Batch010ProductionConsumerProbe();
      assert.deepEqual(probe.run(app, classic), probe.run(app, esm));
      assert.equal(plan.compatibility.plannedBridgeRecords.length, 2);
      console.log(`Stage 3.10.1–3.10.2 PASS: execution plan and focused matrix replay; ${behavior.length} behavior cases, 2 production consumers, exact activation 148; live runtime unchanged.`);
      return { plan, matrix, behavior, timing };
    } finally {
      fixture.cleanup();
      snapshot.assertEqual(before, snapshot.capture());
      assert.deepEqual(app.projector.rollbackEvidence().runtimeOutput, runtimeBefore,
        "live runtime output changed during focused planning");
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch010PlanningCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010PlanningCheck, Batch010ProductionConsumerProbe };
