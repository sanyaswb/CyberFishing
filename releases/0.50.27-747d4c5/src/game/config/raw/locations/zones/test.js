// Zones of the location "test" (spec 130): x/y/w/h and dynamic bounds in design cells
// (CONFIG.locations.designCellSize). `npm run apply:zones` rewrites this whole file in this form; hand edits are fine.
export const ZONES = {
  castable: [
    { x: 0, y: 12, w: 64, h: 18, mask: { enabled: true, cell: [0.0078125, 0.0277777777778], rects: [[20, 0, 68, 1], [91, 0, 1, 1], [96, 0, 6, 1], [18, 1, 86, 1], [106, 1, 14, 1], [8, 2, 95, 1], [106, 2, 19, 1], [4, 3, 97, 1], [105, 3, 20, 1], [1, 4, 123, 1], [127, 4, 1, 1], [0, 5, 128, 28], [0, 33, 98, 1], [103, 33, 25, 1], [0, 34, 26, 1], [34, 34, 60, 1], [105, 34, 23, 1]] } },
  ],
  collisions: [
    { x: 50, y: 15, w: 3, h: 2, mask: { enabled: true, cell: [0.0833333333333, 0.125], rects: [[2, 0, 6, 1], [0, 1, 12, 3], [0, 4, 11, 1], [1, 5, 9, 1], [1, 6, 7, 1]] } },
  ],
  snags: [
    { x: 50, y: 13, w: 14, h: 8 },
  ],
  dynamic: [
    { id: "fish_school_1", type: "buff", multiplier: 1.5, x: 17.12571864024948, y: 16.75040614586326, w: 1, h: 1, moving: true, speedX: 1.2, speedY: 0.8, bounds: [{ x: 0, y: 13, w: 64, h: 16 }] },
  ],
};
