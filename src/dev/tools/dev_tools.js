import { LoadStepperDevSection } from "./load_stepper_dev_section.js";
import { ActiveFishDevToolsVisibilityPolicy } from "../fishing/active_fish_dev_tools_visibility_policy.js";
import { DevToolsParameterAliasRegistry } from "../services/dev_tools_parameter_alias_registry.js";
import { DevParameterSchema } from "./config/dev_parameter_schema.js";
import { DevConfigEditService } from "./config/dev_config_edit_service.js";
import { ConfigTreeRenderer } from "./config/config_tree_renderer.js";
import { HookedFishEditSync } from "./config/hooked_fish_edit_sync.js";
import { ItemStatAliasSync } from "./config/item_stat_alias_sync.js";
import { assertDevPanelModule } from "./modules/dev_panel_module.js";
import { ItemShopModule } from "./modules/item_shop_module.js";
import { OverlaySettingsModule } from "./modules/overlay_settings_module.js";
import { ConfigModule } from "./modules/config_module.js";
import { DebugModule } from "./modules/debug_module.js";
import { SceneModule } from "./modules/scene_module.js";
import { ZoneEditorModule } from "./modules/zone_editor_module.js";
import { DatabaseModule } from "./modules/database_module.js";
import { SpineModule } from "./modules/spine_module.js";
import { RadioModule } from "./modules/radio_module.js";
import { ActiveFishModule } from "./modules/active_fish_module.js";
import { ServiceModule } from "./modules/service_module.js";
import { ItemProgressionModule } from "./modules/item_progression_module.js";

const SECTION_STATES_KEY = "dev_tools_open_sections";
const LEGACY_SECTION_STATES_KEY = "dev_tools_sections_state";
const ACTIVE_PAGE_KEY = "dev_tools_active_module";

