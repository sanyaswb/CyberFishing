class DevToolsParameterTooltipProvider {
  #descriptionsByKey = {};
  #readyPromise;

  constructor({
    urls = [
      "src/config/metadata/dev_tool_parameter_descriptions.json",
      "src/config/metadata/parameter_labels.json",
    ],
  } = {}) {
    this.#readyPromise = this.#load(urls);
  }

  get ready() {
    return this.#readyPromise;
  }

  getTooltip(labelText) {
    const description = this.#descriptionsByKey[String(labelText)];
    if (!description) return "";

    if (description.path) {
      return `${description.path} = ${description.label}:\n${description.description}`;
    }

    return `${description.key} = ${description.ua}:\n${description.description}`;
  }

  async #load(urls) {
    if (typeof fetch !== "function") return;

    const targetUrls = Array.isArray(urls) ? urls : [urls];
    const responses = await Promise.allSettled(
      targetUrls.map((url) => this.#loadOne(url)),
    );

    for (const response of responses) {
      if (response.status === "fulfilled") {
        this.#ingestDescriptions(response.value);
      }
    }
  }

  async #loadOne(url) {
    try {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(
        "[DevTools] Tooltip descriptions failed to load:",
        url,
        error,
      );
      return null;
    }
  }

  #ingestDescriptions(descriptions) {
    if (!descriptions) return;

    if (Array.isArray(descriptions)) {
      for (const item of descriptions) {
        if (!item?.key) continue;
        this.#descriptionsByKey[item.key] = item;
      }
      return;
    }

    for (const [path, item] of Object.entries(descriptions)) {
      if (!item?.label) continue;

      const normalized = {
        path,
        label: item.label,
        description: item.description || "",
      };
      this.#descriptionsByKey[path] = normalized;

      const leafKey = path.split(".").pop();
      if (leafKey && !this.#descriptionsByKey[leafKey]) {
        this.#descriptionsByKey[leafKey] = normalized;
      }
    }
  }
}

class DevTools {
  #config;
  #ui;
  #isOpen = false;
  #liveData = null;
  #activeFishKey = "";
  #activeFishShapeKey = "";
  #configRuntime = null;
  #hookedFishProfileSynchronizer;
  #activeFishVisibilityPolicy;
  #locationSchema;
  #parameterAliases;
  #isDisposed = false;
  #onDebugLiveUpdate = (event) => {
    if (this.#isDisposed) return;
    this.#liveData = event.detail || null;
    const nextFishKey = this.#getActiveFishKey();
    const nextFishShapeKey = this.#getActiveFishShapeKey();
    if (
      this.#isOpen &&
      (nextFishKey !== this.#activeFishKey ||
        nextFishShapeKey !== this.#activeFishShapeKey)
    ) {
      this.#populatePanel();
    }
  };

  #excludeKeys = [
    "id",
    "name",
    "icon", // ДОДАНО: ігноруємо емодзі, щоб не створювати для них зайвих полів
    "bgUrls",
    "depthUrl",
    "endpoint",
    "backgroundColor",
    "colorGradient",
    "statuses",
  ];

  constructor(config, hookedFishProfileSynchronizer) {
    if (
      !hookedFishProfileSynchronizer ||
      typeof hookedFishProfileSynchronizer.synchronize !== "function"
    ) {
      throw new TypeError(
        "DevTools requires hookedFishProfileSynchronizer",
      );
    }
    this.#config = config;
    this.#hookedFishProfileSynchronizer = hookedFishProfileSynchronizer;
    this.#configRuntime =
      typeof CONFIG_RUNTIME_CONTEXT !== "undefined"
        ? CONFIG_RUNTIME_CONTEXT
        : null;
    this.#activeFishVisibilityPolicy =
      typeof ActiveFishDevToolsVisibilityPolicy !== "undefined"
        ? new ActiveFishDevToolsVisibilityPolicy()
        : null;
    this.#locationSchema =
      typeof LocationDevToolsSchema !== "undefined"
        ? new LocationDevToolsSchema()
        : null;
    this.#parameterAliases =
      typeof DevToolsParameterAliasRegistry !== "undefined"
        ? new DevToolsParameterAliasRegistry()
        : null;
    const tooltipProvider = new DevToolsParameterTooltipProvider();
    this.#ui = new DevToolsUI(
      () => this.toggle(),
      this.#config,
      tooltipProvider,
    );
    tooltipProvider.ready.then(() => {
      if (this.#isOpen) this.#populatePanel();
    });
    document.addEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
  }

  toggle() {
    if (this.#isDisposed) return;
    this.#isOpen = !this.#isOpen;
    this.#ui.togglePanel(this.#isOpen);

    if (this.#isOpen) {
      this.#populatePanel();
    }
  }

  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    document.removeEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
    this.#liveData = null;
    this.#ui.dispose();
  }

  #populatePanel() {
    const body = this.#ui.body;
    this.#ui.clearValueBindings();
    body.innerHTML = "";
    this.#activeFishKey = this.#getActiveFishKey();
    this.#activeFishShapeKey = this.#getActiveFishShapeKey();

