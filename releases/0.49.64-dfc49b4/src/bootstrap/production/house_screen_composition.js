import { BrowserWallClock } from "../../platform/browser/time/browser_wall_clock.js";
import { HousePresenter } from "../../game/presentation/house/house_presenter.js";
import { composeHouseView } from "./house_view_composition.js";
import { HOUSE_LABELS } from "../../game/presentation/house/house_labels.js";
import { HOUSE_SCREEN_MARKUP } from "../../game/presentation/house/house_screen_markup.js";
import { bindAssetHrefs } from "../../game/presentation/ui/asset_href_binder.js";
import { CONFIG } from "../../game/config/runtime/game_config.js";
import { HOUSE_CONFIG } from "../../game/config/raw/house/house_config.js";
import { RoomUpgradeService } from "../../game/application/house/room_upgrade_service.js";
import { RoomProgressLocalStore } from "../../platform/browser/storage/room_progress_local_store.js";
import { composeTimeDisplay } from "./time_display_composition.js";
import { GameMinuteTicker } from "../../platform/browser/time/game_minute_ticker.js";
import { AquariumFishMotion } from "../../game/presentation/house/aquarium_fish_motion.js";
import { AquariumFishView } from "../../game/presentation/house/aquarium_fish_view.js";
import { AQUARIUM_FISH_VIEW_STYLE } from "../../game/presentation/house/aquarium_fish_view_style.js";
import { isUsableAquariumVisual } from "../../game/config/validation/aquarium_visual_issues.js";
import { AquariumFeedPicker } from "../../game/presentation/house/aquarium_feed_picker.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventoryResourceMeterRenderer } from "../../game/presentation/inventory/inventory_resource_meter_renderer.js";
import { DegradationColorResolver } from "../../game/presentation/styles/degradation_color_resolver.js";
import { UiAutoSwitchRenderer } from "../../game/presentation/ui/ui_auto_switch_renderer.js";
import { UiSheetHandleRenderer } from "../../game/presentation/ui/ui_sheet_handle_renderer.js";
import { SheetDismissController } from "../../platform/browser/dom/sheet_dismiss_controller.js";
import { SheetHeightController } from "../../platform/browser/dom/sheet_height_controller.js";
import { HudRowSizer } from "../../platform/browser/dom/hud_row_sizer.js";
import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { FullscreenControl } from "../../platform/browser/ui/fullscreen_control.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";

const AQUARIUM_VISUAL_PATH = Object.freeze(["liveBait", "visual"]);

