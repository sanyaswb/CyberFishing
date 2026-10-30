import { GridPathfinder } from "../../../engine/navigation/grid_pathfinder.js";
import { GridPathSmoother } from "../../../engine/navigation/grid_path_smoother.js";

// TK-161: routes keep off land and obstacles. Distances are in planning steps (half a map cell, 20 px at 40 px cells).
// A straight shortcut may only cross cells at least CLEAR_STEPS from land (a full cell: more than the boat's bumper
// reach), and cells closer than COST_STEPS cost more the closer they are, so A* runs down the middle of the water.
const CLEAR_STEPS = 2;
const COST_STEPS = 4;
const NEAR_LAND_COST = 6;

// The bait boat's routes on the current map (spec 154). A passability grid at half a map cell is built from the same
// water test the boat's physics uses, and rebuilt whenever the map's revision, cell size or water bounds change (DEV
// zone/grid edits, future map changes), so every leg is planned on the map as it is when the boat sets off. A distance
// field from land (shore, obstacles, the map edge) makes cells near land cost more and limits straight shortcuts to
// cells a full cell from land, so routes keep off the shore and obstacles (TK-161).
// Connected water bodies are labelled once per grid: a target in other water is unreachable (Q1).
export class BoatRoutePlanner {
  #getRevision;
  #getCellSize;
  #getBounds;
  #isWater;
  #pathfinder = new GridPathfinder();
  #smoother = new GridPathSmoother();
  #key = "";
  #grid = null;

  // getBounds(): the water's map rectangle; isWater(x, y): the boat's water test (GameWorld.checkWater semantics).
  constructor({ getRevision, getCellSize, getBounds, isWater }) {
    for (const [name, value] of Object.entries({ getRevision, getCellSize, getBounds, isWater })) {
      if (typeof value !== "function") throw new TypeError(`BoatRoutePlanner requires ${name}`);
    }
    this.#getRevision = getRevision;
    this.#getCellSize = getCellSize;
    this.#getBounds = getBounds;
    this.#isWater = isWater;
  }

  // Route points in map coordinates after the start, ending at the target; null when the target cannot be reached.
  plan(fromX, fromY, toX, toY) {
    const grid = this.#ensureGrid();
    const start = this.#snap(grid, fromX, fromY);
    const goal = this.#snap(grid, toX, toY);
    if (start < 0 || goal < 0 || grid.component[start] !== grid.component[goal]) return null;
    const cells = this.#pathfinder.findPath(grid, start, goal);
    if (!cells) return null;
    const kept = this.#smoother.smooth(grid, grid.clear, cells);
    const route = [];
    // TK-161: a boat in a pocket finer than the grid (a notch of a fine mask) first moves to its snapped water cell.
    if (!this.#isWater(fromX, fromY) || this.#cellOf(grid, fromX, fromY) !== start) route.push(this.#centre(grid, start));
    for (let index = 1; index < kept.length - 1; index += 1) route.push(this.#centre(grid, kept[index]));
    route.push(this.#isWater(toX, toY) ? { x: toX, y: toY } : this.#centre(grid, goal));
    return route;
  }

  isReachable(fromX, fromY, toX, toY) {
    const grid = this.#ensureGrid();
    const start = this.#snap(grid, fromX, fromY);
    const goal = this.#snap(grid, toX, toY);
    return start >= 0 && goal >= 0 && grid.component[start] === grid.component[goal];
  }

  #ensureGrid() {
    const bounds = this.#getBounds();
    const cellSize = this.#getCellSize();
    const key = `${this.#getRevision()}|${cellSize}|${bounds.left}|${bounds.top}|${bounds.right}|${bounds.bottom}`;
    if (key === this.#key && this.#grid) return this.#grid;
    this.#key = key;
    this.#grid = this.#build(bounds, cellSize / 2);
    return this.#grid;
  }

  #build(bounds, step) {
    const left = bounds.left, top = bounds.top;
    const cols = Math.max(1, Math.ceil((bounds.right - left) / step));
    const rows = Math.max(1, Math.ceil((bounds.bottom - top) / step));
    const size = cols * rows;
    const passable = new Uint8Array(size);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        passable[y * cols + x] = this.#isWater(left + (x + 0.5) * step, top + (y + 0.5) * step) ? 1 : 0;
      }
    }
    const distance = this.#landDistance(cols, rows, passable);
    const clear = new Uint8Array(size);
    const cost = new Float32Array(size);
    for (let index = 0; index < size; index += 1) {
      if (!passable[index]) continue;
      const steps = distance[index];
      clear[index] = steps >= CLEAR_STEPS ? 1 : 0;
      cost[index] = steps >= COST_STEPS ? 1 : 1 + NEAR_LAND_COST * (COST_STEPS - steps) / COST_STEPS;
    }
    const grid = { cols, rows, left, top, step, passable, clear, cost, component: new Int32Array(size).fill(-1) };
    this.#label(grid);
    return grid;
  }

