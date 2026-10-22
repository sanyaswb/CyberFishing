// Fans are measured in central-button units. `origin` is the fan centre as a share of the central button's box;
// angles run from the left (0) over the top (90) to the right (180); `reverse` numbers the petals from the end
// angle, so a mirrored fan keeps the same section beside the ground. The corner fan is the wide-screen layout;
// toolbars up to 820 logical px place the selector in the centre (half or arc fan) or in a bottom corner
// (TK-034, TK-037).
export const INVENTORY_SELECTOR_CONFIG = Object.freeze({
  gap: 0.1,
  highlightDistance: 0.12,
  rounding: 0.06,
  sectorCount: 3,
  arcSteps: 32,
  cornerSteps: 8,
  sizeScales: Object.freeze({ 1: 1, 2: 1.35, 3: 1.7 }),
  layouts: Object.freeze({
    corner: Object.freeze({ origin: Object.freeze({ x: 1, y: 1 }), startAngle: 0, endAngle: 90,
      centralRadius: 1, outerRadius: 2.1, centralDisk: false, reverse: false }),
    "corner-left": Object.freeze({ origin: Object.freeze({ x: 0, y: 1 }), startAngle: 90, endAngle: 180,
      centralRadius: 1, outerRadius: 2.1, centralDisk: false, reverse: true }),
    half: Object.freeze({ origin: Object.freeze({ x: 0.5, y: 1 }), startAngle: 0, endAngle: 180,
      centralRadius: 0.5, outerRadius: 1.6, centralDisk: false, reverse: false }),
    arc: Object.freeze({ origin: Object.freeze({ x: 0.5, y: 0.5 }), startAngle: 30, endAngle: 150,
      centralRadius: 0.5, outerRadius: 1.6, centralDisk: true, reverse: false }),
  }),
  // Compact toolbars: the centred fan's shape, the selector's place and the side of the action column.
  compactLayouts: Object.freeze(["half", "arc"]),
  compactPlacements: Object.freeze(["center", "right", "left"]),
  compactActionSides: Object.freeze(["right", "left"]),
});