// The DevTools panel (spec 174 B3): its lifecycle (open, close, redraw, dispose), the page navigation and the order of
// its modules. Each area of the panel is a module (src/dev/tools/modules) that draws itself into the panel with one
// shared context: the controls (DevToolsUI), remembered sections, the config tree and the one edit path.
export class DevTools {
  #ui;
  #isOpen = false;
  #isDisposed = false;
  #liveData = null;
  #edits;
  #context;
  #pages;
  #activePage;
  #activeFish;
  #openGame;
  #openHouse;
  #storageCache;
  // Spec 174 B4: which sections are open, by their place in the tree (not by their title), read once.
  #sectionStates;
  #sectionKeys = new WeakMap();
  #onDebugLiveUpdate = (event) => {
    if (this.#isDisposed) return;
    this.#liveData = event.detail || null;
    // Spec 174 B4: a new fish on the hook (or its tree's shape) redraws only its own sections.
    if (this.#isOpen && this.#activeFish.hasChanged) this.#activeFish.refresh();
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
    // Before anything else: it checks the synchroniser itself.
    const hookedFishSync = new HookedFishEditSync({ synchronizer: hookedFishProfileSynchronizer, fishes: catalogs.fishes });
    this.#storageCache = storageCache;
    // The title-keyed states of before spec 174 B4 are dropped, not carried over (a DEV convenience).
    storageCache.remove(LEGACY_SECTION_STATES_KEY);
    this.#sectionStates = { ...storageCache.get(SECTION_STATES_KEY, {}) };
    this.#openGame = openGame;
    this.#openHouse = openHouse;

    const { ui, tooltipProvider } = createUI(() => this.toggle(), config);
    this.#ui = ui;
    const parameterAliases = new DevToolsParameterAliasRegistry();
    this.#edits = new DevConfigEditService({ config, catalogs, configRuntime, configValidation, parameterAliases,
      prepareZoneEdit, getHookedFish: () => this.#liveData?.hookedFish, hookedFishSync,
      itemStatSync: new ItemStatAliasSync({ items: catalogs.items }), itemProgressionResolver, debugModulesSource,
      syncValue: (path, value) => this.#ui.syncValue(path, value), eventTarget: document });
    // The species list for parameters that name a fish: name, id and the species' image (level 1) where the game has one.
    const schema = new DevParameterSchema({ sources: {
      fish: () => (Array.isArray(catalogs.fishes) ? catalogs.fishes : []).filter((fish) => fish?.id).map((fish) => ({
        value: fish.id, label: fish.name || fish.id, hint: fish.id,
        imageUrl: keepnet?.imagePathOf?.({ id: fish.id, level: 1 }) || "",
      })),
    } });
    const createSection = (label, parent, path = null, options = {}) => this.#createSection(label, parent, path, options);
    this.#context = Object.freeze({ ui, createSection, edits: this.#edits,
      tree: new ConfigTreeRenderer({ ui, schema, aliases: parameterAliases, edits: this.#edits, createSection }) });

    this.#activeFish = new ActiveFishModule({ getHookedFish: () => this.#liveData?.hookedFish,
      policy: new ActiveFishDevToolsVisibilityPolicy() });
    // Spec 174 C2 (Q1): seven modules on the rail, each with its areas in order. Weather stays inside the scene
    // section (owner, TK-291), so «Локація» holds the zone editor alone.
    const shop = typeof grantCatalogItem === "function" ? new ItemShopModule({ items: catalogs.items, grantCatalogItem, assets }) : null;
    this.#pages = [
      { id: "game", title: "Гра", icon: "hook", navigation: true, empty: "",
        modules: [shop, new DebugModule({ config, keepnet })] },
      { id: "config", title: "Конфіг", icon: "sliders", empty: "", modules: [new ConfigModule({ config })] },
      { id: "data", title: "Бази", icon: "database", empty: "",
        modules: [new DatabaseModule({ catalogs }),
          itemProgressionDebugProvider ? new ItemProgressionModule({ provider: itemProgressionDebugProvider }) : null] },
      { id: "location", title: "Локація", icon: "map", empty: "Редактор зон на цій сторінці недоступний.",
        modules: [zoneEditorState ? new ZoneEditorModule({ config, configRuntime, state: zoneEditorState, files: zoneEditorFiles,
          gameVersion, readDynamicZones, getDependentZones, maskEditor, zoneDrawing, fullscreen: zoneEditorFullscreen,
          getWaterMetric, createWaterMetric }) : null] },
      { id: "scene", title: "Сцена", icon: "scene", empty: "На цій сторінці немає сцени, Spine чи радіо.",
        modules: [new SceneModule({ config, configRuntime, scene, weather, files: zoneEditorFiles, gameVersion }),
          new SpineModule({ config, rodSpine, boatSpine }),
          radio ? new RadioModule({ config, radio, files: zoneEditorFiles, gameVersion }) : null] },
      { id: "diagnostics", title: "Діагностика", icon: "bug", empty: "",
        modules: [new OverlaySettingsModule({ config, settingsStore }), this.#activeFish] },
      { id: "service", title: "Сервіс", icon: "wrench", empty: "",
        modules: [new ServiceModule({ configRuntime, configValidation, assetLoadPlanStore,
          redraw: () => this.#populatePanel(), windowRef: globalThis }),
        loadStepper ? DevTools.#loadStepperModule(loadStepper) : null] },
    ].map((page) => ({ ...page, modules: page.modules.filter(Boolean).map(assertDevPanelModule) }));
    this.#activePage = storageCache.get(ACTIVE_PAGE_KEY, "game");

    tooltipProvider.ready.then(() => {
      if (!this.#isDisposed && this.#isOpen) this.#populatePanel();
    });
    document.addEventListener("debug-live-update", this.#onDebugLiveUpdate);
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
    if (this.#isOpen) this.#populatePanel();
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
    this.#liveData = null;
    for (const page of this.#pages) for (const module of page.modules) module.dispose?.();
    this.#ui.dispose();
  }

  #populatePanel() {
    const body = this.#ui.body;
    // Spec 174 B4: a full redraw (opening, import or reset of overrides) keeps the place the panel was scrolled to.
    const scrollTop = body.scrollTop;
    this.#ui.clearValueBindings();
    // Spec 174 C2: one page per module; the chosen module is remembered.
    const hosts = this.#ui.createPages(this.#pages, this.#activePage, (id) => {
      this.#activePage = id;
      this.#storageCache.set(ACTIVE_PAGE_KEY, id);
    });
    for (const page of this.#pages) {
      const host = hosts.get(page.id);
      if (page.navigation) this.#renderNavigation(host);
      for (const module of page.modules) module.mount(host, this.#context);
      if (page.empty && host.children.length === 0) this.#ui.createEmptyNote(host, page.empty);
    }
    // Spec 174 C3: a search or the changed-only filter stays applied across a redraw.
    this.#ui.refreshFilter();
    body.scrollTop = scrollTop;
  }

  // The pages of the DEV build: the game and the fisherman's house.
  #renderNavigation(host) {
    const pages = [];
    if (this.#openGame) pages.push(["До риболовлі", () => this.#openGame(), "hook"]);
    if (this.#openHouse) pages.push(["Будинок рибалки", () => this.#openHouse(), "home"]);
    if (pages.length) this.#ui.createNavigation(pages, host);
  }

  // Spec 174 B4 (R6): a section is remembered open or closed by its place: its parent section's key and its own path
  // (its title only when it has no path). Two sections with one title (each fish's «Опис», items with one id) no longer
  // share a state, and a title that changes («ПЛАН ЗАВАНТАЖЕННЯ (змінено)») keeps it. The states are read once.
  #createSection(label, parentElement, path, options) {
    const key = `${this.#sectionKeys.get(parentElement) ?? ""}/${path ? path.join(".") : label}`;
    const content = this.#ui.createSection(label, parentElement, this.#sectionStates[key] === true, (isNowExpanded) => {
      if (isNowExpanded) this.#sectionStates[key] = true;
      else delete this.#sectionStates[key];
      this.#storageCache.set(SECTION_STATES_KEY, this.#sectionStates);
    }, path, options);
    this.#sectionKeys.set(content, key);
    return content;
  }

  // Spec 167: the step-by-step loading section draws itself with the panel's controls.
  static #loadStepperModule(loadStepper) {
    let section = null;
    return { mount: (host, { ui, createSection }) => {
      section ??= new LoadStepperDevSection({ ...loadStepper, createSection });
      section.render(host, ui);
    } };
  }
}
