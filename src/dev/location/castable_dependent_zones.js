import { Vector2 } from "../../engine/math/vector2.js";

// Spec 136: the zones measured from the castable area's bottom edge (the shore line), in the order of the castable
// list. show: the game's own CONFIG.locations switch and its default (on unless false, or off unless true); edit: what
// the editor may drag ("line": the far line, "anchor": the base anchor on the bottom edge).
export const DEPENDENT_ZONES = Object.freeze([
  Object.freeze({ id: "aiming", show: "showAimingZone", defaultOn: true, color: "#4da6ff" }),
  Object.freeze({ id: "handChum", show: "showAimingZone", defaultOn: true, color: "#ffb347", edit: "line" }),
  Object.freeze({ id: "net", show: "showNetZone", defaultOn: true, color: "#33dd88" }),
  Object.freeze({ id: "lastDash", show: "showLastDashZone", defaultOn: false, color: "#b366ff" }),
  Object.freeze({ id: "catch", show: "showCatchZone", defaultOn: true, color: "#3388ff", edit: "anchor" }),
  Object.freeze({ id: "sector", show: "showPoleFightSector", defaultOn: false, color: "#ff8844" }),
  Object.freeze({ id: "line", show: "showFightLineRadius", defaultOn: false, color: "#dddddd", edit: "anchor" }),
  Object.freeze({ id: "chum", show: "showChumZones", defaultOn: true, color: "#ffdd33" }),
]);
const BY_ID = new Map(DEPENDENT_ZONES.map(zone => [zone.id, zone]));
// The fight sector needs its own work (owner, R-Q2) and chum spots exist only at runtime: shown in the game only.
const PREVIEWED = new Set(["aiming", "handChum", "net", "lastDash", "catch", "line"]);
const EDGE_PX = 10;
const HALF_CIRCLE_SEGMENTS = 32;

// The castable area's dependent zones in the location editor (spec 136): their editor state (which may be dragged,
// the hovered one, the chosen net and fish, the half-circles' base anchors), static previews of the real values
// (CastableZoneReadings) measured from the bottom edge, and their hover and drag. Only hand chum writes a game value:
// MAP_DB.<id>.chumCastDistance through the validated config path. revision changes whenever what is drawn changes.
export class CastableDependentZones {
  revision = 0;
  #state; #config; #readings; #map; #projector; #getMetric; #writeConfig;
  #editing = new Set();
  #hovered = null;
  #netId = null;
  #fishId = null;
  #anchors = { catch: null, line: null };
  #anchorLocation = null;
  #values = [];
  #ground = new Vector2();
  #point = new Vector2();
  #screen = new Vector2();

  // writeConfig(path, value): the validated runtime config write (DevTools).
  constructor({ state, config, readings, map, projector, getWaterMetric, writeConfig }) {
    this.#state = state; this.#config = config; this.#readings = readings; this.#map = map;
    this.#projector = projector; this.#getMetric = getWaterMetric; this.#writeConfig = writeConfig;
  }

  get readings() {
    return this.#readings;
  }

  isShown(id) {
    const zone = BY_ID.get(id), value = this.#config.locations[zone.show];
    return zone.defaultOn ? value !== false : value === true;
  }

  isEditing(id) {
    return this.#editing.has(id);
  }

