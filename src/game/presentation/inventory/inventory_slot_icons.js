// Shared empty-compartment artwork. Filled compartments keep their actual item images.
const ICONS = Object.freeze({
  rod: "assets/ui/inventory/rod.svg",
  reel: "assets/ui/inventory/reel.svg",
  terminalLine: "assets/ui/inventory/line.svg",
  line: "assets/ui/inventory/line.svg",
  float: "assets/ui/inventory/float.svg",
  tackle: "assets/ui/inventory/tackle.svg",
  hook: "assets/ui/inventory/tackle.svg",
  net: "assets/ui/inventory/net.svg",
  keepnet: "assets/ui/inventory/keepnet.svg",
  handChum: "assets/ui/inventory/chum.svg",
  chum: "assets/ui/inventory/chum.svg",
  cargo: "assets/ui/inventory/chum.svg",
  battery: "assets/ui/inventory/battery.svg",
  delivery: "assets/ui/inventory/boat.svg",
  gasMask: "assets/ui/inventory/gas-mask.svg",
  radio: "assets/ui/inventory/radio.svg",
  bait: "assets/ui/inventory/bait.svg",
  weight: "assets/ui/inventory/weight.svg",
});

export function inventorySlotIconPath(slotId) {
  return ICONS[slotId] || "";
}

// Every distinct placeholder file, warmed when the inventory is composed (TK-081).
export function inventorySlotIconPaths() {
  return [...new Set(Object.values(ICONS))];
}
