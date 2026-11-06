// Shortens a grid path by line of sight ("string pulling"): from each kept cell it jumps to the farthest later cell
// that a straight line reaches through clear cells only. `clear` is usually stricter than the path's passability
// (cells with room on every side), so the shortened path keeps away from walls and corners.
export class GridPathSmoother {
  // grid: { cols }, clear: Uint8Array; path: cell indices. Returns the kept cell indices (first and last always).
  smooth(grid, clear, path) {
    if (path.length <= 2) return path.slice();
    const kept = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let next = anchor + 1;
      for (let candidate = path.length - 1; candidate > anchor + 1; candidate -= 1) {
        if (this.#lineIsClear(grid.cols, clear, path[anchor], path[candidate])) {
          next = candidate;
          break;
        }
      }
      kept.push(path[next]);
      anchor = next;
    }
    return kept;
  }

  // Samples the segment between two cell centres at quarter-cell steps; every sampled cell must be clear.
  #lineIsClear(cols, clear, fromIndex, toIndex) {
    const x0 = fromIndex % cols, y0 = (fromIndex - x0) / cols;
    const x1 = toIndex % cols, y1 = (toIndex - x1) / cols;
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      if (!clear[y * cols + x]) return false;
    }
    return true;
  }
}
