"use strict";
const { composeTestConfig } = require("./testing/runtime/config_test_composition");
const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

function check(structured) {
  let cloneCalls = 0;
  const visual = {}, degradation = {};
  const config = {physics:{enabled:true,nested:{value:1}},rarity:{visual:null},degradationColors:null};
  const runtime = new SourceRuntime({globals:{window:{},CONFIG:config,RARITY_VISUAL_CONFIG:visual,DEGRADATION_COLOR_CONFIG:degradation,
    ...(structured ? {structuredClone:value=>{cloneCalls++;return structuredClone(value);}} : {})}});
  for(const [file,expose] of [
    ["src/platform/browser/config/deep_clone_config.js",["deepCloneConfig"]],
    ["src/game/config/runtime/config_override_store.js",["ConfigOverrideStore"]],
    ["src/game/config/runtime/resolved_config_provider.js",["ResolvedConfigProvider"]],
    ["src/game/config/runtime/immutable_config.js",["deepFreezeConfig","setRuntimeConfigPath","getRuntimeConfigPath"]],
    ["src/bootstrap/production/config_context.js",["createRuntimeConfigContext"]],
    ["src/bootstrap/production/game_composition_root.js",["GameCompositionRoot"]],
    ["src/game/config/runtime/config_provider.js",["ConfigProvider"]],
    ["src/game/config/validation/config_schema_validator.js",["ConfigSchemaValidator"]],
    ["src/dev/overlay/overlay_metric_resolver.js",["OverlayMetricResolver"]],
  ]) runtime.load(file,{expose});
  composeTestConfig(file => runtime.importModule(file), runtime.context);
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
  const source = fs.readFileSync(require("node:path").join(__dirname, "../src/bootstrap/development/development_game_startup.js"), "utf8");
  const tree = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
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
  const rootSource = fs.readFileSync(require("node:path").join(__dirname, "../src/bootstrap/production/game_composition_root.js"), "utf8");
  for (const [name, symbol, specifier] of [["loadRandomInventoryId","createRandomInventoryId","../../platform/browser/inventory/random_inventory_id.js"],["loadBrowserEventTargetAdapter","BrowserEventTargetAdapter","../../platform/browser/runtime/browser_event_target_adapter.js"],["loadBrowserTimeoutScheduler","BrowserTimeoutScheduler","../../platform/browser/time/browser_timeout_scheduler.js"],["loadInventoryAssemblyProfileConfig","getInventoryAssemblyProfileConfig","../../game/config/inventory/inventory_composition_config.js"]]) {
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
  const document = {}, window = { document, DEBUG_MODULES: { catchResolution: true } }, diagnostics = {}, configRuntime = {}, configValidation = {};
  const godModeInstance = { enabled: true }, gameLoopGuard = {};
  const debugModules = { catchResolution: true };
  class Flags { constructor(options) { this.options = options; } }
  class Renderer { constructor(options) { this.options = options; } }
  class Tools { constructor(config, synchronizer, options) { Object.assign(this, { config, synchronizer, options }); } }
  const runtime = new SourceRuntime({ globals: { window, DevFlagsProvider: Flags, WorldDebugRenderer: Renderer,
    LocationDebugRenderFrameBuilder: Renderer, DevTools: Tools, RenderAllocationDiagnostics: diagnostics,
    CONFIG_RUNTIME_CONTEXT: configRuntime, configRuntime, configValidation, LocationDebugMapBuilder: Renderer, ItemProgressionDebugSnapshotProvider: Renderer,
    FixedCatchFishFactory: Renderer, FixedCatchHook: Renderer, HookedFishProfileSynchronizer: Renderer, DebugService: Renderer,
    itemCatalog: {}, FISH_DB: {}, mapCatalog: {}, settingsStore: {}, storageCache: {}, debugModulesSource: () => debugModules, debugModules,
    DevToolsParameterTooltipProvider: class {}, DevToolsUI: class {},
    documentTarget: document, windowTarget: window, gameLoopGuard, godMode: godModeInstance } });

  runtime.context.DevFlagsProvider = Flags; // Keep the constructor spy after loading the real canvas provider.
  const ports = runtime.run("(" + source.slice(options.start, options.end) + ")");
  assert.equal(ports.documentTarget, document);
  assert.equal(ports.windowTarget, window);
  assert.equal(ports.gameLoopGuard, gameLoopGuard, "the page loop guard reaches the composition root");
  const config = {}, flags = ports.createDevFlags(config);
  assert.equal(flags.options.config, config);
  assert.equal(flags.options.godModeSource(), runtime.context.godMode);
  assert.equal(flags.options.debugModulesSource(), runtime.context.debugModules);
  runtime.context.debugModules.catchResolution = false;
  assert.equal(flags.options.debugModulesSource().catchResolution, false, "flag source stays live");
  assert.equal(ports.isCatchResolutionLogEnabled(), false);
  runtime.context.debugModules.catchResolution = true;
  assert.equal(ports.isCatchResolutionLogEnabled(), true);
  // Native DEV toggles have one injected owner: unrelated window/document globals no longer drive them.
  window.DEBUG_MODULES = { catchResolution: false }; window.document = null;
  assert.equal(ports.isCatchResolutionLogEnabled(), true, "window globals do not own native DEV toggles");
  assert.equal(flags.options.debugModulesSource(), runtime.context.debugModules);
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
  const hookDeps = { config, biteRules: {}, devFlags: {}, fishRarityResolver: {}, fishAnomalyVariantResolver: {}, fishVisualVariantResolver: {} };
  const hook = ports.createHookedFishOverride(hookDeps);
  assert.equal(hook.options.config, config);assert.equal(hook.options.biteRules, hookDeps.biteRules);assert.equal(hook.options.devFlags, hookDeps.devFlags);
  assert.deepEqual(Object.keys(hook.options.fishFactory.options).sort(), ["fishAnomalyVariantResolver", "fishRarityResolver", "fishVisualVariantResolver"], "DEV Fixed Catch hook composes its fish factory");
  assert.equal(ports.createHookedFishProfileSynchronizer(rendererOptions).options, rendererOptions);
  assert.equal(ports.createDebugService(config).options, config);
  const tools = ports.createDevTools(config, synchronizer, { itemProgressionResolver: progression });
  assert.equal(tools.config, config);
  assert.equal(tools.synchronizer, synchronizer);
  assert.equal(tools.options.configRuntime, configRuntime);
  assert.equal(tools.options.configValidation, configValidation, "DEV tools validate the live config after edits");
  assert.equal(tools.options.itemProgressionResolver, progression);
}
checkDevelopmentInputs();

function checkProductionOverrideReader() {
  const { GameplayOverrideReader } = require("../src/game/application/fishing/gameplay_override_reader.js");
  const config = { debug: {} }, source = new SourceRuntime({ globals: { CONFIG: config, window: {} } });
  source.load("src/platform/browser/runtime/dev_flags_provider.js", { expose: ["DevFlagsProvider"] });
  source.load("src/bootstrap/production/game_composition_root.js", { expose: ["GameCompositionRoot"] });
  // DEV composes the same reader class as production.
  const reader = new GameplayOverrideReader(config);
  const flags = new source.context.DevFlagsProvider({ config, godModeSource: () => reader });
  for (const enabled of [undefined, false, 0, true, 1, "enabled"]) {
    for (const value of [undefined, false, true, 1, "yes"]) {
      config.debug.godMode = { enabled, infiniteResources:value, noEquipmentLoss:value, noHookEscape:value,
        noLineBreak:value, noRodBreak:value, noFishStaminaLoss:value, infiniteCasting:value,
        fixedBiteChanceEnabled:value, fixedBiteChancePercent:-20, forceAnomalyChance:value, biteSequenceMode:"GUARANTEED" };
      assert.equal(flags.isEnabled("noEquipmentLoss"), reader.noEquipmentLoss === true);
      assert.equal(flags.godModeValue("biteSequenceMode"), reader.biteSequenceMode);
    }
  }
  const expectedPercents = [0,0,50,100,100,42,100,100];
  [-5,0,50,100,150,"42",NaN,Infinity].forEach((percent, index) => {
    config.debug.godMode = { enabled:true,fixedBiteChanceEnabled:true,fixedBiteChancePercent:percent };
    assert.equal(reader.fixedBiteChancePercent, expectedPercents[index], "fixed bite percent " + String(percent));
  });
  const expectedModes = ["default","default","normal","guaranteed","default"];
  [undefined,"default","NORMAL","guaranteed","other"].forEach((mode, index) => {
    config.debug.godMode.biteSequenceMode = mode;
    assert.equal(reader.biteSequenceMode, expectedModes[index], "bite sequence mode " + String(mode));
  });
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
  const { DevFlagsProvider } = evaluate("src/platform/browser/runtime/dev_flags_provider.js", ["DevFlagsProvider"], { EventBus });
  const { ActiveGameLoopGuard } = evaluate("src/platform/browser/runtime/active_game_loop_guard.js", ["ActiveGameLoopGuard"], {});
  const { createRuntimeConfigContext } = evaluate("src/bootstrap/production/config_context.js", ["createRuntimeConfigContext"], {
    ...require("../src/game/config/runtime/config_override_store.js"), ...require("../src/game/config/runtime/resolved_config_provider.js"),
    ...require("../src/platform/browser/config/deep_clone_config.js"), ...require("../src/game/config/runtime/immutable_config.js"),
  });
  const loaders = {
    loadRandomInventoryId: "../../platform/browser/inventory/random_inventory_id.js",
    loadBrowserEventTargetAdapter: "../../platform/browser/runtime/browser_event_target_adapter.js",
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
    const documentTarget = { readyState, addEventListener(type, fn, options) { assert.equal(options.once, true);documentListeners.set(type, fn); },
      removeEventListener(type,fn){if(documentListeners.get(type)===fn)documentListeners.delete(type);} };
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
        assert.deepEqual(Object.keys(ports).sort(), [...Object.keys(loaders), "windowTarget", "documentTarget", "gameLoopGuard", "createDevFlags"].sort(), "production supplies only gameplay and platform ports (no Fixed Catch)");
        assert(ports.gameLoopGuard instanceof ActiveGameLoopGuard, "startup composes the page loop guard");
        this.ports = ports;
        const flags = ports.createDevFlags(owner);assert(flags instanceof DevFlagsProvider);assert.equal(flags.isEnabled("noEquipmentLoss"), true);
        owner.debug.godMode.enabled = false;assert.equal(flags.isEnabled("noEquipmentLoss"), false);owner.debug.godMode.enabled = true;
        assert(reader instanceof GameplayOverrideReader);
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
      GameCompositionRoot: Root, ActiveGameLoopGuard, ...composition, ...platform,
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
    assert.deepEqual(imports, Object.values(loaders));assert.deepEqual([roots, builds, starts, contexts, adapters, activations, storage, previous], [1,1,1,1,1,1,0,1], "production startup prints no storage report");
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
  const devModules = fs.readdirSync(path.join(root,"src/dev"),{recursive:true}).map(file => "src/dev/" + String(file).replaceAll("\\","/"))
    .filter(file => file.endsWith(".js")).sort().map(target => ({target,exports:Object.keys(require(path.join(root,target)))}));
  const globals = {};
  for (const module of devModules) Object.assign(globals,require(path.join(root,module.target)));
  const config = require("../src/game/config/runtime/game_config.js").CONFIG;
  const settingsStore = new globals.OverlaySettingsStore(Object.fromEntries(Object.keys(globals.OVERLAY_MODULES).map(key=>[key,true])));
  const captured = [];
  const overlayModules = devModules.filter(module => module.target.startsWith("src/dev/overlay/") &&
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
    fishPassiveKg:1,fishOppositionKg:1,fishConditionPhase:"stamina",currentStamina:1,fishConditionMaxStamina:2,
    liveChances:[],chumZones:[],baits:[],equipment:{},bottomDepth:2,hookDepth:1,lineLength:3};
  let comparisons = 0;
  for (const record of captured) {
    for (const state of ["playing","waiting","biting","scouting"]) {
      data.gameState = state;
      if (!record.instance.isActive(data)) continue;
      const html = record.instance.render(data);
      assert(typeof html === "string" && html.length > 0,record.name+" renders "+state);
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
  const {ConfiguredInventorySeeder} = require("../src/game/application/inventory/configured_inventory_seeder.js");
  const items = new Map(), inventoryAdapter = {getInstance:id=>items.get(id),remove:id=>items.delete(id),addItem:item=>items.set(item.instanceId,item)};
  new ConfiguredInventorySeeder({inventory:inventoryAdapter,itemDB:catalog,playerConfig:{}}).seed();
  assert(items.has("debug_float_build_box") && items.has("debug_feeder_build_box"));
  const previousItems=JSON.stringify([...items.values()]);
  new ConfiguredInventorySeeder({inventory:inventoryAdapter,itemDB:ITEM_DB,playerConfig:{}}).seed();
  assert.equal(JSON.stringify([...items.values()]),previousItems,"old DEV build IDs and serialized records survive production seeding");
  const {Fish,FishPhysicsProfile} = require("../src/game/domain/fish/fish.js");
  const fish = new Fish(1,1,{behaviors:{swim:{forceMultiplier:1}}});
  const facts = fish.getDebuffState();assert(Object.isFrozen(facts));assert.equal(facts,fish.getDebuffState());
  assert.equal(facts.active,false);assert.equal(formatDebuffName(facts),"Немає");assert.equal(formatDebuffName(null),"Немає");
  console.log("Native DEV displays: 19 overlays, "+comparisons+" active renders, exact no-active/unknown/type labels, isolated catalog and stable Domain facts.");
}

function checkLocationMapConfigChanges() {
  const source = new SourceRuntime({globals:{document:{addEventListener(){},removeEventListener(){},dispatchEvent(){}},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}, console:{...console,log(){}}},
  });
  const {CONFIG} = source.importModule('src/game/config/runtime/game_config.js');
  const {createRuntimeConfigContext} = source.importModule('src/bootstrap/production/config_context.js');
  const {LocationMap} = ({ ...source.importModule('src/game/domain/locations/grid_cell.js'), ...source.importModule('src/game/domain/locations/dynamic_zone.js'), ...source.importModule('src/game/domain/locations/location_map.js') });
  const fields = ['debugGrid','debugDepthText','debugZones','enableCastable','enableCollisions','enableSnags','enableDynamicZones'];
  const config = JSON.parse(JSON.stringify(CONFIG));
  const context = createRuntimeConfigContext(config);
  const resources = {background:{dynamic:false},loaded:true};
  const locationId = Object.keys(config.locations.map)[0];
  const map = new LocationMap(locationId,config.locations,{next:()=>0.5},resources);
  let calls = 0;
  const recalculate = map.recalculateZones;
  map.recalculateZones = function(...args) {calls++;return recalculate.apply(this,args);};
  const verify = (expectedCalls,expectedRevision) => {
    assert.equal(calls,expectedCalls,'only location flag changes recalculate zones');
    assert.equal(map.getRevision(),expectedRevision,'revision preserves the original update order');
  };
  verify(0,1);map.update(16,12);verify(1,2);
  for(let frame=0;frame<128;frame++) map.update(16,12);
  verify(1,2);
  for(const [index,field] of fields.entries()) {
    assert.equal(typeof config.locations[field],'boolean','supported location writers use booleans');
    context.set('locations.'+field,!config.locations[field]);
    map.update(16,12);verify(index+2,index+3);
    map.update(16,12);verify(index+2,index+3);
  }
  const exported = JSON.parse(JSON.stringify(context.exportOverrides()));
  context.set('debug.godMode.enabled',!config.debug.godMode.enabled);
  context.set('physics.enabled',!config.physics.enabled);
  map.update(16,12);verify(8,9);
  context.resetAll();map.update(16,12);verify(9,10);
  context.importOverrides(exported);map.update(16,12);verify(10,11);
  context.importOverrides(exported);map.update(16,12);verify(10,11);
  const replacement = JSON.parse(JSON.stringify(config.locations));
  map.refreshConfig(replacement,resources);verify(11,12);
  map.update(16,12);verify(11,12);
  replacement.debugGrid = !replacement.debugGrid;
  map.update(16,12);verify(12,13);
  const changedReplacement = JSON.parse(JSON.stringify(replacement));
  changedReplacement.enableSnags = !changedReplacement.enableSnags;
  map.refreshConfig(changedReplacement,resources);verify(13,14);
  map.update(16,12);verify(14,15);
  const switches = new Map();
  const ui = new Proxy({body:{},createSection:()=>({}),createSwitcherRow(key,value,parent,change,path){switches.set(path.join('.'),change);}},
    {get:(target,key)=>target[key] || (()=>{})});
  const {DevTools} = source.importModule('src/dev/tools/dev_tools.js');
  const tools = new DevTools(config,{synchronize(){}},{configRuntime:context,catalogs:{},settingsStore:null,storageCache:{get:()=>({}),set(){}},
    debugModulesSource:()=>({}),createUI:()=>({ui,tooltipProvider:{ready:Promise.resolve()}})});
  tools.toggle();
  // The map receives the same live view that actual checkbox callbacks write through the authoritative store.
  map.refreshConfig(config.locations,resources);verify(15,16);
  map.update(16,12);verify(16,17);
  for(const [index,field] of fields.entries()) {
    const change = switches.get('CONFIG.locations.'+field);
    assert.equal(typeof change,'function','location checkbox exists: '+field);
    change(!config.locations[field]);map.update(16,12);verify(index+17,index+18);
    map.update(16,12);verify(index+17,index+18);
  }
  tools.dispose();
  const missingFlags = JSON.parse(JSON.stringify(config.locations));
  for(const field of fields) delete missingFlags[field];
  const first = new LocationMap(locationId,missingFlags,{next:()=>0.5},resources);
  first.update(16,12);assert.equal(first.getRevision(),2,'first update recalculates even with missing flags');
  first.update(16,12);assert.equal(first.getRevision(),2);
}

async function checkNativeDevelopmentLifecycle() {
  const counts={root:0,start:0,gameDispose:0,consoleDispose:0,overlayDispose:0,probeDispose:0,watchdogDispose:0};
  const listeners=new Map(), windowTarget={console,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  const config={rarity:{},spawns:{fishes:[]},locations:{map:{}},debug:{godMode:{enabled:false,noEquipmentLoss:true},fixedCatch:{enabled:false},consoleModules:{},memoryWatchdog:{enabled:true}}};
  const composition = new SourceRuntime({moduleStubs:{'src/game/config/runtime/game_config.js':{CONFIG:config}}})
    .importModule('src/bootstrap/production/game_config_composition.js');
  let configRuntime;
  let resolveBuild,rejectBuild,buildReady;
  const resetBuild=()=>{buildReady=new Promise((resolve,reject)=>{resolveBuild=resolve;rejectBuild=reject;});};
  const app={start(){counts.start++;return true;},dispose(){counts.gameDispose++;}};
  class Root { constructor(config,options){counts.root++;this.options=options;}build(){return buildReady;}getMemoryWatchdogConfig(){return config.debug.memoryWatchdog;}printStorageUsage(){} }
  const resource=key=>({dispose(){counts[key]++;}});
  const source=new SourceRuntime({moduleStubs:{
    'src/platform/browser/runtime/browser_startup_environment.js':{getBrowserStartupEnvironment:()=>({windowTarget,documentTarget:{}}),publishBrowserStartupConfig(target,runtime){target.CYBER_FISHING_CONFIG_RUNTIME=runtime;},activateBrowserStartupInterface(){}},
    'src/game/config/runtime/game_config.js':{CONFIG:config},
    'src/bootstrap/production/game_config_composition.js':{createProductionConfigContext(initialize){configRuntime=composition.createProductionConfigContext(initialize);return configRuntime;}},
    'src/bootstrap/production/game_composition_root.js':{GameCompositionRoot:Root},
    'src/bootstrap/development/debug_console_bootstrap.js':{createDebugConsoleRuntime:()=>resource('consoleDispose')},
    'src/bootstrap/development/debug_overlay_bootstrap.js':{createDebugOverlayRuntime:()=>resource('overlayDispose')},
    'src/dev/modules/reel_retrieve_diagnostic.js':{ReelRetrieveDiagnostic:class{dispose(){counts.probeDispose++;}}},
    'src/dev/services/memory_leak_watchdog.js':{MemoryLeakWatchdog:class{start(){}dispose(){counts.watchdogDispose++;}getReport(){return{};}}},
  }});
  const startup=source.importModule('src/bootstrap/development/development_game_startup.js');
  assert.equal(source.context.__CYBER_FISHING_COMPAT_RUNTIME__,undefined,'native harness never publishes a transport');
  const Game=source.importModule('src/bootstrap/production/game.js').Game;
  assert.equal(Game,source.importModule('src/bootstrap/production/game.js').Game,'one native class per VM context');
  assert.notEqual(Game,new SourceRuntime().importModule('src/bootstrap/production/game.js').Game,'different VM realms retain isolated module identity');
  resetBuild();const first=startup.startDevelopmentGame();assert.equal(startup.startDevelopmentGame(),first);resolveBuild(app);
  const game=await first;assert(game instanceof Game);assert.equal(counts.root,1);assert.equal(counts.start,1);assert.equal(listeners.size,1);
  assert.equal(configRuntime.baseConfig.debug.godMode.enabled,true,'DEV explicitly enables its balance default before freezing the base');
  assert.equal(configRuntime.baseConfig.debug.fixedCatch.enabled,true);
  const {GameplayOverrideReader} = source.importModule('src/game/application/fishing/gameplay_override_reader.js');
  const reader = new GameplayOverrideReader(config);
  assert.equal(reader.noEquipmentLoss,true);
  configRuntime.set('debug.godMode.enabled',false);configRuntime.set('debug.fixedCatch.enabled',false);
  assert.equal(reader.noEquipmentLoss,false);assert.equal(config.debug.fixedCatch.enabled,false);
  const saved = JSON.parse(JSON.stringify(configRuntime.exportOverrides()));
  configRuntime.resetAll();assert.equal(reader.noEquipmentLoss,true);assert.equal(config.debug.fixedCatch.enabled,true);
  configRuntime.importOverrides(saved);assert.equal(reader.noEquipmentLoss,false);assert.equal(config.debug.fixedCatch.enabled,false);
  const cleanup=windowTarget.CYBER_FISHING_GAME_CLEANUP;cleanup();cleanup();
  assert.equal(counts.gameDispose,1);assert.equal(counts.watchdogDispose,1);assert.equal(listeners.size,0);
  assert.equal(windowTarget.game,null);assert.equal(windowTarget.CYBER_FISHING_GAME_CLEANUP,null);assert.equal(windowTarget.getCyberFishingMemoryReport,null);
  resetBuild();const second=startup.startDevelopmentGame();assert.notEqual(second,first);resolveBuild(app);await second;windowTarget.CYBER_FISHING_GAME_CLEANUP();
  assert.equal(config.debug.godMode.enabled,false,'restart preserves the live override instead of reapplying DEV defaults');
  assert.equal(config.debug.fixedCatch.enabled,false);
  assert.equal(counts.root,2);assert.equal(counts.start,2);assert.equal(counts.gameDispose,2);assert.equal(windowTarget.CYBER_FISHING_CONFIG_RUNTIME,configRuntime);
  resetBuild();const failed=startup.startDevelopmentGame();rejectBuild(new Error('fixture build failure'));await assert.rejects(failed,/fixture build failure/);
  assert.equal(listeners.size,0);assert.equal(windowTarget.game,null);assert.equal(counts.consoleDispose,3);assert.equal(counts.overlayDispose,3);assert.equal(counts.probeDispose,3);
  resetBuild();const hidden=startup.startDevelopmentGame();listeners.get('pagehide')();resolveBuild(app);await hidden;
  assert.equal(counts.start,2,'pagehide during a pending build never starts a late game loop');assert.equal(counts.gameDispose,3);
  assert.equal(counts.consoleDispose,4);assert.equal(counts.overlayDispose,4);assert.equal(counts.probeDispose,4);assert.equal(counts.watchdogDispose,2);
}

checkNativeProductionStartup().then(checkNativeDevelopmentLifecycle).then(() => {
checkNativeDevelopmentDisplays();
checkLocationMapConfigChanges();
for(let reload=0;reload<2;reload++) {
  const production = new SourceRuntime();
  const {createProductionConfigContext} = production.importModule('src/bootstrap/production/game_config_composition.js');
  const context = createProductionConfigContext();
  const {GameplayOverrideReader} = production.importModule('src/game/application/fishing/gameplay_override_reader.js');
  assert.equal(context.runtimeConfig.debug.godMode.enabled,false,'actual production composition has safe defaults on startup/reload');
  assert.equal(context.runtimeConfig.debug.fixedCatch.enabled,false);
  assert.equal(new GameplayOverrideReader(context.runtimeConfig).noEquipmentLoss,false);
  assert.equal(context.overrideStore.entries().length,0,'DEV settings never leak into the production realm');
  assert.equal(createProductionConfigContext(),context,'one config context');
  // Normalized physics settings are computed once per runtime config revision and follow every live override.
  const physics = context.runtimeConfig.fightPhysicsConfig;
  const water = physics.getWaterConfig(), rodControl = physics.getRodControlConfig();
  assert.equal(physics.getWaterConfig(), water, 'unchanged config reuses the normalized water settings');
  assert.equal(physics.getRodControlConfig(), rodControl, 'unchanged config reuses the normalized rod control settings');
  const path = 'physics.water.motionResistance', original = water.motionResistance;
  context.set(path, original + 7);
  assert.equal(physics.getWaterConfig().motionResistance, original + 7, 'a live override reaches the adapter');
  assert.notEqual(physics.getRodControlConfig(), rodControl, 'an override recomputes dependent settings');
  assert.equal(physics.getRodControlConfig().water.motionResistance, original + 7);
  context.reset(path);
  assert.equal(physics.getWaterConfig().motionResistance, original, 'resetting the override restores the setting');
  context.set(path, original + 1);context.resetAll();
  assert.equal(physics.getWaterConfig().motionResistance, original, 'reset all restores the setting');
}
console.log("Config runtime passed: structured-clone and JSON fallback; frozen base, authoritative override identity, detached reads, live set/reset/import/export, root/adapter replacements and injected DEV base metrics.");
}).catch(error => { console.error(error);process.exitCode = 1; });
