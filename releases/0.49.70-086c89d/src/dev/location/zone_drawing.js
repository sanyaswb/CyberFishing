import { ZONE_PHYSICS_KEYS } from "./zone_category_colors.js";
import { cutZones, mergeTouchingZones } from "./zone_cell_shapes.js";

const EPSILON = 1e-9;
const near = value => Number(value.toPrecision(12));

// Spec 141: drawing new zones of a category on the map grid. «Додати зону» starts it for castable, obstacle and snag
// zones (moving zones keep their own add, D3); the new zones are appended to the category in the session config at
// once, so they draw, list and move like any zone; zones that were there stay untouched (the drag tool takes only the
// new ones, base and up). A LMB press on a cell starts a rectangle of whole grid cells that spans the press cell and
// the pointer's cell along both axes until release; a RMB rectangle cuts its cells out of the new zones (Revision 2: a
// zone keeps its remaining shape, an L with a mask, and splits only into pieces that fall apart). New zones that overlap
// or touch side by side merge on release; «Застосувати» merges them with the zones that were there. Cells are whole cells of the current grid inside the allowed area
// (D1): the whole map for the castable area, the castable bounds for the others. «Застосувати» ends the mode keeping
// the zones; «Скасувати» writes the category back as it was. The editor, its category or the location going away
// ends the mode and keeps what was drawn.
export class ZoneDrawing {
  #state; #config; #getMap; #write;
  #draft = null;
  #gesture = null;
  revision = 0;

  // writeConfig(path, value): the validated runtime config write; getMap(): the location map on screen.
  constructor({ state, config, getMap, writeConfig }) {
    this.#state = state; this.#config = config; this.#getMap = getMap; this.#write = writeConfig;
  }

