import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventorySelectorController } from "../../platform/browser/dom/inventory_selector_controller.js";
import { InventorySelectorGeometry } from "../../game/presentation/inventory/inventory_selector_geometry.js";
import { InventorySelectorRenderer } from "../../game/presentation/inventory/inventory_selector_renderer.js";
import { INVENTORY_SELECTOR_CONFIG } from "../../game/presentation/inventory/inventory_selector_config.js";
import { INVENTORY_SELECTOR_LABELS } from "../../game/presentation/inventory/inventory_selector_labels.js";
import { INVENTORY_SECTIONS } from "../../game/presentation/inventory/inventory_sections.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";

export function composeInventorySelector({ documentRef, windowRef, uiSurface, mountNode,
  inventoryUI, keepnetUI, config, imageAssets, logger, equipmentSource = null,
  id = "inventory-selector-sections", onSelect = null }) {
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
  let disposed = false, loadState = "pending", radial = null, classicVisible = null, size = null, openSize = null;
  let artworkKey = "", artworkRevision = 0;
  const syncEquipment = () => {
    if (disposed) return;
    const rod = equipmentSource?.getEquipped()?.rod;
    const thumbnail = rod?.skin?.thumbnail ? { ...rod.skin.thumbnail }
      : { src: rod?.iconUrl || rod?.imageUrl || rod?.src };
    const key = JSON.stringify([thumbnail.src || "", thumbnail.visibleHeight, thumbnail.focusX, thumbnail.anchor]);
    if (key === artworkKey) return;
    artworkKey = key;
    const revision = ++artworkRevision;
    view.setEquipmentArtwork(null);
    if (!thumbnail.src) return;
    imageAssets.preload([{ id: thumbnail.src, src: thumbnail.src }]).then(() => {
      if (!disposed && revision === artworkRevision) view.setEquipmentArtwork(thumbnail);
    }).catch(error => {
      if (!disposed && revision === artworkRevision) logger.warn("[InventorySelector] Rod artwork preload failed; retaining SVG", error);
    });
  };
  const sync = () => {
    if (disposed) return;
    const settings = config.ui?.inventorySelector;
    const requestedRadial = settings?.radialEnabled === true;
    const nextRadial = loadState === "ready" && requestedRadial;
    // Pending artwork is not a request for classic mode. Only a real failure needs that fallback.
    const nextClassicVisible = !requestedRadial || loadState === "failed";
    const nextSize = settings?.size ?? 1;
    const nextOpenSize = settings?.openSize ?? 3;
    if (radial === nextRadial && classicVisible === nextClassicVisible && size === nextSize && openSize === nextOpenSize) return;
    controller.cancel();
    view.setSizeScales(INVENTORY_SELECTOR_CONFIG.sizeScales[nextSize] || 1,
      INVENTORY_SELECTOR_CONFIG.sizeScales[nextOpenSize] || INVENTORY_SELECTOR_CONFIG.sizeScales[3]);
    controller.setEnabled(nextRadial);
    inventoryUI.setShortcutVisible(nextClassicVisible);
    keepnetUI?.setShortcutVisible(nextClassicVisible);
    radial = nextRadial; classicVisible = nextClassicVisible; size = nextSize; openSize = nextOpenSize;
  };
  const unsubscribe = inventoryUI.onVisibilityChange(open => { if (open) controller.cancel(); });
  const unsubscribeEquipment = equipmentSource?.onInventoryChanged(syncEquipment);
  syncEquipment();
  documentRef.addEventListener("config-updated", sync);
  sync();
  const sources = [INVENTORY_SECTIONS.iconSprite, INVENTORY_SECTIONS.backpackImage, KEEPNET_ART_STAGES[0].imagePath];
  const ready = imageAssets.preload(sources.map(src => ({ id: src, src }))).then(() => {
    loadState = "ready"; sync(); return true;
  }).catch(error => {
    loadState = "failed"; sync();
    if (!disposed) logger.warn("[InventorySelector] Artwork preload failed; retaining classic controls", error);
    return false;
  });
  return { view, controller, ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      documentRef.removeEventListener("config-updated", sync);
      unsubscribe(); unsubscribeEquipment?.(); controller.dispose(); view.dispose();
      inventoryUI.setShortcutVisible(true); keepnetUI?.setShortcutVisible(true);
    } };
}
