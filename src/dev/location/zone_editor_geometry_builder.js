import { Vector2 } from "../../engine/math/vector2.js";
import { ZONE_CATEGORY_COLORS } from "./zone_category_colors.js";

const COLORS = Object.freeze(Object.fromEntries(Object.entries(ZONE_CATEGORY_COLORS)
  .map(([category, hex]) => [category, Number.parseInt(hex.slice(1), 16)])));
// The selected zone (spec 129 D4): a thicker outline and corner handles of this many logical pixels.
const SELECTED_LINE_WIDTH = 3;
const HANDLE_PX = 8;
// The map's cell lines (D5): at most this many per axis.
const MAX_CELL_LINES = 400;
const MAX_GRID_STEPS = 96;
const CURVE_SEGMENTS = 24;
const EMPTY_ZONES = Object.freeze([]);
const CATEGORIES = Object.freeze(Object.keys(COLORS));

// Builds the same reusable logical-pixel geometry for WebGL and Canvas; no rendering, physics or mutable config.
export class ZoneEditorGeometryBuilder {
  #state; #map; #projector; #getMetric; #config;
  #point = new Vector2();
  #origin = new Vector2();
  #metric = null;
  #revision = -1; #mapRevision = -1; #scale = NaN; #x = NaN; #y = NaN;
  #dynamic = [];
  #model = { revision: 0, lines: [], lineCount: 0, rects: [], rectCount: 0, cellLines: [], cellLineCount: 0, overlay: null };
  #movingModel = { revision: 0, lines: [], lineCount: 0, rects: [], rectCount: 0 };
  rebuilds = 0;
  overlayRebuilds = 0;

  constructor({ state, map, projector, getWaterMetric, config }) {
    this.#state = state; this.#map = map; this.#projector = projector; this.#getMetric = getWaterMetric; this.#config = config;
    state.locationId = map.currentLocationId;
  }

