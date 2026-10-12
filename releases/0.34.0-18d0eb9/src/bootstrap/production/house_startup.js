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

export function startFishermanHouse() {
  const { documentTarget, windowTarget } = getBrowserStartupEnvironment();
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
  const timeDisplay = new TimeDisplay({ documentRef: documentTarget,
    mount: documentTarget.querySelector("[data-house-time-mount]") });
  const fishView = new AquariumFishView({ canvas: documentTarget.querySelector("[data-house-aquarium-fish]"),
    windowTarget, motion: new AquariumFishMotion({ config: CONFIG.liveBait.visual, rng: { next: () => Math.random() } }),
    createImage: () => new windowTarget.Image(),
    observeResize: (canvas, callback) => {
      const observer = new windowTarget.ResizeObserver(callback); observer.observe(canvas); return observer;
    } });
  const onPreview = (event) => {
    if (hostWindow && event.source === hostWindow && event.origin === windowTarget.location.origin &&
      event.data?.type === "cyber-fishing:aquarium-preview") fishView.setConfig(event.data.visual);
  };
  windowTarget.addEventListener("message", onPreview);
  let presenter;
  const view = new HouseView({ documentRef: documentTarget, windowTarget,
    roomConfig: HOUSE_CONFIG.room, uiConfig: HOUSE_CONFIG.ui, aquariumCapacities: CONFIG.liveBait.capacities,
    returnTo, fullscreenDocument, fishView,
    onReturn: hostWindow ? () => hostWindow.postMessage({ type: EMBEDDED_PAGE_RETURN_MESSAGE }, windowTarget.location.origin) : null,
    toggleFullscreen: () => fullscreenDocument.fullscreenElement
      ? fullscreenDocument.exitFullscreen() : fullscreenDocument.documentElement.requestFullscreen(),
    perform: (action, id) => presenter.perform(action, id) });
  presenter = new HousePresenter({ liveBait, room, gameTime, view, labels: HOUSE_LABELS, now: () => clock.nowMs() });
  const refresh = () => { presenter.refresh(); timeDisplay.update(gameTime.getHours()); };
  refresh();
  const careTimer = windowTarget.setInterval(() => { liveBait.advance(); refresh(); }, CONFIG.liveBait.careTickMs);
  const displayTimer = windowTarget.setInterval(() => { gameTime.sync(); refresh(); }, CONFIG.liveBait.displayTickMs);
  const onFocus = () => { gameTime.sync(); liveBait.advance(); refresh(); };
  windowTarget.addEventListener("focus", onFocus);
  return { dispose() { windowTarget.clearInterval(careTimer); windowTarget.clearInterval(displayTimer);
    windowTarget.removeEventListener("focus", onFocus); windowTarget.removeEventListener("message", onPreview);
    fishView.dispose(); timeDisplay.dispose(); view.dispose(); } };
}
