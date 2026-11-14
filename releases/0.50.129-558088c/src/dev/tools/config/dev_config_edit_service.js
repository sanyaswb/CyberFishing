// The one path every DevTools edit takes (spec 174 B2, moved from DevTools): CONFIG through the runtime override store
// with validation, the catalogs (ITEM_DB, FISH_DB, MAP_DB) and the hooked fish in place; then the panel's controls of
// that path are synced, linked values kept consistent and the game told through its DOM events. Also the session-wide
// override actions (import, reset of all, reset of one subtree). No DOM of its own: events go to eventTarget.
export class DevConfigEditService {
  #config;
  #catalogs;
  #configRuntime;
  #configValidation;
  #parameterAliases;
  #prepareZoneEdit;
  #getHookedFish;
  #hookedFishSync;
  #itemStatSync;
  #itemProgressionResolver;
  #debugModulesSource;
  #syncValue;
  #eventTarget;
  #logger;

  constructor({ config, catalogs, configRuntime = null, configValidation = null, parameterAliases,
    prepareZoneEdit = null, getHookedFish, hookedFishSync, itemStatSync, itemProgressionResolver = null,
    debugModulesSource, syncValue, eventTarget, logger = console }) {
    this.#config = config;
    this.#catalogs = catalogs;
    this.#configRuntime = configRuntime;
    this.#configValidation = configValidation;
    this.#parameterAliases = parameterAliases;
    this.#prepareZoneEdit = prepareZoneEdit;
    this.#getHookedFish = getHookedFish;
    this.#hookedFishSync = hookedFishSync;
    this.#itemStatSync = itemStatSync;
    this.#itemProgressionResolver = itemProgressionResolver;
    this.#debugModulesSource = debugModulesSource;
    this.#syncValue = syncValue;
    this.#eventTarget = eventTarget;
    this.#logger = logger;
  }

  get configRuntime() {
    return this.#configRuntime;
  }

  // The live value at a path (CONFIG, ITEM_DB, FISH_DB, MAP_DB, HOOKED_FISH ...), undefined when it is not there.
  read(path) {
    let current = this.#rootOf(path?.[0]);
    if (!current) return undefined;
    for (let i = 1; i < path.length; i++) {
      if (current == null) return undefined;
      current = current[path[i]];
    }
    return current;
  }

  update(path, value) {
    path = this.#parameterAliases.resolveCanonicalPath(path) || path;
    const displayPath = path;
    if (this.#prepareZoneEdit) ({ path, value } = this.#prepareZoneEdit(path, value));
    const root = this.#rootOf(path[0]);
    if (!root) return;

    if (path[0] === "CONFIG" && this.#configRuntime) {
      this.#configRuntime.set(path, value);
      this.#configValidation?.report(`edit ${path.join(".")}`, { quietWhenValid: true });
    } else {
      let target = root;
      for (let i = 1; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
    }

    this.#syncValue(path, value);
    if (displayPath !== path) {
      let displayed = value;
      for (const key of displayPath.slice(path.length)) displayed = displayed?.[key];
      this.#syncValue(displayPath, displayed);
    }

    this.#syncDebugConsoleModule(path, value);
    this.#hookedFishSync.afterEdit(path, value, root);
    if (path[0] === "HOOKED_FISH") {
      this.#logger.log(`[DevTools] Оновлено ${path.join(".")} =`, value);
      this.#dispatch("debug-hooked-fish-updated", { path, value, fish: root });
      return;
    }
    this.#itemStatSync.afterEdit(path, value);
    this.#invalidateItemProgression(path);
    this.#logger.log(`[DevTools] Оновлено ${path.join(".")} =`, value);
    this.#dispatch("config-updated", { path, value, override: path[0] === "CONFIG" });
  }

  // Spec 174 C3: whether a CONFIG parameter has a session override (its value is not the code's).
  isOverridden(path) {
    return path[0] === "CONFIG" && this.#configRuntime?.overrideStore.has(path.slice(1).join(".")) === true;
  }

  // Spec 174 C3: one CONFIG parameter back to the code's value; the panel and the game hear it like an edit.
  resetParameter(path) {
    if (path[0] !== "CONFIG" || !this.#configRuntime) return;
    this.#configRuntime.reset(path);
    const value = this.read(path);
    this.#syncValue(path, value);
    this.#logger.log(`[DevTools] Скинуто ${path.join(".")} =`, value);
    this.#dispatch("config-updated", { path, value, override: true });
  }

  // An overrides export of another session, with its old parameter names normalised.
  importOverrides(overrides) {
    this.#configRuntime?.importOverrides(this.#parameterAliases.normalizeConfigOverrides(overrides) || overrides);
    this.#dispatch("config-updated", { path: ["CONFIG"], value: this.#config, importOverrides: true });
    this.#invalidateItemProgression(["CONFIG", "itemProgression"]);
  }

  resetAll() {
    this.#configRuntime?.resetAll();
    this.#dispatch("config-updated", { path: ["CONFIG"], value: this.#config, resetAll: true });
    this.#invalidateItemProgression(["CONFIG", "itemProgression"]);
  }

  // Drops the session's overrides of CONFIG.<configParts...> and every path under it, so it is the code's again.
  // The event carries the subtree object as it was read before the reset (as before spec 174 B2).
  resetOverrideTree(configParts) {
    const value = this.read(["CONFIG", ...configParts]);
    const prefix = configParts.join(".");
    for (const key of Object.keys(this.#configRuntime.exportOverrides())) {
      if (key === prefix || key.startsWith(prefix + ".")) this.#configRuntime.reset(key);
    }
    this.#dispatch("config-updated", { path: ["CONFIG", ...configParts], value, override: true });
  }

  #rootOf(name) {
    if (name === "CONFIG") return this.#config;
    if (name === "ITEM_DB") return this.#catalogs.items ?? null;
    if (name === "FISH_DB") return this.#catalogs.fishes ?? null;
    if (name === "MAP_DB") return this.#catalogs.maps ?? null;
    if (name === "HOOKED_FISH") return this.#getHookedFish() || null;
    return null;
  }

  #syncDebugConsoleModule(path, value) {
    if (path[0] !== "CONFIG" || path[1] !== "debug" || path[2] !== "consoleModules" || path.length !== 4) return;
    const module = path[3];
    this.#debugModulesSource()[module] = value === true;
    this.#dispatch("debug-module-toggled", { module, enabled: value === true });
  }

  #invalidateItemProgression(path) {
    if (path[0] !== "ITEM_DB" && !(path[0] === "CONFIG" && path[1] === "itemProgression")) return;
    this.#itemProgressionResolver?.invalidate();
    this.#dispatch("item-progression-updated", { path });
  }

  #dispatch(type, detail) {
    this.#eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