    this.#renderRuntimeOverrideControls(body);

    // 1. OVERLAY MODULES
    const overlaySettings =
      typeof window !== "undefined" && window.OverlaySettingsStore
        ? window.OverlaySettingsStore
        : null;
    const legacyOverlayModules =
      typeof OVERLAY_MODULES !== "undefined" ? OVERLAY_MODULES : null;
    const overlayModules =
      overlaySettings?.getSnapshot?.() || legacyOverlayModules;
    const overlayKeys =
      overlaySettings?.keys?.() || Object.keys(overlayModules || {});
    if (overlayModules && overlayKeys.length > 0) {
      const content = this.#createSectionWithCache(
        "OVERLAY MODULES (В live time)",
        body,
        ["OVERLAY_MODULES"],
      );
      const renderedKeys = new Set();
      const groups =
        typeof OVERLAY_MODULE_GROUPS !== "undefined" &&
        Array.isArray(OVERLAY_MODULE_GROUPS)
          ? OVERLAY_MODULE_GROUPS
          : [];

      const renderSwitcher = (key, parent) => {
        if (!overlayKeys.includes(key) || renderedKeys.has(key)) return;
        renderedKeys.add(key);
        const enabled = overlaySettings?.isEnabled
          ? overlaySettings.isEnabled(key)
          : !!overlayModules[key];
        const label = this.#getOverlayModuleLabel(key);
        this.#ui.createSwitcherRow(
          label,
          enabled,
          parent,
          (v) => {
            if (overlaySettings?.setEnabled) overlaySettings.setEnabled(key, v);
            else overlayModules[key] = v;
          },
          ["OVERLAY_MODULES", key],
        );
      };

      if (groups.length > 0) {
        for (const group of groups) {
          const keys = Array.isArray(group?.keys) ? group.keys : [];
          const visibleKeys = keys.filter((key) => overlayKeys.includes(key));
          if (visibleKeys.length === 0) continue;
          const groupContent = this.#createSectionWithCache(
            group.label || "Overlay group",
            content,
            ["OVERLAY_MODULES", group.label || "group"],
          );
          visibleKeys.forEach((key) => renderSwitcher(key, groupContent));
        }
      }

      overlayKeys.forEach((key) => renderSwitcher(key, content));
    }

    const debugContent = this.#renderConfigDebugSection(body);
    this.#renderLocationDebugSection(debugContent);

    // 3. ITEM_DB (БАЗА ПРЕДМЕТІВ)
    if (typeof ITEM_DB !== "undefined") {
      const dbContent = this.#createSectionWithCache(
        "📦 БАЗА ПРЕДМЕТІВ (ITEM_DB)",
        body,
        ["ITEM_DB"],
      );
      for (const key of Object.keys(ITEM_DB)) {
        if (this.#excludeKeys.includes(key)) continue;
        const sectionContent = this.#createSectionWithCache(key, dbContent, [
          "ITEM_DB",
          key,
        ]);
        // Шлях тепер починається з "ITEM_DB"
        this.#buildTree(ITEM_DB[key], sectionContent, ["ITEM_DB", key]);
      }
    }

    // 4. FISH_DB (БАЗА РИБИ)
    if (typeof FISH_DB !== "undefined") {
      const fishDbContent = this.#createSectionWithCache(
        "🐟 БАЗА РИБИ (FISH_DB)",
        body,
        ["FISH_DB"],
      );
      FISH_DB.forEach((fish, index) => {
        const fishLabel = fish?.id || fish?.name || `Fish [${index}]`;
        const sectionContent = this.#createSectionWithCache(
          fishLabel,
          fishDbContent,
          ["FISH_DB", index],
        );
        this.#buildTree(fish, sectionContent, ["FISH_DB", index]);
      });
    }

    // 5. MAP_DB (БАЗА ЛОКАЦІЙ)
    if (typeof MAP_DB !== "undefined") {
      const mapDbContent = this.#createSectionWithCache(
        "🗺️ БАЗА ЛОКАЦІЙ (MAP_DB)",
        body,
        ["MAP_DB"],
      );
      for (const key of Object.keys(MAP_DB)) {
        const location = MAP_DB[key];
        const locationLabel = location?.id || location?.name || key;
        const sectionContent = this.#createSectionWithCache(
          locationLabel,
          mapDbContent,
          ["MAP_DB", key],
        );
        this.#buildTree(location, sectionContent, ["MAP_DB", key]);
      }
    }

    // 6. CONFIG (НАЛАШТУВАННЯ ГРИ)
    if (typeof CONFIG !== "undefined") {
      const configContent = this.#createSectionWithCache(
        "⚙️ НАЛАШТУВАННЯ (CONFIG)",
        body,
        ["CONFIG"],
      );
      for (const key of Object.keys(CONFIG)) {
        if (this.#shouldSkipKey(["CONFIG"], key)) continue;
        const sectionContent = this.#createSectionWithCache(
          key,
          configContent,
          ["CONFIG", key],
        );
        // Шлях тепер починається з "CONFIG"
        this.#buildTree(CONFIG[key], sectionContent, ["CONFIG", key]);
      }
    }

    this.#renderActiveFishSection(body);
  }

  #renderConfigDebugSection(body) {
    if (typeof CONFIG === "undefined" || !CONFIG?.debug) return null;

    const debugContent = this.#createSectionWithCache(
      "🐞 DEBUG (CONFIG.debug)",
      body,
      ["CONFIG", "debug"],
    );
    this.#buildTree(CONFIG.debug, debugContent, ["CONFIG", "debug"]);
    return debugContent;
  }

  #renderLocationDebugSection(debugContent) {
    if (
      !debugContent ||
      typeof CONFIG === "undefined" ||
      !CONFIG?.locations ||
      !this.#locationSchema
    ) {
      return;
    }

    const rootPath = ["CONFIG", "locations"];
    const rootContent = this.#createSectionWithCache(
      this.#locationSchema.rootTitle,
      debugContent,
      rootPath,
    );

    for (const group of this.#locationSchema.getGroups()) {
      const groupContent = this.#createSectionWithCache(
        group.title,
        rootContent,
      );
      for (const key of group.keys) {
        const value = CONFIG.locations[key];
        if (typeof value !== "boolean") continue;
        const path = [...rootPath, key];
        this.#ui.createSwitcherRow(
          this.#formatDevToolsKey(key, path),
          value,
          groupContent,
          (newValue) => this.#updateConfigValue(path, newValue),
          path,
        );
      }
    }
  }

  #renderActiveFishSection(body) {
    const hookedFish = this.#liveData?.hookedFish;
    if (!hookedFish) return;

    const fish = this.#activeFishVisibilityPolicy?.normalizeHookedFish
      ? this.#activeFishVisibilityPolicy.normalizeHookedFish(hookedFish)
      : hookedFish;
    const fishLabel = fish.id || fish.name || "hookedFish";
    const activeFishContent = this.#createSectionWithCache(
      `ACTIVE FISH (${fishLabel})`,
      body,
      ["HOOKED_FISH"],
    );

    const fishRuntimeContent = this.#createSectionWithCache(
      this.#activeFishVisibilityPolicy?.fishRuntimeRootTitle ||
        "🐟 Fish runtime parameters (HOOKED_FISH)",
      activeFishContent,
      ["HOOKED_FISH"],
    );
    this.#buildTree(fish, fishRuntimeContent, ["HOOKED_FISH"], {
      visibilityPolicy: this.#activeFishVisibilityPolicy,
      applyHookedFishLegacySkips: false,
    });

    this.#renderActiveFishGlobalConfigShortcuts(activeFishContent);
  }

  #renderActiveFishGlobalConfigShortcuts(parentElement) {
    const shortcuts =
      this.#activeFishVisibilityPolicy?.getGlobalConfigShortcuts?.() || [];
    if (!shortcuts.length || typeof CONFIG === "undefined") return;

    const globalContent = this.#createSectionWithCache(
      this.#activeFishVisibilityPolicy?.globalConfigRootTitle ||
        "🌐 Global fight config shortcuts (CONFIG)",
      parentElement,
      ["CONFIG"],
    );

    for (const shortcut of shortcuts) {
      const value = this.#readPath(shortcut.path);
      if (!value || typeof value !== "object") continue;
      const content = this.#createSectionWithCache(
        shortcut.title || shortcut.path.join("."),
        globalContent,
        shortcut.path,
      );
      this.#buildTree(value, content, shortcut.path);
    }
  }

  #readPath(path) {
    const root = this.#resolveEditableRoot(path?.[0]);
    if (!root) return undefined;
    let current = root;
    for (let i = 1; i < path.length; i++) {
      if (current == null) return undefined;
      current = current[path[i]];
    }
    return current;
  }

  #getActiveFishKey() {
    const fish = this.#liveData?.hookedFish;
    if (!fish) return "";
    return `${fish.id || fish.name || "hookedFish"}:${fish.level ?? ""}:${fish.weight ?? ""}`;
  }

  #getActiveFishShapeKey() {
    const fish = this.#liveData?.hookedFish;
    if (!fish) return "";
    const paths = [];
    this.#collectVisibleScalarPaths(fish, ["HOOKED_FISH"], paths, {
      visibilityPolicy: this.#activeFishVisibilityPolicy,
      applyHookedFishLegacySkips: false,
    });
    return paths.join("|");
  }

  #collectVisibleScalarPaths(obj, path, output, options = {}) {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      if (this.#shouldSkipKey(path, key, options)) continue;

      const value = obj[key];
      const currentPath = [...path, key];
      if (options.visibilityPolicy?.isVisible?.(currentPath, value) === false) {
        continue;
      }

      if (value && typeof value === "object") {
        this.#collectVisibleScalarPaths(value, currentPath, output, options);
        continue;
      }

      if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "string"
      ) {
        output.push(currentPath.join("."));
      }
    }
  }

  #shouldSkipKey(path, key, options = {}) {
    if (!options.visibilityPolicy && this.#excludeKeys.includes(key)) return true;
    if (path[0] === "CONFIG" && path.length === 1 && key === "debug") {
      return true;
    }
    if (options.applyHookedFishLegacySkips !== false) {
      if (
        path[0] === "HOOKED_FISH" &&
        (key === "weight" ||
          key === "level" ||
          key === "maxLevel" ||
          key === "resistance" ||
          key === "biteSequence")
      ) {
        return true;
      }
      if (path[0] === "HOOKED_FISH" && path[1] === "physics") {
        const compatibilityKeys = new Set([
          "basePower",
          "baseStamina",
          "levelBasePower",
          "staminaWeightMultiplier",
          "minStaminaActivityMultiplier",
          "exhaustedSpeedRatio",
          "baseSpeedMetersPerSec",
          "agility",
          "bounceCooldownMs",
          "dirChangeMinMs",
          "dirChangeMaxMs",
          "lastDashTrigger",
          "behaviors",
          "pullResistance",
          "fishRetrieve",
        ]);
        if (compatibilityKeys.has(key)) return true;
      }
    }

    const isConfigLocationsMap =
      path[0] === "CONFIG" && path[1] === "locations" && key === "map";
    const isConfigSpawnsFishes =
      path[0] === "CONFIG" && path[1] === "spawns" && key === "fishes";

    return isConfigLocationsMap || isConfigSpawnsFishes;
  }

  #createSectionWithCache(labelStr, parentElement, path = null) {
    let savedStates =
      typeof CacheManager !== "undefined"
        ? CacheManager.get("dev_tools_sections_state", {})
        : {};
    let isExpanded = savedStates[labelStr] || false;

    return this.#ui.createSection(
      labelStr,
      parentElement,
      isExpanded,
      (isNowExpanded) => {
        if (typeof CacheManager !== "undefined") {
          savedStates = CacheManager.get("dev_tools_sections_state", {});
          savedStates[labelStr] = isNowExpanded;
          CacheManager.set("dev_tools_sections_state", savedStates);
        }
      },
      path,
    );
  }

  #formatDevToolsKey(key, path) {
    if (path?.[0] !== "CONFIG" || !this.#configRuntime?.overrideStore)
      return key;
    const overridePath = path.slice(1).join(".");
    return this.#configRuntime.overrideStore.has(overridePath)
      ? `${key} *`
      : key;
  }

  #getOverlayModuleLabel(key) {
    const labels =
      typeof OVERLAY_MODULE_LABELS !== "undefined" ? OVERLAY_MODULE_LABELS : {};
    return labels?.[key]?.label || key;
  }

  #buildTree(obj, parentElement, path, options = {}) {
    for (const key in obj) {
      if (this.#shouldSkipKey(path, key, options)) continue;

      const val = obj[key];
      const currentPath = [...path, key];
      if (options.visibilityPolicy?.isVisible?.(currentPath, val) === false) {
        continue;
      }

      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === "number") {
          this.#ui.createInputRow(
            this.#formatDevToolsKey(key, currentPath),
            val.join(", "),
            parentElement,
            "array",
            (newVal) => this.#updateConfigValue(currentPath, newVal),
            currentPath,
          );
        } else if (val.length > 0 && typeof val[0] === "object") {
          const content = this.#createSectionWithCache(
            key,
            parentElement,
            currentPath,
          );
          val.forEach((item, index) => {
            const itemLabel = item.id || item.type || `Item [${index}]`;
            const itemContent = this.#createSectionWithCache(
              itemLabel,
              content,
              [...currentPath, index],
            );
            this.#buildTree(item, itemContent, [...currentPath, index], options);
          });
        }
      } else if (val !== null && typeof val === "object") {
        const content = this.#createSectionWithCache(
          key,
          parentElement,
          currentPath,
        );
        this.#buildTree(val, content, currentPath, options);
      } else if (
        typeof val === "number" ||
        typeof val === "boolean" ||
        typeof val === "string"
      ) {
        this.#renderScalarValue({
          key,
          value: val,
          parentElement,
          displayPath: currentPath,
          canonicalPath: currentPath,
        });
      }
    }

    this.#renderParameterAliases(obj, parentElement, path);
  }

  #renderParameterAliases(obj, parentElement, parentPath) {
    const aliases =
      this.#parameterAliases?.getAliasesForParent(parentPath) || [];
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(obj, alias.key)) continue;
      const value = this.#readPath(alias.canonicalPath);
      if (
        typeof value !== "number" &&
        typeof value !== "boolean" &&
        typeof value !== "string"
      ) {
        continue;
      }
      this.#renderScalarValue({
        key: alias.key,
        value,
        parentElement,
        displayPath: alias.displayPath,
        canonicalPath: alias.canonicalPath,
      });
    }
  }

  #renderScalarValue({
    key,
    value,
    parentElement,
    displayPath,
    canonicalPath,
  }) {
    const onChange = (newValue) =>
      this.#updateConfigValue(canonicalPath, newValue);
    if (typeof value === "boolean") {
      this.#ui.createSwitcherRow(
        key,
        value,
        parentElement,
        onChange,
        displayPath,
        canonicalPath,
      );
      return;
    }
    if (typeof value === "string" && key === "currentMethod") {
      this.#ui.createEnumToggleRow(
        key,
        ["hand", "boat"],
        value,
        parentElement,
        onChange,
        displayPath,
        canonicalPath,
      );
      return;
    }
    this.#ui.createInputRow(
      this.#formatDevToolsKey(key, canonicalPath),
      value,
      parentElement,
      typeof value === "number" ? "number" : "string",
      onChange,
      displayPath,
      canonicalPath,
    );
  }

  #updateConfigValue(path, newValue) {
    path = this.#parameterAliases?.resolveCanonicalPath(path) || path;
    const root = this.#resolveEditableRoot(path[0]);
    if (!root) return;

    if (path[0] === "CONFIG" && this.#configRuntime) {
      this.#configRuntime.set(path, newValue);
      this.#refreshFightPhysicsAdapter();
    } else {
      let target = root;
      for (let i = 1; i < path.length - 1; i++) {
        target = target[path[i]];
      }
      target[path[path.length - 1]] = newValue;
    }

    this.#ui.syncValue(path, newValue);

    this.#syncDebugConsoleModule(path, newValue);
    this.#syncHookedFishProfileAliases(path, newValue, root);
    this.#syncHookedFishLevelBalance(path);
    if (path[0] === "HOOKED_FISH") {
      this.#emitHookedFishUpdated(path, newValue, root);
      return;
    }
    this.#syncItemDbStatAliases(path, newValue);
    console.log(`[DevTools] Оновлено ${path.join(".")} =`, newValue);

    document.dispatchEvent(
      new CustomEvent("config-updated", {
        detail: {
          path,
          value: newValue,
          override: path[0] === "CONFIG",
        },
      }),
    );
  }

  #syncDebugConsoleModule(path, newValue) {
    if (
      path[0] !== "CONFIG" ||
      path[1] !== "debug" ||
      path[2] !== "consoleModules" ||
      path.length !== 4
    ) {
      return;
    }

    const moduleKey = path[3];
    if (typeof window !== "undefined") {
      window.DEBUG_MODULES = window.DEBUG_MODULES || {};
      window.DEBUG_MODULES[moduleKey] = newValue === true;
    }

    document.dispatchEvent(
      new CustomEvent("debug-module-toggled", {
        detail: { module: moduleKey, enabled: newValue === true },
      }),
    );
  }

  #refreshFightPhysicsAdapter() {
    if (
      typeof CONFIG === "undefined" ||
      typeof FightPhysicsConfigAdapter === "undefined"
    )
      return;
    Object.defineProperty(CONFIG, "fightPhysicsConfig", {
      value: new FightPhysicsConfigAdapter(CONFIG),
      enumerable: false,
      configurable: true,
    });
  }

  #renderRuntimeOverrideControls(parentElement) {
    const content = this.#createSectionWithCache(
      "🧩 RUNTIME OVERRIDES",
      parentElement,
      ["CONFIG_OVERRIDES"],
    );

    const count = this.#configRuntime?.overrideStore?.entries?.().length || 0;
    this.#ui.createInfoRow("active overrides", String(count), content);
    this.#ui.createButtonRow("Reset all overrides", content, () => {
      this.#configRuntime?.resetAll?.();
      this.#refreshFightPhysicsAdapter();
      document.dispatchEvent(
        new CustomEvent("config-updated", {
          detail: { path: ["CONFIG"], value: CONFIG, resetAll: true },
        }),
      );
      this.#populatePanel();
    });
    this.#ui.createButtonRow("Export overrides", content, () => {
      const json = JSON.stringify(
        this.#configRuntime?.exportOverrides?.() || {},
        null,
        2,
      );
      console.log("[DevTools] Runtime overrides export:", json);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
      window.prompt?.("Copy runtime overrides JSON", json);
    });
    this.#ui.createButtonRow("Import overrides", content, () => {
      const json = window.prompt?.("Paste runtime overrides JSON", "{}");
      if (!json) return;
      try {
        const overrides = JSON.parse(json);
        const normalizedOverrides =
          this.#parameterAliases?.normalizeConfigOverrides(overrides) ||
          overrides;
        this.#configRuntime?.importOverrides?.(normalizedOverrides);
        this.#refreshFightPhysicsAdapter();
        document.dispatchEvent(
          new CustomEvent("config-updated", {
            detail: { path: ["CONFIG"], value: CONFIG, importOverrides: true },
          }),
        );
        this.#populatePanel();
      } catch (error) {
        console.warn("[DevTools] Failed to import runtime overrides", error);
      }
    });
  }

  #resolveEditableRoot(rootName) {
    if (rootName === "ITEM_DB" && typeof ITEM_DB !== "undefined")
      return ITEM_DB;
    if (rootName === "FISH_DB" && typeof FISH_DB !== "undefined")
      return FISH_DB;
    if (rootName === "HOOKED_FISH") return this.#liveData?.hookedFish || null;
    if (rootName === "MAP_DB" && typeof MAP_DB !== "undefined") return MAP_DB;
    if (rootName === "CONFIG" && typeof CONFIG !== "undefined") return CONFIG;
    return null;
  }

  #emitHookedFishUpdated(path, value, fish) {
    console.log(`[DevTools] Оновлено ${path.join(".")} =`, value);
    document.dispatchEvent(
      new CustomEvent("debug-hooked-fish-updated", {
        detail: { path, value, fish },
      }),
    );
  }

  #syncHookedFishProfileAliases(path, newValue, fish) {
    if (path[0] !== "HOOKED_FISH" || path[1] !== "physics" || !fish?.physics) {
      return;
    }

    const profileName = path[2];
    const field = path[3];
    if (!profileName || !field) return;

    const aliasByProfile = {
      forceProfile: {
        basePower: "basePower",
        levelBasePower: "levelBasePower",
      },
      staminaProfile: {
        baseStamina: "baseStamina",
        staminaWeightMultiplier: "staminaWeightMultiplier",
        minStaminaActivityMultiplier: "minStaminaActivityMultiplier",
        exhaustedSpeedRatio: "exhaustedSpeedRatio",
      },
      movementProfile: {
        baseSpeed: "baseSpeed",
        agility: "agility",
        bounceCooldownMs: "bounceCooldownMs",
        dirChangeMinMs: "dirChangeMinMs",
        dirChangeMaxMs: "dirChangeMaxMs",
        lastDashTrigger: "lastDashTrigger",
      },
    };

    const alias = aliasByProfile[profileName]?.[field];
    if (alias) {
      fish.physics[alias] = newValue;
    }
  }

  #syncHookedFishLevelBalance(path) {
    if (path[0] !== "HOOKED_FISH") return;

    const changedKey = path[path.length - 1];
    if (
      changedKey !== "weight" &&
      changedKey !== "level" &&
      changedKey !== "hasAnomaly"
    ) {
      return;
    }

    const fish = this.#liveData?.hookedFish;
    if (!fish) return;

    const template = this.#findFishTemplate(fish);
    const synchronization = this.#hookedFishProfileSynchronizer.synchronize({
      fish,
      template,
      changedKey,
    });
    const range = synchronization?.range;
    if (!range) return;
    fish.physics = fish.physics || {};
    fish.physics.forceProfile = fish.physics.forceProfile || {};
    fish.physics.movementProfile = fish.physics.movementProfile || {};
    this.#applyFiniteNumber(
      fish.physics.forceProfile,
      "levelBasePower",
      range.basePower,
    );
    this.#applyFiniteNumber(fish.physics, "levelBasePower", range.basePower);
    const levelSpeed = this.#firstFiniteNumber(
      range.baseSpeed,
      range.speedMultiplier,
      range.speed,
    );
    this.#applyFiniteNumber(
      fish.physics.movementProfile,
      "baseSpeed",
      levelSpeed,
    );
    this.#applyFiniteNumber(fish.physics, "baseSpeed", levelSpeed);
  }

  #findFishTemplate(fish) {
    if (typeof FISH_DB === "undefined" || !Array.isArray(FISH_DB)) return null;
    return FISH_DB.find((candidate) => candidate?.id === fish?.id) || null;
  }

  #applyFiniteNumber(target, key, value) {
    if (!Number.isFinite(Number(value))) return;
    target[key] = Math.max(0, Number(value));
  }

  #firstFiniteNumber(...values) {
    for (const value of values) {
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return NaN;
  }

  #syncItemDbStatAliases(path, newValue) {
    if (path[0] !== "ITEM_DB" || path.length < 5) return;

    const category = path[1];
    const itemId = path[2];
    const group = path[3];
    const field = path[4];
    const item = ITEM_DB?.[category]?.[itemId];
    if (!item || typeof item !== "object") return;

    if (group === "displayStats") {
      const engineKey = this.#resolveDisplayStatEngineKey(
        item,
        category,
        field,
        newValue,
      );
      if (!engineKey) return;
      item.engineStats = item.engineStats || {};
      item.engineStats[engineKey] = newValue;
      return;
    }

    if (group === "engineStats") {
      const displayKey = this.#resolveEngineStatDisplayKey(item, field);
      if (!displayKey) return;
      item.displayStats[displayKey] = newValue;
    }
  }

  #resolveDisplayStatEngineKey(item, category, field, value) {
    const key = String(field).toLowerCase();
    if (key === "level") return "level";
    if (key === "power" || key === "basepower" || key === "strength") {
      return "basePower";
    }
    if (key === "maxdistance" || key === "distance") return "maxDistance";

    if (category !== "rods") return null;
    const keys = Object.keys(item.displayStats || {});
    const index = keys.indexOf(field);
    if (index === 0 && Number.isFinite(Number(value))) return "level";
    if (index === 1 && Number.isFinite(Number(value))) return "basePower";
    return null;
  }

  #resolveEngineStatDisplayKey(item, field) {
    const displayStats = item.displayStats;
    if (!displayStats || typeof displayStats !== "object") return null;

    for (const key of Object.keys(displayStats)) {
      const engineKey = this.#resolveDisplayStatEngineKey(
        item,
        "rods",
        key,
        displayStats[key],
      );
      if (engineKey === field) return key;
    }

    if (
      field === "level" &&
      Object.prototype.hasOwnProperty.call(displayStats, "level")
    ) {
      return "level";
    }
    if (
      field === "basePower" &&
      Object.prototype.hasOwnProperty.call(displayStats, "power")
    ) {
      return "power";
    }
    if (
      field === "maxDistance" &&
      Object.prototype.hasOwnProperty.call(displayStats, "distance")
    ) {
      return "distance";
    }
    return null;
  }
}

