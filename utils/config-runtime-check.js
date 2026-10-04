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
  assert.equal(config.physics.nested,value,"live write keeps the original identity");
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
  assert.equal(port.physics,replacement,"the RuntimeConfig port reads root replacements live");
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
  assert.equal(consumerConfig.physics,replacement);
  assert.equal(anotherPort.fightPhysicsConfig,replacementAdapter,"adapter overrides are read per call");
  assert.equal(Object.keys(anotherPort).includes("fightPhysicsConfig"),false);
  const metrics=new runtime.context.OverlayMetricResolver({baseConfig:base});
  assert.equal(metrics.resolvePath("BASE_CONFIG.physics.nested.value").value,1);
  const validateVersion=projectVersion=>new runtime.context.ConfigSchemaValidator({config,baseConfig:base,overrideStore:store,projectVersion}).validate();
  assert.equal(validateVersion(undefined).warnings.filter(issue=>issue.path==="project.version").length,1);
  assert.equal(validateVersion({version:"0.25.0"}).errors.filter(issue=>issue.path==="PROJECT_VERSION_CONFIG.version").length,0);
  assert.equal(validateVersion({version:"invalid"}).errors.filter(issue=>issue.path==="PROJECT_VERSION_CONFIG.version").length,1);
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

console.log("Config runtime passed: structured-clone and JSON fallback; frozen base, authoritative override identity, detached reads, live set/reset/import/export, root/adapter replacements and injected DEV base metrics.");