  setEditing(id, value) {
    if (!BY_ID.get(id)?.edit) throw new TypeError("Not an editable dependent zone");
    if (this.#editing.has(id) === (value === true)) return;
    if (value === true) this.#editing.add(id); else { this.#editing.delete(id); if (this.#hovered === id) this.#hovered = null; }
    this.revision++;
  }

  get netId() {
    return this.#netId ?? this.#readings.nets[0]?.[0] ?? null;
  }

  setNet(id) {
    if (id !== this.#netId) { this.#netId = id; this.revision++; }
  }

  get fishId() {
    return this.#fishId ?? this.#readings.fishes[0]?.[0] ?? null;
  }

  setFish(id) {
    if (id !== this.#fishId) { this.#fishId = id; this.revision++; }
  }

  get hovered() {
    return this.#hovered;
  }

  // Once per frame while the editor draws: re-reads the real values (equipment, the location's chum distance) and the
  // anchors' location, bumping the revision only when something changed. Returns the revision.
  refresh() {
    const locationId = this.#state.locationId;
    if (this.#anchorLocation !== locationId) {
      this.#anchorLocation = locationId;
      this.#anchors.catch = null; this.#anchors.line = null; this.#hovered = null;
      this.revision++;
    }
    const readings = this.#readings, values = this.#values;
    const next = [readings.rodCastPx(), readings.handChumPx(locationId), readings.netPx(this.netId),
      readings.lastDashMeters(this.fishId), readings.landingMeters(), readings.lineMeters()];
    let changed = values.length !== next.length;
    for (let index = 0; index < next.length; index++) {
      if (values[index] !== next[index]) { values[index] = next[index]; changed = true; }
    }
    if (changed) this.revision++;
    return this.revision;
  }

  // draw: band(left, top, right, bottom, look) and polygon(points, look), handle(x, y, look) in map pixels; look:
  // { color, editable, hovered }. Only zones shown in the game are previewed.
  buildInto(draw) {
    const frame = this.#frame();
    if (!frame) return;
    const [rodCast, handChum, net, lastDash, landing, line] = this.#values;
    const ppm = this.#readings.pixelsPerMeter;
    for (const zone of DEPENDENT_ZONES) {
      if (!PREVIEWED.has(zone.id) || !this.isShown(zone.id)) continue;
      const look = { color: zone.color, editable: this.isEditing(zone.id), hovered: this.#hovered === zone.id };
      const reach = { aiming: rodCast, handChum, net, lastDash: lastDash === null ? null : lastDash * ppm }[zone.id];
      if (reach !== undefined) {
        if (reach === null) continue;
        draw.band(frame.left, this.#farY(frame, reach), frame.right, frame.shore, look);
        continue;
      }
      const meters = zone.id === "catch" ? landing : line;
      if (meters === null) continue;
      const centre = this.#anchorX(zone.id, frame);
      draw.polygon(this.#halfCircle(frame, centre, meters * ppm), look);
      if (look.editable) {
        draw.handle(centre, frame.shore, look);
        draw.handle(this.#point.x, this.#point.y, look);
      }
    }
  }

  // The handle under a screen point, or null: hand chum's far line, or a half-circle's base anchor.
  hit(px, py) {
    const frame = this.#frame();
    if (!frame) return null;
    for (const zone of DEPENDENT_ZONES) {
      if (!zone.edit || !this.isEditing(zone.id) || !this.isShown(zone.id)) continue;
      if (zone.edit === "line") {
        const y = this.#screenY(this.#farY(frame, this.#values[1]));
        const left = this.#screenX(frame.left), right = this.#screenX(frame.right);
        if (Math.abs(py - y) <= EDGE_PX && px >= left - EDGE_PX && px <= right + EDGE_PX) return { id: zone.id, kind: "line", cursor: "y" };
        continue;
      }
      if ((zone.id === "catch" ? this.#values[4] : this.#values[5]) === null) continue;
      this.#projector.virtualToScreen(this.#anchorX(zone.id, frame), frame.shore, this.#screen);
      if (Math.hypot(px - this.#screen.x, py - this.#screen.y) <= EDGE_PX) return { id: zone.id, kind: "anchor", cursor: "x" };
    }
    return null;
  }

  // The hovered editable zone (the one whose area holds the point); a change bumps the revision.
  hover(px, py) {
    const frame = this.#frame();
    let next = null;
    if (frame) {
      const point = this.#projector.screenToVirtual(px, py, this.#point);
      for (const zone of DEPENDENT_ZONES) {
        if (!zone.edit || !this.isEditing(zone.id) || !this.isShown(zone.id)) continue;
        if (zone.edit === "line") {
          if (point.y <= frame.shore && point.y >= this.#farY(frame, this.#values[1]) - EDGE_PX && point.x >= frame.left && point.x <= frame.right) next = zone.id;
          continue;
        }
        const meters = zone.id === "catch" ? this.#values[4] : this.#values[5];
        if (meters === null) continue;
        const metric = frame.metric;
        metric.toGround(this.#anchorX(zone.id, frame), frame.shore, this.#ground);
        const centreX = this.#ground.x;
        metric.toGround(point.x, point.y, this.#ground);
        if (this.#ground.y >= 0 && Math.hypot(this.#ground.x - centreX, this.#ground.y) <= meters * this.#readings.pixelsPerMeter / metric.pixelsPerMeter) next = zone.id;
      }
    }
    if (next !== this.#hovered) { this.#hovered = next; this.revision++; }
  }

  clearHover() {
    if (this.#hovered !== null) { this.#hovered = null; this.revision++; }
  }

  allowed(handle) {
    return this.isEditing(handle.id) && this.isShown(handle.id) && !!this.#frame();
  }

  // Moves a handle to a map point, snapped to the map's cell step like zone edges (cellSize x snapCells).
  drag(handle, x, y) {
    const frame = this.#frame();
    if (!frame) return;
    const step = this.#config.locations.cellSize * Math.max(1, this.#state.snapCells || 1);
    if (handle.kind === "line") {
      const snapped = Math.min(frame.shore - step, Math.max(frame.top, Math.round(y / step) * step));
      const distance = Math.round(frame.metric.metersFromShore(snapped) * frame.metric.pixelsPerMeter);
      if (distance !== this.#values[1]) {
        this.#writeConfig(["CONFIG", "locations", "map", this.#state.locationId, "chumCastDistance"], distance);
      }
      return;
    }
    const snapped = Math.min(frame.right, Math.max(frame.left, Math.round(x / step) * step));
    if (snapped !== this.#anchors[handle.id]) { this.#anchors[handle.id] = snapped; this.revision++; }
  }

  #frame() {
    const state = this.#state;
    if (!state.enabled || !state.editsLoadedLocation || this.#config.locations.enableCastable === false) return null;
    const metric = this.#getMetric();
    const bounds = this.#map.getCastableBoundsVirtual(this.#config.locations.cellSize);
    if (!metric || !bounds) return null;
    return { metric, left: bounds.left, right: bounds.right, top: bounds.top, shore: bounds.bottom };
  }

  #farY(frame, basePixels) {
    return Math.max(frame.top, frame.metric.yAtBasePixels(Math.min(basePixels, frame.metric.topBasePixels)));
  }

  #anchorX(id, frame) {
    return this.#anchors[id] ?? (frame.left + frame.right) / 2;
  }

  // The water half-circle above the shore around (centreX, shore), radius in base pixels, as map points; it leaves the
  // far end of its middle line in this.#point (the length marker).
  #halfCircle(frame, centreX, radiusBasePixels) {
    const metric = frame.metric, points = [];
    metric.toGround(centreX, frame.shore, this.#ground);
    const gx = this.#ground.x, gy = this.#ground.y, radius = radiusBasePixels / metric.pixelsPerMeter;
    for (let index = 0; index <= HALF_CIRCLE_SEGMENTS; index++) {
      const angle = Math.PI * index / HALF_CIRCLE_SEGMENTS;
      metric.toVirtual(gx + Math.cos(angle) * radius, gy + Math.sin(angle) * radius, this.#point);
      points.push(this.#point.x, this.#point.y);
    }
    metric.toVirtual(gx, gy + radius, this.#point);
    return points;
  }

  #screenX(x) {
    return this.#projector.virtualToScreen(x, 0, this.#screen).x;
  }

  #screenY(y) {
    return this.#projector.virtualToScreen(0, y, this.#screen).y;
  }
}