  buildInto(target) {
    target.annotations = null;
    target.backgroundHidden = false;
    const state = this.#state;
    if (!state.enabled) return;
    const metric = this.#getMetric();
    const origin = this.#projector.virtualToScreen(0, 0, this.#origin);
    const scale = this.#projector.getScale();
    const moving = state.categories.dynamic && this.#config.locations.enableDynamicZones !== false
      ? this.#map.getDynamicZones() : EMPTY_ZONES;
    const topologyChanged = this.#dynamic.length !== moving.length * 4;
    let dirty = topologyChanged;
    for (let i = 0; i < moving.length; i++) {
      const zone = moving[i], offset = i * 4;
      if (this.#dynamic[offset] !== zone.x || this.#dynamic[offset + 1] !== zone.y ||
        this.#dynamic[offset + 2] !== zone.w || this.#dynamic[offset + 3] !== zone.h) dirty = true;
      this.#dynamic[offset] = zone.x; this.#dynamic[offset + 1] = zone.y;
      this.#dynamic[offset + 2] = zone.w; this.#dynamic[offset + 3] = zone.h;
    }
    this.#dynamic.length = moving.length * 4;
    const staticDirty = topologyChanged || metric !== this.#metric || state.revision !== this.#revision || this.#mapRevision !== this.#map.getRevision() ||
      scale !== this.#scale || origin.x !== this.#x || origin.y !== this.#y;
    if (staticDirty) {
      this.#metric = metric; this.#revision = state.revision; this.#mapRevision = this.#map.getRevision();
      this.#scale = scale; this.#x = origin.x; this.#y = origin.y;
      this.#rebuild(moving);
    }
    if (dirty || staticDirty) {
      this.overlayRebuilds++; this.#movingModel.revision++; this.#movingModel.rectCount = 0;
      const cell = this.#config.locations.cellSize;
      for (const zone of moving) this.#rect(zone.x * cell, zone.y * cell, zone.w * cell, zone.h * cell, COLORS.dynamic, this.#movingModel);
    }
    this.#model.overlay = moving.length ? this.#movingModel : null;
    target.annotations = this.#model;
    target.backgroundHidden = !state.background;
  }

  #rebuild(moving) {
    this.rebuilds++; this.#model.revision++; this.#model.lineCount = 0; this.#model.rectCount = 0;
    this.#model.cellLineCount = 0;
    const zones = this.#map.getLocationZones();
    const cell = this.#config.locations.cellSize;
    const width = this.#config.locations.baseResolution.width;
    const selection = this.#state.selection;
    if (this.#state.cellGrid) this.#cellGrid(cell);
    for (const category of CATEGORIES) {
      if (!this.#state.categories[category]) continue;
      const records = zones[category] || EMPTY_ZONES;
      for (let index = 0; index < records.length; index++) {
        const zone = records[index];
        const x = zone.adaptiveX ? 0 : zone.x * cell;
        const selected = selection.category === category && selection.index === index;
        if (category !== "dynamic" || !moving.length || selected) {
          const w = zone.adaptiveX ? width : zone.w * cell, y = zone.y * cell, h = zone.h * cell;
          this.#rect(x, y, w, h, COLORS[category], this.#model, selected ? SELECTED_LINE_WIDTH : 1);
          if (selected) this.#handles(x, y, w, h, COLORS[category]);
        }
        if (zone.bounds) {
          if (Array.isArray(zone.bounds)) {
            for (const b of zone.bounds) this.#rect(b.x, b.y, b.w, b.h, COLORS[category]);
          } else { const b = zone.bounds; this.#rect(b.x, b.y, b.w, b.h, COLORS[category]); }
        }
      }
    }
    if (this.#state.grid) this.#grid();
  }

  // The map's cells (locations.cellSize) over the whole picture: what a dragged edge snaps to.
  #cellGrid(cell) {
    const { width, height } = this.#config.locations.baseResolution;
    if (!(cell > 0)) return;
    for (let x = 0, i = 0; x <= width + 1e-6 && i < MAX_CELL_LINES; x += cell, i++) this.#line(x, 0, x, height, this.#model.cellLines, "cellLineCount");
    for (let y = 0, i = 0; y <= height + 1e-6 && i < MAX_CELL_LINES; y += cell, i++) this.#line(0, y, width, y, this.#model.cellLines, "cellLineCount");
  }

  // Corner squares of HANDLE_PX logical pixels, filled, so the selected zone shows where it can be taken.
  #handles(x, y, w, h, color) {
    const size = HANDLE_PX / this.#scale;
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      this.#rect(cx - size / 2, cy - size / 2, size, size, color, this.#model, 1, 0.9);
    }
  }

  #grid() {
    const metric = this.#metric;
    const bounds = this.#map.getCastableBoundsVirtual(this.#config.locations.cellSize);
    metric.toGround(bounds.left, bounds.top, this.#point);
    const left = this.#point.x;
    metric.toGround(bounds.right, bounds.top, this.#point);
    const right = this.#point.x;
    const spacing = this.#state.spacingMeters;
    const step = Math.ceil(Math.max(spacing, metric.topMeters / MAX_GRID_STEPS, (right - left) / MAX_GRID_STEPS) / spacing) * spacing;
    const end = metric.topMeters;
    let lastMeters = -Infinity;
    for (let meters = 0, i = 0; meters <= end + 1e-8 && i < MAX_GRID_STEPS; meters += step, i++) {
      const y = metric.yAtMeters(meters);
      // Keep grid edges on the water rectangle; vertical lines curve through the same ground->map mapping.
      this.#line(bounds.left, y, bounds.right, y);
      lastMeters = meters;
    }
    if (Math.abs(lastMeters - end) > 1e-8) this.#line(bounds.left, bounds.top, bounds.right, bounds.top);
    for (let lateral = Math.ceil(left / step) * step, i = 0; lateral <= right && i < MAX_GRID_STEPS; lateral += step, i++) {
      let lastX = 0, lastY = 0;
      for (let j = 0; j <= CURVE_SEGMENTS; j++) {
        metric.toVirtual(lateral, end * j / CURVE_SEGMENTS, this.#point);
        const x = this.#point.x, y = this.#point.y;
        if (j > 0 && Math.max(x, lastX) >= bounds.left && Math.min(x, lastX) <= bounds.right) {
          const dx = x - lastX;
          let start = 0, finish = 1;
          if (dx > 0) { start = Math.max(0, (bounds.left - lastX) / dx); finish = Math.min(1, (bounds.right - lastX) / dx); }
          else if (dx < 0) { start = Math.max(0, (bounds.right - lastX) / dx); finish = Math.min(1, (bounds.left - lastX) / dx); }
          this.#line(lastX + dx * start, lastY + (y - lastY) * start, lastX + dx * finish, lastY + (y - lastY) * finish);
        }
        lastX = x; lastY = y;
      }
    }
  }

  #line(x1, y1, x2, y2, lines = this.#model.lines, countKey = "lineCount") {
    const index = this.#model[countKey]++;
    const record = lines[index] ||= {};
    this.#projector.virtualToScreen(x1, y1, this.#point); record.x1 = this.#point.x; record.y1 = this.#point.y;
    this.#projector.virtualToScreen(x2, y2, this.#point); record.x2 = this.#point.x; record.y2 = this.#point.y;
  }

  #rect(x, y, w, h, color, target = this.#model, lineWidth = 1, fillAlpha = 0.12) {
    const index = target.rectCount++;
    const record = target.rects[index] ||= {};
    this.#projector.virtualToScreen(x, y, this.#point); record.x = this.#point.x; record.y = this.#point.y;
    record.width = w * this.#scale; record.height = h * this.#scale; record.color = color;
    record.lineWidth = lineWidth; record.fillAlpha = fillAlpha;
  }
}
