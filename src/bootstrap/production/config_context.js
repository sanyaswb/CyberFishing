import { ConfigOverrideStore } from "../../game/config/runtime/config_override_store.js";
import { deepCloneConfig } from "../../platform/browser/config/deep_clone_config.js";
import { deepFreezeConfig } from "../../game/config/runtime/immutable_config.js";
import { ResolvedConfigProvider } from "../../game/config/runtime/resolved_config_provider.js";

export function createRuntimeConfigContext(runtimeConfig = {}, {catalogs = {}} = {}) {
  const baseConfig = deepFreezeConfig(deepCloneConfig(runtimeConfig));
  const overrideStore = new ConfigOverrideStore(deepCloneConfig);
  const resolvedProvider = new ResolvedConfigProvider(baseConfig,overrideStore,catalogs);
  let configView;
  const normalized = path => Array.isArray(path) && path[0] === "CONFIG" ? path.slice(1) : path;
  const refresh = () => configView.refresh();
  const context = Object.freeze({baseConfig,overrideStore,resolvedProvider,runtimeConfig,
    set(path,value) { overrideStore.set(normalized(path),value); refresh(); },
    reset(path) { resolvedProvider.resetOverride(normalized(path)); refresh(); },
    resetAll() { resolvedProvider.resetAllOverrides(); refresh(); },
    exportOverrides() { return overrideStore.toJSON(); },
    importOverrides(data) { resolvedProvider.importOverrides(data); refresh(); },
  });
  configView = createRuntimeConfigView(runtimeConfig,resolvedProvider,(path,value) => context.set(path,value));
  refresh();
  return context;
}

// A stable injected read view. Accessors contain no state and allocate no data on reads.
// The store/provider own values; linked catalog objects keep their separate authoring owner.
function createRuntimeConfigView(root, provider, write) {
  const views = new Map([["",root]]), immutablePaths = new Set();
  const isBranch = value => value && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Date.prototype && !provider.isCatalogReference(value);
  function prepare(parts, seed) {
    const key = parts.join("."), value = provider.readLive(parts);
    if (seed && Object.isFrozen(seed)) immutablePaths.add(key);
    if (!isBranch(value) || immutablePaths.has(key)) return value;
    let view = views.get(key);
    if (!view) { view = seed && isBranch(seed) && Object.isExtensible(seed) && Object.keys(seed).every(name => Object.getOwnPropertyDescriptor(seed,name).configurable) ? seed : {}; views.set(key,view); }
    for (const name of Object.keys(view)) if (!Object.prototype.hasOwnProperty.call(value,name)) delete view[name];
    for (const name of Object.keys(value)) {
      const childParts = [...parts,name], childKey = childParts.join(".");
      const descriptor = Object.getOwnPropertyDescriptor(view,name);
      prepare(childParts,descriptor?.value);
      Object.defineProperty(view,name,{enumerable:true,configurable:true,
        get: () => { const current = provider.readLive(childParts); return isBranch(current) ? (views.get(childKey) || current) : current; },
        set: next => write(childParts,next)});
    }
    return view;
  }
  return {view:root,refresh:() => prepare([],root)};
}
