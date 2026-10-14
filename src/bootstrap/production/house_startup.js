import { getBrowserStartupEnvironment } from "../../platform/browser/runtime/browser_startup_environment.js";
import { BrowserWallClock } from "../../platform/browser/time/browser_wall_clock.js";
import { composeLiveBait } from "./live_bait_composition.js";
import { HousePresenter } from "../../game/presentation/house/house_presenter.js";
import { HouseView } from "../../game/presentation/house/house_view.js";
import { HOUSE_LABELS } from "../../game/presentation/house/house_labels.js";
import { CONFIG } from "../../game/config/runtime/game_config.js";
import { HOUSE_CONFIG } from "../../game/config/raw/house/house_config.js";
import { RoomUpgradeService } from "../../game/application/house/room_upgrade_service.js";
import { RoomProgressLocalStore } from "../../platform/browser/storage/room_progress_local_store.js";
import { composeGameTime } from "./game_time_composition.js";
import { TimeDisplay } from "../../platform/browser/ui/time_display.js";
import { EMBEDDED_PAGE_RETURN_MESSAGE } from "../../platform/browser/ui/embedded_page_overlay.js";
import { AquariumFishMotion } from "../../game/presentation/house/aquarium_fish_motion.js";
import { AquariumFishView } from "../../game/presentation/house/aquarium_fish_view.js";
import { AquariumFeedPicker } from "../../game/presentation/house/aquarium_feed_picker.js";
import { UiSurfaceAdapter } from "../../platform/browser/dom/ui_surface_adapter.js";
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