// The House screen (spec 084) inside the game page: a `.house` root in the page's UI surface, composed over the
// session's live bait service, game clock and asset registry (GameCompositionRoot.getSessionServices). It owns its timers, listeners
// and DOM until dispose. `onExit` is the return control; `createTimeDisplay` and `mountHeaderControl` are DEV ports.
export function composeHouseScreen({ documentTarget, windowTarget, uiSurface, liveBait, gameTime, assets, fishArt, onExit,
  createTimeDisplay = null, mountHeaderControl = null }) {
  const root = documentTarget.createElement("div");
  root.className = "house";
  root.innerHTML = HOUSE_SCREEN_MARKUP;
  bindAssetHrefs(root, assets);
  uiSurface.mountRoot.appendChild(root);
  const node = (selector) => root.querySelector(selector);
  const domFactory = new InventoryDomFactory(documentTarget, { assets });
  const resourceMeters = new InventoryResourceMeterRenderer({ domFactory,
    degradationColorResolver: new DegradationColorResolver({ configProvider: () => CONFIG.degradationColors }) });
  const clock = new BrowserWallClock();
  const room = new RoomUpgradeService({ config: HOUSE_CONFIG.room,
    store: new RoomProgressLocalStore(windowTarget.localStorage), now: () => clock.nowMs() });
  const timeOptions = { documentRef: documentTarget, mount: node("[data-house-time-mount]"), clock: gameTime, uiSurface };
  const timeDisplay = createTimeDisplay ? createTimeDisplay(timeOptions) : composeTimeDisplay(timeOptions);
  const headerRow = node("[data-house-header-row]");
  const removeHeaderControl = mountHeaderControl?.(node("[data-house-dev-mount]")) ?? null;
  if (removeHeaderControl) headerRow.classList.add("house__header-row--with-leading-control");
  const headerSizer = new HudRowSizer({ row: headerRow, uiSurface, windowTarget });
  let view;
  const sceneScroll = new HorizontalScrollController({ uiSurface, manualTouch: true,
    className: "house-interior-scroll", dragClassName: "house-interior-scroll--dragging", dragThresholdPx: CONFIG.input.pointerThreshold,
    getPanConfig: () => CONFIG.input.mapPan, onVerticalGesture: delta => view.handleSceneGesture(delta),
    wheelGestureGapMs: HOUSE_CONFIG.ui.sceneWheelGestureGapMs });
  const sceneDetachers = [...root.querySelectorAll(".house__scene")].map(scene => {
    scene.scrollLeft = Math.max(0, (scene.scrollWidth - scene.clientWidth) / 2);
    return sceneScroll.attach(scene);
  });
  sceneDetachers.push(sceneScroll.attach(node("[data-house-scrim]")));
  for (const button of root.querySelectorAll("[data-house-panel-button]")) sceneDetachers.push(sceneScroll.attach(button));
  const fishView = new AquariumFishView({ canvas: node("[data-house-aquarium-fish]"), fishArt,
    windowTarget, motion: new AquariumFishMotion({ config: CONFIG.liveBait.visual, rng: { next: () => Math.random() }, isValidConfig: isUsableAquariumVisual }),
    style: AQUARIUM_FISH_VIEW_STYLE,
    createImage: () => new windowTarget.Image(),
    observeResize: (canvas, callback) => {
      const observer = new windowTarget.ResizeObserver(callback); observer.observe(canvas); return observer;
    } });
  // Runtime config edits (DEV tools in practice) arrive as "config-updated" events on the document. The motion keeps
  // its previous settings when an edited value is invalid.
  const onConfigUpdated = (event) => {
    const path = event.detail?.path;
    if (Array.isArray(path) && path[0] === "CONFIG" && AQUARIUM_VISUAL_PATH.every((key, index) => path.length <= index + 1 || path[index + 1] === key))
      fishView.setConfig(CONFIG.liveBait.visual);
  };
  documentTarget.addEventListener("config-updated", onConfigUpdated);
  let presenter;
  const feedPicker = new AquariumFeedPicker({ documentRef: documentTarget, assets,
    button: node("[data-house-feed-toggle]"), list: node("[data-house-feed-list]"),
    preview: node("[data-house-next-feed]"), hint: node("[data-house-feed-hint]"),
    labels: HOUSE_LABELS.feedPicker, onFeed: (id, quantity) => presenter.perform("feed", id, quantity) });
  const sheetHeights = new SheetHeightController({ windowTarget, uiSurface, durationMs: HOUSE_CONFIG.ui.sheetCloseDurationMs });
  view = composeHouseView({ documentRef: documentTarget, rootNode: root, windowTarget, domFactory, sheetHeights, uiSurface, assets,
    resourceMeters, sheetHandleRenderer: new UiSheetHandleRenderer({ domFactory,
      dismissController: new SheetDismissController({ uiSurface, dismissDistancePx: HOUSE_CONFIG.ui.sheetDismissDistancePx }) }),
    autoSwitchRenderer: new UiAutoSwitchRenderer({ domFactory }),
    roomConfig: HOUSE_CONFIG.room, uiConfig: HOUSE_CONFIG.ui,
    fishView, feedPicker, timeBlendMs: CONFIG.liveBait.displayTickMs, labels: HOUSE_LABELS,
    onReturn: onExit, perform: (action, id) => presenter.perform(action, id) });
  const fullscreen = new FullscreenControl({ documentRef: documentTarget, fullscreenDocument: documentTarget,
    mountNode: node("[data-house-fullscreen-mount]"), label: HUD_LABELS.fullscreen,
    onError: () => view.announce(HOUSE_LABELS.fullscreenFailed, true) });
  presenter = new HousePresenter({ liveBait, room, gameTime, view, labels: HOUSE_LABELS });
  const refresh = () => { presenter.refresh(); timeDisplay.update(gameTime.getHours()); };
  refresh();
  // The game loop is suspended while the House is open, so the House advances live bait care itself.
  const careTimer = windowTarget.setInterval(() => { liveBait.advance(); refresh(); }, CONFIG.liveBait.careTickMs);
  const displayTimer = windowTarget.setInterval(refresh, CONFIG.liveBait.displayTickMs);
  // The clock follows every game minute (spec 081); the view refresh above keeps its own interval.
  const minuteTicker = new GameMinuteTicker({ windowTarget, clock: gameTime, maxDelayMs: CONFIG.liveBait.displayTickMs,
    onTick: () => timeDisplay.update(gameTime.getHours()) });
  minuteTicker.start();
  const onFocus = () => { liveBait.advance(); refresh(); minuteTicker.restart(); };
  windowTarget.addEventListener("focus", onFocus);
  let disposed = false;
  return { dispose() {
    if (disposed) return;
    disposed = true;
    windowTarget.clearInterval(careTimer); windowTarget.clearInterval(displayTimer);
    minuteTicker.dispose();
    windowTarget.removeEventListener("focus", onFocus);
    documentTarget.removeEventListener("config-updated", onConfigUpdated);
    headerSizer.dispose(); fullscreen.dispose(); removeHeaderControl?.();
    for (const detach of sceneDetachers) detach();
    feedPicker.dispose(); fishView.dispose(); timeDisplay.dispose(); view.dispose(); sheetHeights.dispose();
    root.remove();
  } };
}
