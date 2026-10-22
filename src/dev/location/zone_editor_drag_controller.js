import { Vector2 } from "../../engine/math/vector2.js";
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
// Only zones checked in "Зони для редагування" are taken; the pointer over them marks them hovered (filled). Of the
// zones under the pointer the smallest that offers a hit is taken: its middle MOVE_SHARE moves the whole zone, a
// pointer within EDGE_PX of an edge takes it (a corner takes both). Positions snap to snapCells map cells, a resized
// zone keeps at least that much, and an adaptive-width zone moves only vertically. Every change of the snapped value
// writes the category's zone array once through the injected config path.
export class ZoneEditorDragController {
  #state; #map; #projector; #config; #getCanvas; #canvasMetrics; #documentTarget; #mountNode; #writeZones;
  #layer = null;
  #drag = null;
  #cursor = "";
  #point = new Vector2();
  #listeners = null;
  #hovered = [];

  // writeZones(path, zones): the validated runtime config write (DevTools); getCanvas: the game canvas element.
  constructor({ state, map, projector, config, getCanvas, canvasMetrics, documentTarget, mountNode, writeZones }) {
    for (const [name, value] of Object.entries({ getCanvas, writeZones })) {
      if (typeof value !== "function") throw new TypeError(`ZoneEditorDragController requires ${name}`);
    }
    if (typeof documentTarget?.createElement !== "function") throw new TypeError("ZoneEditorDragController requires documentTarget");
    this.#state = state; this.#map = map; this.#projector = projector; this.#config = config;
    this.#getCanvas = getCanvas; this.#canvasMetrics = canvasMetrics; this.#documentTarget = documentTarget;
    this.#mountNode = mountNode; this.#writeZones = writeZones;
  }

  get active() {
    return this.#layer !== null;
  }

