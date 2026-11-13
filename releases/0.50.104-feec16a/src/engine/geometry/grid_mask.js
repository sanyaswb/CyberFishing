// Immutable local mask data: normalized cell size and merged integer-cell rectangles. No platform/domain state.
const MAX_CELLS = 1048576;
const compiled = new WeakMap();

export function maskDimensions(cell) {
  if (!Array.isArray(cell) || cell.length !== 2 || cell.some(value => !Number.isFinite(value) || value <= 0 || value > 1)) throw new Error("Invalid mask cell size");
  const cols = Math.ceil(1 / cell[0] - 1e-9), rows = Math.ceil(1 / cell[1] - 1e-9);
  if (!Number.isSafeInteger(cols) || !Number.isSafeInteger(rows) || cols > 4096 || rows > 4096 || cols * rows > MAX_CELLS) throw new Error("Mask exceeds cell limit");
  return { cols, rows };
}

export function connectedMaskCells(cells, cols, rows) {
  let start = -1, count = 0;
  for (let i = 0; i < cells.length; i++) if (cells[i]) { count++; if (start < 0) start = i; }
  if (!count) return false;
  const visited = new Uint8Array(cells.length), queue = new Int32Array(count);
  let head = 0, tail = 1; queue[0] = start; visited[start] = 1;
  while (head < tail) {
    const i = queue[head++], x = i % cols, y = Math.floor(i / cols);
    for (let side = 0; side < 4; side++) {
      if (side === 0 && x === 0 || side === 1 && x === cols - 1 || side === 2 && y === 0 || side === 3 && y === rows - 1) continue;
      const next = i + (side === 0 ? -1 : side === 1 ? 1 : side === 2 ? -cols : cols);
      if (cells[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
    }
  }
  return tail === count;
}

export function readMaskCells(mask) {
  const { cols, rows } = maskDimensions(mask?.cell);
  if (typeof mask.enabled !== "boolean" || !Array.isArray(mask.rects) || mask.rects.length > cols * rows) throw new Error("Invalid mask data");
  const cells = new Uint8Array(cols * rows);
  for (const rect of mask.rects) {
    if (!Array.isArray(rect) || rect.length !== 4 || rect.some(value => !Number.isSafeInteger(value))) throw new Error("Invalid mask rectangle");
    const [x, y, w, h] = rect;
    if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > cols || y + h > rows) throw new Error("Mask rectangle outside grid");
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const index = j * cols + i;
      if (cells[index]) throw new Error("Overlapping mask rectangles");
      cells[index] = 1;
    }
  }
  return { cells, cols, rows };
}

export function validateGridMask(mask) {
  try {
    const { cells, cols, rows } = readMaskCells(mask);
    if (!connectedMaskCells(cells, cols, rows)) return "Mask must be nonempty and side-connected";
    return null;
  } catch (error) { return error.message; }
}

// Combine equal runs on adjacent rows into rectangles; no writable dense cell array is persisted.
export function bakeGridMask(cell, cells, requireConnected = true) {
  const { cols, rows } = maskDimensions(cell);
  if (cells.length !== cols * rows) throw new Error("Invalid mask selection size");
  if (requireConnected && !connectedMaskCells(cells, cols, rows)) throw new Error("Mask must be nonempty and side-connected");
  const rects = [];
  let previous = new Map();
  for (let y = 0; y < rows; y++) {
    const current = new Map();
    for (let x = 0; x < cols;) {
      if (!cells[y * cols + x]) { x++; continue; }
      const start = x;
      while (x < cols && cells[y * cols + x]) x++;
      const width = x - start, key = `${start}:${width}`, rect = previous.get(key);
      if (rect) { rect[3]++; current.set(key, rect); }
      else { const next = [start, y, width, 1]; rects.push(next); current.set(key, next); }
    }
    previous = current;
  }
  return { enabled: true, cell: [...cell], rects };
}

// Compiled topology is reused until a new immutable mask command replaces the source object.
export function compileGridMask(mask) {
  let result = compiled.get(mask);
  if (result) return result;
  const { cells, cols, rows } = readMaskCells(mask), [sx, sy] = mask.cell;
  const rects = [], edges = [], extent = [1, 1, 0, 0];
  for (const [x, y, w, h] of mask.rects) {
    const left = x * sx, top = y * sy, right = Math.min(1, (x + w) * sx), bottom = Math.min(1, (y + h) * sy);
    rects.push([left, top, right - left, bottom - top]);
    extent[0] = Math.min(extent[0], left); extent[1] = Math.min(extent[1], top);
    extent[2] = Math.max(extent[2], right); extent[3] = Math.max(extent[3], bottom);
  }
  for (let y = 0; y <= rows; y++) {
    let start = -1;
    for (let x = 0; x <= cols; x++) {
      const boundary = x < cols && (!!(y > 0 && cells[(y - 1) * cols + x]) !== !!(y < rows && cells[y * cols + x]));
      if (boundary && start < 0) start = x;
      if (!boundary && start >= 0) { edges.push([start * sx, Math.min(1, y * sy), Math.min(1, x * sx), Math.min(1, y * sy)]); start = -1; }
    }
  }
  for (let x = 0; x <= cols; x++) {
    let start = -1;
    for (let y = 0; y <= rows; y++) {
      const boundary = y < rows && (!!(x > 0 && cells[y * cols + x - 1]) !== !!(x < cols && cells[y * cols + x]));
      if (boundary && start < 0) start = y;
      if (!boundary && start >= 0) { edges.push([Math.min(1, x * sx), start * sy, Math.min(1, x * sx), Math.min(1, y * sy)]); start = -1; }
    }
  }
  result = { rects, edges, extent, cells, cols, rows };
  compiled.set(mask, result);
  return result;
}

export function gridMaskContains(mask, x, y) {
  if (x < 0 || y < 0 || x >= 1 || y >= 1) return false;
  const grid = compileGridMask(mask);
  return !!grid.cells[Math.floor(y / mask.cell[1]) * grid.cols + Math.floor(x / mask.cell[0])];
}

// Occupied bounding box in the host's units; a disabled mask retains the ordinary rectangle.
export function gridMaskBounds(mask, x, y, w, h, out) {
  const extent = mask?.enabled ? compileGridMask(mask).extent : null;
  out.x = x + (extent ? extent[0] * w : 0); out.y = y + (extent ? extent[1] * h : 0);
  out.w = extent ? (extent[2] - extent[0]) * w : w;
  out.h = extent ? (extent[3] - extent[1]) * h : h;
  return out;
}