  sync() {
    const d = this.#draft, s = this.#state;
    if (d && (!s.enabled || !s.editsLoadedLocation || s.locationId !== d.location || !s.isEditable(d.category) ||
      this.#config.locations[ZONE_PHYSICS_KEYS[d.category]] === false)) this.#leave();
  }

  get category() { this.sync(); return this.#draft?.category ?? null; }
  isActive(category) { return this.category === category; }
  // The first new zone's index: zones below it were there before the mode.
  get base() { return this.#draft?.base ?? 0; }
  isNewZone(category, index) { return this.isActive(category) && index >= this.#draft.base; }
  get gesture() { return this.#gesture; }

  start(category) {
    if (category === "dynamic") return false;
    const s = this.#state;
    if (!s.enabled || !s.editsLoadedLocation || !s.isEditable(category) ||
      this.#config.locations[ZONE_PHYSICS_KEYS[category]] === false || !this.#getMap()) return false;
    this.#leave();
    const zones = this.#zones(category, s.locationId);
    this.#draft = { category, location: s.locationId, base: zones.length, snapshot: JSON.parse(JSON.stringify(zones)) };
    s.selectAll(category);
    this.revision++;
    return true;
  }

  apply() {
    const d = this.#draft, g = d && this.#grid();
    this.#leave();
    if (!g) return;
    const merged = mergeTouchingZones(this.#zones(d.category, d.location), g.step);
    if (merged) this.#write(this.#path(d), merged.zones);
  }

  cancel() {
    const d = this.#draft;
    if (!d) return;
    this.#leave();
    this.#write(this.#path(d), d.snapshot);
  }

  // The allowed area in map pixels: whole grid cells only.
  allowedArea() {
    const g = this.#grid();
    return g && { left: g.iMin * g.cellPx, top: g.jMin * g.cellPx, right: (g.iMax + 1) * g.cellPx, bottom: (g.jMax + 1) * g.cellPx };
  }

  // The RMB rectangle being drawn, in map pixels, or null.
  eraseArea() {
    const gesture = this.#gesture, g = gesture?.erase ? this.#grid() : null;
    if (!g) return null;
    return { left: Math.min(gesture.i0, gesture.i1) * g.cellPx, top: Math.min(gesture.j0, gesture.j1) * g.cellPx,
      right: (Math.max(gesture.i0, gesture.i1) + 1) * g.cellPx, bottom: (Math.max(gesture.j0, gesture.j1) + 1) * g.cellPx };
  }

  // x, y: map pixels. Returns whether a gesture started (a press inside the allowed area).
  begin(x, y, erase = false) {
    this.sync();
    const d = this.#draft, g = d && this.#grid();
    if (!g) return false;
    const i = Math.floor(x / g.cellPx), j = Math.floor(y / g.cellPx);
    if (i < g.iMin || i > g.iMax || j < g.jMin || j > g.jMax) return false;
    const zones = this.#zones(d.category, d.location);
    this.#gesture = { erase, i0: i, j0: j, i1: i, j1: j, index: erase ? -1 : zones.length };
    if (!erase) this.#write(this.#path(d), [...zones, this.#rect(g)]);
    this.revision++;
    return true;
  }

  // The pointer's cell, held inside the allowed area: the rectangle grows or shrinks with it.
  extend(x, y) {
    const d = this.#draft, gesture = this.#gesture, g = d && gesture && this.#grid();
    if (!g) return;
    const i = Math.max(g.iMin, Math.min(g.iMax, Math.floor(x / g.cellPx)));
    const j = Math.max(g.jMin, Math.min(g.jMax, Math.floor(y / g.cellPx)));
    if (i === gesture.i1 && j === gesture.j1) return;
    gesture.i1 = i; gesture.j1 = j;
    if (!gesture.erase) {
      const zones = this.#zones(d.category, d.location);
      this.#write(this.#path(d), zones.map((zone, index) => index === gesture.index ? this.#rect(g) : zone));
    }
    this.revision++;
  }

  end() {
    const d = this.#draft, gesture = this.#gesture, g = d && gesture && this.#grid();
    this.#gesture = null;
    if (!g) return;
    const zones = this.#zones(d.category, d.location);
    if (gesture.erase) {
      const next = cutZones(zones, d.base, this.#rect(g, gesture), g.step);
      if (next.length !== zones.length || next.some((zone, index) => zone !== zones[index])) this.#write(this.#path(d), next);
    } else {
      const merged = mergeTouchingZones(zones, g.step, { base: d.base });
      if (merged) this.#write(this.#path(d), merged.zones);
    }
    this.revision++;
  }

  #leave() {
    if (!this.#draft) return;
    this.#draft = null; this.#gesture = null; this.revision++;
  }

  // The current grid over the allowed area: cellPx map pixels a cell, step design cells a cell, cell index ranges.
  #grid() {
    const map = this.#getMap(), locations = this.#config.locations, d = this.#draft;
    if (!map || !d) return null;
    const cellPx = map.getCellSize?.() ?? locations.cellSize, design = locations.designCellSize || cellPx;
    const area = d.category === "castable" ? { left: 0, top: 0, right: locations.baseResolution.width, bottom: locations.baseResolution.height }
      : map.getCastableBoundsVirtual(cellPx);
    const iMin = Math.ceil(area.left / cellPx - EPSILON), iMax = Math.floor(area.right / cellPx + EPSILON) - 1;
    const jMin = Math.ceil(area.top / cellPx - EPSILON), jMax = Math.floor(area.bottom / cellPx + EPSILON) - 1;
    if (iMax < iMin || jMax < jMin) return null;
    return { cellPx, step: cellPx / design, iMin, iMax, jMin, jMax };
  }

  // The gesture's rectangle in design cells.
  #rect(g, gesture = this.#gesture) {
    const step = g.step;
    const i = Math.min(gesture.i0, gesture.i1), j = Math.min(gesture.j0, gesture.j1);
    return { x: near(i * step), y: near(j * step), w: near((Math.abs(gesture.i1 - gesture.i0) + 1) * step),
      h: near((Math.abs(gesture.j1 - gesture.j0) + 1) * step) };
  }

  #zones(category, location) { return this.#config.locations.map[location]?.zones?.[category] || []; }
  #path(d) { return ["CONFIG", "locations", "map", d.location, "zones", d.category]; }
}
