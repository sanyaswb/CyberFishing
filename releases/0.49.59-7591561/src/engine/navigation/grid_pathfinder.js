const SQRT2 = Math.SQRT2;
const NEIGHBOURS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

// A* over a grid of cells (8 neighbours, octile heuristic). A diagonal step needs both side cells passable, so a path
// never cuts a blocked corner. cost[index] >= 1 multiplies the step into a cell (e.g. to keep away from walls).
// Buffers are reused while the grid size stays the same.
export class GridPathfinder {
  #size = 0;
  #gScore = null;
  #parent = null;
  #closed = null;
  #heap = [];

  // grid: { cols, rows, passable: Uint8Array, cost: Float32Array | null }. Returns cell indices from start to goal,
  // or null when the goal cannot be reached.
  findPath(grid, startIndex, goalIndex) {
    const { cols, rows, passable, cost } = grid;
    if (!passable[startIndex] || !passable[goalIndex]) return null;
    this.#ensure(cols * rows);
    const gScore = this.#gScore, parent = this.#parent, closed = this.#closed, heap = this.#heap;
    gScore.fill(Infinity);
    closed.fill(0);
    heap.length = 0;
    const goalX = goalIndex % cols, goalY = (goalIndex - goalX) / cols;
    const heuristic = (index) => {
      const x = index % cols, y = (index - x) / cols;
      const dx = Math.abs(x - goalX), dy = Math.abs(y - goalY);
      return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
    };
    gScore[startIndex] = 0;
    parent[startIndex] = -1;
    this.#push(startIndex, heuristic(startIndex));
    while (heap.length > 0) {
      const current = this.#pop();
      if (current === goalIndex) return this.#trace(goalIndex);
      if (closed[current]) continue;
      closed[current] = 1;
      const x = current % cols, y = (current - x) / cols;
      for (const [dx, dy, step] of NEIGHBOURS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const next = ny * cols + nx;
        if (!passable[next] || closed[next]) continue;
        if (dx !== 0 && dy !== 0 && (!passable[y * cols + nx] || !passable[ny * cols + x])) continue;
        const tentative = gScore[current] + step * (cost ? cost[next] : 1);
        if (tentative >= gScore[next]) continue;
        gScore[next] = tentative;
        parent[next] = current;
        this.#push(next, tentative + heuristic(next));
      }
    }
    return null;
  }

  #trace(goalIndex) {
    const path = [];
    for (let index = goalIndex; index !== -1; index = this.#parent[index]) path.push(index);
    return path.reverse();
  }

  #ensure(size) {
    if (size === this.#size) return;
    this.#size = size;
    this.#gScore = new Float64Array(size);
    this.#parent = new Int32Array(size);
    this.#closed = new Uint8Array(size);
  }

  // Binary heap of [priority, index] pairs.
  #push(index, priority) {
    const heap = this.#heap;
    heap.push([priority, index]);
    let child = heap.length - 1;
    while (child > 0) {
      const up = (child - 1) >> 1;
      if (heap[up][0] <= heap[child][0]) break;
      [heap[up], heap[child]] = [heap[child], heap[up]];
      child = up;
    }
  }

  #pop() {
    const heap = this.#heap;
    const top = heap[0][1];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let node = 0;
      for (;;) {
        const left = node * 2 + 1, right = left + 1;
        let smallest = node;
        if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
        if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
        if (smallest === node) break;
        [heap[node], heap[smallest]] = [heap[smallest], heap[node]];
        node = smallest;
      }
    }
    return top;
  }
}
