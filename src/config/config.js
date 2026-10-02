function createRuntimeConfigContext(runtimeConfig) {
  const baseConfig = deepFreezeConfig(deepCloneConfig(runtimeConfig || {}));
  const overrideStore = new ConfigOverrideStore(deepCloneConfig);
  const resolvedProvider = new ResolvedConfigProvider(baseConfig, overrideStore);
  return Object.freeze({
    baseConfig,
    overrideStore,
    resolvedProvider,
    set(path, value) {
      const normalized = Array.isArray(path) && path[0] === "CONFIG" ? path.slice(1) : path;
      overrideStore.set(Array.isArray(normalized) ? normalized.join(".") : normalized, value);
      setRuntimeConfigPath(runtimeConfig, normalized, value);
    },
    reset(path) {
      const normalized = Array.isArray(path) && path[0] === "CONFIG" ? path.slice(1) : path;
      const key = Array.isArray(normalized) ? normalized.join(".") : String(normalized || "");
      overrideStore.remove(key);
      const baseValue = resolvedProvider.getBase(key);
      if (baseValue !== undefined) setRuntimeConfigPath(runtimeConfig, key, deepCloneConfig(baseValue));
    },
    resetAll() {
      const overrides = overrideStore.entries();
      overrideStore.clear();
      for (const [path] of overrides) {
        const baseValue = resolvedProvider.getBase(path);
        if (baseValue !== undefined) setRuntimeConfigPath(runtimeConfig, path, deepCloneConfig(baseValue));
      }
    },
    exportOverrides() {
      return overrideStore.toJSON();
    },
    importOverrides(data) {
      overrideStore.loadFromJSON(data);
      for (const [path, value] of overrideStore.entries()) {
        setRuntimeConfigPath(runtimeConfig, path, value);
      }
    },
  });
}

CONFIG.rarity.visual = RARITY_VISUAL_CONFIG;
CONFIG.degradationColors = DEGRADATION_COLOR_CONFIG;

if (typeof FightPhysicsConfigAdapter !== "undefined") {
  Object.defineProperty(CONFIG, "fightPhysicsConfig", {
    value: new FightPhysicsConfigAdapter(CONFIG),
    enumerable: false,
    configurable: true,
  });
}

const CONFIG_RUNTIME_CONTEXT = createRuntimeConfigContext(CONFIG);

const BASE_CONFIG = CONFIG_RUNTIME_CONTEXT.baseConfig;
const CONFIG_OVERRIDE_STORE = CONFIG_RUNTIME_CONTEXT?.overrideStore || null;
const RESOLVED_CONFIG_PROVIDER =
  CONFIG_RUNTIME_CONTEXT?.resolvedProvider || null;

if (typeof window !== "undefined") {
  window.CYBER_FISHING_CONFIG_RUNTIME = CONFIG_RUNTIME_CONTEXT;
}
