import { createItemPlaceholderIcon } from "./inventory_icons.js";

// Shared empty-compartment artwork by asset id (spec 157 R16). Filled compartments keep their actual item images.
const ICONS = Object.freeze({
  rod: "ui.inventory.rod",
  reel: "ui.inventory.reel",
  terminalLine: "ui.inventory.line",
  line: "ui.inventory.line",
  float: "ui.inventory.float",
  net: "ui.inventory.net",
  keepnet: "ui.inventory.keepnet",
  handChum: "ui.inventory.chum",
  chum: "ui.inventory.chum",
  cargo: "ui.inventory.chum",
  battery: "ui.inventory.battery",
  delivery: "ui.inventory.boat",
  gasMask: "ui.inventory.gas-mask",
  radio: "ui.inventory.radio",
  bait: "ui.inventory.bait",
  weight: "ui.inventory.weight",
});

// TK-238: compartments drawn with a sections sprite symbol: the hook is the one drawing of a hook item without artwork.
const SYMBOLS = Object.freeze({ tackle: "hook", hook: "hook" });

export function inventorySlotIconAsset(slotId) {
  return ICONS[slotId] || "";
}

// An empty compartment's icon element (an image, or the sprite symbol) with className, or null without one.
export function createInventorySlotIcon(dom, slotId, className) {
  if (SYMBOLS[slotId]) return createItemPlaceholderIcon(dom, SYMBOLS[slotId], className);
  const image = dom.image(inventorySlotIconAsset(slotId), "");
  if (image) image.className = className;
  return image;
}

// Every distinct placeholder, warmed when the inventory is composed (TK-081).
export function inventorySlotIconAssets() {
  return [...new Set(Object.values(ICONS))];
}
