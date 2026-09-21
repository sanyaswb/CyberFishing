"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const { Batch009Planning, PROFILE, PATHS, sha, serialize } = require("./domain_batches/stage_three_batch_009_planning");
const { BATCH_009_MATRIX_DEPENDENCIES: dependencies } = require("./domain_batches/stage_three_batch_009_focused_test_catalog");
const { BATCH_009_EXECUTABLE_CASES: cases } = require("./domain_batches/stage_three_batch_009_behavior_cases");
const { TemporaryEsmModuleFixtureBoundary, ClassicClassLoader, DomainBehaviorParityHarness, RepresentationEquivalenceGuard } = require("./domain_batches/stage_three_batch_focused_harness");
const { ActivationShimRenderer, ActivationShimContractValidator } = require("../build/compat_runtime/activation_shim");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");

class Batch009FocusedValidation {
  async run(app, plan, matrix) {
    const fixture = new TemporaryEsmModuleFixtureBoundary();
    try {
      const loaded = await fixture.load(plan.scope.modules.map(m => ({ ...m,
        exportName: m.exports[0], absoluteCurrentPath: path.join(app.root, m.currentPath),
      })));
      const loader = new ClassicClassLoader(), parity = new DomainBehaviorParityHarness();
      const classic = {}, esm = {}, results = [];
      for (const module of plan.scope.modules) {
        const symbol = module.exports[0], item = loaded.get(symbol);
        assert.equal(sha(item.classicSource), module.sourceSha256, "baseline source drift");
        new RepresentationEquivalenceGuard().validate({ classicSource: item.classicSource,
          candidateSource: item.candidateSource, exportName: symbol, transportSymbol: plan.compatibility.transportGlobal });
        classic[symbol] = loader.load(item.classicSource, symbol, module.currentPath);
        esm[symbol] = item.namespace[symbol];
        assert.deepEqual(Object.keys(item.namespace), [symbol], "unexpected export");
        results.push(...parity.run({ exportName: symbol, classicClass: classic[symbol], esmClass: esm[symbol], cases: cases[symbol] }));
      }
      assert.deepEqual(results.map(r => `behavior/${r.exportName}/${r.caseName}`).sort(), matrix.behaviorCases.map(c => c.id).sort());
      this.timeline(app, plan, loaded);
      const di = this.fixedCatch(app, classic, esm, loader);
      return { behaviorCaseCount: results.length, behaviorResults: results,
        compatibilityCaseCount: matrix.compatibilityCases.length, fixedCatchCaseCount: di.length,
        fixedCatchOutputs: di,
        phase: "classic-and-isolated-native-esm-fixtures-only",
        liveBatch009RuntimeValidated: false,
        moduleEvaluationProof: "native-import-cache-namespace-and-class-identity; generated-bundle-evaluation-counter-deferred-to-3.9.4-and-3.9.6",
      };
    } finally { fixture.cleanup(); }
  }

  timeline(app, plan, loaded) {
    const runtime = app.json(PATHS.runtimeContract);
    const context = vm.createContext({});
    // Existing accepted IIFE is executed only in an isolated VM; not rebuilt.
    new vm.Script(app.read(runtime.output.directory + runtime.output.runtimeFile)).runInContext(context);
    assert.deepEqual(Object.keys(context), [runtime.transport.symbol], "unexpected eager external global");
    const modules = { ...context[runtime.transport.symbol].modules };
    for (const m of plan.scope.modules) modules[m.targetPath] = loaded.get(m.exports[0]).namespace;
    const activations = [...runtime.activationPositions, ...plan.compatibility.activations]
      .sort((a, b) => a.legacyScriptIndex - b.legacyScriptIndex || a.id.localeCompare(b.id));
    const timeline = vm.createContext({});
    const renderer = new ActivationShimRenderer(), validator = new ActivationShimContractValidator();
    const published = new Set();
    const earliest = Math.min(...activations.map(a => a.legacyScriptIndex));
    assert.equal(plan.runtimeRelocation.afterLogicalPosition, earliest);
    for (let position = 1; position <= plan.scriptTopology.before.logicalLegacyPositionCount; position++) {
      if (position === earliest) timeline[runtime.transport.symbol] = Object.freeze({ modules: Object.freeze(modules) });
      if (position < earliest) assert.equal(timeline[runtime.transport.symbol], undefined);
      for (const a of activations) if (!published.has(a.id)) assert.equal(timeline[a.legacySymbol], undefined, `early exposure: ${a.id}`);
      for (const a of activations.filter(a => a.legacyScriptIndex === position)) {
        const code = renderer.render(a, runtime.transport.symbol);
        validator.validate({ code, activation: a, transportSymbol: runtime.transport.symbol });
        new vm.Script(code).runInContext(timeline);
        assert.equal(timeline[a.legacySymbol], modules[a.targetModule][a.exportName]);
        published.add(a.id);
      }
    }
    assert.equal(published.size, activations.length);
    assert.equal(new Set(plan.compatibility.plannedBridgeRecords.map(b => b.source)).size, 1);
    for (const bridge of plan.compatibility.plannedBridgeRecords) {
      assert.equal(bridge.source, "src/app/bootstrap.js");
      const code = app.read(bridge.source);
      assert(!code.includes(runtime.transport.symbol), "bootstrap transport lookup");
      for (const provider of bridge.globalProviders) {
        assert(code.includes(`new ${provider.symbol}(`), "missing classic constructor consumer");
        assert.equal(timeline[provider.symbol], loaded.get(provider.symbol).namespace[provider.symbol]);
      }
    }
  }

