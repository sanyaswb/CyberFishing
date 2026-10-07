"use strict";

// Explicit configuration fixture composition; the native loader owns only module evaluation.
function composeTestConfig(getExports, context) {
  const {createRuntimeConfigContext}=getExports("src/bootstrap/production/config_context.js");
  const {FightPhysicsConfigAdapter}=getExports("src/game/config/physics/fight_physics_config_adapter.js");
  const config=context.CONFIG || getExports("src/game/config/runtime/game_config.js").CONFIG;
  config.rarity.visual=context.RARITY_VISUAL_CONFIG || getExports("src/game/presentation/rarity/rarity_visual_config.js").RARITY_VISUAL_CONFIG;
  config.degradationColors=context.DEGRADATION_COLOR_CONFIG || getExports("src/game/presentation/visual/degradation_color_config.js").DEGRADATION_COLOR_CONFIG;
  Object.defineProperty(config,"fightPhysicsConfig",{value:new FightPhysicsConfigAdapter(config),enumerable:false,configurable:true});
  const runtime=createRuntimeConfigContext(config,{catalogs:{"locations.map":config.locations?.map,"spawns.fishes":config.spawns?.fishes,"rarity.visual":config.rarity.visual,"degradationColors":config.degradationColors}});
  Object.assign(context,{CONFIG:config,createRuntimeConfigContext,CONFIG_RUNTIME_CONTEXT:runtime,BASE_CONFIG:runtime.baseConfig,CONFIG_OVERRIDE_STORE:runtime.overrideStore,RESOLVED_CONFIG_PROVIDER:runtime.resolvedProvider});
  if (context.window) context.window.CYBER_FISHING_CONFIG_RUNTIME=runtime;
  return runtime;
}

module.exports = { composeTestConfig };
