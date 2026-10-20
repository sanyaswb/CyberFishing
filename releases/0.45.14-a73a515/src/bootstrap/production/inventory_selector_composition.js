import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventorySelectorController } from "../../platform/browser/dom/inventory_selector_controller.js";
import { InventorySelectorGeometry } from "../../game/presentation/inventory/inventory_selector_geometry.js";
import { InventorySelectorRenderer } from "../../game/presentation/inventory/inventory_selector_renderer.js";
import { INVENTORY_SELECTOR_CONFIG } from "../../game/presentation/inventory/inventory_selector_config.js";
import { INVENTORY_SELECTOR_LABELS } from "../../game/presentation/inventory/inventory_selector_labels.js";
import { INVENTORY_SECTIONS } from "../../game/presentation/inventory/inventory_sections.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";

export function composeInventorySelector({ documentRef, windowRef, uiSurface, mountNode,
  inventoryUI, keepnetUI, config, imageAssets, logger, id = "inventory-selector-sections", onSelect = null }) {
  const view = new InventorySelectorRenderer({ domFactory: new InventoryDomFactory(documentRef),
    geometry: new InventorySelectorGeometry(INVENTORY_SELECTOR_CONFIG), sections: INVENTORY_SECTIONS,
    labels: INVENTORY_SELECTOR_LABELS, keepnetImage: KEEPNET_ART_STAGES[0].imagePath, id });
  const controller = new InventorySelectorController({ view, uiSurface, documentRef, windowRef,
    onSelect: onSelect || (sectionId => {
      inventoryUI.openSection(sectionId);
      inventoryUI.rootNode.tabIndex = -1;
      inventoryUI.rootNode.focus();
    }) });
  mountNode.appendChild(view.element);
  let disposed = false, loaded = false, radial = null, size = null, openSize = null;
  const sync = () => {
    if (disposed) return;
    const settings = config.ui?.inventorySelector;
    const nextRadial = loaded && settings?.radialEnabled === true;
    const nextSize = settings?.size ?? 1;
    const nextOpenSize = settings?.openSize ?? 3;
    if (radial === nextRadial && size === nextSize && openSize === nextOpenSize) return;
    controller.cancel();
    view.setSizeScales(INVENTORY_SELECTOR_CONFIG.sizeScales[nextSize] || 1,
      INVENTORY_SELECTOR_CONFIG.sizeScales[nextOpenSize] || INVENTORY_SELECTOR_CONFIG.sizeScales[3]);
    controller.setEnabled(nextRadial);
    inventoryUI.setShortcutVisible(!nextRadial);
    keepnetUI?.setShortcutVisible(!nextRadial);
    radial = nextRadial; size = nextSize; openSize = nextOpenSize;
  };
  const unsubscribe = inventoryUI.onVisibilityChange(open => { if (open) controller.cancel(); });
  documentRef.addEventListener("config-updated", sync);
  sync();
  const sources = [INVENTORY_SECTIONS.iconSprite, INVENTORY_SECTIONS.backpackImage, KEEPNET_ART_STAGES[0].imagePath];
  const ready = imageAssets.preload(sources.map(src => ({ id: src, src }))).then(() => {
    loaded = true; sync(); return true;
  }).catch(error => { logger.warn("[InventorySelector] Artwork preload failed; retaining classic controls", error); return false; });
  return { view, controller, ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      documentRef.removeEventListener("config-updated", sync);
      unsubscribe(); controller.dispose(); view.dispose();
      inventoryUI.setShortcutVisible(true); keepnetUI?.setShortcutVisible(true);
    } };
}
