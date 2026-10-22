import { Vector2 } from "../../engine/math/vector2.js";

// Logical pixels around an edge of the selected zone that take it.
const EDGE_PX = 10;
const CURSORS = Object.freeze({ x: "zone-editor-drag-layer--x", y: "zone-editor-drag-layer--y",
  xy: "zone-editor-drag-layer--xy" });
// Body class while the editor is on: dev-tools.css hides the game's own UI (TK-052); DevTools stays.
const EDITING_CLASS = "game-shell--zone-editor";

// Drags the edges of the selected zone with the mouse or a finger (spec 129 D6, Revision 2 R4). A transparent layer
// over the game canvas exists while the editor is on, so the game gets no input meanwhile; DevTools stays above it
// and the game's buttons and windows are hidden (TK-052).
// A pointer within EDGE_PX of an edge takes it (a corner takes both); the edge follows the pointer snapped to
// snapCells map cells, the zone keeps at least that much, and an adaptive-width zone moves only its top and bottom.
// Every change of the snapped value writes the category's zone array once through the injected config path.
export class ZoneEditorDragController {
  #state; #map; #projector; #config; #getCanvas; #canvasMetrics; #documentTarget; #mountNode; #writeZones;
  #layer = null;
  #drag = null;
  #cursor = "";
  #point = new Vector2();
  #listeners = null;

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
      ["pointerup", (event) => this.#up(event)], ["pointercancel", (event) => this.#up(event)]];
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
    this.#layer = null;
    this.#listeners = null;
    this.#drag = null;
    this.#cursor = "";
  }

  #down(event) {
    const hit = this.#hit(event);
    if (!hit) return;
    event.preventDefault();
    this.#layer.setPointerCapture?.(event.pointerId);
    this.#drag = { ...hit, pointerId: event.pointerId, written: { x: hit.zone.x, y: hit.zone.y, w: hit.zone.w, h: hit.zone.h } };
  }

  #move(event) {
    const drag = this.#drag;
    if (!drag) {
      const hit = this.#hit(event);
      this.#setCursor(hit ? (hit.left || hit.right) && (hit.top || hit.bottom) ? "xy" : hit.left || hit.right ? "x" : "y" : "");
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

  #up(event) {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
    this.#layer?.releasePointerCapture?.(event.pointerId);
    this.#drag = null;
    this.#state.zonesEdited();
  }

  // The selected zone's edges under the pointer, or null.
  #hit(event) {
    const locations = this.#config.locations;
    const id = this.#state.locationId || this.#map.currentLocationId;
    const { category, index } = this.#state.selection;
    const zones = locations.map?.[id]?.zones?.[category];
    const zone = zones?.[index];
    if (!zone) return null;
    const cell = locations.designCellSize || locations.cellSize;
    const left = zone.adaptiveX ? 0 : zone.x * cell;
    const right = zone.adaptiveX ? locations.baseResolution.width : (zone.x + zone.w) * cell;
    const pointer = this.#toScreen(event);
    const px = pointer.x, py = pointer.y;
    const topLeft = this.#projector.virtualToScreen(left, zone.y * cell, this.#point);
    const sx1 = topLeft.x, sy1 = topLeft.y;
    const bottomRight = this.#projector.virtualToScreen(right, (zone.y + zone.h) * cell, this.#point);
    const sx2 = bottomRight.x, sy2 = bottomRight.y;
    const withinY = py >= sy1 - EDGE_PX && py <= sy2 + EDGE_PX;
    const withinX = px >= sx1 - EDGE_PX && px <= sx2 + EDGE_PX;
    const hit = {
      left: !zone.adaptiveX && withinY && Math.abs(px - sx1) <= EDGE_PX,
      right: !zone.adaptiveX && withinY && Math.abs(px - sx2) <= EDGE_PX,
      top: withinX && Math.abs(py - sy1) <= EDGE_PX,
      bottom: withinX && Math.abs(py - sy2) <= EDGE_PX,
    };
    if (hit.left && hit.right) hit[Math.abs(px - sx1) <= Math.abs(px - sx2) ? "right" : "left"] = false;
    if (hit.top && hit.bottom) hit[Math.abs(py - sy1) <= Math.abs(py - sy2) ? "bottom" : "top"] = false;
    if (!hit.left && !hit.right && !hit.top && !hit.bottom) return null;
    return { ...hit, zone: { x: zone.x, y: zone.y, w: zone.w, h: zone.h }, zones, index,
      path: ["CONFIG", "locations", "map", id, "zones", category] };
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
