// Zones of the location "test" (spec 130): x/y/w/h and dynamic bounds in design cells
// (CONFIG.locations.designCellSize). `npm run apply:zones` rewrites this whole file in this form; hand edits are fine.
export const ZONES = {
  castable: [
    { x: 0, y: 20, w: 64, h: 18, mask: { enabled: true, cell: [0.0078125, 0.0277777777778], rects: [[19, 0, 74, 1], [103, 0, 4, 1], [17, 1, 93, 1], [119, 1, 9, 1], [11, 2, 117, 1], [7, 3, 121, 1], [4, 4, 124, 1], [1, 5, 127, 1], [0, 6, 128, 30]] } },
  ],
  collisions: [
    { x: 54, y: 21, w: 3, h: 1, mask: { enabled: true, cell: [0.0833333333333, 0.25], rects: [[9, 0, 1, 1], [6, 1, 6, 1], [3, 2, 9, 1], [1, 3, 11, 1]] } },
  ],
  snags: [
    { x: 50, y: 20, w: 14, h: 4, mask: { enabled: true, cell: [0.0357142857143, 0.125], rects: [[3, 0, 4, 1], [0, 1, 10, 1], [19, 1, 9, 1], [0, 2, 28, 6]] } },
  ],
  dynamic: [
    { id: "fish_school_1", type: "buff", multiplier: 1.5, x: 0, y: 20, w: 1, h: 1, moving: true, speedX: 1.2, speedY: 0.8, bounds: [{ x: 0, y: 20, w: 64, h: 18 }] },
  ],
};
