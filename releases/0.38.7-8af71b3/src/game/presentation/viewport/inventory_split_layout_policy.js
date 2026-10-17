// Landscape split inventory (spec 098): where the inventory and the game strip lie. Pure: settings, viewport size,
// open state and the chosen side in; one frozen layout out. The inventory takes `inventoryShare` of the width on its
// side, the game strip the rest; outside the gate (switch off, closed, narrow or portrait) the stage is the viewport.
export class InventorySplitLayoutPolicy {
  static MIN_SHARE = 0.5;
  static MAX_SHARE = 0.85;
  static DEFAULT_SHARE = 0.7;
  // Phones in landscape keep the full-screen inventory (owner decision).
  static MIN_WIDTH = 820;

  resolve({ settings, width, height, open, side }) {
    const viewportWidth = Math.max(0, Number(width) || 0);
    const viewportHeight = Math.max(0, Number(height) || 0);
    const active = open === true && settings?.enabled === true && viewportWidth > InventorySplitLayoutPolicy.MIN_WIDTH &&
      viewportWidth > viewportHeight && (side === "left" || side === "right");
    if (!active) {
      return Object.freeze({ active: false, side: null, inventoryWidth: 0, stageLeft: 0,
        stageWidth: viewportWidth, stageHeight: viewportHeight });
    }
    const inventoryWidth = Math.round(viewportWidth * this.share(settings));
    return Object.freeze({ active: true, side, inventoryWidth, stageLeft: side === "left" ? inventoryWidth : 0,
      stageWidth: viewportWidth - inventoryWidth, stageHeight: viewportHeight });
  }

  share(settings) {
    const value = Number(settings?.inventoryShare);
    if (!Number.isFinite(value)) return InventorySplitLayoutPolicy.DEFAULT_SHARE;
    return Math.min(InventorySplitLayoutPolicy.MAX_SHARE, Math.max(InventorySplitLayoutPolicy.MIN_SHARE, value));
  }

  // The inventory opens on the side without the cast rod; a cast rod at or right of the centre puts it on the left.
  // Without a cast (rodScreenX null) it opens on defaultSide, "right" unless "left".
  sideForRod(rodScreenX, canvasWidth, defaultSide = "right") {
    if (rodScreenX === null || rodScreenX === undefined || !Number.isFinite(Number(rodScreenX))) {
      return defaultSide === "left" ? "left" : "right";
    }
    const centre = Math.max(0, Number(canvasWidth) || 0) / 2;
    return Number(rodScreenX) < centre ? "right" : "left";
  }
}
