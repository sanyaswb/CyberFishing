import { bakeGridMask, gridMaskContains } from "../../engine/geometry/grid_mask.js";

// Spec 173 F3 (TK-277): «Обрізати по ігровій зоні». A zone of any category but the castable one is cut down to the
// castable area (the water) on the castable area's own grid, so the cut lies exactly on that grid:
// - the grid is the castable mask's cells (the test location: 0.5 design cells), anchored at that castable zone; without
//   a castable mask, cells of `fallbackStep` design cells from the map's origin;
// - a grid cell stays when its centre is inside the zone (with its own enabled mask) and inside some castable zone (with
//   its enabled mask);
// - each side-connected group of remaining cells becomes a zone: shrunk to the group's cells, a plain rectangle when the
//   group fills it, else a mask on that grid (masks must be side-connected, so separate pieces are separate zones);
// - moving zones keep their body: their movement areas (bounds, plain rectangles) are cut to the castable area's
//   bounding box instead, and must still hold the body.
// All coordinates are design cells; the zones given are never changed. Returns { zones } (the replacement for the one
// zone) or { error } with a short reason.
const ROUND = 1e6;
const round = (value) => Math.round(value * ROUND) / ROUND;

export function clipZoneToCastable(zone, castable, { category, mapWidth, fallbackStep = 1 }) {
  if (!zone || !Array.isArray(castable) || castable.length === 0) return { error: "no-castable" };
  if (category === "castable") return { error: "castable" };
  if (category === "dynamic") return clipMovementArea(zone, castable, mapWidth);
  const grid = castableGrid(castable, mapWidth, fallbackStep);
  const { stepX, stepY, originX, originY } = grid;
  const i0 = Math.floor((zone.x - originX) / stepX + 1e-9), i1 = Math.ceil((zone.x + zone.w - originX) / stepX - 1e-9);
  const j0 = Math.floor((zone.y - originY) / stepY + 1e-9), j1 = Math.ceil((zone.y + zone.h - originY) / stepY - 1e-9);
  const cols = i1 - i0, rows = j1 - j0;
  if (!(cols > 0 && rows > 0)) return { error: "empty" };
  const kept = new Uint8Array(cols * rows);
  let total = 0, all = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = originX + (i0 + i + 0.5) * stepX, y = originY + (j0 + j + 0.5) * stepY;
    if (!inside(zone, x, y, mapWidth)) continue;
    all++;
    if (!castable.some((water) => inside(water, x, y, mapWidth))) continue;
    kept[j * cols + i] = 1;
    total++;
  }
  if (total === 0) return { error: "outside" };
  const zones = [];
  for (const group of components(kept, cols, rows)) {
    zones.push(groupZone(zone, group, kept, cols, { stepX, stepY, originX: originX + i0 * stepX, originY: originY + j0 * stepY }));
  }
  return { zones, changed: total !== all || zones.length !== 1 || !sameRect(zones[0], zone) || Boolean(zone.mask) !== Boolean(zones[0].mask) };
}

// The castable mask's grid (the first castable zone with an enabled mask), or fallbackStep cells from the origin.
function castableGrid(castable, mapWidth, fallbackStep) {
  const host = castable.find((water) => water.mask?.enabled && Array.isArray(water.mask.cell));
  if (!host) return { stepX: fallbackStep, stepY: fallbackStep, originX: 0, originY: 0 };
  const width = host.adaptiveX ? mapWidth : host.w;
  return { stepX: host.mask.cell[0] * width, stepY: host.mask.cell[1] * host.h, originX: host.adaptiveX ? 0 : host.x, originY: host.y };
}

function inside(zone, x, y, mapWidth) {
  const left = zone.adaptiveX ? 0 : zone.x, width = zone.adaptiveX ? mapWidth : zone.w;
  if (x < left || x >= left + width || y < zone.y || y >= zone.y + zone.h) return false;
  return zone.mask?.enabled ? gridMaskContains(zone.mask, (x - left) / width, (y - zone.y) / zone.h) : true;
}

// Side-connected groups of kept cells, each as a list of cell indices.
function components(kept, cols, rows) {
  const seen = new Uint8Array(kept.length), groups = [];
  for (let start = 0; start < kept.length; start++) {
    if (!kept[start] || seen[start]) continue;
    const group = [start];
    seen[start] = 1;
    for (let head = 0; head < group.length; head++) {
      const index = group[head], x = index % cols, y = Math.floor(index / cols);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const next = ny * cols + nx;
        if (kept[next] && !seen[next]) { seen[next] = 1; group.push(next); }
      }
    }
    groups.push(group);
  }
  return groups;
}

// One group as a zone: the zone's other fields, its cells' bounding box, and a mask unless the group fills it.
function groupZone(zone, group, kept, cols, grid) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const index of group) {
    const x = index % cols, y = Math.floor(index / cols);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const width = maxX - minX + 1, height = maxY - minY + 1;
  const result = { ...zone };
  delete result.mask;
  delete result.adaptiveX;
  result.x = round(grid.originX + minX * grid.stepX);
  result.y = round(grid.originY + minY * grid.stepY);
  result.w = round(width * grid.stepX);
  result.h = round(height * grid.stepY);
  if (group.length === width * height) return result;
  const cells = new Uint8Array(width * height);
  for (const index of group) cells[(Math.floor(index / cols) - minY) * width + (index % cols - minX)] = 1;
  result.mask = bakeGridMask([1 / width, 1 / height], cells);
  return result;
}

// Moving zones: every movement area cut to the castable area's bounding box; each must still hold the body.
function clipMovementArea(zone, castable, mapWidth) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const water of castable) {
    const x = water.adaptiveX ? 0 : water.x, w = water.adaptiveX ? mapWidth : water.w;
    left = Math.min(left, x); top = Math.min(top, water.y); right = Math.max(right, x + w); bottom = Math.max(bottom, water.y + water.h);
  }
  const bounds = zone.bounds ? (Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds]) : null;
  if (!bounds) return { error: "no-area" };
  const clipped = [];
  for (const bound of bounds) {
    const x = Math.max(left, bound.x), y = Math.max(top, bound.y);
    const w = Math.min(right, bound.x + bound.w) - x, h = Math.min(bottom, bound.y + bound.h) - y;
    if (w > 0 && h > 0) clipped.push({ ...bound, x: round(x), y: round(y), w: round(w), h: round(h) });
  }
  if (clipped.length === 0) return { error: "outside" };
  const holds = clipped.some((area) => zone.x >= area.x && zone.y >= area.y && zone.x + zone.w <= area.x + area.w &&
    zone.y + zone.h <= area.y + area.h);
  if (!holds) return { error: "body-outside" };
  const result = { ...zone, bounds: Array.isArray(zone.bounds) ? clipped : clipped[0] };
  return { zones: [result], changed: JSON.stringify(result.bounds) !== JSON.stringify(zone.bounds) };
}

function sameRect(a, b) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
