import { getBrowserStartupEnvironment } from "../../platform/browser/runtime/browser_startup_environment.js";
import { ITEM_DB } from "../../game/config/databases/item_catalog.js";
import { UiSurfaceAdapter } from "../../platform/browser/dom/ui_surface_adapter.js";
import { EMBEDDED_PAGE_RETURN_MESSAGE } from "../../platform/browser/ui/embedded_page_overlay.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { ItemRarityDomAdapter } from "../../platform/browser/dom/item_rarity_dom_adapter.js";
import { InventoryUiBootstrap } from "../production/inventory_ui_bootstrap.js";
import { composeInventorySelector } from "../production/inventory_selector_composition.js";
import { ImageAssetProvider } from "../../platform/browser/assets/image_asset_provider.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { UiCatalogSelectorExample } from "../../dev/ui_catalog/ui_catalog_selector_example.js";
import { InventoryActionType } from "../../game/presentation/inventory/inventory_action_type.js";
import { InventoryResourceMeterRenderer } from "../../game/presentation/inventory/inventory_resource_meter_renderer.js";
import { InventoryResourceMeterResolver } from "../../game/presentation/inventory/inventory_resource_meter_resolver.js";
import { UiCloseButtonRenderer } from "../../game/presentation/ui/ui_close_button_renderer.js";
import { UiAutoSwitchRenderer } from "../../game/presentation/ui/ui_auto_switch_renderer.js";
import { composeHouseView } from "../production/house_view_composition.js";
import { AquariumFishView } from "../../game/presentation/house/aquarium_fish_view.js";
import { AquariumFishMotion } from "../../game/presentation/house/aquarium_fish_motion.js";
import { AQUARIUM_FISH_VIEW_STYLE } from "../../game/presentation/house/aquarium_fish_view_style.js";
import { isUsableAquariumVisual } from "../../game/config/validation/aquarium_visual_issues.js";
import { AquariumFeedPicker } from "../../game/presentation/house/aquarium_feed_picker.js";
import { AquariumCareCalculator } from "../../game/domain/live_bait/aquarium_care_calculator.js";
import { HOUSE_LABELS } from "../../game/presentation/house/house_labels.js";
import { HOUSE_SCREEN_MARKUP } from "../../game/presentation/house/house_screen_markup.js";
import { HOUSE_CONFIG } from "../../game/config/raw/house/house_config.js";
import { CONFIG } from "../../game/config/runtime/game_config.js";
import { DEGRADATION_COLOR_CONFIG } from "../../game/presentation/visual/degradation_color_config.js";
import { RARITY_VISUAL_CONFIG } from "../../game/presentation/rarity/rarity_visual_config.js";
import { DegradationColorResolver } from "../../game/presentation/styles/degradation_color_resolver.js";
import { RarityVisualResolver } from "../../game/presentation/styles/rarity_visual_resolver.js";
import { RarityAnimationResolver } from "../../game/presentation/screens/rarity_animation_resolver.js";
import { HudStyleResolver } from "../../game/presentation/styles/hud_style_resolver.js";
import { HudBarRenderer } from "../../game/presentation/hud/hud_bar_renderer.js";
import { FightStatusBarsRenderer } from "../../game/presentation/hud/fight_status_bars_renderer.js";
import { composeDepthSelector } from "../production/depth_selector_composition.js";
import { HoldCharges } from "../../platform/browser/ui/hold_charges.js";
import { ChumControls } from "../../platform/browser/ui/chum_controls.js";
import { composeTimeDisplay } from "../production/time_display_composition.js";
import { TimePhaseControl } from "../../game/application/world/time_phase_control.js";
import { GAME_TIME_CONFIG } from "../../game/config/raw/time/game_time_config.js";
import { GameControls } from "../../platform/browser/ui/game_controls.js";
import { GameToolbar } from "../../platform/browser/ui/game_toolbar.js";
import { FullscreenControl } from "../../platform/browser/ui/fullscreen_control.js";
import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { SheetDismissController } from "../../platform/browser/dom/sheet_dismiss_controller.js";
import { SheetHeightController } from "../../platform/browser/dom/sheet_height_controller.js";
import { HudRowSizer } from "../../platform/browser/dom/hud_row_sizer.js";
import { UiSheetHandleRenderer } from "../../game/presentation/ui/ui_sheet_handle_renderer.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { UI_CATALOG_DEFINITIONS, UI_CATALOG_LABELS } from "../../dev/ui_catalog/ui_catalog_definitions.js";
import { UiCatalogPage } from "../../dev/ui_catalog/ui_catalog_page.js";
import { UiCatalogDocumentScope } from "../../dev/ui_catalog/ui_catalog_document_scope.js";
import { UiCatalogFrameScheduler } from "../../dev/ui_catalog/ui_catalog_frame_scheduler.js";
import { UiCatalogControlsExample } from "../../dev/ui_catalog/ui_catalog_controls_example.js";
import { UiCatalogMetersExample } from "../../dev/ui_catalog/ui_catalog_meters_example.js";
import { UiCatalogInventoryFixture } from "../../dev/ui_catalog/ui_catalog_inventory_fixture.js";
import { UiCatalogInventoryExample } from "../../dev/ui_catalog/ui_catalog_inventory_example.js";
import { UiCatalogKeepnetFixture } from "../../dev/ui_catalog/ui_catalog_keepnet_fixture.js";
import { UiCatalogKeepnetExample } from "../../dev/ui_catalog/ui_catalog_keepnet_example.js";
import { UiCatalogHouseExample } from "../../dev/ui_catalog/ui_catalog_house_example.js";
import { UiCatalogHudExample } from "../../dev/ui_catalog/ui_catalog_hud_example.js";
import { GameTimeClock } from "../../game/domain/time/game_time_clock.js";
import { composeDevTimeDisplay } from "./dev_time_composition.js";

