// Spec 188 D4: a jagged branching line (a lightning bolt) by midpoint displacement. The main channel runs from (x0, y0)
// to (x1, y1) in 2^generations segments: each pass moves every segment's middle sideways by up to `roughness` of that
// segment's length, so the line breaks at every scale. A few branches leave the channel's upper part at an angle,
// shorter, with two generations fewer. The result is a list of segments in arrays made once (the largest bolt the
// options allow), refilled by every build — no allocation per strike. Geometry only: no renderer, the random source is
// the caller's.
const MAX_GENERATIONS = 7;
const MAX_BRANCHES = 8;
const BRANCH_GENERATIONS_DROP = 2;
const MAX_POINTS = (1 << MAX_GENERATIONS) + 1;
// The channel's share a branch may leave from (not the very top, not its lower end).
const BRANCH_FROM = 0.08;
const BRANCH_TO = 0.7;

export const BRANCHING_BOLT_MAX_SEGMENTS = (1 << MAX_GENERATIONS) + MAX_BRANCHES * (1 << (MAX_GENERATIONS - BRANCH_GENERATIONS_DROP));

const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
const between = (pair, random, fallbackLow, fallbackHigh) => {
  const low = Number(Array.isArray(pair) ? pair[0] : fallbackLow);
  const high = Number(Array.isArray(pair) ? pair[1] : fallbackHigh);
  const from = Number.isFinite(low) ? low : fallbackLow;
  const to = Number.isFinite(high) ? high : from;
  return from + (to - from) * random();
};

export class BranchingBolt {
  ax = new Float32Array(BRANCHING_BOLT_MAX_SEGMENTS);
  ay = new Float32Array(BRANCHING_BOLT_MAX_SEGMENTS);
  bx = new Float32Array(BRANCHING_BOLT_MAX_SEGMENTS);
  by = new Float32Array(BRANCHING_BOLT_MAX_SEGMENTS);
  // 0 — the main channel, 1 — a branch.
  branch = new Uint8Array(BRANCHING_BOLT_MAX_SEGMENTS);
  count = 0;
  #px = new Float32Array(MAX_POINTS);
  #py = new Float32Array(MAX_POINTS);
  #mainX = new Float32Array(MAX_POINTS);
  #mainY = new Float32Array(MAX_POINTS);

  // options: { generations, roughness, branches: [min, max], branchLengthShare: [min, max], branchAngleDeg: [min, max] }.
  build(random, x0, y0, x1, y1, options = {}) {
    this.count = 0;
    const generations = clampInt(options.generations ?? 6, 1, MAX_GENERATIONS);
    const roughness = Math.max(0, Number(options.roughness) || 0);
    const points = this.#line(random, x0, y0, x1, y1, generations, roughness);
    this.#mainX.set(this.#px.subarray(0, points));
    this.#mainY.set(this.#py.subarray(0, points));
    this.#append(points, 0);
    const length = Math.hypot(x1 - x0, y1 - y0);
    const low = clampInt(Array.isArray(options.branches) ? options.branches[0] : 0, 0, MAX_BRANCHES);
    const high = clampInt(Array.isArray(options.branches) ? options.branches[1] : low, low, MAX_BRANCHES);
    const branches = low + Math.floor(random() * (high - low + 1));
    const branchGenerations = Math.max(1, generations - BRANCH_GENERATIONS_DROP);
    const last = points - 1;
    for (let index = 0; index < branches; index += 1) {
      const at = Math.max(1, Math.min(last - 1, Math.round(last * (BRANCH_FROM + (BRANCH_TO - BRANCH_FROM) * random()))));
      const sx = this.#mainX[at], sy = this.#mainY[at];
      const heading = Math.atan2(this.#mainY[at + 1] - this.#mainY[at - 1], this.#mainX[at + 1] - this.#mainX[at - 1]);
      const side = random() < 0.5 ? -1 : 1;
      const angle = heading + side * between(options.branchAngleDeg, random, 20, 45) * Math.PI / 180;
      const branchLength = length * Math.max(0, between(options.branchLengthShare, random, 0.2, 0.4));
      if (!(branchLength > 0)) continue;
      const count = this.#line(random, sx, sy, sx + Math.cos(angle) * branchLength, sy + Math.sin(angle) * branchLength,
        branchGenerations, roughness);
      this.#append(count, 1);
    }
    return this;
  }

  // Midpoint displacement into #px / #py; returns the number of points (2^generations + 1).
  #line(random, x0, y0, x1, y1, generations, roughness) {
    const last = 1 << generations;
    const px = this.#px, py = this.#py;
    px[0] = x0; py[0] = y0; px[last] = x1; py[last] = y1;
    for (let step = last >> 1; step >= 1; step >>= 1) {
      for (let index = step; index < last; index += step * 2) {
        const ax = px[index - step], ay = py[index - step], bx = px[index + step], by = py[index + step];
        const dx = bx - ax, dy = by - ay;
        const offset = (random() * 2 - 1) * roughness;
        // Sideways (perpendicular to the segment) by a share of its own length.
        px[index] = (ax + bx) / 2 - dy * offset;
        py[index] = (ay + by) / 2 + dx * offset;
      }
    }
    return last + 1;
  }

  #append(points, branch) {
    for (let index = 0; index < points - 1 && this.count < BRANCHING_BOLT_MAX_SEGMENTS; index += 1) {
      const at = this.count;
      this.ax[at] = this.#px[index]; this.ay[at] = this.#py[index];
      this.bx[at] = this.#px[index + 1]; this.by[at] = this.#py[index + 1];
      this.branch[at] = branch;
      this.count += 1;
    }
  }
}
