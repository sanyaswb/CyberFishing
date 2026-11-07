// Item and filter icons are symbols of the sections sprite: `icon` in the item catalog and the filter lists names one.
const SPRITE_ASSET = "ui.inventory-sections";
const FALLBACK_SYMBOL = "item";

// An interface icon (a filter, a sort direction): takes the colour of its control.
export function createInventoryIcon(dom, symbol, className) {
  return dom.svgIcon(SPRITE_ASSET, symbol, `ui-icon ${className}`);
}

// The placeholder of an item without artwork.
export function createItemPlaceholderIcon(dom, symbol, className) {
  return dom.svgIcon(SPRITE_ASSET, symbol || FALLBACK_SYMBOL, `ui-icon ui-icon--placeholder ${className}`);
}
