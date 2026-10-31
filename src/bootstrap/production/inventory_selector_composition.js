import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventorySelectorController } from "../../platform/browser/dom/inventory_selector_controller.js";
import { InventorySelectorGeometry } from "../../game/presentation/inventory/inventory_selector_geometry.js";
import { InventorySelectorRenderer } from "../../game/presentation/inventory/inventory_selector_renderer.js";
import { INVENTORY_SELECTOR_CONFIG } from "../../game/presentation/inventory/inventory_selector_config.js";
import { INVENTORY_SELECTOR_LABELS } from "../../game/presentation/inventory/inventory_selector_labels.js";
import { INVENTORY_SECTIONS } from "../../game/presentation/inventory/inventory_sections.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";

// Spec 157 R11 (owner, 2026-10-30): the selector's artwork (section sprite, backpack, first keepnet stage, rod
// thumbnail) is not part of startup. Until loadArtwork() is called (after the game is ready) and the artwork has
// loaded, the classic inventory and keepnet buttons stand in for the radial selector; a failed load keeps them.
export function composeInventorySelector({ documentRef, windowRef, uiSurface, mountNode,
  inventoryUI, keepnetUI, config, imageAssets, logger, equipmentSource = null,
  id = "inventory-selector-sections", onSelect = null, assets }) {
  const geometries = Object.fromEntries(Object.keys(INVENTORY_SELECTOR_CONFIG.layouts)
    .map(layout => [layout, new InventorySelectorGeometry(INVENTORY_SELECTOR_CONFIG, layout)]));
  const domFactory = new InventoryDomFactory(documentRef, { assets });
  const view = new InventorySelectorRenderer({ domFactory, geometries, sections: INVENTORY_SECTIONS,
    labels: INVENTORY_SELECTOR_LABELS, keepnetAsset: KEEPNET_ART_STAGES[0].imageAsset, id });
  const controller = new InventorySelectorController({ view, uiSurface, documentRef, windowRef,
    onSelect: onSelect || (sectionId => {
      inventoryUI.openSection(sectionId);
      inventoryUI.rootNode.tabIndex = -1;
      inventoryUI.rootNode.focus();
    }) });
  mountNode.appendChild(view.element);
  let disposed = false, loadState = "pending", radial = null, classicVisible = null, size = null, openSize = null, compactKey = null;
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
    imageAssets.preload([{ id: thumbnail.asset, src: domFactory.assetUrl(thumbnail.asset) }]).then(() => {
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
    // Until the artwork is ready the classic buttons stand in (spec 157 R11), and they stay after a failure.
    const nextClassicVisible = !requestedRadial || loadState !== "ready";
    const nextSize = settings?.size ?? 1;
    const nextOpenSize = settings?.openSize ?? 3;
    // Compact toolbars: a corner selector puts the action column on the other side; a centred one follows the setting.
    const placement = pick(INVENTORY_SELECTOR_CONFIG.compactPlacements, settings?.compactPlacement);
    const actionsSide = placement === "right" ? "left" : placement === "left" ? "right"
      : pick(INVENTORY_SELECTOR_CONFIG.compactActionSides, settings?.compactActionsSide);
    const compactLayout = placement === "center" ? pick(INVENTORY_SELECTOR_CONFIG.compactLayouts, settings?.compactShape)
      : placement === "left" ? "corner-left" : "corner";
    const nextCompactKey = `${compactLayout} ${placement} ${actionsSide}`;
    if (radial === nextRadial && classicVisible === nextClassicVisible && size === nextSize && openSize === nextOpenSize
      && compactKey === nextCompactKey) return;
    controller.cancel();
    view.setSizeScales(INVENTORY_SELECTOR_CONFIG.sizeScales[nextSize] || 1,
      INVENTORY_SELECTOR_CONFIG.sizeScales[nextOpenSize] || INVENTORY_SELECTOR_CONFIG.sizeScales[3]);
    view.setCompactLayout(compactLayout);
    view.setCompactPlacement(placement, actionsSide);
    controller.setEnabled(nextRadial);
    inventoryUI.setShortcutVisible(nextClassicVisible);
    keepnetUI?.setShortcutVisible(nextClassicVisible);
    radial = nextRadial; classicVisible = nextClassicVisible; size = nextSize; openSize = nextOpenSize;
    compactKey = nextCompactKey;
  };
  const unsubscribe = inventoryUI.onVisibilityChange(open => { if (open) controller.cancel(); });
  const unsubscribeEquipment = equipmentSource?.onInventoryChanged(syncEquipment);
  syncEquipment();
  documentRef.addEventListener("config-updated", sync);
  sync();
  const sources = [INVENTORY_SECTIONS.iconSpriteAsset, INVENTORY_SECTIONS.backpackAsset, KEEPNET_ART_STAGES[0].imageAsset];
  // Starts the artwork loads once; resolves true when the radial selector can show, false after a failure.
  const loadArtwork = () => {
    if (ready) return ready;
    artworkRequested = true;
    syncEquipment();
    ready = imageAssets.preload(sources.map(id => ({ id, src: domFactory.assetUrl(id) }))).then(() => {
      if (!disposed) { loadState = "ready"; sync(); }
      return true;
    }).catch(error => {
      if (!disposed) {
        loadState = "failed"; sync();
        logger.warn("[InventorySelector] Artwork preload failed; retaining classic controls", error);
      }
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
