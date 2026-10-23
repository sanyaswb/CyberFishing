// Zones of the location "test" (spec 130): x/y/w/h and dynamic bounds in design cells
// (CONFIG.locations.designCellSize). `npm run apply:zones` rewrites this whole file in this form; hand edits are fine.
export const ZONES = {
  castable: [
    { x: 0, y: 11.7, w: 64, h: 18, mask: { enabled: true, cell: [0.00703125, 0.025], rects: [[25, 0, 71, 1], [107, 0, 5, 1], [19, 1, 93, 1], [16, 2, 124, 1], [9, 3, 130, 1], [3, 4, 135, 1], [0, 5, 138, 2], [140, 6, 3, 1], [0, 7, 143, 30], [0, 37, 111, 1], [114, 37, 29, 1], [0, 38, 107, 1], [115, 38, 28, 1], [0, 39, 28, 1], [37, 39, 67, 1], [117, 39, 26, 1]] } },
  ],
  collisions: [
    { x: 12, y: 22, w: 3, h: 2 },
  ],
  snags: [
    { x: 50, y: 13, w: 14, h: 8 },
  ],
  dynamic: [
    { id: "fish_school_1", type: "buff", multiplier: 1.5, x: 17.12571864024948, y: 16.75040614586326, w: 1, h: 1, moving: true, speedX: 1.2, speedY: 0.8, bounds: [{ x: 0, y: 13, w: 64, h: 16 }] },
  ],
};
