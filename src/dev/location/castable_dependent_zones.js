import { Vector2 } from "../../engine/math/vector2.js";
import { PoleFightSectorGeometry } from "../../game/domain/fishing/pole_fight_sector_geometry.js";
import { FISHING_ZONE_COLORS } from "../../game/presentation/styles/fishing_zone_colors.js";
import { ChumTestZones } from "./chum_test_zones.js";

// Spec 136: the zones inside the castable area, in the order of the "Зони риболовлі" section. show: the game's own
// CONFIG.locations switch and its default (on unless false, or off unless true); overlay: the game draws it only while
// CONFIG.locations.debugVisuals is on (FightAreaRenderFrameBuilder), so its switch and preview depend on that parent.
// Colours: the fishing zones' one look shared with the game's own overlays (spec 136 R3-1).
export const DEPENDENT_ZONES = Object.freeze([
  Object.freeze({ id: "handChum", show: "showAimingZone", defaultOn: true, color: FISHING_ZONE_COLORS.handChum }),
  Object.freeze({ id: "net", show: "showNetZone", defaultOn: true, color: FISHING_ZONE_COLORS.net, overlay: true }),
  Object.freeze({ id: "lastDash", show: "showLastDashZone", defaultOn: false, color: FISHING_ZONE_COLORS.lastDash, overlay: true }),
  Object.freeze({ id: "catch", show: "showCatchZone", defaultOn: true, color: FISHING_ZONE_COLORS.catch, overlay: true }),
  Object.freeze({ id: "sector", show: "showPoleFightSector", defaultOn: false, color: FISHING_ZONE_COLORS.sector, overlay: true }),
  Object.freeze({ id: "line", show: "showFightLineRadius", defaultOn: false, color: FISHING_ZONE_COLORS.line, overlay: true }),
  Object.freeze({ id: "chum", show: "showChumZones", defaultOn: true, color: FISHING_ZONE_COLORS.chum }),
]);
// The game states with a cast out: the game then draws the fight-area overlays from the real float (R3-2); only a
// waiting float (no fish on) may be moved by the editor (R3-3).
const CAST_STATES = new Set(["waiting", "biting", "playing"]);
const BY_ID = new Map(DEPENDENT_ZONES.map(zone => [zone.id, zone]));
const FLOAT_COLOR = "#ffffff";
const EDGE_PX = 10;
const ARC_SEGMENTS = 64;
const HALF_CIRCLE_SEGMENTS = 32;
const DEFAULT_LINE_METERS = 10;

// The castable area's zones in the location editor (spec 136, Revision 2): their editor state (hand chum editing, the
// chosen net and fish, the line length, the conditional float, the test chum zones), previews of the real values
// (CastableZoneReadings) from the rod's real position on the bottom edge, and their hover and drag. Only hand chum
// writes a game value: MAP_DB.<id>.chumCastDistance through the validated config path. revision changes whenever what
// is drawn changes.
export class CastableDependentZones {
  #revision = 0;
  #state; #config; #readings; #map; #projector; #getMetric; #writeConfig; #getRodScreenX; #canvasMetrics;
  #getFloat; #getGameStateName; #checkWater; #equipmentRules; #getHookDepthMeters; #getEquipment;
  #realFloat = { x: 0, y: 0, movable: false };
  #sector = new PoleFightSectorGeometry();
  #chum = new ChumTestZones();
  #editingChumLine = false;
  #movingFloat = false;
  #hovered = null;
  #netId = null;
  #fishId = null;
  #lineMeters = DEFAULT_LINE_METERS;
  #fromEquipment = false;
  #float = null;
  #floatLocation = null;
  #values = [];
  #origin = new Vector2();
  #plane = new Vector2();
  #point = new Vector2();
  #screen = new Vector2();

