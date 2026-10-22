// Zones of the location "test" (spec 130): x/y/w/h and dynamic bounds in design cells
// (CONFIG.locations.designCellSize). `npm run apply:zones` rewrites this whole file in this form; hand edits are fine.
export const ZONES = {
  castable: [
    { x: 0, y: 13, w: 64, h: 16 },
  ],
  collisions: [
    { x: 12, y: 22, w: 3, h: 2 },
  ],
  snags: [
    { x: 50, y: 13, w: 14, h: 8 },
  ],
  dynamic: [
    { id: "fish_school_1", type: "buff", multiplier: 1.5, x: 22, y: 15, w: 1, h: 1, moving: true, speedX: 1.2, speedY: 0.8, bounds: [{ x: 0, y: 13, w: 64, h: 17 }] },
  ],
};
