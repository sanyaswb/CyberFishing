// Shared empty-compartment artwork by asset id (spec 157 R16). Filled compartments keep their actual item images.
const ICONS = Object.freeze({
  rod: "ui.inventory.rod",
  reel: "ui.inventory.reel",
  terminalLine: "ui.inventory.line",
  line: "ui.inventory.line",
  float: "ui.inventory.float",
  tackle: "ui.inventory.tackle",
  hook: "ui.inventory.tackle",
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

export function inventorySlotIconAsset(slotId) {
  return ICONS[slotId] || "";
}

// Every distinct placeholder, warmed when the inventory is composed (TK-081).
export function inventorySlotIconAssets() {
  return [...new Set(Object.values(ICONS))];
}
