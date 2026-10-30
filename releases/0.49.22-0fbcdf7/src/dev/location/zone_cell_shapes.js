import { bakeGridMask, readMaskCells } from "../../engine/geometry/grid_mask.js";

// Spec 141 Revision 2: zones of one category as cells, for cutting and merging. A zone is laid on a unit grid (design
// cells per unit along x and y); a plain zone covers whole units, a zone with an enabled mask covers the units of its
// mask cells. Shapes come back as one zone per side-connected piece: a full rectangle stays plain, any other piece is
// its bounding rectangle with a mask (an L stays one zone; only pieces that fall apart become separate zones). Zones
// that do not lie on the units (an adaptive-width zone, a disabled mask, a zone off the grid) are left as they are.
const EPSILON = 1e-6;
const near = value => Number(value.toPrecision(12));
const whole = value => Math.abs(value - Math.round(value)) < EPSILON;

// The natural unit of a zone: the map step, or its mask cell when finer.
function unitOf(zone, step) {
  if (!zone.mask?.enabled) return [step, step];
  return [Math.min(step, zone.mask.cell[0] * zone.w), Math.min(step, zone.mask.cell[1] * zone.h)];
}

// The zone's cells on the unit grid as "i,j" keys, or null when it is not on the grid.
function rasterize(zone, ux, uy) {
  if (zone.adaptiveX || (zone.mask && !zone.mask.enabled)) return null;
  const i0 = zone.x / ux, j0 = zone.y / uy, ni = zone.w / ux, nj = zone.h / uy;
  if (![i0, j0, ni, nj].every(whole)) return null;
  const x0 = Math.round(i0), y0 = Math.round(j0), cells = new Set();
  if (!zone.mask) {
    for (let j = 0; j < Math.round(nj); j++) for (let i = 0; i < Math.round(ni); i++) cells.add(`${x0 + i},${y0 + j}`);
    return cells;
  }
  let grid;
  try { grid = readMaskCells(zone.mask); } catch { return null; }
  const kx = zone.mask.cell[0] * zone.w / ux, ky = zone.mask.cell[1] * zone.h / uy;
  if (!whole(kx) || !whole(ky) || !whole(grid.cols * kx - ni) || !whole(grid.rows * ky - nj)) return null;
  const sx = Math.round(kx), sy = Math.round(ky);
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    if (!grid.cells[r * grid.cols + c]) continue;
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) cells.add(`${x0 + c * sx + i},${y0 + r * sy + j}`);
  }
  return cells;
}

const parse = key => key.split(",").map(Number);

// One zone per side-connected piece of cells; template: the zone's other fields (its geometry and mask replaced).
function piecesOf(cells, ux, uy, template) {
  const left = new Set(cells), pieces = [];
  const { x: _x, y: _y, w: _w, h: _h, mask: _mask, ...rest } = template;
  while (left.size) {
    const [first] = left; left.delete(first);
    const piece = [first], queue = [first];
    while (queue.length) {
      const [i, j] = parse(queue.pop());
      for (const key of [`${i - 1},${j}`, `${i + 1},${j}`, `${i},${j - 1}`, `${i},${j + 1}`]) {
        if (left.has(key)) { left.delete(key); piece.push(key); queue.push(key); }
      }
    }
    let minI = Infinity, minJ = Infinity, maxI = -Infinity, maxJ = -Infinity;
    for (const key of piece) { const [i, j] = parse(key); minI = Math.min(minI, i); minJ = Math.min(minJ, j); maxI = Math.max(maxI, i); maxJ = Math.max(maxJ, j); }
    const cols = maxI - minI + 1, rows = maxJ - minJ + 1;
    const zone = { ...rest, x: near(minI * ux), y: near(minJ * uy), w: near(cols * ux), h: near(rows * uy) };
    if (piece.length !== cols * rows) {
      const grid = new Uint8Array(cols * rows);
      for (const key of piece) { const [i, j] = parse(key); grid[(j - minJ) * cols + (i - minI)] = 1; }
      zone.mask = bakeGridMask([1 / cols, 1 / rows], grid);
    }
    pieces.push({ zone, first: Math.min(...piece.map(key => order(key))) });
  }
  // Pieces in reading order (top to bottom, left to right), so numbers stay predictable.
  return pieces.sort((a, b) => a.first - b.first).map(piece => piece.zone);
}