  // Steps from each water cell to the nearest land cell (8 neighbours; outside the grid counts as land): 1 next to
  // land, 2 one cell further, ...
  #landDistance(cols, rows, passable) {
    const size = cols * rows;
    const distance = new Int16Array(size).fill(-1);
    const queue = new Int32Array(size);
    let head = 0, tail = 0;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const index = y * cols + x;
        if (!passable[index]) continue;
        let nearLand = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        for (let dy = -1; dy <= 1 && !nearLand; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!passable[(y + dy) * cols + (x + dx)]) { nearLand = true; break; }
          }
        }
        if (nearLand) { distance[index] = 1; queue[tail++] = index; }
      }
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % cols, y = (index - x) / cols;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const next = ny * cols + nx;
          if (!passable[next] || distance[next] >= 0) continue;
          distance[next] = distance[index] + 1;
          queue[tail++] = next;
        }
      }
    }
    return distance;
  }

  // Connected water: 8 neighbours with the same corner rule as the pathfinder.
  #label(grid) {
    const { cols, rows, passable, component } = grid;
    const queue = new Int32Array(cols * rows);
    let label = 0;
    for (let seed = 0; seed < cols * rows; seed += 1) {
      if (!passable[seed] || component[seed] >= 0) continue;
      let head = 0, tail = 0;
      queue[tail++] = seed;
      component[seed] = label;
      while (head < tail) {
        const index = queue[head++];
        const x = index % cols, y = (index - x) / cols;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const next = ny * cols + nx;
            if (!passable[next] || component[next] >= 0) continue;
            if (dx !== 0 && dy !== 0 && (!passable[y * cols + nx] || !passable[ny * cols + x])) continue;
            component[next] = label;
            queue[tail++] = next;
          }
        }
      }
      label += 1;
    }
  }

  // The point's cell, or the nearest water cell within two cells (a shore start, a click on the water's edge).
  #snap(grid, x, y) {
    const cx = Math.floor((x - grid.left) / grid.step), cy = Math.floor((y - grid.top) / grid.step);
    let best = -1, bestDistance = Infinity;
    for (let radius = 0; radius <= 2 && best < 0; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
          const index = ny * grid.cols + nx;
          if (!grid.passable[index]) continue;
          const distance = dx * dx + dy * dy;
          if (distance < bestDistance) { bestDistance = distance; best = index; }
        }
      }
    }
    return best;
  }

  #cellOf(grid, x, y) {
    const cx = Math.floor((x - grid.left) / grid.step), cy = Math.floor((y - grid.top) / grid.step);
    return cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows ? -1 : cy * grid.cols + cx;
  }

  #centre(grid, index) {
    const x = index % grid.cols, y = (index - x) / grid.cols;
    return { x: grid.left + (x + 0.5) * grid.step, y: grid.top + (y + 0.5) * grid.step };
  }
}
