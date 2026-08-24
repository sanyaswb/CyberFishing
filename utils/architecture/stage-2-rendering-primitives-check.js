const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-2.4-engine-rendering-primitives";
const CONTRACTS = Object.freeze([
  Object.freeze({
    symbol: "CompositeRenderer",
    source: "src/render/core/composite_renderer.js",
    target: "src/engine/rendering/composite_renderer.js",
    wrapper: "src/engine/compat/stage_2/composite_renderer_legacy_bridge.js",
    output: "dist/legacy-bridges/composite_renderer.iife.js",
    order: 362,
    role: "engine-runtime",
    consumers: Object.freeze([
      "src/render/fishing/fishing_scene_renderer.js",
      "src/render/hud/fight_hud_renderer.js",
      "src/render/pipeline/world_render_pass.js",
    ]),
  }),
  Object.freeze({
    symbol: "RenderComponent",
    source: "src/render/core/render_component.js",
    target: "src/engine/rendering/render_component.js",
    wrapper: "src/engine/compat/stage_2/render_component_legacy_bridge.js",
    output: "dist/legacy-bridges/render_component.iife.js",
    order: 361,
    role: "engine-runtime",
    consumers: Object.freeze(["src/app/bootstrap.js"]),
  }),
  Object.freeze({
    symbol: "RenderMath",
    source: "src/render/core/render_math.js",
    target: "src/engine/rendering/render_math.js",
    wrapper: "src/engine/compat/stage_2/render_math_legacy_bridge.js",
    output: "dist/legacy-bridges/render_math.iife.js",
    order: 360,
    role: "engine-utility",
    consumers: Object.freeze([
      "src/app/rendering/boat_chum_render_frame_builder.js",
      "src/app/rendering/casting_render_frame_builder.js",
      "src/app/rendering/fight_hud_frame_builder.js",
      "src/render/casting/cast_scene_renderer.js",
      "src/render/fishing/line_visual_state_controller.js",
      "src/render/hud/fight_status_bars_renderer.js",
      "src/render/screens/star_rating_renderer.js",
      "src/render/screens/victory_renderer.js",
    ]),
  }),
  Object.freeze({
    symbol: "RenderPass",
    source: "src/render/core/render_pass.js",
    target: "src/engine/rendering/render_pass.js",
    wrapper: "src/engine/compat/stage_2/render_pass_legacy_bridge.js",
    output: "dist/legacy-bridges/render_pass.iife.js",
    order: 358,
    role: "engine-contract",
    consumers: Object.freeze([
      "src/render/pipeline/casting_render_pass.js",
      "src/render/pipeline/fishing_render_pass.js",
      "src/render/pipeline/hud_render_pass.js",
      "src/render/pipeline/outcome_render_pass.js",
      "src/render/pipeline/world_render_pass.js",
    ]),
  }),
]);

class RenderingPrimitiveSourceLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  loadLegacy() {
    const context = vm.createContext({});
    vm.runInContext(
      `${CONTRACTS.map((item) => this.#read(item.source)).join("\n")}\n` +
        "globalThis.__rendering = { CompositeRenderer, RenderComponent, RenderMath, RenderPass };",
      context,
      { filename: "stage-2.4-legacy-rendering-primitives.js" },
    );
    return context.__rendering;
  }

  async loadMigrated() {
    const modules = await Promise.all(CONTRACTS.map((item) => {
      const source = this.#read(item.target);
      const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
      return import(`${url}#stage-2.4-${item.symbol}`);
    }));
    for (let index = 0; index < CONTRACTS.length; index += 1) {
      assert.deepEqual(Object.keys(modules[index]), [CONTRACTS[index].symbol]);
    }
    return Object.fromEntries(CONTRACTS.map((item, index) => [
      item.symbol,
      modules[index][item.symbol],
    ]));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }
}

class RenderingPrimitiveBehaviorVerifier {
  verify({ CompositeRenderer, RenderComponent, RenderMath, RenderPass }) {
    this.#verifyRenderComponent(RenderComponent);
    this.#verifyCompositeRenderer(CompositeRenderer, RenderComponent);
    this.#verifyRenderMath(RenderMath);
    this.#verifyRenderPass(RenderPass);
  }