class DevToolsUI {
  #panel;
  #body;
  #btn;
  #onToggleCallback;
  #tooltipProvider;
  #controlBindings = new DevToolsControlBindingRegistry();

  constructor(onToggleCallback, config, tooltipProvider = null) {
    this.#onToggleCallback = onToggleCallback;
    this.#tooltipProvider = tooltipProvider;
    this.#initStyles();
    this.#initBtn(config);
    this.#initPanel();
  }

  get body() {
    return this.#body;
  }

  togglePanel(isOpen) {
    if (isOpen) {
      this.#panel.classList.add("open");
    } else {
      this.#panel.classList.remove("open");
    }
  }

  dispose() {
    this.#controlBindings.clear();
    this.#btn?.remove();
    this.#panel?.remove();
    this.#btn = null;
    this.#panel = null;
    this.#body = null;
    this.#onToggleCallback = null;
  }

  clearValueBindings() {
    this.#controlBindings.clear();
  }

  syncValue(path, value) {
    this.#controlBindings.sync(path, value);
  }

  createSection(labelStr, parentElement, isExpanded, onToggle, path = null) {
    const section = document.createElement("div");
    section.className = "devtools-section";
    this.#assignDevToolsPath(section, path);

    const title = document.createElement("div");
    title.className = "devtools-section-title";
    this.#assignDevToolsPath(title, path);
    title.innerHTML = `<span>${isExpanded ? "▼" : "▶"}</span> ${labelStr}`;

    const content = document.createElement("div");
    content.className = "devtools-section-content";
    this.#assignDevToolsPath(content, path);
    content.style.display = isExpanded ? "block" : "none";

    title.addEventListener("click", () => {
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";
      title.innerHTML = `<span>${isHidden ? "▼" : "▶"}</span> ${labelStr}`;
      if (onToggle) onToggle(isHidden);
    });

    section.appendChild(title);
    section.appendChild(content);
    parentElement.appendChild(section);

    return content;
  }

