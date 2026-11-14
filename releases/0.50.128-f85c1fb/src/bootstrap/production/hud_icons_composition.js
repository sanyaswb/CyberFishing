import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { createInventoryIcon } from "../../game/presentation/inventory/inventory_icons.js";

// The HUD controls' icon port (TK-197): create(symbol, className) makes a symbol of the shared sprite (spec 158).
export function composeHudIcons({ documentRef, assets }) {
  const domFactory = new InventoryDomFactory(documentRef, { assets });
  return { create: (symbol, className) => createInventoryIcon(domFactory, symbol, className) };
}
