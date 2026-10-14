import { getBrowserStartupEnvironment } from "../../platform/browser/runtime/browser_startup_environment.js";
import { startFishermanHouse } from "../production/house_startup.js";
import { createProductionConfigContext } from "../production/game_config_composition.js";
import { CONFIG } from "../../game/config/runtime/game_config.js";
import { ITEM_DB } from "../../game/config/databases/item_catalog.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { FishRarityResolver } from "../../game/domain/fish/fish_rarity_resolver.js";
import { FishVisualVariantResolver } from "../../game/presentation/fish/fish_visual_variant_resolver.js";
import { HookedFishProfileSynchronizer } from "../../dev/fishing/hooked_fish_profile_synchronizer.js";
import { DevTools } from "../../dev/tools/dev_tools.js";
import { DevToolsUI } from "../../dev/tools/dev_tools_ui.js";
import { DevToolsParameterTooltipProvider } from "../../dev/tools/dev_tools_parameter_tooltip_provider.js";
import { LocalStorageCache } from "../../platform/browser/storage/local_storage_cache.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { EmbeddedPageOverlay } from "../../platform/browser/ui/embedded_page_overlay.js";
import { UI_CATALOG_LABELS } from "../../dev/ui_catalog/ui_catalog_definitions.js";
import { composeDevTimeDisplay } from "./dev_time_composition.js";

export async function startDevelopmentHouse() {
  const { documentTarget, windowTarget } = getBrowserStartupEnvironment();
  const abort = new windowTarget.AbortController();
  let house, catalog, control;
  let disposed = false;
  const notifyReady = () => {
    if (disposed || new windowTarget.URLSearchParams(windowTarget.location.search).get("embedded") !== "1" ||
      windowTarget.parent === windowTarget) return;
    try {
      if (windowTarget.parent.location.origin === windowTarget.location.origin) {
        windowTarget.parent.postMessage({ type: "cyber-fishing:dev-house-ready" }, windowTarget.location.origin);
      }
    } catch { /* Standalone/cross-origin pages do not share a DEV time control. */ }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; abort.abort();
    windowTarget.removeEventListener("pagehide", dispose);
    windowTarget.removeEventListener("load", notifyReady);
    catalog?.dispose(); house?.dispose();
  };
  windowTarget.addEventListener("pagehide", dispose, { once: true });
  try {
    // One authored House markup source, without running its production entry in this DEV realm.
    const response = await windowTarget.fetch("fisherman-house.html", { signal: abort.signal });
    if (!response.ok) throw new Error(`House template request failed: ${response.status}`);
    const template = new windowTarget.DOMParser().parseFromString(await response.text(), "text/html");
    if (disposed) return { dispose };
    const nodes = Array.from(template.body.children).filter(node => node.tagName !== "SCRIPT")
      .map(node => documentTarget.importNode(node, true));
    documentTarget.body.className = "house house--dev";
    documentTarget.body.replaceChildren(...nodes);
    documentTarget.title = template.title;
    const configRuntime = createProductionConfigContext();
    const cache = new LocalStorageCache({ storage: windowTarget.localStorage, logger: new ConsoleLogger() });
    const synchronizer = new HookedFishProfileSynchronizer({ fishRarityResolver: new FishRarityResolver(CONFIG.rarity),
      fishVisualVariantResolver: new FishVisualVariantResolver({ noneAnomalyIds: CONFIG.rarity?.fish?.noneAnomalyIds }) });
    catalog = new EmbeddedPageOverlay({ documentRef: documentTarget, windowTarget,
      src: "ui-catalog.html?embedded=1", title: UI_CATALOG_LABELS.pageTitle });
    house = startFishermanHouse({
      createTimeDisplay: options => { control = composeDevTimeDisplay({ ...options, config: CONFIG }); return control; },
      onPreviewData: data => {
        if (!data.debugTime) return;
        const snapshot = data.debugTime;
        configRuntime.set("debug.timeAccelerationEnabled", snapshot.enabled === true);
        if (Number.isFinite(snapshot.timeScale) && snapshot.timeScale > 0) configRuntime.set("debug.timeScale", snapshot.timeScale);
        control.resume(snapshot);
      },
      onReturnData: () => ({ debugTime: control.suspend() }),
      createDevTools: ({ uiSurface, returnToGame, toggleMountNode }) => new DevTools(CONFIG, synchronizer, {
        configRuntime, catalogs: { items: ITEM_DB, fishes: FISH_DB, maps: CONFIG.locations.map },
        storageCache: cache, settingsStore: null, debugModulesSource: () => ({}),
        openGame: returnToGame, openUiCatalog: () => catalog.open(),
        createUI: toggle => {
          const tooltipProvider = new DevToolsParameterTooltipProvider();
          return { tooltipProvider, ui: new DevToolsUI(toggle, CONFIG, tooltipProvider, cache, uiSurface, uiSurface.portalRoot, toggleMountNode) };
        },
      }),
    });
    notifyReady();
    if (documentTarget.readyState !== "complete") windowTarget.addEventListener("load", notifyReady, { once: true });
    return { dispose };
  } catch (error) { dispose(); if (error.name !== "AbortError") throw error; return { dispose }; }
}
