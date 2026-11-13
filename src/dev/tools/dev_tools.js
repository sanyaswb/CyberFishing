import { RadioDevSection } from "./radio_dev_section.js";
import { WeatherDevSection } from "./weather_dev_section.js";
import { KeepnetDevSection } from "./keepnet_dev_section.js";
import { LoadStepperDevSection } from "./load_stepper_dev_section.js";
import { ActiveFishDevToolsVisibilityPolicy } from "../fishing/active_fish_dev_tools_visibility_policy.js";
import { DevToolsParameterAliasRegistry } from "../services/dev_tools_parameter_alias_registry.js";
import { DevParameterSchema } from "./config/dev_parameter_schema.js";
import { DevConfigEditService } from "./config/dev_config_edit_service.js";
import { ConfigTreeRenderer } from "./config/config_tree_renderer.js";
import { HookedFishEditSync } from "./config/hooked_fish_edit_sync.js";
import { ItemStatAliasSync } from "./config/item_stat_alias_sync.js";
import {
  OVERLAY_MODULE_GROUPS,
  OVERLAY_MODULE_LABELS,
} from "../overlay/config/overlay_modules_config.js";
import { SpineRodDevSection } from "./spine_rod_dev_section.js";
import { SpineBoatDevSection } from "./spine_boat_dev_section.js";
import { SceneLayerDevSection } from "./scene_layer_dev_section.js";
import { ZoneEditorSection } from "./zone_editor_section.js";

const SECTION_STATES_KEY = "dev_tools_open_sections";
const LEGACY_SECTION_STATES_KEY = "dev_tools_sections_state";