export function startUiCatalog() {
  const { documentTarget: documentRef, windowTarget } = getBrowserStartupEnvironment();
  let hostWindow = null;
  const navigation = new windowTarget.URLSearchParams(windowTarget.location.search);
  if (navigation.get("embedded") === "1" && windowTarget.parent !== windowTarget) {
    try {
      if (windowTarget.parent.location.origin === windowTarget.location.origin) hostWindow = windowTarget.parent;
    } catch { /* A cross-origin parent cannot receive catalog return messages. */ }
  }
  const abort = new windowTarget.AbortController();
  const dom = new InventoryDomFactory(documentRef);
  const colors = new DegradationColorResolver({ configProvider: () => CONFIG.degradationColors || DEGRADATION_COLOR_CONFIG });
  const rarity = new RarityVisualResolver({ configProvider: () => CONFIG.rarity?.visual || RARITY_VISUAL_CONFIG, animationResolver: new RarityAnimationResolver() });
  const meters = new InventoryResourceMeterRenderer({ domFactory: dom, degradationColorResolver: colors });
  const resourceMeterResolver = new InventoryResourceMeterResolver();
  const close = new UiCloseButtonRenderer({ domFactory: dom });
  const auto = new UiAutoSwitchRenderer({ domFactory: dom });
  const scopeFor = (root) => new UiCatalogDocumentScope({ documentRef, root, windowTarget });
  const warningTimers = { setTimeout: (callback, ms) => windowTarget.setTimeout(callback, ms), clearTimeout: (id) => windowTarget.clearTimeout(id) };
  const page = new UiCatalogPage({ documentRef, mountNode: documentRef.getElementById("uiCatalogExamples"), definitions: UI_CATALOG_DEFINITIONS,
    returnLink: documentRef.getElementById("uiCatalogReturn"),
    onReturn: hostWindow ? () => hostWindow.postMessage({ type: EMBEDDED_PAGE_RETURN_MESSAGE }, windowTarget.location.origin) : null,
    createSurface: (hostElement) => new UiSurfaceAdapter({ hostElement, documentRef, windowRef: windowTarget }),
    createExample: async (id, { surface, status }) => {
      const owned = [];
      const own = (resource) => { owned.push(resource); return resource; };
      try {
      if (id === "controls") return new UiCatalogControlsExample({ domFactory: dom, closeButtonRenderer: close, autoSwitchRenderer: auto, surface, status });
      if (id === "meters") return new UiCatalogMetersExample({ domFactory: dom, resourceMeterRenderer: meters, resourceMeterResolver, surface, status });
      if (id === "inventory-selector") {
        const scope = own(scopeFor(surface.mountRoot));
        const toolbar = own(new GameToolbar({ documentRef: scope, mountNode: surface.mountRoot }));
        toolbar.dock.classList.add("ui-catalog-preview__toolbar-row");
        const fixture = new UiCatalogInventoryFixture({ actionTypes: InventoryActionType, rarityVisualResolver: rarity });
        const ui = own(InventoryUiBootstrap.create({ documentRef: scope, mountNode: surface.mountRoot,
          buttonMountNode: toolbar.element, uiSurface: surface, facade: fixture, degradationColorResolver: colors,
          rarityVisualResolver: rarity, rarityDomAdapter: new ItemRarityDomAdapter({ visualResolver: rarity }), warningTimers }));
        const keepnet = own(InventoryUiBootstrap.createKeepnet({ documentRef: scope, liveBait: new UiCatalogKeepnetFixture(),
          inventoryUI: ui, degradationColorResolver: colors, uiSurface: surface, buttonMountNode: toolbar.element }));
        const config = { ui: { inventorySelector: { radialEnabled: true, size: 1, openSize: 3, compactShape: "half", compactPlacement: "center", compactActionsSide: "right" } } };
        const selector = own(composeInventorySelector({ documentRef: scope, windowRef: windowTarget, uiSurface: surface,
          mountNode: toolbar.selectorMountNode, inventoryUI: ui, keepnetUI: keepnet, config,
          imageAssets: new ImageAssetProvider({ imageFactory: () => scope.createElement("img") }), logger: new ConsoleLogger(),
          equipmentSource: { getEquipped: () => ({ rod: ITEM_DB.rods.rod_test_float }), onInventoryChanged: () => () => {} },
          id: "catalog-inventory-selector-sections" }));
        await selector.ready;
        return new UiCatalogSelectorExample({ selector, config, documentScope: scope, inventoryUI: ui, owned });
      }
      if (id === "inventory") {
        const scope = own(scopeFor(surface.mountRoot));
        const fixture = new UiCatalogInventoryFixture({ actionTypes: InventoryActionType, rarityVisualResolver: rarity });
        const ui = own(InventoryUiBootstrap.create({ autoMount: false, documentRef: scope, mountNode: surface.mountRoot, uiSurface: surface,
          facade: fixture, degradationColorResolver: colors, rarityVisualResolver: rarity,
          rarityDomAdapter: new ItemRarityDomAdapter({ visualResolver: rarity }), warningTimers }));
        return new UiCatalogInventoryExample({ fixture, ui, documentScope: scope, surface, status });
      }
      if (id === "keepnet") {
        const scope = own(scopeFor(surface.mountRoot));
        const fixture = new UiCatalogKeepnetFixture();
        // The production section view without an inventory: the catalog places its two halves side by side.
        let ui;
        ui = own(InventoryUiBootstrap.createKeepnetView({ documentRef: scope, buttonMountNode: surface.mountRoot, liveBait: fixture,
          uiSurface: surface, degradationColorResolver: colors,
          openSection: () => ui.setVisible(true), toggleSection: () => ui.setVisible(!ui.isOpen) }));
        const layout = dom.element("div", "ui-catalog-preview__keepnet");
        layout.append(ui.helpNode, ui.summaryNode, ui.contentNode);
        surface.mountRoot.appendChild(layout);
        own({ dispose: () => layout.remove() });
        return new UiCatalogKeepnetExample({ fixture, ui, documentScope: scope, surface, status });
      }
      if (id === "house") {
        // The House screen markup (spec 084); no production composition, timers, clock or storage run here.
        const root = dom.element("div", "house ui-catalog-preview__house");
        root.innerHTML = HOUSE_SCREEN_MARKUP;
        surface.mountRoot.append(root);
        const scope = own(scopeFor(root));
        const scheduler = own(new UiCatalogFrameScheduler({ windowTarget }));
        const gameTime = new GameTimeClock({ anchorHours: 12, anchorMs: 0, timeScale: 1, now: () => 0 });
        const phaseControl = new TimePhaseControl({ clock: gameTime, phaseHours: GAME_TIME_CONFIG.phaseHours });
        const timeDisplay = own(composeTimeDisplay({ documentRef: scope, mount: scope.querySelector("[data-house-time-mount]"),
          clock: gameTime, timers: warningTimers }));
        scope.documentElement = { requestFullscreen: async () => { status.textContent = UI_CATALOG_LABELS.houseFullscreen; } };
        const fullscreenControl = own(new FullscreenControl({ documentRef: scope, mountNode: scope.querySelector("[data-house-fullscreen-mount]"), label: HUD_LABELS.fullscreen }));
        const headerSizer = own(new HudRowSizer({ row: scope.querySelector("[data-house-header-row]"), uiSurface: surface, windowTarget }));
        let view;
        const sceneScroll = new HorizontalScrollController({ uiSurface: surface, manualTouch: true,
          className: "house-interior-scroll", dragClassName: "house-interior-scroll--dragging", dragThresholdPx: CONFIG.input.pointerThreshold, getPanConfig: () => CONFIG.input.mapPan,
          onVerticalGesture: delta => view.handleSceneGesture(delta), wheelGestureGapMs: HOUSE_CONFIG.ui.sceneWheelGestureGapMs });
        const sceneDetachers = [];
        for (const scene of scope.querySelectorAll(".house__scene")) {
          scene.scrollLeft = Math.max(0, (scene.scrollWidth - scene.clientWidth) / 2);
          const detach = sceneScroll.attach(scene);
          sceneDetachers.push(detach);
          own({ dispose: detach });
        }
        const detachScrim = sceneScroll.attach(scope.querySelector("[data-house-scrim]"));
        sceneDetachers.push(detachScrim); own({ dispose: detachScrim });
        for (const button of scope.querySelectorAll("[data-house-panel-button]")) {
          const detach = sceneScroll.attach(button); sceneDetachers.push(detach); own({ dispose: detach });
        }
        const fishView = own(new AquariumFishView({ canvas: scope.querySelector("[data-house-aquarium-fish]"), windowTarget: scheduler,
          motion: new AquariumFishMotion({ config: CONFIG.liveBait.visual, rng: { next: () => .5 }, isValidConfig: isUsableAquariumVisual }),
          style: AQUARIUM_FISH_VIEW_STYLE,
          createImage: () => { const image = new windowTarget.Image(); image.addEventListener("load", () => scheduler.flush(), { once: true }); return image; },
          observeResize: (canvas, callback) => {
            const observer = new windowTarget.ResizeObserver(() => { callback(); scheduler.flush(); });
            own({ dispose: () => observer.disconnect() }); observer.observe(canvas); return observer;
          } }));
        let example;
        const feedPicker = own(new AquariumFeedPicker({ documentRef: scope, button: scope.querySelector("[data-house-feed-toggle]"),
          list: scope.querySelector("[data-house-feed-list]"), labels: HOUSE_LABELS.feedPicker,
          preview: scope.querySelector("[data-house-next-feed]"), hint: scope.querySelector("[data-house-feed-hint]"),
          onFeed: (feedId, quantity) => example.perform("feed", feedId, quantity) }));
        // Track the host subscription even if a malformed shell makes the view
        // constructor fail after binding it.
        const windowBindings = [];
        own({ dispose: () => { for (const [type, listener, options] of windowBindings) windowTarget.removeEventListener(type, listener, options); } });
        const houseWindow = { ...warningTimers, get scrollY() { return windowTarget.scrollY; },
          addEventListener: (type, listener, options) => { windowBindings.push([type, listener, options]); windowTarget.addEventListener(type, listener, options); },
          removeEventListener: (type, listener, options) => windowTarget.removeEventListener(type, listener, options) };
        const sheetHeights = own(new SheetHeightController({ windowTarget, uiSurface: surface, durationMs: HOUSE_CONFIG.ui.sheetCloseDurationMs }));
        view = own(composeHouseView({ documentRef: scope, rootNode: root, windowTarget: houseWindow, domFactory: dom, sheetHeights, uiSurface: surface, roomConfig: HOUSE_CONFIG.room, uiConfig: HOUSE_CONFIG.ui,
          fishView, feedPicker, timeBlendMs: CONFIG.liveBait.displayTickMs, labels: HOUSE_LABELS,
          resourceMeters: meters, autoSwitchRenderer: auto,
          sheetHandleRenderer: new UiSheetHandleRenderer({ domFactory: dom, dismissController: new SheetDismissController({ uiSurface: surface,
            dismissDistancePx: HOUSE_CONFIG.ui.sheetDismissDistancePx }) }),
          onReturn: () => { status.textContent = UI_CATALOG_LABELS.houseReturn; },
          perform: (action, fishId) => example.perform(action, fishId) }));
        example = new UiCatalogHouseExample({ view, fishView, feedPicker, frameScheduler: scheduler, documentScope: scope, roomConfig: HOUSE_CONFIG.room, timeDisplay, status,
          fullscreenControl, sceneDetachers, headerSizer, sheetHeights, gameTime, phaseControl, aquariumCapacities: CONFIG.liveBait.capacities,
          feedCalculator: new AquariumCareCalculator(CONFIG.liveBait), feedCatalog: CONFIG.liveBait.aquariumFeeds });
        return example;
      }
      if (id === "hud") {
        const scope = own(scopeFor(surface.mountRoot));
        scope.documentElement = { requestFullscreen: async () => { status.textContent = UI_CATALOG_LABELS.hudFullscreen; } };
        const scheduler = own(new UiCatalogFrameScheduler({ windowTarget }));
        const canvas = dom.element("canvas", "ui-catalog-preview__canvas"); canvas.width = 320; canvas.height = 280;
        canvas.setAttribute("role", "img"); surface.mountRoot.append(canvas);
        const context = canvas.getContext("2d");
        const hudBarRenderer = new HudBarRenderer(context);
        const statusBarsRenderer = new FightStatusBarsRenderer({ surface: context, hudBarRenderer,
          styleResolver: new HudStyleResolver({ hudStylesProvider: () => CONFIG.ui.hudStyles }) });
        const holdCharges = own(new HoldCharges({ labels: HUD_LABELS, documentRef: scope, mountNode: surface.mountRoot }));
        const toolbar = own(new GameToolbar({ documentRef: scope, mountNode: surface.mountRoot }));
        toolbar.dock.classList.add("ui-catalog-preview__toolbar-row");
        const depthSelector = own(composeDepthSelector({ documentRef: scope, mountNode: toolbar.depthMountNode,
          uiSurface: surface, itemDb: ITEM_DB, imageAssets: new ImageAssetProvider({ imageFactory: () => scope.createElement("img") }) }));
        const chumControls = own(new ChumControls(() => { status.textContent = UI_CATALOG_LABELS.hudChum; }, { labels: HUD_LABELS, documentRef: scope, mountNode: toolbar.element }));
        const clockConfig = { debug: { timeScale: 240, timeAccelerationEnabled: false } };
        const catalogClock = new GameTimeClock({ anchorHours: 12, anchorMs: 0, timeScale: 240, now: () => 0 });
        const timeDisplay = own(composeDevTimeDisplay({ documentRef: scope, mount: surface.mountRoot, clock: catalogClock, config: clockConfig, uiSurface: surface }));
        const gameControls = own(new GameControls(CONFIG, null, { labels: HUD_LABELS, documentRef: scope, mountNode: surface.mountRoot, frameScheduler: scheduler,
          landingNetArt: ITEM_DB.nets.net_basic.skin.thumbnail,
          toolbarMountNode: toolbar.element,
          netMountNode: toolbar.tackleMountNode,
          fullscreenControl: own(new FullscreenControl({ documentRef: scope, mountNode: surface.mountRoot, label: HUD_LABELS.fullscreen })) }));
        gameControls.onNetClick = () => { status.textContent = UI_CATALOG_LABELS.hudNet; };
        gameControls.onContinueClick = () => { status.textContent = UI_CATALOG_LABELS.hudContinue; };
        return new UiCatalogHudExample({ depthSelector, holdCharges, chumControls, timeDisplay, gameControls, toolbar, frameScheduler: scheduler, documentScope: scope, canvas, statusBarsRenderer, surface, status,
          setClockState: state => { clockConfig.debug.timeAccelerationEnabled = state === "time-speed"; catalogClock.setRateMultiplier(state === "time-speed" ? 1.5 : 1); } });
      }
      throw new Error(`Unregistered catalog example: ${id}`);
      } catch (error) {
        for (const resource of owned.reverse()) resource.dispose();
        surface.mountRoot.replaceChildren();
        throw error;
      }
    } });
  const dispose = () => { abort.abort(); page.dispose(); windowTarget.removeEventListener("pagehide", dispose); };
  windowTarget.addEventListener("pagehide", dispose, { once: true });
  void page.mount();
  return { dispose };
}