  fixedCatch(app, classic, esm, loader) {
    const Factory = loader.load(app.read("src/app/fixed_catch_fish_factory.js"), "FixedCatchFishFactory", "fixed_catch_fish_factory.js");
    const Visual = loader.load(app.read("src/core/fish/fish_visual_variant_resolver.js"), "FishVisualVariantResolver", "fish_visual_variant_resolver.js");
    const make = types => new Factory({
      fishRarityResolver: new types.FishRarityResolver(),
      fishAnomalyVariantResolver: new types.FishAnomalyVariantResolver(),
      fishVisualVariantResolver: new Visual(),
    });
    const template = { id: "fixture-fish", name: "Fixture fish", anomaly: "none", trophyWeightKg: 5,
      weightConfig: { maxLevel: 2, levelWeightRanges: [{ level: 1, min: 1, max: 3, basePower: 2 }, { level: 2, min: 4, max: 6, basePower: 3 }] },
      visual: { imagePattern: "fish-{level}", uniqueImagePattern: "unique-{level}" },
      anomalyVariant: { enabled: true, chance: 0.5, anomalyId: "gold", locationIds: ["lake"] },
    };
    const left = make(classic), right = make(esm), outputs = [];
    for (const anomalyChanceOverride of [null, 0, 1]) for (const weightKg of [1, 5]) {
      const args = { template, weightKg, biteSequence: ["wait", "fight"], locationId: "lake", anomalyChanceOverride };
      const a = JSON.parse(JSON.stringify(left.create(args))), b = JSON.parse(JSON.stringify(right.create(args)));
      assert.deepEqual(b, a, "production-shaped DI factory parity");
      assert.equal(b.hasAnomaly, anomalyChanceOverride === 1);
      assert.equal(b.level, weightKg === 1 ? 1 : 2);
      outputs.push(b);
    }
    return outputs;
  }
}

class Batch009PlanningCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const app = new Batch009Planning(root), snapshot = new RepositoryContentSnapshot(root);
    const before = snapshot.capture(), outputBefore = app.projector.rollbackEvidence().runtimeOutput;
    try {
      const audit = app.audit();
      assert.deepEqual(app.bytes(PROFILE.auditPath), serialize(audit), "audit replay drift");
      const plan = app.plan();
      assert.deepEqual(app.bytes(PROFILE.executionPlanPath), serialize(plan), "plan replay drift");
      const matrix = app.matrix(dependencies);
      assert.deepEqual(app.bytes(PROFILE.testMatrixPath), serialize(matrix), "matrix replay drift");
      const focused = await new Batch009FocusedValidation().run(app, plan, matrix);
      console.log(`Stage 3.9.0–3.9.2 PASS: exact two-module closure; ${audit.earlierEvaluation.records.length} early-evaluation records; ${focused.behaviorCaseCount} behavior cases; ${focused.fixedCatchCaseCount} production-shaped DI cases; ${focused.compatibilityCaseCount} compatibility contracts. Live runtime unchanged.`);
      return { status: "passed", ...focused, auditSha256: sha(app.bytes(PROFILE.auditPath)),
        planSha256: sha(app.bytes(PROFILE.executionPlanPath)), matrixSha256: sha(app.bytes(PROFILE.testMatrixPath)),
        sourceReleaseVersion: PROFILE.sourceReleaseVersion,
        runtimeOutputFingerprint: outputBefore.fingerprint,
      };
    } finally {
      snapshot.assertEqual(before, snapshot.capture());
      assert.deepEqual(app.projector.rollbackEvidence().runtimeOutput, outputBefore, "live dist changed");
    }
  }
}
if (require.main === module) new (require("./domain_batches/stage_three_batch_009_historical_workspace").Batch009HistoricalWorkspace)()
  .run(path.resolve(__dirname,"../.."), root => new Batch009PlanningCheck().run(root)).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { Batch009PlanningCheck, Batch009FocusedValidation };
