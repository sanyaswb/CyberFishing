"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const {
  CanonicalActivationIdentity,
  CumulativeRuntimeContractValidator,
  EXACT_TRANSPORT_GLOBAL,
} = require("../build/compat_runtime/cumulative_runtime_contract");
const {
  CumulativeGraphPlanner,
  StageThreeTargetSelector,
  StageTwoMigratedTargetCatalog,
} = require("../build/compat_runtime/cumulative_graph_planner");
const {
  CumulativeSideEffectGate,
  ModuleEvaluationEffectObserver,
} = require("../build/compat_runtime/cumulative_side_effect_gate");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("../build/compat_runtime/activation_shim");
const {
  CumulativeRuntimeBuildApplication,
  CumulativeRuntimeBundleValidator,
} = require("../build/compat_runtime/cumulative_runtime_builder");
const {
  CumulativeRuntimeOutputManager,
} = require("../build/compat_runtime/cumulative_runtime_output_manager");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("./migration/stage_three_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BASE_CONTRACT = JSON.parse(fs.readFileSync(
  path.join(PROJECT_ROOT, "architecture/migration/stage_3_compatibility_runtime.json"),
  "utf8",
));
const FOUNDATION_CONTRACT = JSON.parse(JSON.stringify(BASE_CONTRACT));
FOUNDATION_CONTRACT.status = "foundation-verified";
FOUNDATION_CONTRACT.previousRuntimeTransitions = [];
FOUNDATION_CONTRACT.sideEffectReviews = [];
FOUNDATION_CONTRACT.activationPositions = [];
FOUNDATION_CONTRACT.plannedActivationPositions = [];

class TemporaryFixtureProject {
  constructor() {
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-stage-3-compat-"));
  }

  write(relativePath, value) {
    const target = path.resolve(this.root, relativePath);
    const relative = path.relative(this.root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Fixture write escaped root: ${relativePath}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value, "utf8");
  }

  read(relativePath) {
    return fs.readFileSync(path.resolve(this.root, relativePath), "utf8");
  }

  exists(relativePath) {
    return fs.existsSync(path.resolve(this.root, relativePath));
  }

