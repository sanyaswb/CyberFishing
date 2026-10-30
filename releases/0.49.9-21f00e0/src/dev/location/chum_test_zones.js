import { MOVE_SHARE } from "./zone_editor_state.js";

// A new test zone's radius: 2 m at the engine's 50 base pixels per metre.
const DEFAULT_RADIUS = 100;
const EDGE_PX = 10;
const RADIUS = "radius";
// A test zone keeps radius, a game ChumZone baseRadius; both are base pixels.
const radiusOf = zone => (RADIUS in zone ? zone.radius : zone.baseRadius);

// Spec 136 R2-5: editor-only chum zones (session, per location) to see how a chum spot looks at a place and size. They
// are drawn by the game's own chum renderer (world.chumZones records, full bonus) and never touch items or the game's
// chum. Each zone: map centre and base radius (base pixels, as ChumZone.baseRadius). Like the other zones only the
// selected number is taken: its middle MOVE_SHARE moves it, its edge resizes it, both snapped to the cell step.
// TK-088: the game's own chum zones on the location (delivered, not expired) come first in the same numbering and are
// edited the same way (centre, baseRadius); a moved game zone is saved through saveGameZones. Only test zones are
// drawn here (the game draws its own) and only test zones can be removed.
export class ChumTestZones {
  revision = 0;
  #zones = new Map();
  #getGameZones;
  #saveGameZones;
  #selected = 0;
  #all = false;
  #editing = false;
  #hovered = false;

  // getGameZones(locationId): the game's chum zones on that location ([] for another one); saveGameZones(): persists them.
  constructor({ getGameZones = () => [], saveGameZones = null } = {}) {
    this.#getGameZones = getGameZones; this.#saveGameZones = saveGameZones;
  }

  // The game's zones first, then the test zones.
  list(locationId) {
    const game = this.#game(locationId), test = this.#test(locationId);
    return game.length ? [...game, ...test] : test;
  }

  isGameZone(locationId, index) {
    return index >= 0 && index < this.#game(locationId).length;
  }

  #game(locationId) {
    return (this.#getGameZones(locationId) || []).filter(zone => !zone.isExpired);
  }

  #test(locationId) {
    return this.#zones.get(locationId) || [];
  }

  get selected() {
    return this.#selected;
  }

  get isEditing() {
    return this.#editing;
  }

  get hovered() {
    return this.#hovered;
  }

  setEditing(value) {
    const next = value === true;
    if (next !== this.#editing) { this.#editing = next; this.#hovered = false; this.revision++; }
  }

  select(index) {
    const next = Math.max(0, Math.floor(Number(index) || 0));
    if (next !== this.#selected || this.#all) { this.#selected = next; this.#all = false; this.#hovered = false; this.revision++; }
  }

  // TK-089: every zone (the game's and the test ones) is taken, the one under the pointer.
  get selectsAll() {
    return this.#all;
  }

  selectAll() {
    if (!this.#all) { this.#all = true; this.#hovered = false; this.revision++; }
  }

  isSelected(index) {
    return this.#all || index === this.#selected;
  }

  add(locationId, x, y) {
    const zones = this.#zones.get(locationId) || [];
    zones.push({ x, y, radius: DEFAULT_RADIUS });
    this.#zones.set(locationId, zones);
    this.#selected = this.#game(locationId).length + zones.length - 1;
    this.#all = false;
    this.revision++;
  }

  remove(locationId, index) {
    const zones = this.#test(locationId), offset = this.#game(locationId).length;
    if (index < offset || !zones[index - offset]) return;
    zones.splice(index - offset, 1);
    this.#selected = Math.max(0, Math.min(this.#selected, offset + zones.length - 1));
    this.#hovered = false;
    this.revision++;
  }

  // The game's chum zone records (BoatChumRenderFrameBuilder's ellipse on the water surface).
  buildInto(target, locationId, metric, projector, point) {
    for (const zone of this.#test(locationId)) {
      const record = target.chumZones.acquire();
      projector.virtualToScreen(zone.x, zone.y, point);
      record.opacity = 1;
      record.x = point.x; record.y = point.y;
      record.radiusX = zone.radius * metric.surfaceScaleAt(zone.y) * projector.getScale();
      record.radiusY = record.radiusX * metric.surfaceSquashY;
    }
  }

  // The selected zone's hit at a screen point (with "Всі" the first zone hit): { move } in its middle, { edge } on its
  // rim; null otherwise.
  hit(px, py, locationId, metric, projector, point) {
    if (!this.#editing) return null;
    const zones = this.list(locationId);
    for (let index = 0; index < zones.length; index++) {
      if (!this.isSelected(index)) continue;
      const zone = zones[index];
      projector.virtualToScreen(zone.x, zone.y, point);
      const rx = radiusOf(zone) * metric.surfaceScaleAt(zone.y) * projector.getScale(), ry = rx * metric.surfaceSquashY;
      const distance = Math.hypot((px - point.x) / rx, (py - point.y) / ry);
      if (distance <= MOVE_SHARE) return { kind: "chum", index, move: true, cursor: "move" };
      if (Math.abs(distance - 1) * Math.min(rx, ry) <= EDGE_PX) return { kind: "chum", index, move: false, cursor: "xy" };
    }
    return null;
  }

  // Whether a map point lies inside a selected zone (hover).
  contains(x, y, locationId, metric) {
    if (!this.#editing) return false;
    const zones = this.list(locationId);
    for (let index = 0; index < zones.length; index++) {
      if (!this.isSelected(index)) continue;
      const zone = zones[index], scale = metric.surfaceScaleAt(zone.y);
      if (Math.hypot((x - zone.x) / scale, (y - zone.y) / (scale * metric.surfaceSquashY)) <= radiusOf(zone)) return true;
    }
    return false;
  }

  hover(inside) {
    if (inside !== this.#hovered) { this.#hovered = inside; this.revision++; }
  }

  // move: the centre to the snapped map point; edge: the radius to the pointer's distance over the surface, snapped.
  drag(handle, locationId, x, y, step, metric) {
    const zone = this.list(locationId)[handle.index];
    if (!zone) return;
    if (handle.move) {
      const nextX = Math.round(x / step) * step, nextY = Math.round(y / step) * step;
      if (nextX === zone.x && nextY === zone.y) return;
      zone.x = nextX; zone.y = nextY;
    } else {
      const scale = metric.surfaceScaleAt(zone.y);
      const dx = (x - zone.x) / scale, dy = (y - zone.y) / (scale * metric.surfaceSquashY);
      const radius = Math.max(step, Math.round(Math.hypot(dx, dy) / step) * step);
      if (radius === radiusOf(zone)) return;
      if (RADIUS in zone) zone.radius = radius; else zone.baseRadius = radius;
    }
    if (this.isGameZone(locationId, handle.index)) this.#saveGameZones?.();
    this.revision++;
  }
}
