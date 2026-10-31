import { DepthSelector } from "../../platform/browser/ui/depth_selector.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";

// deferLoad(load): spec 157 R6, the icons of every float and bait warm up after the game is ready, not at startup.
export function composeDepthSelector({ documentRef, mountNode, uiSurface, itemDb, imageAssets, deferLoad }) {
  const iconImages = Object.fromEntries([...Object.values(itemDb.floats || {}), ...Object.values(itemDb.baits || {})]
    .filter(item => item.icon && item.iconUrl).map(item => [item.icon, item.iconUrl]));
  deferLoad(() => imageAssets.preload([...new Set(Object.values(iconImages))].map(src => ({ id: src, src })))
    .catch(error => new ConsoleLogger().warn("[DepthSelector] Artwork preload failed", error)));
  const selector = new DepthSelector({ documentRef, mountNode, uiSurface, labels: HUD_LABELS,
    domFactory: new InventoryDomFactory(documentRef), iconImages });
  selector.setIcon(itemDb.floats?.float_day?.icon || "");
  return selector;
}
