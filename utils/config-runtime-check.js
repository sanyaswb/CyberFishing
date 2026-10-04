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
console.log("Config runtime passed: structured-clone and JSON fallback; frozen base, authoritative override identity, detached reads, live set/reset/import/export, root/adapter replacements and injected DEV base metrics.");