export class DevTools {
  #config;
  #catalogs;
  #settingsStore;
  #ui;
  #isOpen = false;
  #liveData = null;
  #activeFishKey = "";
  #activeFishShapeKey = "";
  #configRuntime = null;
  #configValidation = null;
  #activeFishVisibilityPolicy;
  // Spec 174 B2: every edit goes through #edits; config and catalog trees are drawn by #tree.
  #edits;
  #tree;
  #itemProgressionDebugProvider;
  #grantCatalogItem;
  #rodSpine;
  #boatSpine;
  #radio;
  #weather;
  #keepnet;
  #scene;
  #zoneEditorState;
  #zoneEditorFiles;
  #readDynamicZones;
  #getDependentZones;
  #maskEditor;
  #zoneDrawing;
  #zoneEditorFullscreen;
  #zoneEditorSection = null;
  #weatherSection = null;
  #gameVersion;
  #getWaterMetric;
  #createWaterMetric;
  #storageCache;
  // Spec 174 B4: which sections are open, by their place in the tree (not by their title), read once.
  #sectionStates;
  #sectionKeys = new WeakMap();
  // Spec 174 B4: the hooked fish's sections are redrawn here on their own.
  #activeFishSlot = null;
  #assets;
  #assetLoadPlanStore;
  #loadStepperSection = null;
  #openHouse;
  #openGame;
  #unsubscribeOverlaySettings = null;
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
      this.#refreshActiveFish();
    }
  };

  constructor(
    config,
    hookedFishProfileSynchronizer,
    {
      itemProgressionDebugProvider = null,
      itemProgressionResolver = null,
      grantCatalogItem = null,
      rodSpine = null,
      boatSpine = null,
      radio = null,
      weather = null,
      keepnet = null,
      scene = null,
      zoneEditorState = null,
      zoneEditorFiles = null,
      prepareZoneEdit = null,
      readDynamicZones = null,
      getDependentZones = null,
      maskEditor = null,
      zoneDrawing = null,
      zoneEditorFullscreen = null,
      gameVersion = "",
      getWaterMetric = null,
      createWaterMetric = null,
      configRuntime = null,
      configValidation = null,
      catalogs,
      settingsStore,
      debugModulesSource,
      createUI,
      storageCache,
      openHouse = null,
      openGame = null,
      // The AssetRegistry: the shop shows each item's art by asset id (spec 157 R16).
      assets = null,
      // Spec 157 D6: the asset load plan's DEV edits (DevAssetLoadPlanStore) or null.
      assetLoadPlanStore = null,
      // Spec 167: { settings, getGate, readStatus, restart } of the step-by-step loading, or null.
      loadStepper = null,
    } = {},
  ) {
    this.#assets = assets;
    this.#storageCache = storageCache;
    // The title-keyed states of before spec 174 B4 are dropped, not carried over (a DEV convenience).
    storageCache.remove(LEGACY_SECTION_STATES_KEY);
    this.#sectionStates = { ...storageCache.get(SECTION_STATES_KEY, {}) };
    this.#zoneEditorState = zoneEditorState;
    this.#zoneEditorFiles = zoneEditorFiles;
    this.#readDynamicZones = readDynamicZones;
    this.#getDependentZones = getDependentZones;
    this.#maskEditor = maskEditor;
    this.#zoneDrawing = zoneDrawing;
    this.#zoneEditorFullscreen = zoneEditorFullscreen;
    this.#gameVersion = gameVersion;
    this.#getWaterMetric = getWaterMetric;
    this.#createWaterMetric = createWaterMetric;
    this.#openHouse = openHouse;
    this.#openGame = openGame;
    this.#assetLoadPlanStore = assetLoadPlanStore;
    this.#loadStepperSection = loadStepper
      ? new LoadStepperDevSection({
          ...loadStepper,
          createSection: (label, parent, path) =>
            this.#createSectionWithCache(label, parent, path),
        })
      : null;
    // Before the edit service: it checks the synchroniser itself (HookedFishEditSync).
    const hookedFishSync = new HookedFishEditSync({ synchronizer: hookedFishProfileSynchronizer,
      fishes: catalogs.fishes });
    this.#config = config;
    this.#catalogs = catalogs;
    this.#settingsStore = settingsStore;
    this.#configRuntime = configRuntime;
    this.#configValidation = configValidation;
    this.#activeFishVisibilityPolicy = new ActiveFishDevToolsVisibilityPolicy();
    this.#itemProgressionDebugProvider = itemProgressionDebugProvider;
    this.#grantCatalogItem = grantCatalogItem;
    this.#rodSpine = rodSpine;
    this.#boatSpine = boatSpine;
    this.#radio = radio;
    this.#weather = weather;
    this.#keepnet = keepnet;
    this.#scene = scene;
    const { ui, tooltipProvider } = createUI(() => this.toggle(), this.#config);
    this.#ui = ui;
    const parameterAliases = new DevToolsParameterAliasRegistry();
    this.#edits = new DevConfigEditService({ config, catalogs, configRuntime, configValidation, parameterAliases,
      prepareZoneEdit, getHookedFish: () => this.#liveData?.hookedFish, hookedFishSync,
      itemStatSync: new ItemStatAliasSync({ items: catalogs.items }), itemProgressionResolver, debugModulesSource,
      syncValue: (path, value) => this.#ui.syncValue(path, value), eventTarget: document });
    // The species list for parameters that name a fish: name, id and the species' image (level 1) where the game has one.
    const schema = new DevParameterSchema({
      sources: {
        fish: () =>
          (Array.isArray(this.#catalogs.fishes) ? this.#catalogs.fishes : [])
            .filter((fish) => fish?.id)
            .map((fish) => ({
              value: fish.id,
              label: fish.name || fish.id,
              hint: fish.id,
              imageUrl:
                this.#keepnet?.imagePathOf?.({ id: fish.id, level: 1 }) || "",
            })),
      },
    });
    this.#tree = new ConfigTreeRenderer({ ui, schema, aliases: parameterAliases, edits: this.#edits,
      createSection: (label, parent, path) => this.#createSectionWithCache(label, parent, path) });
    tooltipProvider.ready.then(() => {
      if (!this.#isDisposed && this.#isOpen) this.#populatePanel();
    });
    document.addEventListener("debug-live-update", this.#onDebugLiveUpdate);
    this.#unsubscribeOverlaySettings =
      this.#settingsStore?.subscribe?.((key, enabled) => {
        if (!this.#isDisposed) {
          this.#ui.syncValue(["OVERLAY_MODULES", key], enabled);
        }
      }) || null;
  }

  mountScreenToggle(mountNode) {
    return this.#isDisposed ? () => {} : this.#ui.mountScreenToggle(mountNode);
  }

  // A config edit from another DEV tool (the zone editor's drag, spec 129) through the same validated path as the panel.
  updateConfig(path, value) {
    this.#edits.update(path, value);
  }

  // TK-252: while the panel is open the game sends its live data (the hooked fish), Overlay on or off.
  get isOpen() {
    return this.#isOpen && !this.#isDisposed;
  }

  toggle() {
    if (this.#isDisposed) return;
    this.#isOpen = !this.#isOpen;
    this.#ui.togglePanel(this.#isOpen);

    if (this.#isOpen) {
      this.#populatePanel();
    }
  }

  open() {
    if (!this.#isDisposed && !this.#isOpen) this.toggle();
  }

  // Spec 177 (TK-296): open DevTools (if closed), expand ancestor sections and highlight the parameter green.
  revealParameter(path) {
    if (this.#isDisposed) return false;
    if (!this.#isOpen) this.open();
    return this.#ui.revealPath(path);
  }

  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    document.removeEventListener("debug-live-update", this.#onDebugLiveUpdate);
    this.#unsubscribeOverlaySettings?.();
    this.#unsubscribeOverlaySettings = null;
    this.#liveData = null;
    this.#zoneEditorSection?.dispose();
    this.#weatherSection?.dispose();
    this.#ui.dispose();
  }

  #populatePanel() {
    this.#zoneEditorSection?.dispose({ preserveDraft: true });
    this.#zoneEditorSection = null;
    this.#weatherSection?.dispose();
    this.#weatherSection = null;
    const body = this.#ui.body;
    // Spec 174 B4: a full redraw (opening, import or reset of overrides) keeps the place the panel was scrolled to.
    const scrollTop = body.scrollTop;
    this.#ui.clearValueBindings();
    body.replaceChildren();
    const pages = [];
    if (this.#openGame) pages.push(["До риболовлі ▶", () => this.#openGame()]);
    if (this.#openHouse)
      pages.push(["Будинок рибалки 🏠", () => this.#openHouse()]);
    if (pages.length) this.#ui.createNavigation(pages, body);

    this.#renderItemGrantSection(body);
    this.#renderOverlaySection(body);
    this.#renderConfigSection(body);
    const debugContent = this.#renderConfigDebugSection(body);
    this.#renderSceneLayerSection(body);
    if (this.#zoneEditorState) {
      this.#zoneEditorSection = new ZoneEditorSection({
        ui: this.#ui,
        state: this.#zoneEditorState,
        config: this.#config,
        createSection: (label, parent, path) =>
          this.#createSectionWithCache(label, parent, path),
        renderTree: (value, parent, path) =>
          this.#tree.render(value, parent, path),
        updateConfig: (path, value) => this.#edits.update(path, value),
        getWaterMetric: this.#getWaterMetric,
        createWaterMetric: this.#createWaterMetric,
        resetPerspective: (id) => this.#resetLocationPerspective(id),
        files: this.#zoneEditorFiles,
        getBaseZones: (id) =>
          this.#configRuntime?.baseConfig.locations.map[id]?.zones ?? null,
        resetZones: this.#configRuntime
          ? (id) => this.#resetLocationZones(id)
          : null,
        gameVersion: this.#gameVersion,
        readDynamicZones: this.#readDynamicZones,
        getDependentZones: this.#getDependentZones,
        maskEditor: this.#maskEditor,
        zoneDrawing: this.#zoneDrawing,
        fullscreen: this.#zoneEditorFullscreen,
      });
      this.#zoneEditorSection.render(body);
    }

    this.#renderDatabaseSection(body);
    if (this.#rodSpine || this.#boatSpine) {
      const spineSection = this.#createSectionWithCache("SPINE", body, [
        "SPINE",
      ]);
      if (this.#rodSpine) this.#renderSpineRodSection(spineSection);
      if (this.#boatSpine) this.#renderSpineBoatSection(spineSection);
    }
    if (this.#radio) {
      new RadioDevSection({
        ui: this.#ui,
        radio: this.#radio,
        createSection: (label, parent, path) =>
          this.#createSectionWithCache(label, parent, path),
        config: () => this.#config.radio,
        renderConfigTree: (value, parent, path, options) =>
          this.#tree.render(value, parent, path, options),
        setConfig: (path, value) => this.#edits.update(path, value),
        files: this.#zoneEditorFiles,
        gameVersion: this.#gameVersion,
      }).render(body);
    }
    this.#activeFishSlot = this.#ui.createSectionSlot(body);
    this.#refreshActiveFish();
    this.#loadStepperSection?.render(body, this.#ui);
    const service = this.#createSectionWithCache("Сервіс", body, [
      "DEV_SERVICE",
    ]);
    this.#renderRuntimeOverrideControls(service);
    this.#renderAssetLoadPlanControls(service);
    this.#renderItemProgressionSection(service);
    body.scrollTop = scrollTop;
  }

  // Spec 174 B4: a new fish on the hook (or its tree's shape) redraws only its own sections, so the panel keeps its
  // scroll, focus and every other control while playing.
  #refreshActiveFish() {
    const slot = this.#activeFishSlot;
    this.#activeFishKey = this.#getActiveFishKey();
    this.#activeFishShapeKey = this.#getActiveFishShapeKey();
    if (!slot) return;
    this.#ui.releaseValueBindings(slot);
    slot.replaceChildren();
    this.#renderActiveFishSection(slot);
  }

  // Spec 157 D6 (TK-177 item 8): the asset load plan exported as its module text, an edited plan (JSON) validated and
  // kept for the next start, and a reset to the configured plan.
  #renderAssetLoadPlanControls(service) {
    const store = this.#assetLoadPlanStore;
    if (!store) return;
    const content = this.#createSectionWithCache(
      store.isEdited() ? "ПЛАН ЗАВАНТАЖЕННЯ (змінено)" : "ПЛАН ЗАВАНТАЖЕННЯ",
      service,
      ["DEV_SERVICE", "ASSET_LOAD_PLAN"],
    );
    this.#ui.createButtonRow("Експорт плану", content, () => {
      const text = store.exportText();
      if (navigator?.clipboard?.writeText)
        navigator.clipboard.writeText(text).catch(() => {});
      window.prompt?.(
        "Текст для src/game/config/raw/assets/asset_load_plan.js",
        text,
      );
    });
    this.#ui.createButtonRow(
      "Змінити план (з наступного старту)",
      content,
      () => {
        const json = window.prompt?.(
          "JSON плану завантаження",
          JSON.stringify(store.plan()),
        );
        if (!json) return;
        let errors;
        try {
          errors = store.save(JSON.parse(json));
        } catch (error) {
          errors = [error.message];
        }
        if (errors.length > 0)
          window.alert?.(`План не збережено:\n${errors.join("\n")}`);
        else window.alert?.("План збережено: діє з наступного старту.");
      },
    );
    this.#ui.createButtonRow("Скинути план до конфігу", content, () => {
      store.reset();
      window.alert?.("Скинуто: з наступного старту діє план із конфігу.");
    });
  }

  #renderOverlaySection(body) {
    const overlayContent = this.#createSectionWithCache("OVERLAY", body, [
      "OVERLAY",
    ]);
    for (const key of Object.keys(this.#config.debug || {}).filter((key) =>
      key.startsWith("overlay"),
    )) {
      const path = ["CONFIG", "debug", key];
      this.#tree.renderScalar({
        key: key === "overlay" ? "enabled" : key,
        value: this.#config.debug[key],
        parentElement: overlayContent,
        displayPath: path,
        canonicalPath: path,
      });
    }
    const overlaySettings = this.#settingsStore;
    const overlayModules = overlaySettings?.getSnapshot?.();
    const overlayKeys =
      overlaySettings?.keys?.() || Object.keys(overlayModules || {});
    if (overlayModules && overlayKeys.length > 0) {
      const content = this.#createSectionWithCache(
        "OVERLAY MODULES (В live time)",
        overlayContent,
        ["OVERLAY_MODULES"],
      );
      const renderedKeys = new Set();
      const groups = Array.isArray(OVERLAY_MODULE_GROUPS)
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
  }

  #renderDatabaseSection(body) {
    const database = this.#createSectionWithCache("БАЗА ДАНИХ", body, [
      "DATABASE",
    ]);
    if (typeof this.#catalogs.maps !== "undefined") {
      const mapDbContent = this.#createSectionWithCache(
        "🗺️ БАЗА ЛОКАЦІЙ (MAP_DB)",
        database,
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
        this.#tree.render(location, sectionContent, ["MAP_DB", key]);
      }
    }

    if (typeof this.#catalogs.fishes !== "undefined") {
      const fishDbContent = this.#createSectionWithCache(
        "🐟 БАЗА РИБИ (FISH_DB)",
        database,
        ["FISH_DB"],
      );
      this.#catalogs.fishes.forEach((fish, index) => {
        const fishLabel = fish?.id || fish?.name || `Fish [${index}]`;
        const sectionContent = this.#createSectionWithCache(
          fishLabel,
          fishDbContent,
          ["FISH_DB", index],
        );
        this.#tree.render(fish, sectionContent, ["FISH_DB", index]);
      });
    }

    if (typeof this.#catalogs.items !== "undefined") {
      const dbContent = this.#createSectionWithCache(
        "📦 БАЗА ПРЕДМЕТІВ (ITEM_DB)",
        database,
        ["ITEM_DB"],
      );
      for (const key of Object.keys(this.#catalogs.items)) {
        if (ConfigTreeRenderer.isExcludedKey(key)) continue;
        const sectionContent = this.#createSectionWithCache(key, dbContent, [
          "ITEM_DB",
          key,
        ]);
        // Шлях тепер починається з "ITEM_DB"
        this.#tree.render(this.#catalogs.items[key], sectionContent, [
          "ITEM_DB",
          key,
        ]);
      }
    }
  }

  #renderConfigSection(body) {
    if (typeof this.#config !== "undefined") {
      const configContent = this.#createSectionWithCache(
        "⚙️ НАЛАШТУВАННЯ (CONFIG)",
        body,
        ["CONFIG"],
      );
      for (const key of Object.keys(this.#config)) {
        if (this.#tree.skips(["CONFIG"], key)) continue;
        const sectionContent = this.#createSectionWithCache(
          key,
          configContent,
          ["CONFIG", key],
        );
        // Шлях тепер починається з "CONFIG"
        this.#tree.render(this.#config[key], sectionContent, ["CONFIG", key]);
      }
    }
  }

  #renderConfigDebugSection(body) {
    if (typeof this.#config === "undefined" || !this.#config?.debug)
      return null;

    const debugContent = this.#createSectionWithCache(
      "🐞 DEBUG (CONFIG.debug)",
      body,
      ["CONFIG", "debug"],
    );
    this.#tree.render(this.#config.debug, debugContent, ["CONFIG", "debug"], {
      groupedDebug: true,
    });
    // TK-260: which stays in view when the fish runs far: the rod (off) or the fish / float (on). It edits the game's
    // own setting CONFIG.locations.cameraFollowPriority live (spec 153 D1).
    if (this.#config.locations) {
      // The switch binds its own path: config syncs carry "rod" / "tackle", a switch shows only true.
      const priorityPath = ["CONFIG", "locations", "cameraFollowPriority"];
      const switchPath = ["DEBUG_CAMERA", "followsTackle"];
      this.#ui.createSwitcherRow(
        "🎥 Камера тримає рибу (інакше — вудку в кадрі)",
        this.#config.locations.cameraFollowPriority === "tackle",
        debugContent,
        (enabled) => {
          this.#edits.update(priorityPath, enabled ? "tackle" : "rod");
          this.#ui.syncValue(switchPath, enabled);
        },
        switchPath,
      );
    }
    const inventory = this.#createSectionWithCache("Inventory", debugContent, [
      "DEBUG_INVENTORY",
    ]);
    if (this.#config.debug.inventory)
      this.#tree.render(this.#config.debug.inventory, inventory, [
        "CONFIG",
        "debug",
        "inventory",
      ]);
    if (this.#config.debug.inventorySplit) {
      const splitPath = ["CONFIG", "debug", "inventorySplit"];
      this.#tree.render(
        this.#config.debug.inventorySplit,
        this.#createSectionWithCache("Split", inventory, splitPath),
        splitPath,
      );
    }
    // TK-227/228: the keepnet fill lives under DEBUG, not among the main sections.
    if (this.#keepnet) {
      new KeepnetDevSection({
        ui: this.#ui,
        keepnet: this.#keepnet,
        createSection: (label, parent, path) =>
          this.#createSectionWithCache(label, parent, path),
      }).render(debugContent);
    }
    return debugContent;
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
    this.#tree.render(fish, fishRuntimeContent, ["HOOKED_FISH"], {
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
      const value = this.#edits.read(shortcut.path);
      if (!value || typeof value !== "object") continue;
      const content = this.#createSectionWithCache(
        shortcut.title || shortcut.path.join("."),
        globalContent,
        shortcut.path,
      );
      this.#tree.render(value, content, shortcut.path);
    }
  }

  #getActiveFishKey() {
    const fish = this.#liveData?.hookedFish;
    if (!fish) return "";
    return `${fish.id || fish.name || "hookedFish"}:${fish.level ?? ""}:${fish.weight ?? ""}`;
  }

  #getActiveFishShapeKey() {
    const fish = this.#liveData?.hookedFish;
    if (!fish) return "";
    return this.#tree.visibleScalarPaths(fish, ["HOOKED_FISH"], {
      visibilityPolicy: this.#activeFishVisibilityPolicy,
      applyHookedFishLegacySkips: false,
    }).join("|");
  }

  // One button per catalog item adds it to the player's inventory, so catalog-only items can be tested in game.
  #renderItemGrantSection(body) {
    if (
      typeof this.#grantCatalogItem !== "function" ||
      typeof this.#catalogs.items === "undefined"
    )
      return;
    const content = this.#createSectionWithCache(
      "🎁 БЕЗКОШТОВНИЙ МАГАЗИН",
      body,
      ["ITEM_SHOP"],
      { buttonTitle: true },
    );
    const labels = {
      rods: "🎣 Вудки",
      reels: "🧵 Котушки",
      lines: "🧶 Ліски",
      hooks: "🪝 Гачки",
      leaders: "🪢 Поводки",
      floats: "🥢 Поплавки",
      nets: "🕸️ Підсаки",
      misc: "☣️ Інше",
      baits: "🪱 Наживки та снасті",
      chums: "🍞 Прикормки для риболовлі",
      aquariumFeeds: "🐟 Прикормки для акваріума",
      deliveryMethods: "🚤 Доставка",
      batteries: "🔋 Живлення",
      devices: "📻 Пристрої",
      builds: "📦 Комплекти",
    };
    for (const category of Object.keys(this.#catalogs.items)) {
      if (ConfigTreeRenderer.isExcludedKey(category)) continue;
      const section = this.#createSectionWithCache(
        labels[category] || category,
        content,
      );
      for (const [itemId, item] of Object.entries(
        this.#catalogs.items[category] || {},
      )) {
        if (!item?.itemType || item.devExclude) continue;
        const iconAsset = item.iconAsset || item.skin?.thumbnail?.asset || "";
        const iconUrl =
          iconAsset && this.#assets ? this.#assets.pathOf(iconAsset) : "";
        const label = `${item.name || itemId} · Безкоштовно`;
        let granted = 0;
        this.#ui.createButtonRow(
          label,
          section,
          (event) => {
            const quantity = Math.max(
              1,
              Number(item.defaultQuantity || item.packSize) || 1,
            );
            const result = this.#grantCatalogItem(itemId, quantity);
            if (result?.success) granted += 1;
            const labelNode = iconUrl
              ? event.currentTarget.querySelector(".devtools__action-label")
              : event.currentTarget;
            labelNode.innerText = result?.success
              ? `${label} ✓×${granted}`
              : `${label} ✗`;
          },
          false,
          iconUrl,
        );
      }
    }
  }

  // DEV Spine rod section (spec 099 Phase 4) over the rod controller's DEV port.
  #renderSpineRodSection(body) {
    if (!this.#rodSpine) return;
    new SpineRodDevSection({
      ui: this.#ui,
      controller: this.#rodSpine,
      createSection: (label, parent, path) =>
        this.#createSectionWithCache(label, parent, path),
      renderConfigTree: (parent) =>
        this.#tree.render(this.#config.ui.rod.spine, parent, [
          "CONFIG",
          "ui",
          "rod",
          "spine",
        ]),
    }).render(body);
  }

  // DEV Spine boat section (spec 150 TK-145) over the boat controller's DEV port.
  #renderSpineBoatSection(body) {
    if (!this.#boatSpine) return;
    new SpineBoatDevSection({
      ui: this.#ui,
      controller: this.#boatSpine,
      createSection: (label, parent, path) =>
        this.#createSectionWithCache(label, parent, path),
      renderConfigTree: (parent) =>
        this.#tree.render(this.#config.ui.boat, parent, ["CONFIG", "ui", "boat"]),
    }).render(body);
  }

  // TK-291: the weather section («ПОГОДА»), drawn inside the WebGL scene section (its effects are the scene's), or in
  // the panel when there is no scene section. A redraw of the scene section draws it again, so the old one is disposed.
  #renderWeatherSection(parent) {
    if (!this.#weather) return;
    this.#weatherSection?.dispose();
    const locationId = this.#weather.locationId;
    this.#weatherSection = new WeatherDevSection({
      ui: this.#ui,
      weather: this.#weather,
      config: () => this.#config.locations?.map?.[locationId]?.weather ?? null,
      locationConfig: (id) => this.#config.locations?.map?.[id]?.weather ?? null,
      locationsMap: () => this.#config.locations?.map ?? null,
      rainConfig: () => this.#config.canvas?.rain ?? null,
      createSection: (label, parent, path) =>
        this.#createSectionWithCache(label, parent, path),
      renderConfigTree: (value, parent, path, options) =>
        this.#tree.render(value, parent, path, options),
      updateConfig: (path, value) => this.#edits.update(path, value),
      files: this.#zoneEditorFiles,
      getBaseRain: () => this.#configRuntime?.baseConfig.canvas?.rain ?? null,
      getBaseLocationWeather: (id) =>
        this.#configRuntime?.baseConfig.locations?.map?.[id]?.weather ?? null,
      resetWeather: this.#configRuntime ? (id) => this.#resetWeather(id) : null,
      gameVersion: this.#gameVersion,
    });
    this.#weatherSection.render(parent);
  }

  // DEV WebGL scene section (spec 104 D5) over the scene layer's DEV methods and the router.
  #renderSceneLayerSection(body) {
    if (!this.#scene) {
      this.#renderWeatherSection(body);
      return;
    }
    new SceneLayerDevSection({
      ui: this.#ui,
      scene: this.#scene,
      createSection: (label, parent, path) =>
        this.#createSectionWithCache(label, parent, path),
      renderWaterConfig: (parent) =>
        this.#tree.render(this.#config.canvas.water, parent, [
          "CONFIG",
          "canvas",
          "water",
        ]),
      renderWeather: (parent) => this.#renderWeatherSection(parent),
    }).render(body);
  }

  // Spec 174 B4 (R6): a section is remembered open or closed by its place: its parent section's key and its own path
  // (its title only when it has no path). Two sections with one title (each fish's «Опис», items with one id) no longer
  // share a state, and a title that changes («ПЛАН ЗАВАНТАЖЕННЯ (змінено)») keeps it. The states are read once.
  #createSectionWithCache(labelStr, parentElement, path = null, options = {}) {
    const key = `${this.#sectionKeys.get(parentElement) ?? ""}/${path ? path.join(".") : labelStr}`;
    const content = this.#ui.createSection(
      labelStr,
      parentElement,
      this.#sectionStates[key] === true,
      (isNowExpanded) => {
        if (isNowExpanded) this.#sectionStates[key] = true;
        else delete this.#sectionStates[key];
        this.#storageCache.set(SECTION_STATES_KEY, this.#sectionStates);
      },
      path,
      options,
    );
    this.#sectionKeys.set(content, key);
    return content;
  }

  #getOverlayModuleLabel(key) {
    const labels = OVERLAY_MODULE_LABELS;
    return labels?.[key]?.label || key;
  }

  #renderItemProgressionSection(body) {
    const snapshots =
      this.#itemProgressionDebugProvider?.getSnapshots?.() || [];
    if (snapshots.length === 0) return;
    const root = this.#createSectionWithCache("📈 ITEM PROGRESSION", body, [
      "ITEM_PROGRESSION",
    ]);
    for (const snapshot of snapshots) {
      const item = this.#createSectionWithCache(snapshot.itemId, root, [
        "ITEM_PROGRESSION",
        snapshot.itemId,
      ]);
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
      this.#ui.createInfoRow("Rating tier", snapshot.ratingTier, item);
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

  #applyImportedOverrides(overrides) {
    this.#edits.importOverrides(overrides);
    if (this.#isOpen) this.#populatePanel();
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
      this.#edits.resetAll();
      this.#populatePanel();
      this.#configValidation?.report("reset all overrides");
    });
    this.#ui.createButtonRow("Export overrides", content, () =>
      this.#exportRuntimeOverrides(),
    );
    this.#ui.createButtonRow("Import overrides", content, () =>
      this.#importRuntimeOverrides(),
    );
    if (this.#configValidation) {
      this.#ui.createButtonRow("Validate config", content, () =>
        this.#configValidation.report("manual check"),
      );
    }
  }

  // Restores this location's waterProjection and drops exported overrides of the branches spec 126 retired, so
  // they are neither saved nor exported again (they never reach the metric).
  #resetLocationPerspective(id) {
    const location = ["locations", "map", id];
    const retired = ["perspective", "distanceProfile"].map((branch) =>
      [...location, branch].join("."),
    );
    for (const [key] of Object.entries(
      this.#configRuntime?.exportOverrides?.() || {},
    )) {
      if (
        retired.some((prefix) => key === prefix || key.startsWith(prefix + "."))
      )
        this.#configRuntime.reset(key);
    }
    const path = ["CONFIG", ...location, "waterProjection"];
    const initial =
      this.#configRuntime?.baseConfig.locations.map[id]?.waterProjection;
    if (initial === undefined) {
      if (this.#config.locations.map[id]?.waterProjection !== undefined)
        this.#configRuntime?.reset?.(path);
      return;
    }
    this.#edits.update(path, initial);
    for (const [key, value] of Object.entries(
      this.#config.locations.map[id].waterProjection || {},
    )) {
      this.#ui.syncValue([...path, key], value);
    }
  }

  // Spec 130 D5: drops the session's overrides of a location's zones (the whole list and every child path), so the
  // zones are the code's again, and tells the game to reload the location's map.
  #resetLocationZones(id) {
    this.#edits.resetOverrideTree(["locations", "map", id, "zones"]);
    console.log(`[DevTools] Зони ${id} скинуто до коду`);
  }

  // Spec 175 TK-286: drops the session's overrides of rain look and the location's weather so both match the code again.
  #resetWeather(id) {
    this.#edits.resetOverrideTree(["canvas", "rain"]);
    this.#edits.resetOverrideTree(["locations", "map", id, "weather"]);
    console.log(`[DevTools] Погоду ${id} скинуто до коду`);
  }

  #exportRuntimeOverrides() {
    const json = JSON.stringify(
      this.#configRuntime?.exportOverrides?.() || {},
      null,
      2,
    );
    console.log("[DevTools] Runtime overrides export:", json);
    if (navigator?.clipboard?.writeText)
      navigator.clipboard.writeText(json).catch(() => {});
    window.prompt?.("Copy runtime overrides JSON", json);
  }

  #importRuntimeOverrides() {
    const json = window.prompt?.("Paste runtime overrides JSON", "{}");
    if (!json) return;
    try {
      this.#applyImportedOverrides(JSON.parse(json));
      this.#configValidation?.report("import overrides");
    } catch (error) {
      console.warn("[DevTools] Failed to import runtime overrides", error);
    }
  }
}
