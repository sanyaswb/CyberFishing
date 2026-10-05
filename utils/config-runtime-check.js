"use strict";
const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

function check(structured) {
  let cloneCalls = 0;
  const visual = {}, degradation = {};
  const config = {physics:{enabled:true,nested:{value:1}},rarity:{visual:null},degradationColors:null};
  const runtime = new SourceRuntime({globals:{window:{},CONFIG:config,RARITY_VISUAL_CONFIG:visual,DEGRADATION_COLOR_CONFIG:degradation,
    ...(structured ? {structuredClone:value=>{cloneCalls++;return structuredClone(value);}} : {})}});
  for(const [file,expose] of [
    ["src/infrastructure/config/deep_clone_config.js",["deepCloneConfig"]],
    ["src/config/runtime/config_override_store.js",["ConfigOverrideStore"]],
    ["src/config/runtime/resolved_config_provider.js",["ResolvedConfigProvider"]],
    ["src/config/runtime/immutable_config.js",["deepFreezeConfig","setRuntimeConfigPath","getRuntimeConfigPath"]],
    ["src/config/runtime/config_context_composition.js",["createRuntimeConfigContext"]],
    ["src/config/config.js",["createRuntimeConfigContext","CONFIG_RUNTIME_CONTEXT","BASE_CONFIG","CONFIG_OVERRIDE_STORE","RESOLVED_CONFIG_PROVIDER"]],
    ["src/app/bootstrap.js",["GameCompositionRoot"]],
    ["src/app/adapters.js",["ConfigProvider"]],
    ["src/config/validation/config_schema_validator.js",["ConfigSchemaValidator"]],
    ["src/debug/overlay/services/overlay_metric_resolver.js",["OverlayMetricResolver"]],
  ]) runtime.load(file,{expose});
  const {CONFIG_RUNTIME_CONTEXT:ctx,BASE_CONFIG:base,CONFIG_OVERRIDE_STORE:store,RESOLVED_CONFIG_PROVIDER:provider} = runtime.context;
  assert.equal(config.rarity.visual,visual);
  assert.equal(config.degradationColors,degradation);
  assert.equal(ctx.overrideStore,store);
  assert.equal(ctx.resolvedProvider,provider);
  assert.equal(provider.overrideStore,store,"one authoritative override store");
  assert(Object.isFrozen(base)&&Object.isFrozen(base.physics)&&Object.isFrozen(base.physics.nested));
  const port = new runtime.context.GameCompositionRoot(config).getRuntimeConfig();
  assert.equal(port.physics,config.physics);
  const value = {value:5};
  ctx.set(["CONFIG","physics","nested"],value);
  assert.notEqual(config.physics.nested,value,"the store owns values; the runtime keeps its injected read identity");
  assert.equal(port.physics.nested.value,5);
  value.value=9;
  assert.equal(provider.get("physics.nested").value,5,"store clones the input independently");
  const detached=provider.get("physics.nested");detached.value=99;
  assert.equal(provider.get("physics.nested").value,5,"reads cannot mutate stored overrides");
  assert.equal(base.physics.nested.value,1);
  ctx.reset("physics.nested");
  assert.equal(config.physics.nested.value,1);
  assert.equal(provider.hasOverride("physics.nested"),false);
  ctx.importOverrides({"physics.enabled":false,"physics.nested":{value:7}});
  assert.equal(port.physics.enabled,false);
  assert.equal(JSON.stringify(ctx.exportOverrides()),'{"physics.enabled":false,"physics.nested":{"value":7}}');
  ctx.resetAll();
  assert.equal(port.physics.enabled,true);
  assert.equal(port.physics.nested.value,1);
  assert.equal(JSON.stringify(ctx.exportOverrides()),"{}");
  const replacement={enabled:false};config.physics=replacement;
  assert.notEqual(port.physics,replacement,"the stable runtime view does not expose caller-owned writable values");
  assert.equal(port.physics.enabled,false);
  const adapter={getRodControlConfig:()=>({value:1})};
  // A production config exposes this property before its port is created.
  Object.defineProperty(config,"fightPhysicsConfig",{value:adapter,configurable:true,enumerable:false});
  const anotherPort=new runtime.context.GameCompositionRoot(config).getRuntimeConfig();
  assert.equal(anotherPort.fightPhysicsConfig,adapter);
  const consumerConfig=new runtime.context.ConfigProvider(anotherPort);
  assert.equal(consumerConfig.fightPhysicsConfig,adapter);
  const replacementAdapter={getRodControlConfig:()=>({value:2})};
  Object.defineProperty(config,"fightPhysicsConfig",{value:replacementAdapter,configurable:true,enumerable:false});
  assert.equal(consumerConfig.fightPhysicsConfig,replacementAdapter,"existing Application consumers read adapter overrides live");
  assert.equal(consumerConfig.physics,port.physics);
  assert.equal(consumerConfig.physics.enabled,false);
  assert.equal(anotherPort.fightPhysicsConfig,replacementAdapter,"adapter overrides are read per call");
  assert.equal(Object.keys(anotherPort).includes("fightPhysicsConfig"),false);
  const metrics=new runtime.context.OverlayMetricResolver({baseConfig:base,configSource:() => config});
  assert.equal(metrics.resolvePath("BASE_CONFIG.physics.nested.value").value,1);
  const validateVersion=projectVersion=>new runtime.context.ConfigSchemaValidator({config,baseConfig:base,overrideStore:store,projectVersion}).validate();
  assert.equal(validateVersion(undefined).warnings.filter(issue=>issue.path==="project.version").length,1);
  assert.equal(validateVersion({version:"0.25.0"}).errors.filter(issue=>issue.path==="PROJECT_VERSION_CONFIG.version").length,0);
  assert.equal(validateVersion({version:"invalid"}).errors.filter(issue=>issue.path==="PROJECT_VERSION_CONFIG.version").length,1);
  const livePhysics = config.physics;
  ctx.set("physics", {enabled:true,nested:{value:10,sibling:20},list:[1,2]});
  ctx.set("physics.nested.value",0);
  assert.equal(livePhysics,config.physics,"already injected entities retain a live branch identity");
  assert.equal(livePhysics.nested.value,0); assert.equal(livePhysics.nested.sibling,20);
  assert.equal(provider.get("physics.nested").value,0,"parent reads include child overrides");
  assert.equal(provider.get("physics.nested.sibling"),20,"child reads include ancestor overrides");
  ctx.set("physics.list.1",9); assert.equal(config.physics.list[1],9); assert(Array.isArray(config.physics.list));
  ctx.set("physics.nested",{value:null}); assert.equal(provider.get("physics.nested.value",42),null);
  assert.equal(provider.get("physics.nested.sibling",42),42);
  ctx.set("physics.enabled",false); ctx.set("physics.newField",7);
  ctx.importOverrides({"physics.nested.value":11});
  assert.equal(config.physics.enabled,false,"omitted imports keep previous live values");
  assert.equal(config.physics.newField,7);
  assert.equal(JSON.stringify(ctx.exportOverrides()),'{"physics.nested.value":11}');
  ctx.reset("physics.newField"); assert.equal(config.physics.newField,7,"base-missing reset keeps live value");
  ctx.resetAll(); assert.equal(config.physics.nested.value,1);
  assert.equal(config.physics.enabled,false,"resetAll visits only currently exported paths");
  ctx.set("physics.nested.value",30); ctx.set("physics.nested.sibling",40); ctx.reset("physics.nested");
  assert.equal(config.physics.nested.value,1,"parent reset restores whole base subtree");
  assert.equal(config.physics.nested.sibling,undefined,"older child records do not reappear after parent reset");
  assert.equal(store.get("physics.nested.value"),30,"export metadata preserves the existing exact-key format");
  ctx.resetAll();
  assert.equal(config.physics.nested.value,1); assert.equal(config.physics.nested.sibling,undefined);
  assert.equal(JSON.stringify(ctx.exportOverrides()),"{}");
  ctx.set("physics",{enabled:false}); ctx.set("physics.enabled",true); ctx.set("physics",{enabled:false});
  assert.equal(config.physics.enabled,false,"latest parent write wins over earlier child writes");
  assert.equal(JSON.stringify(ctx.exportOverrides()),'{"physics":{"enabled":false},"physics.enabled":true}');
  ctx.resetAll();
  if (structured) { ctx.set("physics.nested.value",undefined); assert.equal(provider.get("physics.nested.value",42),undefined); }
  const readsBefore = cloneCalls;
  for(let i=0;i<1000;i++) assert.equal(config.physics.enabled,true);
  assert.equal(cloneCalls,readsBefore,"hot runtime reads perform no clone/materialization");
  const catalog={lake:{name:"A"}}, source={locations:{map:catalog},spawns:{fishes:[]}};
  const linked=runtime.context.createRuntimeConfigContext(source,{catalogs:{"locations.map":catalog,"spawns.fishes":source.spawns.fishes}});
  assert.equal(source.locations.map,catalog,"catalog identity stays with its separate owner");
  catalog.lake.name="B"; assert.equal(source.locations.map.lake.name,"B");
  linked.set("locations.map.lake.name","C"); assert.equal(source.locations.map.lake.name,"C"); assert.equal(catalog.lake.name,"B");
  const date = new Date("2020-01-01T00:00:00Z");
  const clonedDate=runtime.context.deepCloneConfig({date});
  if(structured){assert(clonedDate.date instanceof Date);assert(cloneCalls>0);}
  else {assert.equal(clonedDate.date,"2020-01-01T00:00:00.000Z");assert.throws(()=>runtime.context.deepCloneConfig(undefined));}
}
check(true);
check(false);
function checkDevelopmentInputs() {
  const fs = require("node:fs"), acorn = require("acorn");
  const source = fs.readFileSync(require("node:path").join(__dirname, "../src/app/script.js"), "utf8");
  const tree = acorn.parse(source, { ecmaVersion: "latest" });
  let options;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "NewExpression" && node.callee.name === "GameCompositionRoot") {
      assert.equal(options, undefined, "one development Root construction");
      options = node.arguments[1];
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(tree);
  assert.equal(options?.type, "ObjectExpression");
  // Preserve each original serial await; only its importer moves to Development Bootstrap.
  const rootSource = new SourceRuntime().readAuthoredSource("src/app/bootstrap.js");
  for (const [name, symbol, specifier] of [["loadRandomInventoryId","createRandomInventoryId","../platform/browser/inventory/random_inventory_id.js"],["loadBrowserEventTargetAdapter","BrowserEventTargetAdapter","../platform/browser/runtime/legacy_runtime_adapters.js"],["loadBrowserTimeoutScheduler","BrowserTimeoutScheduler","../platform/browser/time/browser_timeout_scheduler.js"],["loadInventoryAssemblyProfileConfig","getInventoryAssemblyProfileConfig","../game/config/inventory/inventory_composition_config.js"]]) {
    const property = options.properties.find(item => item.key.name === name);
    assert.equal(property.value.type, "ArrowFunctionExpression");
    assert.equal(property.value.body.type, "ImportExpression");
    assert.equal(property.value.body.source.value, specifier);
    assert.equal(rootSource.split("const { " + symbol + " } = await this.#" + name + "();").length, 2);
  }
  assert.equal(rootSource.includes("await import("), false);
  const lifecycleSource = fs.readFileSync(require("node:path").join(__dirname, "../src/platform/browser/runtime/browser_game_lifecycle.js"), "utf8");
  const Lifecycle = new SourceRuntime().run(lifecycleSource.replace("export class", "class") + ";BrowserGameLifecycle");
  const calls = [], target = { addEventListener(...args) { calls.push(["add", ...args]); }, removeEventListener(...args) { calls.push(["remove", ...args]); } };
  const lifecycle = new Lifecycle(target), gameHandle = {}, watchdog = { getReport() { return this; } }, cleanup = () => {};
  target.CYBER_FISHING_GAME_CLEANUP = function () { assert.equal(this, target); calls.push(["previous"]); };
  lifecycle.cleanupPreviousGame(); assert.equal(calls.pop()[0], "previous");
  lifecycle.publishGame(gameHandle);
  lifecycle.publishWatchdog(watchdog);
  assert.equal(target.game, gameHandle);
  assert.equal(target.CYBER_FISHING_MEMORY_WATCHDOG, watchdog);
  assert.equal(target.getCyberFishingMemoryReport(), watchdog, "report receiver and identity");
  lifecycle.installPagehideCleanup(cleanup);
  assert.equal(target.CYBER_FISHING_GAME_CLEANUP, cleanup);
  assert.equal(calls[0][0], "add"); assert.equal(calls[0][1], "pagehide"); assert.equal(calls[0][2], cleanup); assert.equal(calls[0][3].once, true);
  lifecycle.removePagehideListener(cleanup);
  assert.equal(calls[1][0], "remove"); assert.equal(calls[1][1], "pagehide"); assert.equal(calls[1][2], cleanup);
  const replacementGame = {}, replacementWatchdog = {};
  lifecycle.publishGame(replacementGame); lifecycle.publishWatchdog(replacementWatchdog);
  lifecycle.clearPublishedHandles(gameHandle, watchdog);
  assert.equal(target.game, replacementGame); assert.equal(target.CYBER_FISHING_MEMORY_WATCHDOG, replacementWatchdog);
  lifecycle.clearPublishedHandles(replacementGame, replacementWatchdog);
  assert.equal(target.game, null); assert.equal(target.CYBER_FISHING_MEMORY_WATCHDOG, null);
  lifecycle.publishWatchdog(null); assert.equal(target.getCyberFishingMemoryReport(), null);
  const document = {}, window = { document, DEBUG_MODULES: { catchResolution: true } }, diagnostics = {}, configRuntime = {};
  class Flags { constructor(options) { this.options = options; } }
  class Renderer { constructor(options) { this.options = options; } }
  class Tools { constructor(config, synchronizer, options) { Object.assign(this, { config, synchronizer, options }); } }
  const runtime = new SourceRuntime({ globals: { window, DevFlagsProvider: Flags, WorldDebugRenderer: Renderer,
    LocationDebugRenderFrameBuilder: Renderer, DevTools: Tools, GodMode: { enabled: true }, RenderAllocationDiagnostics: diagnostics,
    CONFIG_RUNTIME_CONTEXT: configRuntime, LocationDebugMapBuilder: Renderer, ItemProgressionDebugSnapshotProvider: Renderer,
    FixedCatchFishFactory: Renderer, HookedFishProfileSynchronizer: Renderer, DebugService: Renderer } });
  runtime.load("src/app/adapters.js", { expose: ["CanvasMetricsProvider"] });
  runtime.context.DevFlagsProvider = Flags; // Keep the constructor spy after loading the real canvas provider.
  const ports = runtime.run("(" + source.slice(options.start, options.end) + ")");
  assert.equal(ports.documentTarget, document);
  assert.equal(ports.windowTarget, window);
  const config = {}, flags = ports.createDevFlags(config);
  assert.equal(flags.options.config, config);
  assert.equal(flags.options.godModeSource(), runtime.context.GodMode);
  assert.equal(flags.options.debugModulesSource(), window.DEBUG_MODULES);
  window.DEBUG_MODULES = { catchResolution: false };
  assert.equal(flags.options.debugModulesSource(), window.DEBUG_MODULES, "flag source stays live");
  assert.equal(ports.isCatchResolutionLogEnabled(), false);
  window.DEBUG_MODULES.catchResolution = true;
  assert.equal(ports.isCatchResolutionLogEnabled(), true);
  window.document = null;
  assert.equal(ports.isCatchResolutionLogEnabled(), false);
  window.document = document;
  assert.equal(ports.getRenderDiagnostics(), diagnostics);
  const replacement = {};
  runtime.context.RenderAllocationDiagnostics = replacement;
  assert.equal(ports.getRenderDiagnostics(), replacement, "diagnostics lookup stays live at each cold call site");
  const rendererOptions = { surface: {} }, synchronizer = {}, progression = {};
  assert.equal(ports.createWorldDebugRenderer(rendererOptions).options, rendererOptions);
  assert.equal(ports.createLocationDebugRenderFrameBuilder(rendererOptions).options, rendererOptions);
  assert.equal(ports.createLocationDebugMapBuilder(rendererOptions).options, rendererOptions);
  assert.equal(ports.createItemProgressionDebugSnapshotProvider(rendererOptions).options, rendererOptions);
  assert.equal(ports.createFixedCatchFishFactory(rendererOptions).options, rendererOptions);
  assert.equal(ports.createHookedFishProfileSynchronizer(rendererOptions).options, rendererOptions);
  assert.equal(ports.createDebugService(config).options, config);
  const tools = ports.createDevTools(config, synchronizer, { itemProgressionResolver: progression });
  assert.equal(tools.config, config);
  assert.equal(tools.synchronizer, synchronizer);
  assert.equal(tools.options.configRuntime, configRuntime);
  assert.equal(tools.options.itemProgressionResolver, progression);
}
checkDevelopmentInputs();

