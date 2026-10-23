import { containsRectangle, findRectangleContainer } from "../../engine/math/rectangle_bounds.js";
import { Vector2 } from "../../engine/math/vector2.js";
import { gridMaskBounds, gridMaskContains } from "../../engine/geometry/grid_mask.js";
import { ZONE_CATEGORY_COLORS, ZONE_PHYSICS_KEYS } from "./zone_category_colors.js";
import { MOVE_SHARE, ZoneEditorState } from "./zone_editor_state.js";

// Logical pixels around an edge of an editable zone that take it.
const EDGE_PX = 10;
const CURSORS = Object.freeze({ x: "zone-editor-drag-layer--x", y: "zone-editor-drag-layer--y",
  xy: "zone-editor-drag-layer--xy", yx: "zone-editor-drag-layer--yx", move: "zone-editor-drag-layer--move" });
const CATEGORIES = Object.freeze(Object.keys(ZONE_CATEGORY_COLORS));
const NO_ZONES = Object.freeze([]);
// Body class while the editor is on: dev-tools.css hides the game's own UI (TK-052); DevTools stays.
const EDITING_CLASS = "game-shell--zone-editor";

// Drags editable zones with the mouse or a finger (spec 129 D6, Revision 2 R4, Revision 3). A transparent layer
// over the game canvas exists while the editor is on, so the game gets no input meanwhile; DevTools stays above it
// and the game's buttons and windows are hidden (TK-052).
// Only each enabled category's explicitly selected number is eligible for hover and input. Of those eligible
// zones under the pointer the smallest that offers a hit is taken: its middle MOVE_SHARE moves the whole zone, a
// pointer within EDGE_PX of an edge takes it (a corner takes both). Dynamic-body translation is continuous;
// other positions snap to one map cell, a resized
// zone keeps at least that much, and an adaptive-width zone moves only vertically. Every change of the snapped value
// writes the category's zone array once through the injected config path. The castable area's dependent zones (spec
// 136) own their handles: they are tried first and take their own drag.
export class ZoneEditorDragController {
  #state; #map; #projector; #config; #getCanvas; #canvasMetrics; #documentTarget; #mountNode; #writeZones; #dependent;
  #layer = null;
  #drag = null;
  #cursor = "";
  #point = new Vector2();
  #listeners = null;
  #hovered = [];
  #maskEditor;

  // writeZones(path, zones): the validated runtime config write (DevTools); getCanvas: the game canvas element.
  constructor({ state, map, projector, config, getCanvas, canvasMetrics, documentTarget, mountNode, writeZones, dependentZones = null, maskEditor = null }) {
    for (const [name, value] of Object.entries({ getCanvas, writeZones })) {
      if (typeof value !== "function") throw new TypeError(`ZoneEditorDragController requires ${name}`);
    }
    if (typeof documentTarget?.createElement !== "function") throw new TypeError("ZoneEditorDragController requires documentTarget");
    this.#state = state; this.#map = map; this.#projector = projector; this.#config = config;
    this.#getCanvas = getCanvas; this.#canvasMetrics = canvasMetrics; this.#documentTarget = documentTarget;
    this.#mountNode = mountNode; this.#writeZones = writeZones; this.#dependent = dependentZones;
    this.#maskEditor = maskEditor;
  }

  get active() {
    return this.#layer !== null;
  }

