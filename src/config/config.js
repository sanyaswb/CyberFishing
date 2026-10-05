CONFIG.rarity.visual = RARITY_VISUAL_CONFIG;
CONFIG.degradationColors = DEGRADATION_COLOR_CONFIG;

if (typeof FightPhysicsConfigAdapter !== "undefined") {
  Object.defineProperty(CONFIG, "fightPhysicsConfig", {
    value: new FightPhysicsConfigAdapter(CONFIG),
    enumerable: false,
    configurable: true,
  });
}

const CONFIG_RUNTIME_CONTEXT = createRuntimeConfigContext(CONFIG, {catalogs: {"locations.map": CONFIG.locations?.map, "rarity.visual": CONFIG.rarity.visual, "degradationColors": CONFIG.degradationColors, "spawns.fishes": CONFIG.spawns?.fishes}});

const BASE_CONFIG = CONFIG_RUNTIME_CONTEXT.baseConfig;
const CONFIG_OVERRIDE_STORE = CONFIG_RUNTIME_CONTEXT?.overrideStore || null;
const RESOLVED_CONFIG_PROVIDER =
  CONFIG_RUNTIME_CONTEXT?.resolvedProvider || null;

if (typeof window !== "undefined") {
  window.CYBER_FISHING_CONFIG_RUNTIME = CONFIG_RUNTIME_CONTEXT;
}