function checkProductionOverrideReader() {
  const { GameplayOverrideReader } = require("../src/game/application/fishing/gameplay_override_reader.js");
  const config = { debug: {} }, source = new SourceRuntime({ globals: { CONFIG: config, window: {} } });
  source.load("src/debug/god_mode.js", { expose: ["GodMode"] });
  source.load("src/app/adapters.js", { expose: ["DevFlagsProvider"] });
  source.load("src/app/bootstrap.js", { expose: ["GameCompositionRoot"] });
  const reader = new GameplayOverrideReader(config), original = source.context.GodMode;
  const names = Object.entries(Object.getOwnPropertyDescriptors(original)).filter(([, value]) => value.get).map(([name]) => name);
  const flags = new source.context.DevFlagsProvider({ config, godModeSource: () => reader });
  for (const enabled of [undefined, false, 0, true, 1, "enabled"]) {
    for (const value of [undefined, false, true, 1, "yes"]) {
      config.debug.godMode = { enabled, infiniteResources:value, noEquipmentLoss:value, noHookEscape:value,
        noLineBreak:value, noRodBreak:value, noFishStaminaLoss:value, infiniteCasting:value,
        fixedBiteChanceEnabled:value, fixedBiteChancePercent:-20, forceAnomalyChance:value, biteSequenceMode:"GUARANTEED" };
      for (const name of names) assert.equal(reader[name], original[name], name + " accessor parity");
      assert.equal(flags.isEnabled("noEquipmentLoss"), original.noEquipmentLoss === true);
      assert.equal(flags.godModeValue("biteSequenceMode"), original.biteSequenceMode);
    }
  }
  for (const percent of [-5,0,50,100,150,"42",NaN,Infinity]) {
    config.debug.godMode = { enabled:true,fixedBiteChanceEnabled:true,fixedBiteChancePercent:percent };
    assert.equal(reader.fixedBiteChancePercent, original.fixedBiteChancePercent);
  }
  for (const mode of [undefined,"default","NORMAL","guaranteed","other"]) {
    config.debug.godMode.biteSequenceMode = mode;
    assert.equal(reader.biteSequenceMode, original.biteSequenceMode);
  }
  config.debug.godMode = { enabled:true,noEquipmentLoss:true };
  assert.equal(flags.isEnabled("noEquipmentLoss"), true, "live owner replacement enables the production effect");
  config.debug.godMode.enabled = false;
  assert.equal(flags.isEnabled("noEquipmentLoss"), false, "master setting is read live");
  const Root = source.context.GameCompositionRoot;
  assert.doesNotThrow(() => new Root(config));
  for (const option of ["createDebugService","createDevTools","getRenderDiagnostics","isCatchResolutionLogEnabled"])
    assert.throws(() => new Root(config, { [option]:false }), /optional callback/);
  assert.throws(() => new Root(config, { createWorldDebugRenderer:()=>({render(){}}) }), /coherent world debug/);
  assert.throws(() => new Root(config, { createDevTools:()=>({dispose(){}}) }), /synchronizer/);
  assert.doesNotThrow(() => new Root(config, { createDebugService:null, getRenderDiagnostics:null }));
}
checkProductionOverrideReader();

