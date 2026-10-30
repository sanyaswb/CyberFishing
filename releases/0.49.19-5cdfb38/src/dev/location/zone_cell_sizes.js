// TK-083: the cell sizes the zone editor offers. A size is offered only when the map (CONFIG.locations.baseResolution)
// is a whole number of cells in both axes, so the map's edges lie on grid lines: the common divisors of its width and
// height inside the editor's range (2560 x 1440 -> 5, 8, 10, 16, 20, 32, 40, 80, 160). An empty list means the map's
// size fits no size in the range.
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

export function zoneCellSizes(map, range) {
  const { width, height } = map;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return [];
  const common = gcd(width, height), sizes = [];
  for (let size = Math.ceil(range.min); size <= Math.min(range.max, common); size++) if (common % size === 0) sizes.push(size);
  return sizes;
}

// The warning shown over the screen while the grid does not fit the map, or null when it fits.
export function zoneCellSizeWarning(map, sizes, cellSize, range) {
  const mapText = `${map.width}×${map.height} px`;
  if (!sizes.length) {
    return `Розмір локації ${mapText} некоректний: ширина й висота не діляться на цілі клітинки ${range.min}–${range.max} px. `
      + "Потрібні ширина й висота, кратні одному розміру клітинки (наприклад 2560×1440 при клітинці 40 px).";
  }
  if (sizes.includes(cellSize)) return null;
  return `Розмір клітинки ${cellSize} px не ділить локацію ${mapText} на цілі клітинки: край карти лягає посеред клітинки. `
    + `Потрібні значення, кратні розміру локації: ${sizes.join(", ")} px.`;
}