export function startFishermanHouse({ createTimeDisplay = null, createDevTools = null, onPreviewData = null, onReturnData = null } = {}) {
  const { documentTarget, windowTarget } = getBrowserStartupEnvironment();
  const originalNodes = Array.from(documentTarget.body.children).filter(node => node.tagName !== "SCRIPT");
  const uiSurface = new UiSurfaceAdapter({ hostElement: documentTarget.body,
    documentRef: documentTarget, windowRef: windowTarget, viewport: true });
  for (const node of originalNodes) uiSurface.mountRoot.appendChild(node);
  const domFactory = new InventoryDomFactory(documentTarget);
  const resourceMeters = new InventoryResourceMeterRenderer({ domFactory,
    degradationColorResolver: new DegradationColorResolver({ configProvider: () => CONFIG.degradationColors }) });
  const navigation = new windowTarget.URLSearchParams(windowTarget.location.search);
  const requestedReturn = navigation.get("returnTo");
  const returnTo = requestedReturn === "dev.html" ? "dev.html" : "index.html";
  let hostWindow = null;
  if (navigation.get("embedded") === "1" && windowTarget.parent !== windowTarget) {
    try {
      if (windowTarget.parent.location.origin === windowTarget.location.origin) hostWindow = windowTarget.parent;
    } catch { /* A cross-origin parent cannot host the house overlay. */ }
  }
  const fullscreenDocument = hostWindow?.document ?? documentTarget;
  const clock = new BrowserWallClock();
  const liveBait = composeLiveBait({ storage: windowTarget.localStorage, clock });
  const room = new RoomUpgradeService({ config: HOUSE_CONFIG.room,
    store: new RoomProgressLocalStore(windowTarget.localStorage), now: () => clock.nowMs() });
  const gameTime = composeGameTime({ storage: windowTarget.localStorage, now: () => clock.nowMs(),
    initialHours: CONFIG.debug?.initialTime, timeScale: CONFIG.debug?.timeScale || 1 });
  const timeOptions = { documentRef: documentTarget, mount: documentTarget.querySelector("[data-house-time-mount]"), clock: gameTime, uiSurface };
  const timeDisplay = createTimeDisplay ? createTimeDisplay(timeOptions) : new TimeDisplay(timeOptions);
  let view;
  if (createDevTools) documentTarget.querySelector("[data-house-header-row]").classList.add("house__header-row--with-leading-control");
  const headerSizer = new HudRowSizer({ row: documentTarget.querySelector("[data-house-header-row]"), uiSurface, windowTarget });
  const sceneScroll = new HorizontalScrollController({ uiSurface, manualTouch: true,
    className: "house-interior-scroll", dragClassName: "house-interior-scroll--dragging", dragThresholdPx: CONFIG.input.pointerThreshold,
    getPanConfig: () => CONFIG.input.mapPan, onVerticalGesture: delta => view.handleSceneGesture(delta),
    wheelGestureGapMs: HOUSE_CONFIG.ui.sceneWheelGestureGapMs });
  const sceneDetachers = [...documentTarget.querySelectorAll(".house__scene")].map(scene => {
    scene.scrollLeft = Math.max(0, (scene.scrollWidth - scene.clientWidth) / 2);
    return sceneScroll.attach(scene);
  });
  sceneDetachers.push(sceneScroll.attach(documentTarget.querySelector("[data-house-scrim]")));
  for (const button of documentTarget.querySelectorAll("[data-house-panel-button]")) sceneDetachers.push(sceneScroll.attach(button));
  const fishView = new AquariumFishView({ canvas: documentTarget.querySelector("[data-house-aquarium-fish]"),
    windowTarget, motion: new AquariumFishMotion({ config: CONFIG.liveBait.visual, rng: { next: () => Math.random() } }),
    createImage: () => new windowTarget.Image(),
    observeResize: (canvas, callback) => {
      const observer = new windowTarget.ResizeObserver(callback); observer.observe(canvas); return observer;
    } });
  const onPreview = (event) => {
    if (hostWindow && event.source === hostWindow && event.origin === windowTarget.location.origin &&
      event.data?.type === "cyber-fishing:dev-house-handoff") onPreviewData?.(event.data);
  };
  windowTarget.addEventListener("message", onPreview);
  // Runtime config edits (DEV tools in practice) arrive as "config-updated" events on the document. The motion keeps
  // its previous settings when an edited value is invalid.
  const onConfigUpdated = (event) => {
    const path = event.detail?.path;
    if (Array.isArray(path) && path[0] === "CONFIG" && AQUARIUM_VISUAL_PATH.every((key, index) => path.length <= index + 1 || path[index + 1] === key))
      fishView.setConfig(CONFIG.liveBait.visual);
  };
  documentTarget.addEventListener("config-updated", onConfigUpdated);
  let presenter;
  const feedPicker = new AquariumFeedPicker({ documentRef: documentTarget,
    button: documentTarget.querySelector("[data-house-feed-toggle]"), list: documentTarget.querySelector("[data-house-feed-list]"),
    preview: documentTarget.querySelector("[data-house-next-feed]"), hint: documentTarget.querySelector("[data-house-feed-hint]"),
    labels: HOUSE_LABELS.feedPicker, onFeed: (id, quantity) => presenter.perform("feed", id, quantity) });
  const returnToGame = () => {
    const data = onReturnData?.() || {};
    if (hostWindow) hostWindow.postMessage({ ...data, type: EMBEDDED_PAGE_RETURN_MESSAGE }, windowTarget.location.origin);
    else windowTarget.location.assign(returnTo);
  };
  const sheetHeights = new SheetHeightController({ windowTarget, uiSurface, durationMs: HOUSE_CONFIG.ui.sheetCloseDurationMs });
  view = new HouseView({ documentRef: documentTarget, windowTarget, sheetHeights,
    resourceMeters, sheetHandleRenderer: new UiSheetHandleRenderer({ domFactory,
      dismissController: new SheetDismissController({ uiSurface, dismissDistancePx: HOUSE_CONFIG.ui.sheetDismissDistancePx }) }),
    sheetDismissLabel: HOUSE_LABELS.sheetDismiss,
    menuHandleLabel: HOUSE_LABELS.menuHandle,
    autoSwitchRenderer: new UiAutoSwitchRenderer({ domFactory }),
    roomConfig: HOUSE_CONFIG.room, uiConfig: HOUSE_CONFIG.ui,
    returnTo, fishView, feedPicker, timeBlendMs: CONFIG.liveBait.displayTickMs, labels: HOUSE_LABELS,
    onReturn: hostWindow || onReturnData ? returnToGame : null,
    perform: (action, id) => presenter.perform(action, id) });
  const fullscreen = new FullscreenControl({ documentRef: documentTarget, fullscreenDocument,
    mountNode: documentTarget.querySelector("[data-house-fullscreen-mount]"), label: HUD_LABELS.fullscreen,
    onError: () => view.announce(HOUSE_LABELS.fullscreenFailed, true) });
  presenter = new HousePresenter({ liveBait, room, gameTime, view, labels: HOUSE_LABELS });
  const refresh = () => { presenter.refresh(); timeDisplay.update(gameTime.getHours()); };
  refresh();
  const careTimer = windowTarget.setInterval(() => { liveBait.advance(); refresh(); }, CONFIG.liveBait.careTickMs);
  const displayTimer = windowTarget.setInterval(() => { gameTime.sync(); refresh(); }, CONFIG.liveBait.displayTickMs);
  const onFocus = () => { gameTime.sync(); liveBait.advance(); refresh(); };
  windowTarget.addEventListener("focus", onFocus);
  const devTools = createDevTools?.({ uiSurface, returnToGame, toggleMountNode: documentTarget.querySelector("[data-house-dev-mount]") });
  return { dispose() { windowTarget.clearInterval(careTimer); windowTarget.clearInterval(displayTimer);
    windowTarget.removeEventListener("focus", onFocus); windowTarget.removeEventListener("message", onPreview);
    documentTarget.removeEventListener("config-updated", onConfigUpdated);
    devTools?.dispose(); headerSizer.dispose(); fullscreen.dispose();
    for (const detach of sceneDetachers) detach();
    feedPicker.dispose(); fishView.dispose(); timeDisplay.dispose(); view.dispose(); sheetHeights.dispose();
    for (const node of originalNodes) documentTarget.body.appendChild(node);
    uiSurface.dispose(); } };
}
