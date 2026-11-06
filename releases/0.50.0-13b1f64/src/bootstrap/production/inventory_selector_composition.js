import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventorySelectorController } from "../../platform/browser/dom/inventory_selector_controller.js";
import { InventorySelectorGeometry } from "../../game/presentation/inventory/inventory_selector_geometry.js";
import { InventorySelectorRenderer } from "../../game/presentation/inventory/inventory_selector_renderer.js";
import { INVENTORY_SELECTOR_CONFIG } from "../../game/presentation/inventory/inventory_selector_config.js";
import { INVENTORY_SELECTOR_LABELS } from "../../game/presentation/inventory/inventory_selector_labels.js";
import { INVENTORY_SECTIONS } from "../../game/presentation/inventory/inventory_sections.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";

// The control shown is what the configuration names, from the first frame (TK-194). The selector's artwork (backpack,
// first keepnet stage, rod thumbnail) is not part of startup (spec 157 R11): its sectors show the section sprite's
// symbols until loadArtwork() (after the game is ready) has loaded it, and keep them when the load fails.
// preloadArtwork(): settles when the asset load plan's "selector" group has loaded (rejects when it failed).
export function composeInventorySelector({ documentRef, windowRef, uiSurface, mountNode,
  inventoryUI, keepnetUI, config, requestArtwork, logger, equipmentSource = null,
  id = "inventory-selector-sections", onSelect = null, assets, preloadArtwork, progressive = null }) {
  const geometries = Object.fromEntries(Object.keys(INVENTORY_SELECTOR_CONFIG.layouts)
    .map(layout => [layout, new InventorySelectorGeometry(INVENTORY_SELECTOR_CONFIG, layout)]));
  const domFactory = new InventoryDomFactory(documentRef, { assets, progressive });
  const view = new InventorySelectorRenderer({ domFactory, geometries, sections: INVENTORY_SECTIONS,
    labels: INVENTORY_SELECTOR_LABELS, keepnetAsset: KEEPNET_ART_STAGES[0].imageAsset, id });
  const controller = new InventorySelectorController({ view, uiSurface, documentRef, windowRef,
    onSelect: onSelect || (sectionId => {
      inventoryUI.openSection(sectionId);
      inventoryUI.rootNode.tabIndex = -1;
      inventoryUI.rootNode.focus();
    }) });
  mountNode.appendChild(view.element);
  let disposed = false, radial = null, size = null, openSize = null, compactKey = null;
  const pick = (list, value) => list.includes(value) ? value : list[0];
  let artworkKey = "", artworkRevision = 0, artworkRequested = false, ready = null;
  const syncEquipment = () => {
    if (disposed || !artworkRequested) return;
    const rod = equipmentSource?.getEquipped()?.rod;
    const thumbnail = rod?.skin?.thumbnail ? { ...rod.skin.thumbnail } : { asset: rod?.iconAsset };
    const key = JSON.stringify([thumbnail.asset || "", thumbnail.visibleHeight, thumbnail.focusX, thumbnail.anchor]);
    if (key === artworkKey) return;
    artworkKey = key;
    const revision = ++artworkRevision;
    view.setEquipmentArtwork(null);
    if (!thumbnail.asset) return;
    Promise.resolve(requestArtwork([thumbnail.asset])).then((outcome) => {
      if (outcome?.status === "failed") throw outcome.error;
      if (!disposed && revision === artworkRevision) view.setEquipmentArtwork(thumbnail);
    }).catch(error => {
      if (!disposed && revision === artworkRevision) logger.warn("[InventorySelector] Rod artwork preload failed; retaining SVG", error);
    });
  };
  const sync = () => {
    if (disposed) return;
    const settings = config.ui?.inventorySelector;
    const nextRadial = settings?.radialEnabled === true;
    const nextSize = settings?.size ?? 1;
    const nextOpenSize = settings?.openSize ?? 3;
    // Compact toolbars: a corner selector puts the action column on the other side; a centred one follows the setting.
    const placement = pick(INVENTORY_SELECTOR_CONFIG.compactPlacements, settings?.compactPlacement);
    const actionsSide = placement === "right" ? "left" : placement === "left" ? "right"
      : pick(INVENTORY_SELECTOR_CONFIG.compactActionSides, settings?.compactActionsSide);
    const compactLayout = placement === "center" ? pick(INVENTORY_SELECTOR_CONFIG.compactLayouts, settings?.compactShape)
      : placement === "left" ? "corner-left" : "corner";
    const nextCompactKey = `${compactLayout} ${placement} ${actionsSide}`;
    if (radial === nextRadial && size === nextSize && openSize === nextOpenSize && compactKey === nextCompactKey) return;
    controller.cancel();
    view.setSizeScales(INVENTORY_SELECTOR_CONFIG.sizeScales[nextSize] || 1,
      INVENTORY_SELECTOR_CONFIG.sizeScales[nextOpenSize] || INVENTORY_SELECTOR_CONFIG.sizeScales[3]);
    view.setCompactLayout(compactLayout);
    view.setCompactPlacement(placement, actionsSide);
    controller.setEnabled(nextRadial);
    inventoryUI.setShortcutVisible(!nextRadial);
    keepnetUI?.setShortcutVisible(!nextRadial);
    radial = nextRadial; size = nextSize; openSize = nextOpenSize;
    compactKey = nextCompactKey;
  };
  const unsubscribe = inventoryUI.onVisibilityChange(open => { if (open) controller.cancel(); });
  const unsubscribeEquipment = equipmentSource?.onInventoryChanged(syncEquipment);
  syncEquipment();
  documentRef.addEventListener("config-updated", sync);
  sync();
  // Starts the artwork loads once; resolves true when the sectors can show their artwork, false after a failure.
  const loadArtwork = () => {
    if (ready) return ready;
    artworkRequested = true;
    syncEquipment();
    ready = new Promise((resolve) => resolve(preloadArtwork())).then(() => {
      if (!disposed) view.showSectionArtwork();
      return true;
    }).catch(error => {
      if (!disposed) logger.warn("[InventorySelector] Artwork preload failed; retaining sprite symbols", error);
      return false;
    });
    return ready;
  };
  return { view, controller, loadArtwork,
    dispose() {
      if (disposed) return;
      disposed = true;
      documentRef.removeEventListener("config-updated", sync);
      unsubscribe(); unsubscribeEquipment?.(); controller.dispose(); view.dispose();
      inventoryUI.setShortcutVisible(true); keepnetUI?.setShortcutVisible(true);
    } };
}
