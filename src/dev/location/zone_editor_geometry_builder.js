import { Vector2 } from "../../engine/math/vector2.js";
import { ZONE_CATEGORY_COLORS, ZONE_PHYSICS_KEYS } from "./zone_category_colors.js";
import { MOVE_SHARE } from "./zone_editor_state.js";

const COLORS = Object.freeze(Object.fromEntries(Object.entries(ZONE_CATEGORY_COLORS)
  .map(([category, hex]) => [category, Number.parseInt(hex.slice(1), 16)])));
// Revision 3 (R3-2): an editable zone keeps a 2 px outline of its colour; while the pointer is over it, it is filled
// and shows its corner handles (HANDLE_PX logical pixels) and its move area (the middle MOVE_SHARE). "Показати зону"
// fills a category permanently (SHOWN). Zones neither editable nor shown are not drawn.
const EDITABLE_LINE_WIDTH = 2;
const EDITABLE_STROKE = 0.95;
const HOVER_FILL = 0.35;
const SHOWN = Object.freeze({ fill: 0.15, stroke: 0.6 });
const HANDLE_PX = 8;
// A zone category is drawn only while its physics is on (Revision 2: the "Зони" lists).
const PHYSICS_KEYS = ZONE_PHYSICS_KEYS;
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
  #model = { revision: 0, lines: [], lineCount: 0, rects: [], rectCount: 0, cellLines: [], cellLineCount: 0, cellLineAlpha: 0,
    overlay: null };
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
    this.#model.cellLineAlpha = this.#state.cellGridOpacity;
    const zones = this.#map.getLocationZones();
    const cell = this.#config.locations.cellSize;
    const width = this.#config.locations.baseResolution.width;
    const state = this.#state;
    if (state.cellGrid) this.#cellGrid(cell);
    for (const category of CATEGORIES) {
      if (this.#config.locations[PHYSICS_KEYS[category]] === false) continue;
      const shown = state.categories[category];
      const records = zones[category] || EMPTY_ZONES;
      for (let index = 0; index < records.length; index++) {
        const editable = state.isEditable(category, index);
        if (!editable && !shown) continue;
        const hovered = editable && state.isHovered(category, index);
        const zone = records[index], color = COLORS[category];
        const fill = hovered ? HOVER_FILL : shown ? SHOWN.fill : 0;
        const lineWidth = editable ? EDITABLE_LINE_WIDTH : 1, stroke = editable ? EDITABLE_STROKE : SHOWN.stroke;
        // A moving zone's live position is the overlay; its authored rectangle shows while it is being edited.
        if (category !== "dynamic" || !moving.length || editable) {
          const x = zone.adaptiveX ? 0 : zone.x * cell;
          const w = zone.adaptiveX ? width : zone.w * cell, y = zone.y * cell, h = zone.h * cell;
          this.#rect(x, y, w, h, color, this.#model, lineWidth, fill, stroke);
          if (hovered) {
            this.#handles(x, y, w, h, color);
            const mw = w * MOVE_SHARE, mh = h * MOVE_SHARE;
            this.#rect(x + (w - mw) / 2, y + (h - mh) / 2, mw, mh, color, this.#model, 1, 0, SHOWN.stroke);
          }
        }
        if (zone.bounds) {
          for (const b of Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds]) {
            this.#rect(b.x, b.y, b.w, b.h, color, this.#model, 1, fill, SHOWN.stroke);
          }
        }
      }
    }
    if (this.#state.grid) this.#grid();
  }

  // The map's cells (locations.cellSize) over the whole picture: what a dragged edge snaps to.
  // Every cellLineStep-th cell line (Revision 2, "Сітка клітинок"), at the section's opacity.
  #cellGrid(cell) {
    const { width, height } = this.#config.locations.baseResolution;
    const step = cell * this.#state.cellLineStep;
    if (!(step > 0) || !(this.#state.cellGridOpacity > 0)) return;
    for (let x = 0, i = 0; x <= width + 1e-6 && i < MAX_CELL_LINES; x += step, i++) this.#line(x, 0, x, height, this.#model.cellLines, "cellLineCount");
    for (let y = 0, i = 0; y <= height + 1e-6 && i < MAX_CELL_LINES; y += step, i++) this.#line(0, y, width, y, this.#model.cellLines, "cellLineCount");
  }

  // Corner squares of HANDLE_PX logical pixels, filled, so a hovered editable zone shows where it can be taken.
  #handles(x, y, w, h, color) {
    const size = HANDLE_PX / this.#scale;
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      this.#rect(cx - size / 2, cy - size / 2, size, size, color, this.#model, 1, 0.9, 0.95);
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

  #rect(x, y, w, h, color, target = this.#model, lineWidth = 1, fillAlpha = 0.12, strokeAlpha = 0.9) {
    const index = target.rectCount++;
    const record = target.rects[index] ||= {};
    this.#projector.virtualToScreen(x, y, this.#point); record.x = this.#point.x; record.y = this.#point.y;
    record.width = w * this.#scale; record.height = h * this.#scale; record.color = color;
    record.lineWidth = lineWidth; record.fillAlpha = fillAlpha; record.strokeAlpha = strokeAlpha;
  }
}