async function checkNativeProductionStartup() {
  const acorn = require("acorn"), fs = require("node:fs"), path = require("node:path");
  const { Game } = require("../src/bootstrap/production/game.js");
  const { BrowserGameLifecycle } = require("../src/platform/browser/runtime/browser_game_lifecycle.js");
  const { EventBus } = require("../src/engine/events/event_bus.js");
  const { GameplayOverrideReader } = require("../src/game/application/fishing/gameplay_override_reader.js");
  const { FixedCatchFishFactory } = require("../src/game/application/fishing/fixed_catch_fish_factory.js");
  const { FightPhysicsConfigAdapter } = require("../src/game/config/physics/fight_physics_config_adapter.js");
  // Evaluate the actual module bodies with controlled imported collaborators and import callbacks.
  function evaluate(file, names, bindings) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const tree = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" }), edits = [];
    for (const node of tree.body) {
      if (node.type === "ImportDeclaration") edits.push([node.start, node.end, ""]);
      else if (node.type === "ExportNamedDeclaration") {
        assert(node.declaration, "fixture expects a native declaration export");
        edits.push([node.start, node.declaration.start, ""]);
      }
    }
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (node.type === "ImportExpression") edits.push([node.start, node.start + 6, "importModule"]);
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") visit(value);
      }
    }
    visit(tree);
    let evaluated = source;
    for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0]))
      evaluated = evaluated.slice(0, start) + replacement + evaluated.slice(end);
    return new SourceRuntime({ globals: bindings }).run("(function(){\n" + evaluated + "\nreturn {" + names.join(",") + "};})()", file);
  }
  const { DevFlagsProvider } = evaluate("src/platform/browser/runtime/legacy_runtime_adapters.js", ["DevFlagsProvider"], { EventBus });
  const { createRuntimeConfigContext } = evaluate("src/bootstrap/production/config_context.js", ["createRuntimeConfigContext"], {
    ...require("../src/game/config/runtime/config_override_store.js"), ...require("../src/game/config/runtime/resolved_config_provider.js"),
    ...require("../src/platform/browser/config/deep_clone_config.js"), ...require("../src/game/config/runtime/immutable_config.js"),
  });
  const loaders = {
    loadRandomInventoryId: "../../platform/browser/inventory/random_inventory_id.js",
    loadBrowserEventTargetAdapter: "../../platform/browser/runtime/legacy_runtime_adapters.js",
    loadBrowserTimeoutScheduler: "../../platform/browser/time/browser_timeout_scheduler.js",
    loadInventoryAssemblyProfileConfig: "../../game/config/inventory/inventory_composition_config.js",
  };
  for (const readyState of ["loading", "interactive", "complete"]) {
    const fishCatalog = [], mapCatalog = {}, physicsCatalog = {};
    const config = { physics: physicsCatalog, spawns: { fishes: fishCatalog }, locations: { map: mapCatalog }, rarity: { visual: null }, degradationColors: null,
      debug: { godMode: { enabled: true, noEquipmentLoss: true } } };
    const visual = {}, degradation = {}, version = {}, windowListeners = new Map(), documentListeners = new Map();
    let adapters = 0, contexts = 0, activations = 0, mounts = 0, roots = 0, builds = 0, starts = 0, disposals = 0, storage = 0, previous = 0, pagehideAdds = 0, reader;
    const windowTarget = { addEventListener(type, fn, options) { assert.equal(type, "pagehide");assert.equal(options.once, true);pagehideAdds++;windowListeners.set(type, fn); },
      removeEventListener(type, fn) { assert.equal(windowListeners.get(type), fn);windowListeners.delete(type); },
      CYBER_FISHING_GAME_CLEANUP() { assert.equal(this, windowTarget);previous++; } };
    const documentTarget = { readyState, addEventListener(type, fn, options) { assert.equal(options.once, true);documentListeners.set(type, fn); } };
    class Adapter extends FightPhysicsConfigAdapter { constructor(owner) { super(owner);adapters++;assert.equal(owner, config); } }
    const composition = evaluate("src/bootstrap/production/game_config_composition.js", ["createProductionConfigContext"], {
      CONFIG: config, RARITY_VISUAL_CONFIG: visual, DEGRADATION_COLOR_CONFIG: degradation, FightPhysicsConfigAdapter: Adapter,
      createRuntimeConfigContext(owner, options) { contexts++;assert.equal(owner, config);assert.equal(owner.rarity.visual, visual);
        assert.equal(owner.degradationColors, degradation);assert(owner.fightPhysicsConfig instanceof FightPhysicsConfigAdapter);return createRuntimeConfigContext(owner, options); },
    });
    const platform = evaluate("src/platform/browser/runtime/browser_startup_environment.js",
      ["getBrowserStartupEnvironment", "publishBrowserStartupConfig", "activateBrowserStartupInterface"],
      { window: windowTarget, document: documentTarget, initEngineInterface() { activations++; } });
    class Overrides extends GameplayOverrideReader { constructor(owner) { super(owner);assert.equal(owner, config);reader = this; } }
    const imports = [], modules = Object.fromEntries(Object.values(loaders).map(specifier => [specifier, {}]));
    let resolveBuild;
    const buildReady = new Promise(resolve => { resolveBuild = resolve; });
    const app = { start() { starts++;return true; }, dispose() { disposals++; } };
    class Root {
      constructor(owner, ports) {
        roots++;assert.equal(owner, config);assert.equal(ports.windowTarget, windowTarget);assert.equal(ports.documentTarget, documentTarget);
        assert.deepEqual(Object.keys(ports).sort(), [...Object.keys(loaders), "windowTarget", "documentTarget", "createDevFlags", "createFixedCatchFishFactory"].sort(), "production supplies only gameplay and platform ports");
        this.ports = ports;
        const flags = ports.createDevFlags(owner);assert(flags instanceof DevFlagsProvider);assert.equal(flags.isEnabled("noEquipmentLoss"), true);
        owner.debug.godMode.enabled = false;assert.equal(flags.isEnabled("noEquipmentLoss"), false);owner.debug.godMode.enabled = true;
        assert(reader instanceof GameplayOverrideReader);
        assert(ports.createFixedCatchFishFactory({ fishRarityResolver: { resolve() {} }, fishAnomalyVariantResolver: { resolve() {} },
          fishVisualVariantResolver: { resolveImagePath() {} } }) instanceof FixedCatchFishFactory);
      }
      async build(canvasId) {
        builds++;assert.equal(canvasId, "gameCanvas");
        for (const [name, specifier] of Object.entries(loaders)) assert.equal(await this.ports[name](), modules[specifier]);
        return buildReady;
      }
      printStorageUsage() { storage++; }
    }
    const startup = evaluate("src/bootstrap/production/game_startup.js", ["startProductionGame"], {
      CONFIG: config, PROJECT_VERSION_CONFIG: version, Game, BrowserGameLifecycle, DevFlagsProvider, GameplayOverrideReader: Overrides,
      FixedCatchFishFactory, GameCompositionRoot: Root, ...composition, ...platform,
      GameVersionBadge: { mountById() { mounts++; } }, ConsoleLogger: class { error(error) { throw error; } },
      importModule(specifier) { imports.push(specifier);assert(Object.hasOwn(modules, specifier));return Promise.resolve(modules[specifier]); },
    });
    const first = startup.startProductionGame(), second = startup.startProductionGame();
    assert.equal(first, second, "concurrent startup shares the original promise");resolveBuild(app);
    const game = await first, context = windowTarget.CYBER_FISHING_CONFIG_RUNTIME;
    assert(game instanceof Game);assert.equal(await game.ready, app);assert.equal(windowTarget.game, game);
    assert.equal(composition.createProductionConfigContext(), context);assert.equal(composition.createProductionConfigContext(), context);
    assert.equal(context.overrideStore, context.resolvedProvider.overrideStore);assert(Object.isFrozen(context.baseConfig));
    assert.equal(config.rarity.visual, visual);assert.equal(config.degradationColors, degradation);assert.equal(config.fightPhysicsConfig.config, config);
    assert.equal(config.spawns.fishes, fishCatalog);assert.equal(config.locations.map, mapCatalog);assert.equal(config.physics, physicsCatalog);
    const descriptor = Object.getOwnPropertyDescriptor(config, "fightPhysicsConfig");
    assert.equal(descriptor.enumerable, false);assert.equal(descriptor.configurable, true);assert.equal(descriptor.writable, false);
    assert.deepEqual(imports, Object.values(loaders));assert.deepEqual([roots, builds, starts, contexts, adapters, activations, storage, previous], [1,1,1,1,1,1,1,1]);
    assert.equal(windowTarget.CYBER_FISHING_PROJECT_VERSION, version);assert.equal(windowTarget.CYBER_FISHING_MEMORY_WATCHDOG, null);assert.equal(windowTarget.getCyberFishingMemoryReport(), null);
    if (readyState === "loading") { assert.equal(mounts, 0);assert.equal(documentListeners.size, 1);documentListeners.get("DOMContentLoaded")(); }
    else assert.equal(documentListeners.size, 0);
    assert.equal(mounts, 1);assert.equal(windowListeners.size, 1);assert.equal(pagehideAdds, 1);
    const cleanup = windowListeners.get("pagehide");assert.equal(cleanup, windowTarget.CYBER_FISHING_GAME_CLEANUP);cleanup();cleanup();
    assert.equal(disposals, 1);assert.equal(windowListeners.size, 0);assert.equal(windowTarget.game, null);assert.equal(windowTarget.CYBER_FISHING_MEMORY_WATCHDOG, null);
    assert.equal(startup.startProductionGame(), first, "completed single-shot startup retains its original promise");assert.equal(roots, 1);
  }
}
function checkNativeDevelopmentDisplays() {
  const fs = require("node:fs"), path = require("node:path"), acorn = require("acorn");
  const root = path.resolve(__dirname,"..");
  const inventory = JSON.parse(fs.readFileSync(path.join(root,"architecture/migration/stage_6/stage6_module_inventory.json")));
  const globals = {};
  for (const module of inventory.migrationModules.filter(module => module.boundary === "dev"))
    Object.assign(globals,require(path.join(root,module.target)));
  const config = require("../src/game/config/runtime/game_config.js").CONFIG;
  const settingsStore = new globals.OverlaySettingsStore(Object.fromEntries(Object.keys(globals.OVERLAY_MODULES).map(key=>[key,true])));
  const captured = [];
  const overlayModules = inventory.migrationModules.filter(module => module.target.startsWith("src/dev/overlay/") &&
    module.exports.some(name => globals[name]?.prototype?.isActive));
  const bindings = {...globals};
  for (const module of overlayModules) for (const name of module.exports) {
    const Native = globals[name]; if (!Native?.prototype?.isActive || name === "OverlayModule") continue;
    bindings[name] = class extends Native { constructor(options) { super(options); captured.push({module,name,options,instance:this}); } };
  }
  bindings.OverlayController = class { start() {} dispose() {} };
  bindings.OverlayMetricCatalog = class {};
  bindings.OverlayMetricInfoBridge = class { start() {} dispose() {} };
  bindings.OverlayUpdateLoop = class { constructor(options) { assert.equal(options.intervalMs,150); } };
  const file = "src/bootstrap/development/debug_overlay_bootstrap.js", source = fs.readFileSync(path.join(root,file),"utf8");
  const tree = acorn.parse(source,{ecmaVersion:"latest",sourceType:"module"});
  const body = tree.body.filter(node => node.type !== "ImportDeclaration").map(node => source.slice(node.declaration?.start || node.start,node.end)).join("\n");
  const factory = new SourceRuntime({globals:bindings}).run("(function(){"+body+";return createDebugOverlayRuntime;})()",file);
  const runtime = factory({config,baseConfig:config,settingsStore,documentTarget:{},windowTarget:{}});
  assert.equal(captured.length,19,"all original main overlays are composed exactly once");
  const data = {gameState:"playing",hookedFish:{id:"fish",name:"Fish",physics:{behaviors:{swim:{forceMultiplier:1,speedMultiplier:1,weight:1}}}},
    fishState:"swim",fishBasePower:1,fishInitialPower:1,fishBaseForceCurrentKg:1,fishCurrentStateMaxForceKg:1,
    fishPassiveKg:1,fishOppositionKg:1,activeDebuffName:"Немає",fishConditionPhase:"stamina",currentStamina:1,fishConditionMaxStamina:2,
    liveChances:[],chumZones:[],baits:[],equipment:{},bottomDepth:2,hookDepth:1,lineLength:3};
  let comparisons = 0;
  for (const record of captured) {
    const original = fs.readFileSync(path.join(root,record.module.source),"utf8");
    const parsed = acorn.parse(original,{ecmaVersion:"latest"});
    const declarations = parsed.body.filter(node => ["ClassDeclaration","FunctionDeclaration","VariableDeclaration"].includes(node.type))
      .map(node => original.slice(node.start,node.end)).join("\n");
    const Original = new SourceRuntime({globals:{...globals,CONFIG:config,window:{OverlaySettingsStore:settingsStore}}})
      .run("(function(){"+declarations+";return "+record.name+";})()",record.module.source);
    const legacy = new Original(record.options);
    for (const state of ["playing","waiting","biting","scouting"]) {
      data.gameState = state;
      assert.equal(Boolean(record.instance.isActive(data)),Boolean(legacy.isActive(data)),record.name+" activation "+state);
      if (!legacy.isActive(data)) continue;
      assert.equal(record.instance.render(data),legacy.render(data),record.name+" HTML/text/metrics parity "+state);
      comparisons++;
    }
  }
  assert(comparisons >= 15);
  runtime.dispose();runtime.dispose();
  const {formatDebuffName} = require("../src/dev/formatting/debuff_name_formatter.js");
  for (const [state,label] of [[{active:false,type:"swimPull"},"Немає"],[{active:true,type:null},"Невідомий"],[{active:true,type:"dashPull"},"dashPull"]])
    assert.equal(formatDebuffName(state),label);
  const {ITEM_DB} = require("../src/game/config/databases/item_catalog.js");
  const {createDevItemCatalog,DEV_BUILD_TEMPLATES} = require("../src/dev/data/dev_item_catalog.js");
  const catalog = createDevItemCatalog(ITEM_DB);
  assert.equal(Object.keys(ITEM_DB.builds).length,0,"production contains no DEV templates");
  assert.deepEqual(Object.keys(catalog.builds),["debug_float_build","debug_feeder_build"]);
  assert.equal(catalog.rods,ITEM_DB.rods,"normal categories retain shared catalog identity");
  assert.equal(catalog.builds.debug_float_build,DEV_BUILD_TEMPLATES.debug_float_build);
  const {ConfiguredInventorySeeder} = require("../src/game/application/inventory/legacy_inventory_system.js");
  const items = new Map(), inventoryAdapter = {getInstance:id=>items.get(id),remove:id=>items.delete(id),addItem:item=>items.set(item.instanceId,item)};
  new ConfiguredInventorySeeder({inventory:inventoryAdapter,itemDB:catalog,playerConfig:{}}).seed();
  assert(items.has("debug_float_build_box") && items.has("debug_feeder_build_box"));
  const previousItems=JSON.stringify([...items.values()]);
  new ConfiguredInventorySeeder({inventory:inventoryAdapter,itemDB:ITEM_DB,playerConfig:{}}).seed();
  assert.equal(JSON.stringify([...items.values()]),previousItems,"old DEV build IDs and serialized records survive production seeding");
  const {Fish,FishPhysicsProfile} = require("../src/game/domain/fish/fish.js");
  const fish = new Fish(1,1,{behaviors:{swim:{forceMultiplier:1}}});
  const facts = fish.getDebuffState();assert(Object.isFrozen(facts));assert.equal(facts,fish.getDebuffState());
  assert.equal(facts.active,false);assert.equal(formatDebuffName(facts),fish.activeDebuffName);
  console.log("Native DEV display parity: 19 overlays, "+comparisons+" active HTML comparisons, exact no-active/unknown/type labels, isolated catalog and stable Domain facts.");
}

checkNativeProductionStartup().then(() => {
checkNativeDevelopmentDisplays();
console.log("Config runtime passed: structured-clone and JSON fallback; frozen base, authoritative override identity, detached reads, live set/reset/import/export, root/adapter replacements and injected DEV base metrics.");
}).catch(error => { console.error(error);process.exitCode = 1; });