  // Once per frame from the location debug builder: shows or removes the layer when the switches change.
  sync() {
    this.#maskEditor?.sync();
    const wanted = this.#state.enabled;
    if (wanted && !this.#layer) this.#attach();
    else if (!wanted && this.#layer) this.#detach();
    if (this.#drag && !this.#dragAllowed(this.#drag)) this.#cancelDrag();
  }

  dispose() {
    this.#detach();
  }

  #attach() {
    const layer = this.#documentTarget.createElement("div");
    layer.className = "zone-editor-drag-layer";
    const listeners = [["pointerdown", (event) => this.#down(event)], ["pointermove", (event) => this.#move(event)],
      ["contextmenu", event => { if (this.#maskEditor?.draft) event.preventDefault(); }],
      ["pointerup", (event) => this.#up(event)], ["pointercancel", (event) => this.#up(event)],
      ["pointerleave", () => {
        if (!this.#drag) { this.#state.setHovered(NO_ZONES); this.#state.setHoveredBound(-1); this.#dependent?.clearHover(); }
      }]];
    for (const [type, listener] of listeners) layer.addEventListener(type, listener);
    this.#listeners = listeners;
    this.#mountNode.prepend(layer);
    this.#documentTarget.body?.classList.add(EDITING_CLASS);
    this.#layer = layer;
  }

  #detach() {
    const layer = this.#layer;
    if (!layer) return;
    for (const [type, listener] of this.#listeners) layer.removeEventListener(type, listener);
    layer.remove();
    this.#documentTarget.body?.classList.remove(EDITING_CLASS);
    this.#state.setHovered(NO_ZONES);
    this.#state.setHoveredBound(-1);
    this.#dependent?.clearHover();
    this.#layer = null;
    this.#listeners = null;
    this.#drag = null;
    this.#maskEditor?.stop();
    this.#cursor = "";
  }

  #down(event) {
    if (this.#maskEditor?.draft) {
      if ((event.button ?? 0) !== 0 && event.button !== 2) return;
      event.preventDefault();
      const point = this.#toVirtual(event), erase = event.button === 2;
      this.#maskEditor.endStroke();
      if (this.#maskEditor.paint(point.x, point.y, erase)) {
        this.#layer.setPointerCapture?.(event.pointerId);
        this.#drag = { mask: this.#maskEditor.draft, erase, pointerId: event.pointerId };
      }
      return;
    }
    if ((event.button ?? 0) !== 0) return;
    const hit = this.#scan(event, null);
    if (!hit) return;
    event.preventDefault();
    if (hit.dependent) {
      this.#layer.setPointerCapture?.(event.pointerId);
      this.#drag = { dependent: hit.dependent, pointerId: event.pointerId };
      return;
    }
    if (hit.category === "dynamic" && hit.kind !== "bounds") {
      this.#state.setHoveredBound(-1);
      this.#state.selectBounds(hit.index);
      this.#state.zonesEdited();
    }
    if (hit.selectOnly) return;
    this.#layer.setPointerCapture?.(event.pointerId);
    const start = this.#toVirtual(event);
    this.#drag = { ...hit, pointerId: event.pointerId, startX: start.x, startY: start.y,
      written: { x: hit.zone.x, y: hit.zone.y, w: hit.zone.w, h: hit.zone.h } };
    // The taken zone becomes the one whose parameters the lists show.
    if (hit.kind !== "bounds" && hit.category !== "dynamic") this.#state.select(hit.category, hit.index);
  }

  #hover(event) {
    if (this.#maskEditor?.draft) { this.#setCursor(""); return; }
    const hovered = this.#hovered;
    hovered.length = 0;
    const hit = this.#scan(event, hovered);
    this.#state.setHovered(hovered);
    if (this.#dependent) { const screen = this.#toScreen(event); this.#dependent.hover(screen.x, screen.y); }
    if (hit?.dependent) { this.#state.setHoveredBound(-1); this.#setCursor(hit.dependent.cursor); return; }
    this.#state.setHoveredBound(hit?.kind === "bounds" ? hit.boundIndex : -1);
    this.#setCursor(!hit || hit.selectOnly ? "" : hit.move ? "move" : (hit.left || hit.right) && (hit.top || hit.bottom)
      ? (hit.left === hit.top ? "xy" : "yx") : hit.left || hit.right ? "x" : "y");
  }

  #move(event) {
    const drag = this.#drag;
    if (!drag) {
      this.#hover(event);
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    if (!this.#dragAllowed(drag)) { this.#cancelDrag(); return; }
    event.preventDefault();
    if (drag.mask) {
      const point = this.#toVirtual(event);
      this.#maskEditor.paint(point.x, point.y, drag.erase);
      return;
    }
    if (drag.dependent) {
      const point = this.#toVirtual(event);
      this.#dependent.drag(drag.dependent, point.x, point.y);
      return;
    }
    // Edges snap to the visible map grid (cellSize pixels); zones are stored in design cells
    // (designCellSize), so a finer map grid gives fractional design coordinates.
    const locations = this.#config.locations;
    const design = locations.designCellSize || locations.cellSize;
    const step = (this.#map.getCellSize?.() ?? locations.cellSize) / design;
    const point = this.#toVirtual(event);
    const cellX = Math.round(point.x / design / step) * step;
    const cellY = Math.round(point.y / design / step) * step;
    const { zone } = drag;
    const occupied = gridMaskBounds(zone.mask, zone.x, zone.y, zone.w, zone.h, {});
    const contained = drag.containedBody || drag.body;
    const containBody = drag.kind === "bounds" && drag.mustContainBody;
    const region = drag.category === "dynamic" && drag.kind !== "bounds" && drag.movementBounds
      ? findRectangleContainer(occupied, drag.movementBounds) : null;
    if (drag.category === "dynamic" && drag.kind !== "bounds" && drag.movementBounds && !region) return;
    let { x, y, w, h } = zone;
    if (drag.move) {
      // The body follows pointer travel, continuous for dynamic bodies; size stays fixed inside the window.
      const free = drag.category === "dynamic" && drag.kind !== "bounds";
      const travelX = free ? (point.x - drag.startX) / design : Math.round((point.x - drag.startX) / design / step) * step;
      const travelY = free ? (point.y - drag.startY) / design : Math.round((point.y - drag.startY) / design / step) * step;
      const topLeft = this.#projector.screenToVirtual(0, 0, this.#point);
      const left = topLeft.x / design, top = topLeft.y / design;
      const bottomRight = this.#projector.screenToVirtual(this.#canvasMetrics.width, this.#canvasMetrics.height, this.#point);
      const right = bottomRight.x / design, bottom = bottomRight.y / design;
      const lowX = containBody ? contained.x + contained.w - zone.w : region?.x;
      const highX = containBody ? contained.x : region ? region.x + region.w - occupied.w : undefined;
      const lowY = containBody ? contained.y + contained.h - zone.h : region?.y;
      const highY = containBody ? contained.y : region ? region.y + region.h - occupied.h : undefined;
      if (!zone.adaptiveX) x = zone.x + this.#windowTravel(travelX, occupied.x, occupied.w, left, right, free ? 0 : step, lowX, highX);
      y = zone.y + this.#windowTravel(travelY, occupied.y, occupied.h, top, bottom, free ? 0 : step, lowY, highY);
    }
    if (drag.left) { x = Math.min(cellX, zone.x + zone.w - step); w = zone.x + zone.w - x; }
    if (drag.right) w = Math.max(step, cellX - zone.x);
    if (drag.top) { y = Math.min(cellY, zone.y + zone.h - step); h = zone.y + zone.h - y; }
    if (drag.bottom) h = Math.max(step, cellY - zone.y);
    if (!drag.move && (region || drag.kind === "bounds")) {
      const body = contained;
      const minX = region?.x ?? -Infinity, minY = region?.y ?? -Infinity;
      const maxX = region ? region.x + region.w : Infinity, maxY = region ? region.y + region.h : Infinity;
      if (drag.left) x = Math.max(Math.ceil(minX / step) * step, Math.min(x, containBody ? Math.floor(body.x / step) * step : zone.x + zone.w - step));
      if (drag.top) y = Math.max(Math.ceil(minY / step) * step, Math.min(y, containBody ? Math.floor(body.y / step) * step : zone.y + zone.h - step));
      if (drag.left) w = zone.x + zone.w - x;
      if (drag.top) h = zone.y + zone.h - y;
      if (drag.right) w = Math.min(Math.floor(maxX / step) * step, Math.max(zone.x + w, containBody ? Math.ceil((body.x + body.w) / step) * step : zone.x + step)) - zone.x;
      if (drag.bottom) h = Math.min(Math.floor(maxY / step) * step, Math.max(zone.y + h, containBody ? Math.ceil((body.y + body.h) / step) * step : zone.y + step)) - zone.y;
      if (!(w >= step && h >= step)) return;
    }
    if (!drag.move && (zone.shape === "circle" || zone.shape === "square")) {
      let side = drag.left || drag.right ? w : h;
      if ((drag.left || drag.right) && (drag.top || drag.bottom)) side = Math.min(w, h);
      if (region) side = Math.min(side,
        drag.left ? zone.x + zone.w - region.x : region.x + region.w - zone.x,
        drag.top ? zone.y + zone.h - region.y : region.y + region.h - zone.y);
      if (!(side >= step)) return;
      w = h = side;
      x = drag.left ? zone.x + zone.w - side : zone.x;
      y = drag.top ? zone.y + zone.h - side : zone.y;
    }
    const candidate = { x, y, w, h };
    if (region && !containsRectangle(region, gridMaskBounds(zone.mask, x, y, w, h, {}))) return;
    if (containBody && !containsRectangle(candidate, contained)) return;
    const written = drag.written;
    if (x === written.x && y === written.y && w === written.w && h === written.h) return;
    written.x = x; written.y = y; written.w = w; written.h = h;
    const zones = drag.zones.map((entry, index) => {
      if (index !== drag.index) return entry;
      if (drag.kind !== "bounds") return { ...entry, x, y, w, h };
      const bounds = (Array.isArray(entry.bounds) ? entry.bounds : [entry.bounds]).map((bound, number) => number === drag.boundIndex ? candidate : bound);
      return { ...entry, ...drag.body, bounds: Array.isArray(entry.bounds) ? bounds : bounds[0] };
    });
    this.#writeZones(drag.path, zones);
  }

  // TK-058: the snapped travel along one axis, limited so the zone [start, start + size] stays inside the window
  // [low, high] (design cells); a zone larger than the window only slides while it still covers the whole window.
  // The limits are whole steps from the start, so the zone keeps its offset to the cell grid.
  #windowTravel(travel, start, size, low, high, step, allowedLow = -Infinity, allowedHigh = Infinity) {
    const fits = size <= high - low;
    if (step === 0) {
      const min = Math.max(fits ? low : high - size, allowedLow) - start;
      const max = Math.min(fits ? high - size : low, allowedHigh) - start;
      return min > max ? 0 : Math.max(min, Math.min(max, travel));
    }
    const min = Math.ceil((Math.max(fits ? low : high - size, allowedLow) - start) / step - 1e-9) * step;
    const max = Math.floor((Math.min(fits ? high - size : low, allowedHigh) - start) / step + 1e-9) * step;
    return min > max ? 0 : Math.max(min, Math.min(max, travel));
  }

  #up(event) {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
    this.#layer?.releasePointerCapture?.(event.pointerId);
    this.#drag = null;
    this.#maskEditor?.endStroke();
    this.#state.zonesEdited();
    this.#hover(event);
  }

  #dragAllowed(drag) {
    if (drag.mask) return this.#maskEditor?.draft === drag.mask;
    const state = this.#state;
    if (drag.dependent) return state.enabled && this.#dependent.allowed(drag.dependent);
    if (!state.enabled || !state.editsLoadedLocation || state.locationId !== drag.path[3] ||
      !state.isEditable(drag.category) || state.selectedIndex(drag.category) !== drag.index ||
      this.#config.locations[ZONE_PHYSICS_KEYS[drag.category]] === false) return false;
    if (drag.kind === "bounds" && (!state.boundsEditing || state.selection.category !== "dynamic")) return false;
    const current = this.#config.locations.map[state.locationId]?.zones?.[drag.category]?.[drag.index];
    return !!current && (drag.category !== "dynamic" || current.id === drag.zoneId);
  }

  #cancelDrag() {
    this.#layer?.releasePointerCapture?.(this.#drag.pointerId);
    this.#drag = null;
    this.#maskEditor?.endStroke();
    this.#state.setHovered(NO_ZONES);
    this.#state.setHoveredBound(-1);
    this.#setCursor("");
  }

  // The editable zones under the pointer (their keys pushed to hovered, when given) and the hit of the smallest one
  // that offers its middle or an edge, or null.
  #scan(event, hovered) {
    const locations = this.#config.locations;
    if (!this.#state.editsLoadedLocation) return null;
    const id = this.#state.locationId;
    const location = locations.map?.[id];
    if (!location) return null;
    const cell = this.#map.getCellSize?.() ?? locations.cellSize;
    const toDesign = cell / (locations.designCellSize || cell);
    const pointer = this.#toScreen(event);
    const px = pointer.x, py = pointer.y;
    const dependent = this.#dependent?.hit(px, py);
    if (dependent) return { dependent };
    let best = null, bestArea = Infinity;
    for (const category of CATEGORIES) {
      if (locations[ZONE_PHYSICS_KEYS[category]] === false) continue;
      const zones = location.zones?.[category];
      if (!zones) continue;
      const live = category === "dynamic" ? this.#map.getDynamicZones() : this.#map.getLocationZones()[category] || NO_ZONES;
      for (let index = 0; index < zones.length; index++) {
        if (!this.#state.isEditable(category) || this.#state.selectedIndex(category) !== index) continue;
        const zone = category === "dynamic" ? live.find(entry => entry.id === zones[index].id) : live[index];
        if (!zone) continue;
        const left = zone.adaptiveX ? 0 : zone.x * cell;
        const right = zone.adaptiveX ? locations.baseResolution.width : (zone.x + zone.w) * cell;
        const topLeft = this.#projector.virtualToScreen(left, zone.y * cell, this.#point);
        const sx1 = topLeft.x, sy1 = topLeft.y;
        const bottomRight = this.#projector.virtualToScreen(right, (zone.y + zone.h) * cell, this.#point);
        const sx2 = bottomRight.x, sy2 = bottomRight.y;
        if (px < sx1 - EDGE_PX || px > sx2 + EDGE_PX || py < sy1 - EDGE_PX || py > sy2 + EDGE_PX) continue;
        const area = (sx2 - sx1) * (sy2 - sy1);
        const inside = zone.mask?.enabled ? gridMaskContains(zone.mask, (px - sx1) / (sx2 - sx1), (py - sy1) / (sy2 - sy1)) : zone.shape === "circle"
          ? Math.hypot((px - (sx1 + sx2) / 2) / ((sx2 - sx1) / 2), (py - (sy1 + sy2) / 2) / ((sy2 - sy1) / 2)) <= 1
          : px >= sx1 && px <= sx2 && py >= sy1 && py <= sy2;
        const hit = zone.mask?.enabled ? inside ? { move: true } : null : this.#hitZone(zone, px, py, sx1, sy1, sx2, sy2) || (category === "dynamic" && inside ? { selectOnly: true } : null);
        if (zone.mask?.enabled ? inside : zone.shape !== "circle" || inside || hit) hovered?.push(ZoneEditorState.zoneKey(category, index));
        if (!hit) continue;
        if (area >= bestArea) continue;
        const bounds = zone.bounds ? (Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds]) : null;
        best = { ...hit, inside, category, index, zones, zoneId: zones[index].id,
          movementBounds: bounds?.map(bound => ({ x: bound.x * toDesign, y: bound.y * toDesign, w: bound.w * toDesign, h: bound.h * toDesign })), path: ["CONFIG", "locations", "map", id, "zones", category],
          zone: { x: zone.x * toDesign, y: zone.y * toDesign, w: zone.w * toDesign, h: zone.h * toDesign, shape: zone.shape, mask: zone.mask, adaptiveX: zone.adaptiveX === true } };
        bestArea = area;
      }
    }
    return best?.category === "dynamic" && best.inside ? best : this.#scanBounds(px, py, location, cell, toDesign) || best;
  }

  #scanBounds(px, py, location, cell, toDesign) {
    const state = this.#state;
    if (!state.boundsEditing || !state.isEditable("dynamic") || this.#config.locations.enableDynamicZones === false || state.selection.category !== "dynamic") return null;
    const index = state.selection.index, zones = location.zones.dynamic || NO_ZONES;
    const body = this.#map.getDynamicZones().find(zone => zone.id === zones[index]?.id);
    if (!body?.bounds) return null;
    const bounds = Array.isArray(body.bounds) ? body.bounds : [body.bounds];
    const occupied = gridMaskBounds(body.mask, body.x, body.y, body.w, body.h, {});
    for (let number = 0; number < bounds.length; number++) {
      const bound = bounds[number];
      const topLeft = this.#projector.virtualToScreen(bound.x * cell, bound.y * cell, this.#point);
      const sx1 = topLeft.x, sy1 = topLeft.y;
      const bottomRight = this.#projector.virtualToScreen((bound.x + bound.w) * cell, (bound.y + bound.h) * cell, this.#point);
      const hit = this.#hitZone(bound, px, py, sx1, sy1, bottomRight.x, bottomRight.y);
      if (!hit) continue;
      return { ...hit, category: "dynamic", index, zones, zoneId: zones[index].id, kind: "bounds", boundIndex: number, mustContainBody: containsRectangle(bound, occupied),
        path: ["CONFIG", "locations", "map", state.locationId, "zones", "dynamic"],
        body: { x: body.x * toDesign, y: body.y * toDesign, w: body.w * toDesign, h: body.h * toDesign },
        containedBody: { x: occupied.x * toDesign, y: occupied.y * toDesign, w: occupied.w * toDesign, h: occupied.h * toDesign },
        zone: { x: bound.x * toDesign, y: bound.y * toDesign, w: bound.w * toDesign, h: bound.h * toDesign } };
    }
    return null;
  }

  // The middle MOVE_SHARE of the zone moves it (it wins over the edges, so a small zone stays movable); otherwise the
  // edges within EDGE_PX; null when neither.
  #hitZone(zone, px, py, sx1, sy1, sx2, sy2) {
    if (zone.shape === "circle") {
      const rx = (sx2 - sx1) / 2, ry = (sy2 - sy1) / 2;
      const dx = (px - (sx1 + sx2) / 2) / rx, dy = (py - (sy1 + sy2) / 2) / ry;
      const radius = Math.hypot(dx, dy);
      if (radius <= MOVE_SHARE) return { move: true };
      if (Math.abs(radius - 1) * Math.min(rx, ry) > EDGE_PX) return null;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      return { left: horizontal && dx < 0, right: horizontal && dx >= 0, top: !horizontal && dy < 0, bottom: !horizontal && dy >= 0 };
    }
    const halfW = (sx2 - sx1) * MOVE_SHARE / 2, halfH = (sy2 - sy1) * MOVE_SHARE / 2;
    if (Math.abs(px - (sx1 + sx2) / 2) <= halfW && Math.abs(py - (sy1 + sy2) / 2) <= halfH) {
      return { move: true, left: false, right: false, top: false, bottom: false };
    }
    const withinY = py >= sy1 - EDGE_PX && py <= sy2 + EDGE_PX;
    const withinX = px >= sx1 - EDGE_PX && px <= sx2 + EDGE_PX;
    const hit = {
      move: false,
      left: !zone.adaptiveX && withinY && Math.abs(px - sx1) <= EDGE_PX,
      right: !zone.adaptiveX && withinY && Math.abs(px - sx2) <= EDGE_PX,
      top: withinX && Math.abs(py - sy1) <= EDGE_PX,
      bottom: withinX && Math.abs(py - sy2) <= EDGE_PX,
    };
    if (hit.left && hit.right) hit[Math.abs(px - sx1) <= Math.abs(px - sx2) ? "right" : "left"] = false;
    if (hit.top && hit.bottom) hit[Math.abs(py - sy1) <= Math.abs(py - sy2) ? "bottom" : "top"] = false;
    return hit.left || hit.right || hit.top || hit.bottom ? hit : null;
  }

  // The pointer in the canvas's logical pixels (the frame's screen coordinates).
  #toScreen(event) {
    const rect = this.#getCanvas().getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.#canvasMetrics.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.#canvasMetrics.height / rect.height : 1;
    this.#point.x = (event.clientX - rect.left) * scaleX;
    this.#point.y = (event.clientY - rect.top) * scaleY;
    return { x: this.#point.x, y: this.#point.y };
  }

  #toVirtual(event) {
    const screen = this.#toScreen(event);
    return this.#projector.screenToVirtual(screen.x, screen.y, this.#point);
  }

  #setCursor(kind) {
    if (kind === this.#cursor || !this.#layer) return;
    if (this.#cursor) this.#layer.classList.remove(CURSORS[this.#cursor]);
    if (kind) this.#layer.classList.add(CURSORS[kind]);
    this.#cursor = kind;
  }
}
