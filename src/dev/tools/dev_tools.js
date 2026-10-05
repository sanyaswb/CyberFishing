import { ActiveFishDevToolsVisibilityPolicy } from "../fishing/active_fish_dev_tools_schema.js";
import { CacheManager } from "../../platform/browser/storage/cache_manager.js";
import { DevToolsParameterAliasRegistry } from "../services/dev_tools_parameter_alias_registry.js";
import { FightPhysicsConfigAdapter } from "../../game/config/physics/fight_physics_config_adapter.js";
import { LocationDevToolsSchema } from "../services/location_dev_tools_schema.js";
import { OVERLAY_MODULE_GROUPS, OVERLAY_MODULE_LABELS } from "../overlay/config/overlay_modules_config.js";

export class DevTools {
  #config;
  #catalogs;
  #settingsStore;
  #debugModulesSource;
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
  #itemProgressionDebugProvider;
  #itemProgressionResolver;
  #reelRetrieveProbeState = Object.freeze({ status: "unavailable" });
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
  #onReelRetrieveProbeState = (event) => {
    if (this.#isDisposed) return;
    this.#reelRetrieveProbeState = event.detail || Object.freeze({
      status: "unavailable",
    });
    if (this.#isOpen) this.#populatePanel();
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

  constructor(
    config,
    hookedFishProfileSynchronizer,
    {
      itemProgressionDebugProvider = null,
      itemProgressionResolver = null,
      configRuntime = null,
      catalogs,
      settingsStore,
      debugModulesSource,
      createUI,
    } = {},
  ) {
    if (
      !hookedFishProfileSynchronizer ||
      typeof hookedFishProfileSynchronizer.synchronize !== "function"
    ) {
      throw new TypeError(
        "DevTools requires hookedFishProfileSynchronizer",
      );
    }
    this.#config = config;
    this.#catalogs = catalogs;
    this.#settingsStore = settingsStore;
    this.#debugModulesSource = debugModulesSource;
    this.#hookedFishProfileSynchronizer = hookedFishProfileSynchronizer;
    this.#configRuntime = configRuntime;
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
    this.#itemProgressionDebugProvider = itemProgressionDebugProvider;
    this.#itemProgressionResolver = itemProgressionResolver;
    const { ui, tooltipProvider } = createUI(() => this.toggle(), this.#config);
    this.#ui = ui;
    tooltipProvider.ready.then(() => {
      if (this.#isOpen) this.#populatePanel();
    });
    document.addEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
    document.addEventListener(
      "stage-3-7-8-reel-retrieve-probe-state",
      this.#onReelRetrieveProbeState,
    );
    this.#sendReelRetrieveProbeCommand("query");
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
    document.removeEventListener(
      "stage-3-7-8-reel-retrieve-probe-state",
      this.#onReelRetrieveProbeState,
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
    this.#renderItemProgressionSection(body);

    // 1. OVERLAY MODULES
    const overlaySettings =
      this.#settingsStore;
    const legacyOverlayModules =
      typeof this.#settingsStore?.getSnapshot() !== "undefined" ? this.#settingsStore?.getSnapshot() : null;
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
    this.#renderStageThreeBatch007ProbeSection(debugContent);
    this.#renderLocationDebugSection(debugContent);

    // 3. ITEM_DB (БАЗА ПРЕДМЕТІВ)
    if (typeof this.#catalogs.items !== "undefined") {
      const dbContent = this.#createSectionWithCache(
        "📦 БАЗА ПРЕДМЕТІВ (ITEM_DB)",
        body,
        ["ITEM_DB"],
      );
      for (const key of Object.keys(this.#catalogs.items)) {
        if (this.#excludeKeys.includes(key)) continue;
        const sectionContent = this.#createSectionWithCache(key, dbContent, [
          "ITEM_DB",
          key,
        ]);
        // Шлях тепер починається з "ITEM_DB"
        this.#buildTree(this.#catalogs.items[key], sectionContent, ["ITEM_DB", key]);
      }
    }

    // 4. FISH_DB (БАЗА РИБИ)
    if (typeof this.#catalogs.fishes !== "undefined") {
      const fishDbContent = this.#createSectionWithCache(
        "🐟 БАЗА РИБИ (FISH_DB)",
        body,
        ["FISH_DB"],
      );
      this.#catalogs.fishes.forEach((fish, index) => {
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
    if (typeof this.#catalogs.maps !== "undefined") {
      const mapDbContent = this.#createSectionWithCache(
        "🗺️ БАЗА ЛОКАЦІЙ (MAP_DB)",
        body,
        ["MAP_DB"],
      );
      for (const key of Object.keys(this.#catalogs.maps)) {
        const location = this.#catalogs.maps[key];
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
    if (typeof this.#config !== "undefined") {
      const configContent = this.#createSectionWithCache(
        "⚙️ НАЛАШТУВАННЯ (CONFIG)",
        body,
        ["CONFIG"],
      );
      for (const key of Object.keys(this.#config)) {
        if (this.#shouldSkipKey(["CONFIG"], key)) continue;
        const sectionContent = this.#createSectionWithCache(
          key,
          configContent,
          ["CONFIG", key],
        );
        // Шлях тепер починається з "CONFIG"
        this.#buildTree(this.#config[key], sectionContent, ["CONFIG", key]);
      }
    }

    this.#renderActiveFishSection(body);
  }

  #renderConfigDebugSection(body) {
    if (typeof this.#config === "undefined" || !this.#config?.debug) return null;

    const debugContent = this.#createSectionWithCache(
      "🐞 DEBUG (CONFIG.debug)",
      body,
      ["CONFIG", "debug"],
    );
    this.#buildTree(this.#config.debug, debugContent, ["CONFIG", "debug"]);
    return debugContent;
  }

  #renderLocationDebugSection(debugContent) {
    if (
      !debugContent ||
      typeof this.#config === "undefined" ||
      !this.#config?.locations ||
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
        const value = this.#config.locations[key];
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
    if (!shortcuts.length || typeof this.#config === "undefined") return;

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
            const itemLabel =
              item.id || item.variant || item.itemType || `Item [${index}]`;
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

  #renderStageThreeBatch007ProbeSection(debugContent) {
    if (!debugContent) return;

    const content = this.#createSectionWithCache(
      "🧪 STAGE 3.7.8 REEL / RETRIEVE GATE",
      debugContent,
      ["DEBUG_TOOLS", "stage-3.7.8-reel-retrieve"],
    );
    const state = this.#reelRetrieveProbeState || { status: "unavailable" };
    const activeStatuses = new Set([
      "arming",
      "armed",
      "capturing-before",
      "observing-recovery",
    ]);

    this.#ui.createInfoRow("status", state.status, content);
    this.#ui.createInfoRow(
      "instructions",
      state.instructions ||
        "Equip a spinning loadout, set drag above zero, start a fight, hold Space, then release it.",
      content,
    );

    if (state.before) {
      this.#ui.createInfoRow(
        "A — BEFORE",
        this.#formatReelRetrieveSnapshot(state.before),
        content,
      );
    }
    if (state.after) {
      this.#ui.createInfoRow(
        "B — AFTER",
        this.#formatReelRetrieveSnapshot(state.after),
        content,
      );
    }
    if (state.verdict) {
      this.#ui.createInfoRow(
        "verdict",
        `${state.verdict.status} / ${state.verdict.blockerClassification}`,
        content,
      );
      this.#ui.createInfoRow(
        "console",
        `${state.verdict.console.errors} errors / ${state.verdict.console.warnings} warnings`,
        content,
      );
      this.#ui.createButtonRow("Copy A/B result", content, () =>
        this.#copyReelRetrieveProbeResult(state),
      );
    }
    if (state.error) {
      this.#ui.createInfoRow("error", state.error, content);
    }

    if (activeStatuses.has(state.status)) {
      this.#ui.createButtonRow("Cancel A/B probe", content, () => {
        this.#sendReelRetrieveProbeCommand("cancel");
      });
      return;
    }

    this.#ui.createButtonRow("Arm A/B probe", content, () => {
      document.activeElement?.blur?.();
      this.#sendReelRetrieveProbeCommand("arm");
    });
  }

  #sendReelRetrieveProbeCommand(action) {
    document.dispatchEvent(
      new CustomEvent("stage-3-7-8-reel-retrieve-probe-command", {
        detail: { action },
      }),
    );
  }

  #formatReelRetrieveSnapshot(snapshot) {
    return [
      `hasReel=${snapshot.hasReel}`,
      `total=${this.#formatProbeNumber(snapshot.lineTotalMeters)}`,
      `released=${this.#formatProbeNumber(snapshot.lineReleasedMeters)}`,
      `stroke=${this.#formatProbeNumber(snapshot.rodStrokeWonMeters)}`,
      `auto=${this.#formatProbeNumber(snapshot.autoRecoveredMeters)}`,
      `hold=${this.#formatProbeNumber(snapshot.holdRecoveredMeters)}`,
      `blocked=${snapshot.autoRecoverBlockedReason || "none"}`,
    ].join("; ");
  }

  #formatProbeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(4) : "n/a";
  }

  #copyReelRetrieveProbeResult(state) {
    const result = JSON.stringify(
      {
        before: state.before,
        after: state.after,
        verdict: state.verdict,
      },
      null,
      2,
    );
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(result).catch(() => {
        window.prompt?.("Copy Stage 3.7.8 A/B result", result);
      });
      return;
    }
    window.prompt?.("Copy Stage 3.7.8 A/B result", result);
  }

  #renderItemProgressionSection(body) {
    const snapshots = this.#itemProgressionDebugProvider?.getSnapshots?.() || [];
    if (snapshots.length === 0) return;
    const root = this.#createSectionWithCache(
      "📈 ITEM PROGRESSION",
      body,
      ["ITEM_PROGRESSION"],
    );
    for (const snapshot of snapshots) {
      const item = this.#createSectionWithCache(
        snapshot.itemId,
        root,
        ["ITEM_PROGRESSION", snapshot.itemId],
      );
      this.#ui.createInfoRow("Group", snapshot.group, item);
      this.#ui.createInfoRow("Strategy", snapshot.strategy, item);
      this.#ui.createInfoRow("Raw metric", String(snapshot.rawMetric), item);
      this.#ui.createInfoRow("Baseline min/max", snapshot.baseline, item);
      this.#ui.createInfoRow(
        "Normalized rating",
        String(snapshot.normalizedRating),
        item,
      );
      this.#ui.createInfoRow(
        "Rating percent",
        `${snapshot.ratingPercent}%`,
        item,
      );
      this.#ui.createInfoRow(
        "Rating tier",
        snapshot.ratingTier,
        item,
      );
      this.#ui.createInfoRow("Quality", snapshot.quality, item);
      if (snapshot.capacity !== "N/A") {
        this.#ui.createInfoRow("Capacity", snapshot.capacity, item);
        this.#ui.createInfoRow(
          "Capacity source",
          snapshot.capacitySource,
          item,
        );
      }
      this.#ui.createInfoRow("Out-of-range", snapshot.outOfRange, item);
      this.#ui.createInfoRow("Config source", snapshot.configSource, item);
      if (snapshot.breakdown.length > 0) {
        const breakdown = this.#createSectionWithCache(
          "Composite breakdown",
          item,
          ["ITEM_PROGRESSION", snapshot.itemId, "breakdown"],
        );
        for (const component of snapshot.breakdown) {
          this.#ui.createInfoRow(
            component.label || component.id,
            `${this.#formatProgressionPercent(component.percent)}% × ${component.weight}`,
            breakdown,
          );
        }
      }
    }
  }

  #formatProgressionPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "N/A";
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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
    this.#invalidateItemProgression(path);
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
      
      this.#debugModulesSource()[moduleKey] = newValue === true;
    }

    document.dispatchEvent(
      new CustomEvent("debug-module-toggled", {
        detail: { module: moduleKey, enabled: newValue === true },
      }),
    );
  }

  #refreshFightPhysicsAdapter() {
    if (
      typeof this.#config === "undefined" ||
      typeof FightPhysicsConfigAdapter === "undefined"
    )
      return;
    Object.defineProperty(this.#config, "fightPhysicsConfig", {
      value: new FightPhysicsConfigAdapter(this.#config),
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
          detail: { path: ["CONFIG"], value: this.#config, resetAll: true },
        }),
      );
      this.#invalidateItemProgression(["CONFIG", "itemProgression"]);
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
            detail: { path: ["CONFIG"], value: this.#config, importOverrides: true },
          }),
        );
        this.#invalidateItemProgression(["CONFIG", "itemProgression"]);
        this.#populatePanel();
      } catch (error) {
        console.warn("[DevTools] Failed to import runtime overrides", error);
      }
    });
  }

  #resolveEditableRoot(rootName) {
    if (rootName === "ITEM_DB" && typeof this.#catalogs.items !== "undefined")
      return this.#catalogs.items;
    if (rootName === "FISH_DB" && typeof this.#catalogs.fishes !== "undefined")
      return this.#catalogs.fishes;
    if (rootName === "HOOKED_FISH") return this.#liveData?.hookedFish || null;
    if (rootName === "MAP_DB" && typeof this.#catalogs.maps !== "undefined") return this.#catalogs.maps;
    if (rootName === "CONFIG" && typeof this.#config !== "undefined") return this.#config;
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
    if (typeof this.#catalogs.fishes === "undefined" || !Array.isArray(this.#catalogs.fishes)) return null;
    return this.#catalogs.fishes.find((candidate) => candidate?.id === fish?.id) || null;
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
    const item = this.#catalogs.items?.[category]?.[itemId];
    if (!item || typeof item !== "object") return;

    if (group === "displayStats") {
      const gameplayKey = this.#resolveDisplayStatGameplayKey(
        item,
        category,
        field,
        newValue,
      );
      if (!gameplayKey) return;
      item.gameplayStats = item.gameplayStats || {};
      item.gameplayStats[gameplayKey] = newValue;
      return;
    }

    if (group === "gameplayStats") {
      const displayKey = this.#resolveGameplayStatDisplayKey(item, field);
      if (!displayKey) return;
      item.displayStats[displayKey] = newValue;
    }
  }

  #resolveDisplayStatGameplayKey(item, category, field, value) {
    const key = String(field).toLowerCase();
    if (key === "level") return "equipmentPowerLevel";
    if (key === "power" || key === "basepower" || key === "strength") {
      return "basePower";
    }
    if (key === "maxdistance" || key === "distance") return "maxDistance";

    if (category !== "rods") return null;
    const keys = Object.keys(item.displayStats || {});
    const index = keys.indexOf(field);
    if (index === 0 && Number.isFinite(Number(value))) {
      return "equipmentPowerLevel";
    }
    if (index === 1 && Number.isFinite(Number(value))) return "basePower";
    return null;
  }

  #resolveGameplayStatDisplayKey(item, field) {
    const displayStats = item.displayStats;
    if (!displayStats || typeof displayStats !== "object") return null;

    for (const key of Object.keys(displayStats)) {
      const gameplayKey = this.#resolveDisplayStatGameplayKey(
        item,
        "rods",
        key,
        displayStats[key],
      );
      if (gameplayKey === field) return key;
    }

    if (
      field === "equipmentPowerLevel" &&
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

  #invalidateItemProgression(path) {
    const affectsProgression =
      path?.[0] === "ITEM_DB" ||
      (path?.[0] === "CONFIG" && path?.[1] === "itemProgression");
    if (!affectsProgression) return;
    this.#itemProgressionResolver?.invalidate?.();
    document.dispatchEvent(new CustomEvent("item-progression-updated", {
      detail: { path },
    }));
  }
}
