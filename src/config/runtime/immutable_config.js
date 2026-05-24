function deepCloneConfig(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function deepFreezeConfig(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreezeConfig(child, seen);
  return Object.freeze(value);
}

function setRuntimeConfigPath(root, path, value) {
  const parts = Array.isArray(path) ? path.slice() : String(path).split(".").filter(Boolean);
  if (!parts.length) return;
  let target = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!target[key] || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  }
  target[parts[parts.length - 1]] = value;
}

function getRuntimeConfigPath(root, path) {
  const parts = Array.isArray(path) ? path : String(path).split(".").filter(Boolean);
  let target = root;
  for (const key of parts) {
    if (target == null || !Object.prototype.hasOwnProperty.call(target, key)) {
      return undefined;
    }
    target = target[key];
  }
  return target;
}

function createRuntimeConfigContext(runtimeConfig) {
  const baseConfig = deepFreezeConfig(deepCloneConfig(runtimeConfig || {}));
  const overrideStore = new ConfigOverrideStore();
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
