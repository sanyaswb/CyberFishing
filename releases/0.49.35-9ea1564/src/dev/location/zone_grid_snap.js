// TK-082: puts a category's authored zones (design cells) onto the current map grid, so a zone authored on a 40 px
// grid sits in whole cells of a new 36 px grid and then snaps to it while it is edited. step: one map cell in design
// cells (cellSize / designCellSize). Static zones round every edge to the nearest grid line (at least one cell); an
// adaptive-width zone keeps its width rule; an edge on the map's border stays there (the map need not be a whole number
// of cells: 2560 px over 36 px cells); moving zones keep their body (it moves smoothly) and widen their movement bounds
// outward to grid lines, so the body stays inside. map: the map's size in design cells { w, h }. Returns the new list,
// or null when every zone is on the grid.
const EPSILON = 1e-9;

const near = value => Number(value.toPrecision(12));
const round = (value, step) => near(Math.round(value / step) * step);
const floor = (value, step) => near(Math.floor(value / step + EPSILON) * step);
const ceil = (value, step) => near(Math.ceil(value / step - EPSILON) * step);

// A value on the map's border (0 or its far edge) stays; any other snaps to the grid.
const edge = (value, step, far) => Math.abs(value) < EPSILON || Math.abs(value - far) < EPSILON ? value : round(value, step);

function snapRect(rect, step, map, adaptiveX = false) {
  const left = edge(rect.x, step, map.w), top = edge(rect.y, step, map.h);
  const right = Math.max(left + step, edge(rect.x + rect.w, step, map.w));
  const bottom = Math.max(top + step, edge(rect.y + rect.h, step, map.h));
  const snapped = { ...rect, y: top, h: near(bottom - top) };
  if (!adaptiveX) { snapped.x = left; snapped.w = near(right - left); }
  return snapped;
}

// Outward to grid lines, never past the map's border.
function widenRect(rect, step, map) {
  const left = Math.max(0, floor(rect.x, step)), top = Math.max(0, floor(rect.y, step));
  const right = Math.min(map.w, ceil(rect.x + rect.w, step)), bottom = Math.min(map.h, ceil(rect.y + rect.h, step));
  return { ...rect, x: left, y: top, w: near(right - left), h: near(bottom - top) };
}

export function snapZonesToGrid(zones, category, step, map = { w: Infinity, h: Infinity }) {
  if (!Array.isArray(zones) || !(step > 0)) return null;
  const next = zones.map((zone) => {
    if (category !== "dynamic") return snapRect(zone, step, map, zone.adaptiveX === true);
    if (!zone.bounds) return zone;
    const bounds = Array.isArray(zone.bounds) ? zone.bounds.map(bound => widenRect(bound, step, map)) : widenRect(zone.bounds, step, map);
    return { ...zone, bounds };
  });
  return JSON.stringify(next) === JSON.stringify(zones) ? null : next;
}