  // writeConfig(path, value): the validated runtime config write (DevTools); getRodScreenX(): the game's rod screen X.
  // R3: getFloat(), getGameStateName(), checkWater(x, y), equipmentRules, getHookDepthMeters(), getEquipment(): the
  // game's cast float and the limits it obeys (optional: without them the real float is never used).
  constructor({ state, config, readings, map, projector, getWaterMetric, writeConfig, getRodScreenX = null, canvasMetrics,
    getFloat = null, getGameStateName = null, checkWater = null, equipmentRules = null, getHookDepthMeters = () => null,
    getEquipment = null }) {
    this.#state = state; this.#config = config; this.#readings = readings; this.#map = map;
    this.#projector = projector; this.#getMetric = getWaterMetric; this.#writeConfig = writeConfig;
    this.#getRodScreenX = getRodScreenX; this.#canvasMetrics = canvasMetrics;
    this.#getFloat = getFloat; this.#getGameStateName = getGameStateName; this.#checkWater = checkWater;
    this.#equipmentRules = equipmentRules; this.#getHookDepthMeters = getHookDepthMeters; this.#getEquipment = getEquipment;
  }

  // R3-2: the game's float while a cast is out and the zones take the equipment's values; null otherwise.
  #castFloat() {
    if (!this.#fromEquipment || !this.#getFloat || !this.#getGameStateName) return null;
    const stateName = this.#getGameStateName();
    if (!CAST_STATES.has(stateName)) return null;
    const position = this.#getFloat()?.getPosition?.();
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
    this.#realFloat.x = position.x; this.#realFloat.y = position.y; this.#realFloat.movable = stateName === "waiting";
    return this.#realFloat;
  }

  get revision() {
    return this.#revision + this.#chum.revision;
  }

  get readings() {
    return this.#readings;
  }

  get chumZones() {
    return this.#chum;
  }

  // Whether any of these zones is shown: the geometry builder then draws even with the editor off.
  get hasShown() {
    return DEPENDENT_ZONES.some(zone => this.isShown(zone.id));
  }

  // Shown as the game shows it: its own switch, and the overlay master for the fight-area overlays.
  isShown(id) {
    const zone = BY_ID.get(id), locations = this.#config.locations, value = locations[zone.show];
    if (zone.overlay && !locations.debugVisuals) return false;
    return zone.defaultOn ? value !== false : value === true;
  }

  get editingChumLine() {
    return this.#editingChumLine;
  }

