import { DepthSelector } from "../../platform/browser/ui/depth_selector.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";

// iconImages: an item's icon -> its art's asset id (spec 157 R16). Spec 157 R6: the icons of every float and bait warm
// up after the game is ready, as the asset load plan's layer-two group "depth-icons" (source hud.depthIcons).
export function composeDepthSelector({ documentRef, mountNode, uiSurface, itemDb, assets }) {
  const iconImages = Object.fromEntries([...Object.values(itemDb.floats || {}), ...Object.values(itemDb.baits || {})]
    .filter(item => item.icon && item.iconAsset).map(item => [item.icon, item.iconAsset]));
  const domFactory = new InventoryDomFactory(documentRef, { assets });
  const selector = new DepthSelector({ documentRef, mountNode, uiSurface, labels: HUD_LABELS, domFactory, iconImages });
  selector.setIcon(itemDb.floats?.float_day?.icon || "");
  return selector;
}
