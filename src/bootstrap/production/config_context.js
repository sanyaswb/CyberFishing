import { ConfigOverrideStore } from "../../game/config/runtime/config_override_store.js";
import { deepCloneConfig } from "../../platform/browser/config/deep_clone_config.js";
import { deepFreezeConfig, setRuntimeConfigPath } from "../../game/config/runtime/immutable_config.js";
import { ResolvedConfigProvider } from "../../game/config/runtime/resolved_config_provider.js";

export function createRuntimeConfigContext(runtimeConfig) {
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