  setEditingChumLine(value) {
    if (this.#editingChumLine !== (value === true)) { this.#editingChumLine = value === true; this.#hovered = null; this.#revision++; }
  }

  get movingFloat() {
    return this.#movingFloat;
  }

  setMovingFloat(value) {
    if (this.#movingFloat !== (value === true)) { this.#movingFloat = value === true; this.#revision++; }
  }

  // The editor's typed line length (the field's value).
  get lineMeters() {
    return this.#lineMeters;
  }

  // TK-069: take the line and the net from the game's equipment instead of the editor's field and select.
  get fromEquipment() {
    return this.#fromEquipment;
  }

  setFromEquipment(value) {
    if (this.#fromEquipment !== (value === true)) { this.#fromEquipment = value === true; this.#revision++; }
  }

  // The line every line-dependent preview uses: the equipped line while taking the equipment (the typed length when
  // nothing is equipped), else the typed length.
  get effectiveLineMeters() {
    return (this.#fromEquipment ? this.#readings.equippedLineMeters() : null) ?? this.#lineMeters;
  }

  // The released line in metres (R2-1); the float stays within it.
  setLineMeters(value) {
    const next = Math.max(0.5, Math.min(1000, Number(value) || DEFAULT_LINE_METERS));
    if (next === this.#lineMeters) return this.#lineMeters;
    this.#lineMeters = next;
    this.#float = null;
    this.#revision++;
    return next;
  }

  get netId() {
    return this.#netId ?? this.#readings.nets[0]?.[0] ?? null;
  }

  setNet(id) {
    if (id !== this.#netId) { this.#netId = id; this.#revision++; }
  }

  get fishId() {
    return this.#fishId ?? this.#readings.fishes[0]?.[0] ?? null;
  }

  setFish(id) {
    if (id !== this.#fishId) { this.#fishId = id; this.#revision++; }
  }

  get hovered() {
    return this.#hovered;
  }

  addChumZone() {
    const frame = this.#frame();
    // Adding works with the editor off too: the zone shows at once; moving and resizing it need the editor.
    if (!frame) return;
    const x = (frame.left + frame.right) / 2, y = (frame.top + frame.shore) / 2;
    this.#chum.add(this.#state.locationId, x, y);
  }

  // Once per frame while the editor draws: re-reads the real values, the rod's position and the game's show switches
  // (a switch changes what is drawn too), bumping the revision only when something changed. Returns the revision.
  refresh() {
    const locationId = this.#state.locationId;
    if (this.#floatLocation !== locationId) { this.#floatLocation = locationId; this.#float = null; this.#hovered = null; this.#revision++; }
    const readings = this.#readings, values = this.#values;
    const net = this.#fromEquipment ? readings.equippedNetPx() : readings.netPx(this.netId);
    const cast = this.#castFloat();
    const next = [readings.handChumPx(locationId), net, readings.lastDashMeters(this.fishId),
      readings.landingMeters(), this.#rodX(), this.effectiveLineMeters, cast ? cast.x : null, cast ? cast.y : null,
      cast ? cast.movable : null];
    for (const zone of DEPENDENT_ZONES) next.push(this.isShown(zone.id));
    let changed = values.length !== next.length;
    for (let index = 0; index < next.length; index++) {
      if (values[index] !== next[index]) { values[index] = next[index]; changed = true; }
    }
    if (changed) this.#revision++;
    return this.revision;
  }

  // draw: band(left, top, right, bottom, look), polygon(points, look), handle(x, y, look) in map pixels; look:
  // { color, editable, hovered }. Only zones shown in the game are previewed.
  buildInto(draw) {
    const frame = this.#frame();
    if (!frame) return;
    const [handChum, net, lastDash, landing] = this.#values;
    const ppm = this.#readings.pixelsPerMeter;
    const look = (id, editable = false) => ({ color: BY_ID.get(id).color, editable, hovered: editable && this.#hovered === id });
    if (this.isShown("handChum")) draw.band(frame.left, this.#farY(frame, handChum), frame.right, frame.shore, look("handChum", this.#editingChumLine));
    // R3-2: with a real cast the game draws these zones from the real float itself; the editor marks the float only.
    const cast = this.#castFloat();
    if (cast) {
      if (this.isShown("sector") || this.isShown("line")) {
        draw.handle(cast.x, cast.y, { color: FLOAT_COLOR, editable: this.#movingFloat && cast.movable, hovered: false });
      }
      return;
    }
    if (this.isShown("net") && net !== null) draw.band(frame.left, this.#farY(frame, net), frame.right, frame.shore, look("net"));
    if (this.isShown("lastDash") && lastDash !== null) draw.band(frame.left, this.#farY(frame, lastDash * ppm), frame.right, frame.shore, look("lastDash"));
    if (this.isShown("catch") && landing !== null) draw.polygon(this.#landingCircle(frame, landing * ppm), look("catch"));
    const sector = this.isShown("sector"), line = this.isShown("line");
    if (!sector && !line) return;
    const origin = this.#planeOrigin(frame);
    if (line) draw.polygon(this.#lineCircle(frame, origin), look("line"));
    const float = this.#floatPlane(frame, origin);
    if (sector) {
      const points = this.#sectorPoints(frame, origin, float);
      if (points) draw.polygon(points, look("sector"));
    }
    frame.metric.fromBasePlane(float.x, float.y, this.#point);
    draw.handle(this.#point.x, this.#point.y, { color: FLOAT_COLOR, editable: this.#movingFloat, hovered: false });
  }

  // The world frame's chum zone records: the test zones look exactly like thrown chum (R2-5).
  buildChumZonesInto(target) {
    const frame = this.#frame();
    if (!frame || !this.isShown("chum")) return;
    this.#chum.buildInto(target, this.#state.locationId, frame.metric, this.#projector, this.#screen);
  }

  // The handle under a screen point, or null: the float, a test chum zone, or hand chum's far line.
  hit(px, py) {
    const frame = this.#editingFrame();
    if (!frame) return null;
    if (this.#movingFloat && (this.isShown("sector") || this.isShown("line"))) {
      const cast = this.#castFloat();
      if (cast && !cast.movable) return null;
      if (cast) { this.#point.x = cast.x; this.#point.y = cast.y; } else {
        const origin = this.#planeOrigin(frame), float = this.#floatPlane(frame, origin);
        frame.metric.fromBasePlane(float.x, float.y, this.#point);
      }
      this.#projector.virtualToScreen(this.#point.x, this.#point.y, this.#screen);
      if (Math.hypot(px - this.#screen.x, py - this.#screen.y) <= EDGE_PX) return { kind: "float", cursor: "move" };
    }
    if (this.isShown("chum")) {
      const chum = this.#chum.hit(px, py, this.#state.locationId, frame.metric, this.#projector, this.#screen);
      if (chum) return chum;
    }
    if (this.#editingChumLine && this.isShown("handChum")) {
      const y = this.#projector.virtualToScreen(0, this.#farY(frame, this.#values[0]), this.#screen).y;
      const left = this.#projector.virtualToScreen(frame.left, 0, this.#screen).x;
      const right = this.#projector.virtualToScreen(frame.right, 0, this.#screen).x;
      if (Math.abs(py - y) <= EDGE_PX && px >= left - EDGE_PX && px <= right + EDGE_PX) return { kind: "line", cursor: "y" };
    }
    return null;
  }

  // Hover fills the edited hand chum band or the selected test chum zone while the pointer is over it.
  hover(px, py) {
    const frame = this.#editingFrame();
    let next = null, chum = false;
    if (frame) {
      const point = this.#projector.screenToVirtual(px, py, this.#point);
      if (this.#editingChumLine && this.isShown("handChum") && point.y <= frame.shore &&
        point.y >= this.#farY(frame, this.#values[0]) - EDGE_PX && point.x >= frame.left && point.x <= frame.right) next = "handChum";
      const zone = this.#chum.isEditing && this.isShown("chum") ? this.#chum.list(this.#state.locationId)[this.#chum.selected] : null;
      if (zone) {
        const scale = frame.metric.surfaceScaleAt(zone.y);
        chum = Math.hypot((point.x - zone.x) / scale, (point.y - zone.y) / (scale * frame.metric.surfaceSquashY)) <= zone.radius;
      }
    }
    this.#chum.hover(chum);
    if (next !== this.#hovered) { this.#hovered = next; this.#revision++; }
  }

  clearHover() {
    this.#chum.hover(false);
    if (this.#hovered !== null) { this.#hovered = null; this.#revision++; }
  }

  allowed(handle) {
    if (!this.#editingFrame()) return false;
    if (handle.kind === "float") return this.#movingFloat;
    if (handle.kind === "chum") return this.#chum.isEditing && this.isShown("chum");
    return this.#editingChumLine && this.isShown("handChum");
  }

  // Moves a handle to a map point: hand chum's far line and test chum zones snap to the map's cell step like zone
  // edges (one cellSize); the float follows the pointer within the line length over the water.
  drag(handle, x, y) {
    const frame = this.#editingFrame();
    if (!frame) return;
    const step = this.#config.locations.cellSize;
    if (handle.kind === "chum") {
      this.#chum.drag(handle, this.#state.locationId, x, y, step, frame.metric);
      return;
    }
    if (handle.kind === "float" && this.#castFloat()) {
      this.#moveCastFloat(frame, x, y);
      return;
    }
    if (handle.kind === "float") {
      const origin = this.#planeOrigin(frame);
      frame.metric.toBasePlane(x, Math.min(y, frame.shore), this.#plane);
      const limit = this.effectiveLineMeters * this.#readings.pixelsPerMeter;
      let dx = this.#plane.x - origin.x, dy = this.#plane.y - origin.y;
      const length = Math.hypot(dx, dy);
      if (length > limit) { dx *= limit / length; dy *= limit / length; }
      this.#float = { dx, dy: Math.min(0, dy) };
      this.#revision++;
      return;
    }
    const snapped = Math.min(frame.shore - step, Math.max(frame.top, Math.round(y / step) * step));
    const distance = Math.round(frame.metric.metersFromShore(snapped) * frame.metric.pixelsPerMeter);
    if (distance !== this.#values[0]) {
      this.#writeConfig(["CONFIG", "locations", "map", this.#state.locationId, "chumCastDistance"], distance);
    }
  }

  // Showing needs only the location on screen and the castable area; editing also needs the editor on.
  // R3-3: the waiting float follows the pointer within the real limits of the cast: on the water (the game's
  // checkWater), within the equipped line's reach from the rod on the base plane (the budget GameState.
  // constrainTackleToLine applies, the selected depth included); its velocity is cleared and the game's own waiting
  // constraints apply from the next frame.
  #moveCastFloat(frame, x, y) {
    const float = this.#getFloat?.();
    if (!float || this.#getGameStateName?.() !== "waiting") return;
    const metric = frame.metric, origin = this.#planeOrigin(frame);
    metric.toBasePlane(x, Math.min(y, frame.shore), this.#plane);
    const reach = this.#equipmentRules?.getMaxCastDistance?.(this.#getEquipment?.(), Infinity, this.#getHookDepthMeters());
    let dx = this.#plane.x - origin.x, dy = this.#plane.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (Number.isFinite(reach) && length > reach) { dx *= reach / length; dy *= reach / length; }
    metric.fromBasePlane(origin.x + dx, origin.y + dy, this.#point);
    if (this.#checkWater && !this.#checkWater(this.#point.x, this.#point.y)) return;
    float.setPosition(this.#point.x, this.#point.y);
    float.getVelocity?.()?.set?.(0, 0);
    this.#revision++;
  }

  #frame() {
    const state = this.#state;
    if (!state.editsLoadedLocation || this.#config.locations.enableCastable === false) return null;
    const metric = this.#getMetric();
    const bounds = this.#map.getCastableBoundsVirtual(this.#config.locations.cellSize);
    if (!metric || !bounds) return null;
    return { metric, left: bounds.left, right: bounds.right, top: bounds.top, shore: bounds.bottom };
  }

  #editingFrame() {
    return this.#state.enabled ? this.#frame() : null;
  }

  // The rod's map X: the game's rod screen X, or the canvas middle while no cast moved it (the port gives null then;
  // Number(null) would be 0, the screen's left edge).
  #rodX() {
    const reported = this.#getRodScreenX?.();
    const screenX = reported === null || reported === undefined ? NaN : Number(reported);
    return this.#projector.screenToVirtual(Number.isFinite(screenX) ? screenX : this.#canvasMetrics.width / 2, 0, this.#screen).x;
  }

  #farY(frame, basePixels) {
    return Math.max(frame.top, frame.metric.yAtBasePixels(Math.min(basePixels, frame.metric.topBasePixels)));
  }

  #planeOrigin(frame) {
    return frame.metric.toBasePlane(this.#values[4], frame.shore, this.#origin);
  }

  // The float on the base plane: straight ahead at the line length unless dragged (kept as an offset from the rod). It
  // stays on the water like a real float: a shorter line pulls it in, and a line longer than the water (TK-069: an
  // equipped 50 m line over 30 m of water) stops it at the water's far edge, both along its direction.
  #floatPlane(frame, origin) {
    const limit = this.effectiveLineMeters * this.#readings.pixelsPerMeter;
    const offset = this.#float ?? { dx: 0, dy: -limit };
    const length = Math.hypot(offset.dx, offset.dy);
    let shrink = length > limit ? limit / length : 1;
    const far = frame.metric.toBasePlane(origin.x, frame.top, this.#screen).y;
    if (offset.dy * shrink < far - origin.y) shrink = (far - origin.y) / offset.dy;
    this.#plane.x = origin.x + offset.dx * shrink;
    this.#plane.y = origin.y + offset.dy * shrink;
    return this.#plane;
  }

  // The landing zone: the water circle round the rod (ground metres, as the game's projectWaterCircle), upper half.
  #landingCircle(frame, radiusBasePixels) {
    const metric = frame.metric, points = [], ground = this.#screen;
    metric.toGround(this.#values[4], frame.shore, ground);
    const gx = ground.x, gy = ground.y, radius = radiusBasePixels / metric.pixelsPerMeter;
    for (let index = 0; index <= HALF_CIRCLE_SEGMENTS; index++) {
      const angle = Math.PI * index / HALF_CIRCLE_SEGMENTS;
      metric.toVirtual(gx + Math.cos(angle) * radius, gy + Math.sin(angle) * radius, this.#point);
      points.push(this.#point.x, this.#point.y);
    }
    return points;
  }

  // The released line's limit: a half-circle of the line length round the rod on the base plane (the game's line radius).
  #lineCircle(frame, origin) {
    const radius = this.effectiveLineMeters * this.#readings.pixelsPerMeter, points = [];
    for (let index = 0; index <= ARC_SEGMENTS; index++) {
      const angle = (-90 + 180 * index / ARC_SEGMENTS) * Math.PI / 180;
      frame.metric.fromBasePlane(origin.x + Math.sin(angle) * radius, origin.y - Math.cos(angle) * radius, this.#point);
      points.push(this.#point.x, this.#point.y);
    }
    return points;
  }

  // The fight sector as FightAreaRenderFrameBuilder draws it: PoleFightSectorGeometry from the rod to the float on the
  // base plane (radius = rod → float), the apex and the arc between the boundary intersections.
  #sectorPoints(frame, origin, float) {
    const config = this.#config.fightPhysicsConfig?.getPoleFightSectorConfig?.() || this.#config.physics?.fight?.poleFightSector || {};
    const geometry = this.#sector.resolve({ origin, config, pixelsPerMeter: this.#readings.pixelsPerMeter,
      limitRadiusPx: Math.hypot(float.x - origin.x, float.y - origin.y) });
    if (!geometry.active) return null;
    const angleOf = (x, y, fallback) => Number.isFinite(x) && Number.isFinite(y)
      ? Math.atan2(x - geometry.originX, -(y - geometry.originY)) * 180 / Math.PI : fallback;
    const left = angleOf(geometry.leftBoundaryRadiusIntersectionX, geometry.leftBoundaryRadiusIntersectionY, -geometry.maxAngleFromCenterDeg);
    const right = angleOf(geometry.rightBoundaryRadiusIntersectionX, geometry.rightBoundaryRadiusIntersectionY, geometry.maxAngleFromCenterDeg);
    const points = [];
    frame.metric.fromBasePlane(geometry.sectorApexX, geometry.sectorApexY, this.#point);
    points.push(this.#point.x, this.#point.y);
    for (let index = 0; index <= ARC_SEGMENTS; index++) {
      const angle = (left + (right - left) * index / ARC_SEGMENTS) * Math.PI / 180;
      frame.metric.fromBasePlane(geometry.originX + Math.sin(angle) * geometry.limitRadiusPx,
        geometry.originY - Math.cos(angle) * geometry.limitRadiusPx, this.#point);
      points.push(this.#point.x, this.#point.y);
    }
    return points;
  }
}