  #verifyRenderComponent(RenderComponent) {
    const renderer = { render() {} };
    const selectModel = (model) => model.child;
    const component = new RenderComponent({
      id: "  hud  ",
      order: "7",
      renderer,
      selectModel,
    });
    assert.equal(component.id, "hud");
    assert.equal(component.order, 7);
    assert.equal(component.renderer, renderer);
    assert.equal(component.selectModel, selectModel);
    assert.equal(component.isVisible, RenderComponent.defaultIsVisible);
    assert.equal(Object.isFrozen(component), true);
    assert.deepEqual(Object.keys(component), [
      "id",
      "order",
      "renderer",
      "selectModel",
      "isVisible",
    ]);
    assert.equal(RenderComponent.defaultIsVisible(null), false);
    assert.equal(RenderComponent.defaultIsVisible({ visible: false }), false);
    assert.equal(RenderComponent.defaultIsVisible({ visible: true }), true);
    assert.throws(() => new RenderComponent({ renderer, selectModel }), /requires id/);
    assert.throws(
      () => new RenderComponent({ id: "x", renderer: {}, selectModel }),
      /requires renderer\.render/,
    );
    assert.throws(
      () => new RenderComponent({ id: "x", renderer, selectModel: null }),
      /requires selectModel/,
    );
    assert.throws(
      () => new RenderComponent({ id: "x", renderer, selectModel, isVisible: true }),
      /requires isVisible/,
    );
  }

  #verifyCompositeRenderer(CompositeRenderer, RenderComponent) {
    const calls = [];
    const source = [
      new RenderComponent({
        id: "late",
        order: 20,
        renderer: { render: (model) => calls.push(["render", "late", model]) },
        selectModel: (model) => {
          calls.push(["select", "late"]);
          return model.late;
        },
      }),
      new RenderComponent({
        id: "hidden",
        order: 10,
        renderer: { render: () => calls.push(["render", "hidden"]) },
        selectModel: (model) => {
          calls.push(["select", "hidden"]);
          return model.hidden;
        },
        isVisible: (componentModel, model) => {
          calls.push(["visible", componentModel, model.root]);
          return false;
        },
      }),
      new RenderComponent({
        id: "early",
        order: 0,
        renderer: { render: (model) => calls.push(["render", "early", model]) },
        selectModel: (model) => {
          calls.push(["select", "early"]);
          return model.early;
        },
      }),
    ];
    const originalOrder = source.map((item) => item.id);
    const composite = new CompositeRenderer({ components: source });
    assert.deepEqual(source.map((item) => item.id), originalOrder);
    source.length = 0;
    assert.equal(composite.getComponentCount(), 3);
    assert.equal(composite.getComponentIdAt(-1), null);
    assert.equal(composite.getComponentIdAt(0), "early");
    assert.equal(composite.getComponentIdAt(1), "hidden");
    assert.equal(composite.getComponentIdAt(2), "late");
    assert.equal(composite.getComponentIdAt(3), null);
    composite.render({ root: "root", early: "E", hidden: "H", late: "L" });
    assert.deepEqual(calls, [
      ["select", "early"],
      ["render", "early", "E"],
      ["select", "hidden"],
      ["visible", "H", "root"],
      ["select", "late"],
      ["render", "late", "L"],
    ]);
    assert.throws(() => new CompositeRenderer({ components: null }), /requires components/);
    assert.throws(
      () => new CompositeRenderer({ components: [{ id: "broken" }] }),
      /component 0 is invalid/,
    );
    const duplicate = new RenderComponent({
      id: "early",
      renderer: { render() {} },
      selectModel: (model) => model,
    });
    assert.throws(
      () => new CompositeRenderer({ components: [duplicate, duplicate] }),
      /Duplicate render component id: early/,
    );
  }

  #verifyRenderMath(RenderMath) {
    assert.equal(RenderMath.clamp(2), 1);
    assert.equal(RenderMath.clamp(-1), 0);
    assert.equal(RenderMath.clamp("0.25"), 0.25);
    assert.equal(RenderMath.clamp(Number.NaN), 0);
    assert.equal(RenderMath.rgba([10, 20, 30], 0.5), "rgba(10, 20, 30, 0.5)");
    assert.equal(RenderMath.rgba(null), "rgba(255, 255, 255, 1)");
    assert.deepEqual(this.#plain(RenderMath.mixRgb([0, 10, 20], [10, 30, 40], 0.5)), [5, 20, 30]);
    assert.equal(
      RenderMath.interpolateRgb([0, 10, 20], [10, 30, 40], 0.5),
      "rgb(5, 20, 30)",
    );
    assert.equal(RenderMath.resolveX("center", 20, 100), 40);
    assert.equal(RenderMath.resolveX("12", 20, 100), 12);
    assert.equal(RenderMath.resolveX("invalid", 20, 100), 0);
    const rect = { x: 10, y: 20, width: 30, height: 40 };
    assert.equal(RenderMath.pointInRect({ x: 10, y: 20 }, rect), true);
    assert.equal(RenderMath.pointInRect({ x: 40, y: 60 }, rect), true);
    assert.equal(RenderMath.pointInRect({ x: 41, y: 60 }, rect), false);
  }

  #verifyRenderPass(RenderPass) {
    assert.throws(() => new RenderPass().render({}), /render\(frame\) must be implemented/);
    const classes = [0, 1, 2, 3, 4].map((index) => class extends RenderPass {
      render(frame) {
        return `${index}:${frame.id}`;
      }
    });
    assert.deepEqual(classes.map((Pass, index) => new Pass().render({ id: "ok" })), [
      "0:ok",
      "1:ok",
      "2:ok",
      "3:ok",
      "4:ok",
    ]);
  }

  #plain(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class StageTwoRenderingPrimitivesCheck {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.paths = Object.freeze({
      approved: "architecture/migration/stage_2_approved_batches.json",
      manifest: "architecture/migration/module_migration_manifest.json",
      state: "architecture/migration/stage_2_execution_state.json",
      registry: "architecture/guards/migration_bridge_registry.json",
      debt: "architecture/guards/known_debt_registry.json",
      index: "index.html",
      ...Object.fromEntries(CONTRACTS.flatMap((item) => [
        [`${item.symbol}Source`, item.source],
        [`${item.symbol}Target`, item.target],
        [`${item.symbol}Wrapper`, item.wrapper],
      ])),
    });
  }

  async run() {
    const before = this.#readTrackedBytes();
    const approvedPlan = this.#readJson(this.paths.approved);
    const manifest = this.#readJson(this.paths.manifest);
    const state = this.#readJson(this.paths.state);
    const registry = this.#readJson(this.paths.registry);
    const debt = this.#readJson(this.paths.debt);
    const batch = approvedPlan.batches.find((item) => item.id === BATCH_ID);
    this.#verifyFrozenBatch(batch);
    const migrated =
      state.completedBatchIds.includes(BATCH_ID) || state.activeBatchId === BATCH_ID;
    if (migrated) this.#verifyMigrated({ manifest, state, registry, debt });
    else this.#verifyPreflight({ manifest, state, registry, debt });

    const loader = new RenderingPrimitiveSourceLoader(this.projectRoot);
    const contracts = migrated ? await loader.loadMigrated() : loader.loadLegacy();
    new RenderingPrimitiveBehaviorVerifier().verify(contracts);
    assert.deepEqual(
      this.#readTrackedBytes(),
      before,
      "Stage 2.4 rendering primitive check must be read-only",
    );
    console.log(
      `Stage 2.4 rendering primitives passed (${migrated ? "migrated" : "preflight"}): ` +
        "4 dependency-free engine contracts, 17 exact classic consumers, " +
        "ordering, math, eager inheritance and load order verified; read-only.",
    );
  }

  #verifyFrozenBatch(batch) {
    assert.ok(batch, "Approved Stage 2.4 batch is missing");
    assert.equal(batch.order, 4);
    assert.equal(batch.status, "approved");
    assert.equal(batch.targetBoundary, "engine");
    assert.deepEqual(batch.dependencyOrdering.batchPrerequisites, [
      "stage-2.3-engine-event-primitives",
    ]);
    assert.deepEqual(
      batch.modules.map((item) => ({
        currentPath: item.currentPath,
        targetPath: item.targetPath,
        providers: item.providers,
        legacyConsumers: item.legacyConsumers,
      })),
      CONTRACTS.map((item) => ({
        currentPath: item.source,
        targetPath: item.target,
        providers: [item.symbol],
        legacyConsumers: [...item.consumers],
      })),
    );
    assert.equal(batch.bridgeStrategy.owner, BATCH_ID);
    assert.equal(batch.bridgeStrategy.removalStage, "stage-5");
    assert.equal(batch.bridgeStrategy.bridges.length, 4);
    for (let index = 0; index < CONTRACTS.length; index += 1) {
      const contract = CONTRACTS[index];
      const bridge = batch.bridgeStrategy.bridges[index];
      assert.equal(bridge.wrapperPath, contract.wrapper);
      assert.equal(bridge.outputPath, contract.output);
      assert.deepEqual(bridge.legacyConsumers, [...contract.consumers]);
    }
  }

  #verifyPreflight({ manifest, state, registry, debt }) {
    assert.deepEqual(state.completedBatchIds, [
      "stage-2.1-engine-asset-contracts",
      "stage-2.2-engine-dependency-contract",
      "stage-2.3-engine-event-primitives",
    ]);
    assert.equal(state.status, "migration-active");
    assert.equal(state.activeBatchId, null);
    assert.equal(registry.bridges.some((item) => item.owner === BATCH_ID), false);
    assert.equal(debt.debts.some((item) => CONTRACTS.some(
      (contract) => item.target === contract.source,
    )), false);
    for (const contract of CONTRACTS) {
      const entry = this.#entry(manifest, contract.source);
      assert.equal(entry.observed.legacyLoadOrder, contract.order);
      assert.equal(entry.architecture.migrationStatus, "classified");
      assert.deepEqual(entry.architecture.roles, [contract.role]);
      assert.equal(entry.architecture.targetBoundary, "engine");
      assert.equal(entry.architecture.targetPath, contract.target);
      assert.deepEqual(entry.observed.environment.browserApis, []);
      assert.deepEqual(entry.analysis.dependencies.items, []);
      assert.deepEqual(entry.analysis.blockers.items, []);
      assert.equal(this.#exists(contract.source), true);
      assert.equal(this.#exists(contract.target), false);
      this.#verifyConsumers(manifest, contract, contract.source);
    }
    this.#verifyEagerRenderPassConsumers(manifest);
    this.#assertRuntimePositions(CONTRACTS.map((item) => item.source));
  }

  #verifyMigrated({ manifest, state, registry, debt }) {
    assert.equal(state.status, "migration-complete");
    assert.equal(state.activeBatchId, null);
    assert.ok(state.completedBatchIds.includes(BATCH_ID));
    assert.equal(
      registry.bridges.filter((item) => item.owner === BATCH_ID).length,
      17,
    );
    assert.equal(debt.debts.some((item) => CONTRACTS.some(
      (contract) => item.target === contract.source,
    )), false);
    for (const contract of CONTRACTS) {
      const target = this.#entry(manifest, contract.target);
      assert.ok(["esm", "verified"].includes(target.architecture.migrationStatus));
      assert.equal(target.observed.legacyLoadOrder, null);
      assert.deepEqual(target.observed.environment.browserApis, []);
      assert.deepEqual(target.analysis.dependencies.items, []);
      assert.equal(this.#exists(contract.source), false);
      assert.equal(this.#exists(contract.target), true);
      assert.equal(this.#exists(contract.wrapper), true);
      this.#verifyConsumers(manifest, contract, contract.wrapper);
    }
    this.#verifyEagerRenderPassConsumers(manifest);
    this.#assertRuntimePositions(CONTRACTS.map((item) => item.wrapper));
  }

  #verifyConsumers(manifest, contract, expectedTarget) {
    const consumers = manifest.modules
      .filter((entry) => entry.analysis.dependencies.items.some(
        (dependency) => dependency.target === expectedTarget &&
          dependency.symbols.includes(contract.symbol),
      ))
      .map((entry) => entry.currentPath)
      .sort();
    assert.deepEqual(consumers, [...contract.consumers]);
  }

  #verifyEagerRenderPassConsumers(manifest) {
    const renderPass = CONTRACTS.find((item) => item.symbol === "RenderPass");
    for (const consumerPath of renderPass.consumers) {
      const consumer = this.#entry(manifest, consumerPath);
      const facts = consumer.observed.consumers.items.filter(
        (item) => item.symbol === "RenderPass",
      );
      assert.equal(facts.length, 1);
      assert.equal(facts[0].accessRequirement, "required");
      assert.equal(facts[0].executionPhase, "eager");
      assert.ok(consumer.observed.legacyLoadOrder > renderPass.order);
    }
  }

  #assertRuntimePositions(expectedProviders) {
    const bySymbol = new Map(CONTRACTS.map((item, index) => [item.symbol, expectedProviders[index]]));
    const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
      this.projectRoot,
    );
    const scripts = new LegacyScriptOrderReader(
      path.join(this.projectRoot, this.paths.index),
      { scriptAliases },
    ).read().map((script) => script.currentPath);
    for (const contract of CONTRACTS) {
      assert.equal(scripts[contract.order - 1], bySymbol.get(contract.symbol));
    }
  }

  #entry(manifest, currentPath) {
    const entry = manifest.modules.find((item) => item.currentPath === currentPath);
    assert.ok(entry, `Manifest entry is missing: ${currentPath}`);
    return entry;
  }

  #readTrackedBytes() {
    return Object.fromEntries(Object.entries(this.paths).map(([id, relativePath]) => [
      id,
      this.#exists(relativePath) ? this.#read(relativePath) : null,
    ]));
  }

  #readJson(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }

  #exists(relativePath) {
    return fs.existsSync(path.join(this.projectRoot, relativePath));
  }
}

new StageTwoRenderingPrimitivesCheck(PROJECT_ROOT).run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