  createInfoRow(labelStr, value, parentElement, path = null) {
    const row = document.createElement("div");
    row.className = "devtools-row";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(labelStr, path));
    const valueEl = document.createElement("div");
    valueEl.className = "devtools-value";
    valueEl.innerText = value;
    row.appendChild(valueEl);
    parentElement.appendChild(row);
  }

  createButtonRow(labelStr, parentElement, onClickCallback) {
    const row = document.createElement("div");
    row.className = "devtools-row";
    const btn = document.createElement("button");
    btn.className = "devtools-action-btn";
    btn.innerText = labelStr;
    btn.addEventListener("click", onClickCallback);
    row.appendChild(btn);
    parentElement.appendChild(row);
  }

  createSwitcherRow(
    labelStr,
    initialValue,
    parentElement,
    onChangeCallback,
    path = null,
    bindingPath = path,
  ) {
    const row = document.createElement("div");
    row.className = "devtools-row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(labelStr, path);
    row.appendChild(label);

    const inputElement = document.createElement("label");
    inputElement.className = "switch";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = initialValue;

    const slider = document.createElement("span");
    slider.className = "slider";

    inputElement.appendChild(cb);
    inputElement.appendChild(slider);
    row.appendChild(inputElement);

    cb.addEventListener("change", (e) => onChangeCallback(e.target.checked));
    this.#controlBindings.register(bindingPath, (value) => {
      cb.checked = value === true;
    });
    parentElement.appendChild(row);
  }

  createInputRow(
    key,
    val,
    parentElement,
    type,
    onChangeCallback,
    path = null,
    bindingPath = path,
  ) {
    const row = document.createElement("div");
    row.className = "devtools-row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(key, path);
    row.appendChild(label);

    let inputElement;

    if (type === "number") {
      inputElement = document.createElement("input");
      inputElement.type = "number";
      inputElement.step = "any";
      inputElement.className = "devtools-input-num";
      inputElement.value = val;
      inputElement.addEventListener("change", (e) =>
        onChangeCallback(parseFloat(e.target.value) || 0),
      );
    } else {
      inputElement = document.createElement("input");
      inputElement.type = "text";
      inputElement.className = "devtools-input-text";
      inputElement.value = val;
      inputElement.addEventListener("change", (e) => {
        let newVal = e.target.value;
        if (type === "array") {
          newVal = newVal.split(",").map((n) => parseFloat(n.trim()) || 0);
        }
        onChangeCallback(newVal);
      });
    }

    this.#controlBindings.register(bindingPath, (value) => {
      inputElement.value = Array.isArray(value) ? value.join(", ") : value;
    });
    row.appendChild(inputElement);
    parentElement.appendChild(row);
  }

  createEnumToggleRow(
    key,
    optionsArray,
    currentValue,
    parentElement,
    onChangeCallback,
    path = null,
    bindingPath = path,
  ) {
    const row = document.createElement("div");
    row.className = "devtools-row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(key, path);
    row.appendChild(label);

    const btn = document.createElement("button");
    btn.className = "devtools-btn-enum";
    btn.innerText = currentValue;
    Object.assign(btn.style, {
      background: "#3a3a50",
      color: "#00ccff",
      border: "1px solid #5a5a70",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
      fontWeight: "bold",
      width: "80px",
    });

    btn.addEventListener("click", () => {
      let currentIndex = optionsArray.indexOf(btn.innerText);
      let nextIndex = (currentIndex + 1) % optionsArray.length;
      let newVal = optionsArray[nextIndex];
      btn.innerText = newVal;
      onChangeCallback(newVal);
    });
    this.#controlBindings.register(bindingPath, (value) => {
      btn.innerText = String(value);
    });

    row.appendChild(btn);
    parentElement.appendChild(row);
  }

  #createLabelElement(rawLabel, path = null) {
    const labelText = String(rawLabel);
    const cleanLabelText = labelText.replace(/\s+\*$/u, "");
    const label = document.createElement("div");
    label.className = "devtools-label";
    this.#assignDevToolsPath(label, path);
    label.dataset.devtoolsKey = cleanLabelText;
    label.innerText = this.#formatLabelText(labelText);
    const tooltip = this.#getParameterTooltip(cleanLabelText);
    const pathText = this.#normalizeDevToolsPath(path);
    if (tooltip || pathText || labelText.length > 15) {
      label.title = [pathText, tooltip || labelText].filter(Boolean).join("\n");
    }
    return label;
  }

  #assignDevToolsPath(element, path) {
    const normalized = this.#normalizeDevToolsPath(path);
    if (normalized) element.dataset.devtoolsPath = normalized;
  }

  #normalizeDevToolsPath(path) {
    if (!path) return "";
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path);
  }

  #formatLabelText(labelText) {
    return labelText.length > 15 ? `${labelText.slice(0, 15)}...` : labelText;
  }

  #getParameterTooltip(labelText) {
    return this.#tooltipProvider?.getTooltip(labelText) || "";
  }

  #initStyles() {
    if (document.getElementById("devtools-styles")) return;

    const style = document.createElement("style");
    style.id = "devtools-styles";
    document.head.appendChild(style);
  }

  #initBtn(config) {
    this.#btn = document.createElement("button");
    this.#btn.innerHTML = "⚙️";

    Object.assign(this.#btn.style, {
      position: "absolute",
      top: "15px",
      left: "160px",
      fontSize: "32px",
      background: "transparent",
      border: "none",
      padding: "0",
      cursor: "pointer",
      zIndex: "9998",
      filter: "drop-shadow(0px 2px 5px rgba(0,0,0,0.8))",
      transition: "transform 0.1s ease",
    });

    this.#btn.addEventListener(
      "mouseenter",
      () => (this.#btn.style.transform = "scale(1.1)"),
    );
    this.#btn.addEventListener(
      "mouseleave",
      () => (this.#btn.style.transform = "scale(1)"),
    );

    UIUtils.makeSolid(this.#btn);

    if (typeof UIDraggableButton !== "undefined") {
      new UIDraggableButton(this.#btn, this.#onToggleCallback, config, {
        id: "devtools_btn",
        noTransform: true,
      });
    } else {
      this.#btn.addEventListener("click", this.#onToggleCallback);
    }

    document.body.appendChild(this.#btn);
  }

  #initPanel() {
    this.#panel = document.createElement("div");
    this.#panel.className = "devtools-panel";

    this.#panel.innerHTML = `
            <div class="devtools-header">
                <h2>⚙️ DEV TOOLS</h2>
                <button class="devtools-close">×</button>
            </div>
            <div class="devtools-body"></div>
        `;

    document.body.appendChild(this.#panel);
    this.#body = this.#panel.querySelector(".devtools-body");

    UIUtils.makeSolid(this.#panel);

    this.#panel
      .querySelector(".devtools-close")
      .addEventListener("click", this.#onToggleCallback);
  }
}