const order = key => { const [i, j] = parse(key); return j * 1e6 + i; };

function commonUnit(zones, step) {
  let ux = step, uy = step;
  for (const zone of zones) { const [x, y] = unitOf(zone, step); ux = Math.min(ux, x); uy = Math.min(uy, y); }
  return [ux, uy];
}

// cut: a rectangle in design cells. Every zone from base on loses the cells inside it: a zone it misses stays the same
// object, a covered one goes, the rest become their pieces (in its place, in order).
export function cutZones(zones, base, cut, step) {
  const result = zones.slice(0, base);
  for (const zone of zones.slice(base)) {
    const [ux, uy] = commonUnit([zone], step);
    const cells = rasterize(zone, ux, uy);
    if (!cells) { result.push(zone); continue; }
    const i0 = cut.x / ux, j0 = cut.y / uy, i1 = (cut.x + cut.w) / ux, j1 = (cut.y + cut.h) / uy;
    let removed = false;
    for (const key of [...cells]) {
      const [i, j] = parse(key);
      if (i + 1 > i0 + EPSILON && i < i1 - EPSILON && j + 1 > j0 + EPSILON && j < j1 - EPSILON) { cells.delete(key); removed = true; }
    }
    if (!removed) result.push(zone);
    else if (cells.size) result.push(...piecesOf(cells, ux, uy, zone));
  }
  return result;
}

// Zones from base on that overlap or touch side by side are merged into one; keep: the index whose zone gives the merged
// zone its other fields (else the first of the group). Returns { zones, index } with keep's new index, or null when
// nothing merges.
export function mergeTouchingZones(zones, step, { base = 0, keep = -1 } = {}) {
  const candidates = [];
  for (let index = base; index < zones.length; index++) candidates.push(index);
  const [ux, uy] = commonUnit(candidates.map(index => zones[index]), step);
  const owner = new Map(), parent = new Map(), cellsOf = new Map();
  const find = index => { while (parent.get(index) !== index) index = parent.get(index); return index; };
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb)); };
  for (const index of candidates) {
    const cells = rasterize(zones[index], ux, uy);
    if (!cells) continue;
    parent.set(index, index); cellsOf.set(index, cells);
    for (const key of cells) {
      const other = owner.get(key);
      if (other !== undefined) join(other, index); else owner.set(key, index);
    }
  }
  for (const [key, index] of owner) {
    const [i, j] = parse(key);
    for (const next of [`${i + 1},${j}`, `${i},${j + 1}`]) { const other = owner.get(next); if (other !== undefined) join(other, index); }
  }
  const groups = new Map();
  for (const index of cellsOf.keys()) { const root = find(index); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(index); }
  if ([...groups.values()].every(group => group.length === 1)) return null;
  const result = [], newIndex = new Map();
  for (let index = 0; index < zones.length; index++) {
    if (!cellsOf.has(index)) { newIndex.set(index, result.length); result.push(zones[index]); continue; }
    const group = groups.get(find(index));
    if (group.length === 1) { newIndex.set(index, result.length); result.push(zones[index]); continue; }
    if (group[0] !== index) continue;
    const cells = new Set();
    for (const member of group) for (const key of cellsOf.get(member)) cells.add(key);
    const template = zones[group.includes(keep) ? keep : group[0]];
    for (const member of group) newIndex.set(member, result.length);
    result.push(...piecesOf(cells, ux, uy, template));
  }
  return { zones: result, index: keep >= 0 ? newIndex.get(keep) ?? -1 : -1 };
}
