import { bakeGridMask, connectedMaskCells, maskDimensions, readMaskCells } from "../../engine/geometry/grid_mask.js";
import { ZONE_PHYSICS_KEYS } from "./zone_category_colors.js";

// Owns only an unapplied DEV draft. The host config owns applied masks; the map owns live geometry.
export class ZoneMaskEditor {
  #state; #config; #getMap; #write;
  #draft = null;
  #preview = null;
  #last = null;
  #geometry = {};
  #opacity = .3;
  revision = 0;
  subdivision = 2;
  message = "";

  constructor({ state, config, getMap, writeConfig }) {
    this.#state = state; this.#config = config; this.#getMap = getMap; this.#write = writeConfig;
  }

  sync() {
    const d = this.#draft, s = this.#state;
    if (d && (!s.enabled || !s.editsLoadedLocation || !s.isEditable(d.category) || s.locationId !== d.location ||
      s.selection.category !== d.category || s.selectedIndex(d.category) !== d.index ||
      this.#config.locations[ZONE_PHYSICS_KEYS[d.category]] === false || this.#source(d.category, d.index) !== d.source)) this.stop();
  }

  get draft() { this.sync(); return this.#draft; }
  isActive(category, index) { const d = this.draft; return d?.category === category && d.index === index; }
  get opacity() { return this.#opacity; }

  setOpacity(value) {
    const next = Math.max(0, Math.min(1, Number(value)));
    if (Number.isFinite(next) && next !== this.#opacity) {
      this.#opacity = next;
      this.revision++; // View-only invalidation: retain draft cells and compiled preview topology.
    }
    return this.#opacity;
  }

  geometry() {
    const d = this.draft, map = this.#getMap();
    if (!d || !map) return null;
    const zone = d.category === "dynamic" ? map.getDynamicZones().find(z => z.id === d.source.id) : map.getLocationZones()[d.category]?.[d.index];
    if (!zone) return null;
    const cell = map.getCellSize?.() ?? this.#config.locations.cellSize;
    const g = this.#geometry;
    g.x = zone.adaptiveX ? 0 : zone.x * cell; g.y = zone.y * cell;
    g.w = zone.adaptiveX ? this.#config.locations.baseResolution.width : zone.w * cell; g.h = zone.h * cell;
    return g;
  }

  start(category, index, fresh = false) {
    this.stop(); this.message = "";
    const s = this.#state, source = this.#source(category, index);
    if (!source || !s.enabled || !s.editsLoadedLocation || !s.isEditable(category) || this.#config.locations[ZONE_PHYSICS_KEYS[category]] === false) return false;
    s.select(category, index); s.boundsEditing = false; s.setHovered([]);
    this.#draft = { category, index, location: s.locationId, source, reversed: false };
    try {
      const geometry = this.geometry();
      if (!geometry || !(geometry.w > 0 && geometry.h > 0)) throw new Error("Missing host geometry");
      const step = (this.#getMap().getCellSize?.() ?? this.#config.locations.cellSize) / this.subdivision;
      const cell = !fresh && source.mask ? [...source.mask.cell] : [Math.min(1, step / geometry.w), Math.min(1, step / geometry.h)];
      const { cols, rows } = maskDimensions(cell);
      const cells = !fresh && source.mask ? readMaskCells(source.mask).cells : new Uint8Array(cols * rows);
      Object.assign(this.#draft, { cell, cells, cols, rows });
      this.#changed(); return true;
    } catch {
      this.stop(); this.message = "Не вдалося створити меш: перевірте розмір зони (ліміт 1 048 576 клітинок).";
      return false;
    }
  }

  stop() {
    if (this.#draft) { this.#draft = null; this.#changed(); }
    this.#last = null;
  }

  setSubdivision(value) {
    if (value !== 2 && value !== 4) return;
    const d = this.draft; this.subdivision = value;
    if (d) this.start(d.category, d.index, true);
  }

  // Coordinates are map pixels. Bresenham joins fast samples, without converting host geometry or the global grid.
  paint(x, y, erase = false) {
    const d = this.draft, g = this.geometry();
    if (!d || !g) return false;
    const nx = (x - g.x) / g.w, ny = (y - g.y) / g.h;
    if (nx < 0 || ny < 0 || nx >= 1 || ny >= 1) { this.#last = null; return false; }
    const cx = Math.floor(nx / d.cell[0]), cy = Math.floor(ny / d.cell[1]);
    let ax = this.#last?.x ?? cx, ay = this.#last?.y ?? cy;
    const dx = Math.abs(cx - ax), dy = -Math.abs(cy - ay), sx = ax < cx ? 1 : -1, sy = ay < cy ? 1 : -1;
    let error = dx + dy, changed = false;
    while (true) {
      const index = ay * d.cols + ax, value = erase ? 0 : 1;
      if (d.cells[index] !== value) { d.cells[index] = value; changed = true; }
      if (ax === cx && ay === cy) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; ax += sx; }
      if (twice <= dx) { error += dx; ay += sy; }
    }
    this.#last = { x: cx, y: cy };
    if (changed) this.#changed();
    return true;
  }

  endStroke() { this.#last = null; }

  invert() {
    const d = this.draft;
    if (!d) return;
    for (let i = 0; i < d.cells.length; i++) d.cells[i] = d.cells[i] ? 0 : 1;
    d.reversed = !d.reversed; this.#changed();
  }

  get canApply() { const d = this.draft; return !!d && connectedMaskCells(d.cells, d.cols, d.rows); }
  get preview() {
    const d = this.draft;
    if (!d) return null;
    return this.#preview ||= bakeGridMask(d.cell, d.cells, false);
  }

  apply() {
    const d = this.draft;
    if (!this.canApply) { this.message = "Маска має бути непорожньою й з’єднаною сторонами в одну фігуру."; return false; }
    const mask = bakeGridMask(d.cell, d.cells);
    this.#write(["CONFIG", "locations", "map", d.location, "zones", d.category, d.index, "mask"], mask);
    this.stop(); this.message = "Маску застосовано. Щоб перенести її в код, експортуйте зони.";
    return true;
  }

  #source(category, index) { return this.#config.locations.map[this.#state.locationId]?.zones?.[category]?.[index]; }
  #changed() { this.revision++; this.#preview = null; this.message = ""; }
}