  // Once per frame from the location debug builder: shows or removes the layer when the switches change.
  sync() {
    const wanted = this.#state.enabled;
    if (wanted && !this.#layer) this.#attach();
    else if (!wanted && this.#layer) this.#detach();
  }

  dispose() {
    this.#detach();
  }

  #attach() {
    const layer = this.#documentTarget.createElement("div");
    layer.className = "zone-editor-drag-layer";
    const listeners = [["pointerdown", (event) => this.#down(event)], ["pointermove", (event) => this.#move(event)],
      ["pointerup", (event) => this.#up(event)], ["pointercancel", (event) => this.#up(event)],
      ["pointerleave", () => { if (!this.#drag) this.#state.setHovered(NO_ZONES); }]];
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
    this.#layer = null;
    this.#listeners = null;
    this.#drag = null;
    this.#cursor = "";
  }

  #down(event) {
    const hit = this.#scan(event, null);
    if (!hit) return;
    event.preventDefault();
    this.#layer.setPointerCapture?.(event.pointerId);
    const start = this.#toVirtual(event);
    this.#drag = { ...hit, pointerId: event.pointerId, startX: start.x, startY: start.y,
      written: { x: hit.zone.x, y: hit.zone.y, w: hit.zone.w, h: hit.zone.h } };
    // The taken zone becomes the one whose parameters the lists show.
    this.#state.select(hit.category, hit.index);
  }

  #hover(event) {
    const hovered = this.#hovered;
    hovered.length = 0;
    const hit = this.#scan(event, hovered);
    this.#state.setHovered(hovered);
    this.#setCursor(!hit ? "" : hit.move ? "move" : (hit.left || hit.right) && (hit.top || hit.bottom)
      ? (hit.left === hit.top ? "xy" : "yx") : hit.left || hit.right ? "x" : "y");
  }

  #move(event) {
    const drag = this.#drag;
    if (!drag) {
      this.#hover(event);
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    // Edges snap to the visible map grid (cellSize x snapCells pixels); zones are stored in design cells
    // (designCellSize), so a finer map grid gives fractional design coordinates.
    const locations = this.#config.locations;
    const design = locations.designCellSize || locations.cellSize;
    const step = locations.cellSize * Math.max(1, this.#state.snapCells || 1) / design;
    const point = this.#toVirtual(event);
    const cellX = Math.round(point.x / design / step) * step;
    const cellY = Math.round(point.y / design / step) * step;
    const { zone } = drag;
    let { x, y, w, h } = zone;
    if (drag.move) {
      // The whole zone follows the pointer's snapped travel; its size never changes, and it stays in the window.
      const travelX = Math.round((point.x - drag.startX) / design / step) * step;
      const travelY = Math.round((point.y - drag.startY) / design / step) * step;
      const topLeft = this.#projector.screenToVirtual(0, 0, this.#point);
      const left = topLeft.x / design, top = topLeft.y / design;
      const bottomRight = this.#projector.screenToVirtual(this.#canvasMetrics.width, this.#canvasMetrics.height, this.#point);
      const right = bottomRight.x / design, bottom = bottomRight.y / design;
      if (!zone.adaptiveX) x = zone.x + this.#windowTravel(travelX, zone.x, zone.w, left, right, step);
      y = zone.y + this.#windowTravel(travelY, zone.y, zone.h, top, bottom, step);
    }
    if (drag.left) { x = Math.min(cellX, zone.x + zone.w - step); w = zone.x + zone.w - x; }
    if (drag.right) w = Math.max(step, cellX - zone.x);
    if (drag.top) { y = Math.min(cellY, zone.y + zone.h - step); h = zone.y + zone.h - y; }
    if (drag.bottom) h = Math.max(step, cellY - zone.y);
    const written = drag.written;
    if (x === written.x && y === written.y && w === written.w && h === written.h) return;
    written.x = x; written.y = y; written.w = w; written.h = h;
    const zones = drag.zones.map((entry, index) => index === drag.index ? { ...entry, x, y, w, h } : entry);
    this.#writeZones(drag.path, zones);
  }

  // TK-058: the snapped travel along one axis, limited so the zone [start, start + size] stays inside the window
  // [low, high] (design cells); a zone larger than the window only slides while it still covers the whole window.
  // The limits are whole steps from the start, so the zone keeps its offset to the cell grid.
  #windowTravel(travel, start, size, low, high, step) {
    const fits = size <= high - low;
    const min = Math.ceil(((fits ? low : high - size) - start) / step - 1e-9) * step;
    const max = Math.floor(((fits ? high - size : low) - start) / step + 1e-9) * step;
    return min > max ? 0 : Math.max(min, Math.min(max, travel));
  }

  #up(event) {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
    this.#layer?.releasePointerCapture?.(event.pointerId);
    this.#drag = null;
    this.#state.zonesEdited();
    this.#hover(event);
  }

  // The editable zones under the pointer (their keys pushed to hovered, when given) and the hit of the smallest one
  // that offers its middle or an edge, or null.
  #scan(event, hovered) {
    const locations = this.#config.locations;
    if (!this.#state.editsLoadedLocation) return null;
    const id = this.#state.locationId;
    const location = locations.map?.[id];
    if (!location) return null;
    const cell = locations.designCellSize || locations.cellSize;
    const pointer = this.#toScreen(event);
    const px = pointer.x, py = pointer.y;
    let best = null, bestArea = Infinity;
    for (const category of CATEGORIES) {
      if (locations[ZONE_PHYSICS_KEYS[category]] === false) continue;
      const zones = location.zones?.[category];
      if (!zones) continue;
      for (let index = 0; index < zones.length; index++) {
        if (!this.#state.isEditable(category, index)) continue;
        const zone = zones[index];
        const left = zone.adaptiveX ? 0 : zone.x * cell;
        const right = zone.adaptiveX ? locations.baseResolution.width : (zone.x + zone.w) * cell;
        const topLeft = this.#projector.virtualToScreen(left, zone.y * cell, this.#point);
        const sx1 = topLeft.x, sy1 = topLeft.y;
        const bottomRight = this.#projector.virtualToScreen(right, (zone.y + zone.h) * cell, this.#point);
        const sx2 = bottomRight.x, sy2 = bottomRight.y;
        if (px < sx1 - EDGE_PX || px > sx2 + EDGE_PX || py < sy1 - EDGE_PX || py > sy2 + EDGE_PX) continue;
        hovered?.push(ZoneEditorState.zoneKey(category, index));
        const area = (sx2 - sx1) * (sy2 - sy1);
        if (area >= bestArea) continue;
        const hit = this.#hitZone(zone, px, py, sx1, sy1, sx2, sy2);
        if (!hit) continue;
        best = { ...hit, category, index, zones, path: ["CONFIG", "locations", "map", id, "zones", category],
          zone: { x: zone.x, y: zone.y, w: zone.w, h: zone.h, adaptiveX: zone.adaptiveX === true } };
        bestArea = area;
      }
    }
    return best;
  }

  // The middle MOVE_SHARE of the zone moves it (it wins over the edges, so a small zone stays movable); otherwise the
  // edges within EDGE_PX; null when neither.
  #hitZone(zone, px, py, sx1, sy1, sx2, sy2) {
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
