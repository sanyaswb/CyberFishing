import { DepthSelector } from "../../platform/browser/ui/depth_selector.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";

// deferLoad(load): spec 157 R6, the icons of every float and bait warm up after the game is ready, not at startup.
// iconImages: an item's icon -> its art's asset id (spec 157 R16).
export function composeDepthSelector({ documentRef, mountNode, uiSurface, itemDb, imageAssets, deferLoad, assets }) {
  const iconImages = Object.fromEntries([...Object.values(itemDb.floats || {}), ...Object.values(itemDb.baits || {})]
    .filter(item => item.icon && item.iconAsset).map(item => [item.icon, item.iconAsset]));
  const domFactory = new InventoryDomFactory(documentRef, { assets });
  deferLoad(() => imageAssets.preload([...new Set(Object.values(iconImages))].map(id => ({ id, src: domFactory.assetUrl(id) })))
    .catch(error => new ConsoleLogger().warn("[DepthSelector] Artwork preload failed", error)));
  const selector = new DepthSelector({ documentRef, mountNode, uiSurface, labels: HUD_LABELS, domFactory, iconImages });
  selector.setIcon(itemDb.floats?.float_day?.icon || "");
  return selector;
}