  dispose() {
    const parent = path.resolve(os.tmpdir());
    if (
      path.dirname(this.root) !== parent ||
      !path.basename(this.root).startsWith("cyber-fishing-stage-3-compat-")
    ) {
      throw new Error(`Refusing unsafe fixture cleanup: ${this.root}`);
    }
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActivation(overrides) {
  const record = {
    id: "pending",
    owner: "stage-3.1-shared-domain-foundation",
    sourceProvider: "src/legacy/provider_a.js",
    targetModule: "src/game/domain/consumer_a.js",
    exportName: "sharedClassFromA",
    legacySymbol: "SharedClassA",
    legacyScriptIndex: 1,
    shimFile: "activations/shared_class_a.js",
    reason: "Preserve the reviewed classic availability position during migration.",
    removalStage: "stage-5",
    ...overrides,
  };
  record.id = CanonicalActivationIdentity.id(record);
  return record;
}

function fixtureSources(project) {
  project.write("index.html", [
    '<script src="src/legacy/provider_a.js"></script>',
    '<script src="src/legacy/provider_b.js"></script>',
    "",
  ].join("\n"));
  project.write("src/game/domain/shared.js", [
    "let evaluationCount = 0;",
    "evaluationCount += 1;",
    "class SharedClass {}",
    "const registry = {};",
    "const getEvaluationCount = () => evaluationCount;",
    "export { SharedClass, registry, getEvaluationCount };",
    "",
  ].join("\n"));
  project.write("src/game/domain/consumer_a.js", [
    'import { SharedClass, registry, getEvaluationCount } from "./shared.js";',
    "const sharedClassFromA = SharedClass;",
    "const registryFromA = registry;",
    "const evaluationCountFromA = getEvaluationCount;",
    "export { sharedClassFromA, registryFromA, evaluationCountFromA };",
    "",
  ].join("\n"));
  project.write("src/game/domain/consumer_b.js", [
    'import { SharedClass, registry, getEvaluationCount } from "./shared.js";',
    "const sharedClassFromB = SharedClass;",
    "const registryFromB = registry;",
    "const evaluationCountFromB = getEvaluationCount;",
    "export { sharedClassFromB, registryFromB, evaluationCountFromB };",
    "",
  ].join("\n"));
}

function fixturePlan() {
  return {
    schemaVersion: 1,
    kind: "cyber-fishing-stage-3-approved-batches",
    batches: [{
      id: "stage-3.1-shared-domain-foundation",
      status: "approved-frozen",
      modules: [
        { targetPath: "src/game/domain/shared.js" },
        { targetPath: "src/game/domain/consumer_a.js" },
        { targetPath: "src/game/domain/consumer_b.js" },
      ],
    }],
  };
}

function fixtureState(active = true) {
  return {
    completedBatchIds: [],
    activeBatchId: active ? "stage-3.1-shared-domain-foundation" : null,
  };
}

function fixtureContract(project, { activations = true, review = true } = {}) {
  const contract = clone(FOUNDATION_CONTRACT);
  contract.status = "migration-active";
  if (review) {
    const source = project.read("src/game/domain/shared.js");
    const observation = new ModuleEvaluationEffectObserver().observe({
      modulePath: "src/game/domain/shared.js",
      source,
    });
    contract.sideEffectReviews = [{
      module: "src/game/domain/shared.js",
      decision: "approved-compatible",
      evidenceFingerprint: observation.evidenceFingerprint,
      owner: "stage-3.1-shared-domain-foundation",
      reason: "Fixture proves one evaluation and shared registry identity in one cumulative graph.",
    }];
  }
  if (activations) {
    contract.activationPositions = [
      createActivation({}),
      createActivation({
        sourceProvider: "src/legacy/provider_b.js",
        targetModule: "src/game/domain/consumer_b.js",
        exportName: "sharedClassFromB",
        legacySymbol: "SharedClassB",
        legacyScriptIndex: 2,
        shimFile: "activations/shared_class_b.js",
      }),
    ].sort((left, right) => left.id.localeCompare(right.id));
  }
  return contract;
}

class StageThreeCompatibilityRuntimeFixtureCheck {
  async run() {
    let cases = 0;
    const count = async (callback) => {
      await callback();
      cases += 1;
    };

    await count(async () => {
      const contract = clone(BASE_CONTRACT);
      contract.activationPositions = [
        createActivation({
          sourceProvider: "src/legacy/shared_provider.js",
          legacySymbol: "FirstSymbol",
          exportName: "FirstSymbol",
          shimFile: "activations/first_symbol.js",
        }),
        createActivation({
          sourceProvider: "src/legacy/shared_provider.js",
          legacySymbol: "SecondSymbol",
          exportName: "SecondSymbol",
          shimFile: "activations/second_symbol.js",
        }),
      ];
      const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(contract);
      assert.equal(
        aliases.get("dist/stage-3-compat-runtime/activations/first_symbol.js"),
        "src/legacy/shared_provider.js",
      );
      assert.equal(
        aliases.get("dist/stage-3-compat-runtime/activations/second_symbol.js"),
        null,
      );
    });

    await count(async () => {
      const validated = new CumulativeRuntimeContractValidator().validate(FOUNDATION_CONTRACT);
      assert.equal(validated.transport.symbol, EXACT_TRANSPORT_GLOBAL);
      assert.equal(validated.transport.ownsGameState, false);
      assert.equal(validated.activationPositions.length, 0);
    });

    await count(async () => {
      const invalid = clone(FOUNDATION_CONTRACT);
      invalid.transport.ownsGameState = true;
      assert.throws(
        () => new CumulativeRuntimeContractValidator().validate(invalid),
        /must not own game state/,
      );
    });

    await count(async () => {
      const invalid = clone(FOUNDATION_CONTRACT);
      invalid.topology.buildMode = "isolated-per-wrapper-iife";
      assert.throws(
        () => new CumulativeRuntimeContractValidator().validate(invalid),
        /buildMode is invalid/,
      );
    });

    await count(async () => {
      const invalid = clone(FOUNDATION_CONTRACT);
      invalid.status = "migration-active";
      const first = createActivation({});
      const second = createActivation({
        targetModule: "src/game/domain/consumer_b.js",
        exportName: "sharedClassFromB",
        shimFile: "activations/shared_class_b.js",
      });
      invalid.activationPositions = [first, second]
        .sort((left, right) => left.id.localeCompare(right.id));
      assert.throws(
        () => new CumulativeRuntimeContractValidator().validate(invalid),
        /duplicate activation position/,
      );
    });

    await count(async () => {
      const selection = new StageThreeTargetSelector().select({
        approvedPlan: fixturePlan(),
        executionState: fixtureState(),
      });
      assert.equal(selection.targetModules.length, 3);
      assert.throws(
        () => new StageThreeTargetSelector().select({
          approvedPlan: fixturePlan(),
          executionState: {
            completedBatchIds: ["not-an-approved-prefix"],
            activeBatchId: null,
          },
        }),
        /ordered approved prefix/,
      );
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        const graph = new CumulativeGraphPlanner({ projectRoot: project.root }).plan({
          targetModules: fixturePlan().batches[0].modules.map((item) => item.targetPath),
        });
        assert.equal(graph.moduleRecordCount, 3);
        assert.equal(graph.edges.length, 2);
        assert.deepEqual(graph.dependentTargets, [
          "src/game/domain/consumer_a.js",
          "src/game/domain/consumer_b.js",
        ]);
        assert.equal(
          graph.modules.filter((item) => item.path === "src/game/domain/shared.js").length,
          1,
        );
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        project.write(
          "src/engine/shared_engine.js",
          "export class SharedEngine {}\n",
        );
        project.write(
          "src/game/domain/engine_consumer.js",
          'import { SharedEngine } from "../../engine/shared_engine.js";\n' +
            "export { SharedEngine };\n",
        );
        const activation = createActivation({
          sourceProvider: "dist/legacy-bridges/shared_engine.iife.js",
          targetModule: "src/engine/shared_engine.js",
          exportName: "SharedEngine",
          legacySymbol: "SharedEngine",
          shimFile: "activations/shared_engine.js",
        });
        const previousStageModules = [{
          source: "src/engine/shared_engine.js",
          originatingStage: "stage-2",
          identitySensitive: true,
          previousRuntime: "stage-2-isolated-iife",
          previousOutputs: ["dist/legacy-bridges/shared_engine.iife.js"],
        }];
        const unresolved = new CumulativeGraphPlanner({ projectRoot: project.root }).plan({
          targetModules: ["src/game/domain/engine_consumer.js"],
          previousStageModules,
          activations: [activation],
        });
        assert.equal(unresolved.moduleRecordCount, 2);
        assert.equal(
          unresolved.modules.find((item) => item.path === "src/engine/shared_engine.js")
            .originatingStage,
          "stage-2",
        );
        assert.equal(unresolved.existingCompatibilityConflicts[0].status, "unresolved");
        assert.equal(unresolved.issues[0].code, "existing-isolated-runtime-conflict");

        const transition = {
          module: "src/engine/shared_engine.js",
          previousRuntime: "stage-2-isolated-iife",
          requiredTransition: "replace-isolated-output-with-cumulative-activation",
          previousOutputs: ["dist/legacy-bridges/shared_engine.iife.js"],
          activationIds: [activation.id],
          owner: "stage-3.1-shared-domain-foundation",
          reason: "Reuse the cumulative engine instance at the original exposure point.",
        };
        const transitionContract = clone(FOUNDATION_CONTRACT);
        transitionContract.status = "migration-active";
        transitionContract.activationPositions = [activation];
        transitionContract.previousRuntimeTransitions = [transition];
        new CumulativeRuntimeContractValidator().validate(transitionContract);
        const resolved = new CumulativeGraphPlanner({ projectRoot: project.root }).plan({
          targetModules: ["src/game/domain/engine_consumer.js"],
          previousStageModules,
          previousRuntimeTransitions: [transition],
          activations: [activation],
        });
        assert.equal(resolved.issues.length, 0);
        assert.equal(resolved.existingCompatibilityConflicts[0].status, "resolved");
        assert.equal(
          resolved.modules.filter((item) => item.path === "src/engine/shared_engine.js").length,
          1,
        );
        assert.equal(resolved.activations[0].mechanism, "global-this-property");
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const catalog = new StageTwoMigratedTargetCatalog().collect({
        approvedPlan: {
          batches: [{
            id: "stage-2.9-fixture",
            modules: [{ targetPath: "src/engine/shared_engine.js" }],
            bridgeStrategy: {
              bridges: [{
                targetModule: "src/engine/shared_engine.js",
                outputPath: "dist/legacy-bridges/shared_engine.iife.js",
              }],
            },
          }],
        },
        executionState: { completedBatchIds: ["stage-2.9-fixture"] },
      });
      assert.deepEqual(catalog, [{
        source: "src/engine/shared_engine.js",
        originatingStage: "stage-2",
        identitySensitive: true,
        previousRuntime: "stage-2-isolated-iife",
        previousOutputs: ["dist/legacy-bridges/shared_engine.iife.js"],
      }]);
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        project.write(
          "src/game/domain/consumer_a.js",
          'const shared = import("./shared.js");\nexport { shared };\n',
        );
        assert.throws(
          () => new CumulativeGraphPlanner({ projectRoot: project.root }).plan({
            targetModules: fixturePlan().batches[0].modules.map((item) => item.targetPath),
          }),
          /does not allow dynamic imports/,
        );
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        project.write(
          "src/game/domain/consumer_a.js",
          'import { Future } from "./future.js";\nexport { Future };\n',
        );
        project.write("src/game/domain/future.js", "export class Future {}\n");
        assert.throws(
          () => new CumulativeGraphPlanner({ projectRoot: project.root }).plan({
            targetModules: fixturePlan().batches[0].modules.map((item) => item.targetPath),
          }),
          /unapproved module: src\/game\/domain\/future.js/,
        );
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        const graph = new CumulativeGraphPlanner({ projectRoot: project.root }).plan({
          targetModules: fixturePlan().batches[0].modules.map((item) => item.targetPath),
        });
        assert.throws(
          () => new CumulativeSideEffectGate({ projectRoot: project.root }).verify({
            graph,
            reviews: [],
          }),
          /requires review: src\/game\/domain\/shared.js/,
        );
        const contract = fixtureContract(project, { activations: false });
        const result = new CumulativeSideEffectGate({ projectRoot: project.root }).verify({
          graph,
          reviews: contract.sideEffectReviews,
        });
        assert.equal(result.status, "verified");
        assert.equal(result.modules.find((item) => item.module.endsWith("shared.js")).reviewed, true);
        const staleReviews = clone(contract.sideEffectReviews);
        staleReviews[0].evidenceFingerprint = "0".repeat(64);
        assert.throws(
          () => new CumulativeSideEffectGate({ projectRoot: project.root }).verify({
            graph,
            reviews: staleReviews,
          }),
          /review is stale/,
        );
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const activation = createActivation({});
      const renderer = new ActivationShimRenderer();
      const code = renderer.render(activation);
      new ActivationShimContractValidator().validate({ code, activation });
      assert.throws(
        () => new ActivationShimContractValidator().validate({
          code: `${code}doBusinessLogic();\n`,
          activation,
        }),
        /differs from exact contract/,
      );
    });

    await count(async () => {
      assert.throws(
        () => new CumulativeRuntimeBundleValidator().validate({
          code: [
            `globalThis.${EXACT_TRANSPORT_GLOBAL} = {};`,
            "globalThis.ExtraGlobal = {};",
          ].join("\n"),
          actualModules: ["src/game/domain/shared.js"],
          approvedModules: ["src/game/domain/shared.js"],
        }),
        /only the exact transport global/,
      );
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        let viteLoaded = false;
        const emptyPlan = { batches: [] };
        const report = await new CumulativeRuntimeBuildApplication({
          projectRoot: project.root,
          contract: FOUNDATION_CONTRACT,
          approvedPlan: emptyPlan,
          executionState: { completedBatchIds: [], activeBatchId: null },
          viteLoader: async () => {
            viteLoaded = true;
            throw new Error("Vite must not load");
          },
        }).run();
        assert.equal(report.status, "no-active-runtime");
        assert.equal(viteLoaded, false);
        assert.equal(project.exists("dist/stage-3-compat-runtime"), false);
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        const contract = fixtureContract(project);
        contract.activationPositions[0].sourceProvider = "src/legacy/not_at_this_position.js";
        contract.activationPositions[0].id = CanonicalActivationIdentity.id(
          contract.activationPositions[0],
        );
        contract.activationPositions.sort((left, right) => left.id.localeCompare(right.id));
        await assert.rejects(
          () => new CumulativeRuntimeBuildApplication({
            projectRoot: project.root,
            contract,
            approvedPlan: fixturePlan(),
            executionState: fixtureState(),
          }).run(),
          /position differs from legacy provider/,
        );
      } finally {
        project.dispose();
      }
    });

    let firstBuildHash;
    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        const contract = fixtureContract(project);
        const report = await new CumulativeRuntimeBuildApplication({
          projectRoot: project.root,
          contract,
          approvedPlan: fixturePlan(),
          executionState: fixtureState(),
        }).run();
        assert.equal(report.status, "built");
        assert.equal(report.moduleCount, 3);
        assert.equal(report.activationCount, 2);
        assert.equal(report.plan.modules.length, 3);
        assert.equal(
          report.plan.modules.find((item) => item.path.endsWith("shared.js"))
            .evaluationSafety,
          "unsafe",
        );
        assert.deepEqual(report.outputs[0].projectModules, [
          "src/game/domain/consumer_a.js",
          "src/game/domain/consumer_b.js",
          "src/game/domain/shared.js",
        ]);
        assert.deepEqual(report.outputs[0].virtualBuildModules, [
          "\u0000rolldown/runtime.js",
        ]);
        firstBuildHash = report.outputs[0].sha256;

        const context = vm.createContext({});
        const runtimeCode = project.read("dist/stage-3-compat-runtime/compat_runtime.iife.js");
        vm.runInContext(runtimeCode, context);
        assert.equal(context.SharedClassA, undefined);
        assert.equal(context.SharedClassB, undefined);
        const transport = context[EXACT_TRANSPORT_GLOBAL];
        assert.equal(transport.ownsGameState, false);
        const moduleA = transport.modules["src/game/domain/consumer_a.js"];
        const moduleB = transport.modules["src/game/domain/consumer_b.js"];
        assert.equal(moduleA.sharedClassFromA, moduleB.sharedClassFromB);
        assert.equal(moduleA.registryFromA, moduleB.registryFromB);
        assert.equal(moduleA.evaluationCountFromA, moduleB.evaluationCountFromB);
        assert.equal(moduleA.evaluationCountFromA(), 1);

        vm.runInContext(
          project.read("dist/stage-3-compat-runtime/activations/shared_class_a.js"),
          context,
        );
        assert.equal(context.SharedClassA, moduleA.sharedClassFromA);
        assert.equal(context.SharedClassB, undefined);
        vm.runInContext(
          project.read("dist/stage-3-compat-runtime/activations/shared_class_b.js"),
          context,
        );
        assert.equal(context.SharedClassB, moduleB.sharedClassFromB);
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        const report = await new CumulativeRuntimeBuildApplication({
          projectRoot: project.root,
          contract: fixtureContract(project),
          approvedPlan: fixturePlan(),
          executionState: fixtureState(),
        }).run();
        assert.equal(report.outputs[0].sha256, firstBuildHash);
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        fixtureSources(project);
        const options = {
          projectRoot: project.root,
          contract: fixtureContract(project),
          approvedPlan: fixturePlan(),
          executionState: fixtureState(),
        };
        await new CumulativeRuntimeBuildApplication(options).run();
        const before = project.read("dist/stage-3-compat-runtime/compat_runtime.iife.js");
        await assert.rejects(
          () => new CumulativeRuntimeBuildApplication({
            ...options,
            viteLoader: async () => { throw new Error("synthetic build failure"); },
          }).run(),
          /synthetic build failure/,
        );
        assert.equal(
          project.read("dist/stage-3-compat-runtime/compat_runtime.iife.js"),
          before,
        );
      } finally {
        project.dispose();
      }
    });

    await count(async () => {
      const project = new TemporaryFixtureProject();
      try {
        const manager = new CumulativeRuntimeOutputManager(project.root);
        const staging = manager.createStagingDirectory();
        assert.throws(
          () => manager.assertControlledChild(staging, project.root, ".input"),
          /unsafe cumulative runtime child operation/,
        );
        manager.discard(staging);
      } finally {
        project.dispose();
      }
    });

    console.log(`Stage 3 compatibility runtime fixtures passed (${cases} cases).`);
  }
}

new StageThreeCompatibilityRuntimeFixtureCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
