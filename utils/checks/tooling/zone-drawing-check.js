"use strict";
// Spec 141: drawing new zones on the grid in the DEV zone editor (LMB rectangles, RMB cuts, apply/cancel), on the real
// LocationMap and validated config edits, through the drag tool, the geometry builder and the editor section.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const runtime = new SourceRuntime();
const load = path => runtime.importModule(path);
const { ZoneEditorState } = load("src/dev/location/zone_editor_state.js");
const { ZoneDrawing } = load("src/dev/location/zone_drawing.js");
const { cutZones, mergeTouchingZones } = load("src/dev/location/zone_cell_shapes.js");
const { readMaskCells } = load("src/engine/geometry/grid_mask.js");
const { ZoneEditorConfigEdits } = load("src/dev/location/zone_editor_config_edits.js");
const { ZoneEditorDragController } = load("src/dev/location/zone_editor_drag_controller.js");
const { ZoneEditorGeometryBuilder } = load("src/dev/location/zone_editor_geometry_builder.js");
const { ZoneEditorSection } = load("src/dev/tools/zone_editor_section.js");
const { LocationMap } = load("src/game/domain/locations/location_map.js");
const { WaterMetric } = load("src/game/domain/locations/water_metric.js");

const plain = value => JSON.parse(JSON.stringify(value));

// 400 x 400 px, 40 px cells: 10 x 10 cells; the castable area is rows 2..7 (80..320 px).
const cfg = { locations: { cellSize: 40, designCellSize: 40, baseResolution: { width: 400, height: 400 }, enableCollisions: true,
  map: { draw: { name: "Draw", depthBounds: { min: 1, max: 5 }, zones: {
    castable: [{ x: 0, y: 2, w: 10, h: 6 }], collisions: [], snags: [], dynamic: [] } } } } };
const map = new LocationMap("draw", cfg.locations, { next: () => 0 }, { depthReader: { getDepthAtPixel: () => 3 } });
map.recalculateZones(null, 40);
const commands = new ZoneEditorConfigEdits({ config: cfg, getMap: () => map });
let writes = 0;
const write = (path, value) => {
  writes++; const command = commands.prepare(path, value);
  let node = cfg; for (const key of command.path.slice(1, -1)) node = node[key]; node[command.path.at(-1)] = command.value;
  map.refreshConfig(cfg.locations, { depthReader: { getDepthAtPixel: () => 3 } });
};
const zonesOf = category => plain(cfg.locations.map.draw.zones[category]);
const state = new ZoneEditorState(); state.locationId = state.loadedLocationId = "draw";
const drawing = new ZoneDrawing({ state, config: cfg, getMap: () => map, writeConfig: write });

// Revision 2 cuts: a zone keeps its remaining shape as one zone (an L or a ring with a mask); only pieces that fall
// apart become separate zones; a missed zone stays the same object, a covered one goes.
const filled = zone => { const { cells, cols } = readMaskCells(zone.mask); const out = [];
  cells.forEach((value, index) => { if (value) out.push([index % cols, Math.floor(index / cols)]); }); return out; };
const square = { x: 0, y: 0, w: 4, h: 4, type: "rock" };
const corner = plain(cutZones([square], 0, { x: 3, y: 0, w: 1, h: 1 }, 1));
assert(corner.length === 1 && corner[0].type === "rock" && corner[0].w === 4 && corner[0].mask.enabled === true &&
  filled(corner[0]).length === 15, "a cut corner leaves one L-shaped zone with its fields");
const ring = plain(cutZones([square], 0, { x: 1, y: 1, w: 2, h: 2 }, 1));
assert(ring.length === 1 && filled(ring[0]).length === 12, "a hole leaves one ring");
const halves = plain(cutZones([square], 0, { x: 2, y: 0, w: 1, h: 4 }, 1));
assert.deepEqual(halves, [{ type: "rock", x: 0, y: 0, w: 2, h: 4 }, { type: "rock", x: 3, y: 0, w: 1, h: 4 }], "a cut across splits it in two plain zones");
const edge = plain(cutZones([square], 0, { x: 0, y: 3, w: 4, h: 1 }, 1));
assert.deepEqual(edge, [{ type: "rock", x: 0, y: 0, w: 4, h: 3 }], "an edge strip only shrinks the zone");
const apart = [square];
assert.equal(cutZones(apart, 0, { x: 9, y: 9, w: 1, h: 1 }, 1)[0], square, "a missed zone stays the same");
assert.equal(cutZones(apart, 0, { x: -1, y: -1, w: 9, h: 9 }, 1).length, 0, "a covered zone is gone");
assert.equal(cutZones(apart, 1, { x: 0, y: 0, w: 2, h: 2 }, 1)[0], square, "zones below base are never cut");

// Merging: zones that overlap or touch side by side become one; corners alone do not join.
const joined = mergeTouchingZones([{ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }], 1);
assert.deepEqual(plain(joined.zones), [{ x: 0, y: 0, w: 4, h: 2 }], "side by side: one plain rectangle");
const ell = mergeTouchingZones([{ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2, type: "reed" }], 1, { keep: 1 });
assert(ell.zones.length === 1 && ell.zones[0].type === "reed" && ell.zones[0].w === 3 && filled(ell.zones[0]).length === 7 && ell.index === 0,
  "overlapping: one zone with the union as its mask and the kept zone's fields");
assert.equal(mergeTouchingZones([{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 }], 1), null, "corner contact does not merge");
assert.equal(mergeTouchingZones([{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }], 1, { base: 1 }), null, "only zones from base on merge");
assert.equal(mergeTouchingZones([{ x: 0, y: 0, w: 1, h: 1, adaptiveX: true }, { x: 0, y: 0, w: 1, h: 1 }], 1), null,
  "an adaptive-width zone is never merged");
const masked = mergeTouchingZones([corner[0], { x: 4, y: 0, w: 1, h: 4 }], 1);
assert(masked.zones.length === 1 && filled(masked.zones[0]).length === 19, "a masked zone merges by its cells");

// Drawing needs the editor and the category's editing; moving zones keep their own add (D3).
assert.equal(drawing.start("collisions"), false, "nothing is drawn while the editor is off");
state.setFlag("enabled", true); state.setEditing("collisions", true);
assert.equal(drawing.start("dynamic"), false, "moving zones are not drawn");
assert(drawing.start("collisions") && drawing.isActive("collisions") && state.selectsAll("collisions"), "drawing starts with «Всі»");
assert.deepEqual(plain(drawing.allowedArea()), { left: 0, top: 80, right: 400, bottom: 320 }, "obstacles only inside the castable area (D1)");
assert.equal(drawing.begin(50, 50), false, "a press in the dimmed area draws nothing");

// LMB: one cell, then the rectangle between the press cell and the pointer's cell, both ways.
assert(drawing.begin(210, 130));
assert.deepEqual(zonesOf("collisions"), [{ x: 5, y: 3, w: 1, h: 1 }], "a press is a one-cell zone");
drawing.extend(10, 330);
assert.deepEqual(zonesOf("collisions"), [{ x: 0, y: 3, w: 6, h: 5 }], "dragging left and down paints every cell, held in the allowed area");
drawing.extend(10, 130);
assert.deepEqual(zonesOf("collisions"), [{ x: 0, y: 3, w: 6, h: 1 }], "dragging back up takes the rows away");
drawing.extend(10, 300); drawing.end();
assert.equal(map.getLocationZones().collisions.length, 1, "the new zone is live on the map");
drawing.begin(370, 290); drawing.end();
assert.deepEqual(zonesOf("collisions")[1], { x: 9, y: 7, w: 1, h: 1 }, "every press makes another zone");

// RMB: the rectangle cuts its cells out of the new zones; a hole leaves one ring-shaped zone (Revision 2).
assert(drawing.begin(90, 170, true)); drawing.extend(130, 210);
assert.deepEqual(plain(drawing.eraseArea()), { left: 80, top: 160, right: 160, bottom: 240 }, "the cut shows while it is drawn");
const before = writes; drawing.end();
assert.equal(writes, before + 1, "one write for the cut");
const holed = zonesOf("collisions");
assert(holed.length === 2 && holed[0].x === 0 && holed[0].w === 6 && holed[0].h === 5 && filled(holed[0]).length === 26 &&
  holed[1].x === 9, "the 6 x 5 zone keeps one ring shape round the 2 x 2 hole");
drawing.begin(370, 290, true); drawing.end();
assert.equal(zonesOf("collisions").length, 1, "a zone the cut covers is removed");
// A new zone drawn against another new one merges with it on release.
drawing.begin(250, 130); drawing.extend(290, 130); drawing.end();
assert.deepEqual(zonesOf("collisions").length, 1, "drawn against the ring, the new cells join it");

// Cancel writes the category back; apply keeps it.
drawing.cancel();
assert(zonesOf("collisions").length === 0 && !drawing.isActive("collisions"), "«Скасувати» removes the new zones");
cfg.locations.map.draw.zones.collisions = [{ x: 7, y: 5, w: 2, h: 2 }]; map.refreshConfig(cfg.locations, { depthReader: { getDepthAtPixel: () => 3 } });
drawing.start("collisions"); drawing.begin(10, 90); drawing.end(); drawing.apply();
assert(!drawing.isActive("collisions") && zonesOf("collisions").length === 2, "«Застосувати» keeps the zones");
state.setEditing("castable", true); drawing.start("castable");
assert.deepEqual(plain(drawing.allowedArea()), { left: 0, top: 0, right: 400, bottom: 400 }, "the castable area is drawn over the whole map");
state.setEditing("castable", false);
assert.equal(drawing.category, null, "the category's editing going off ends drawing, keeping what was drawn");

// The drag tool: a LMB press off the new zones draws, on a new zone it moves it; old zones are not taken; RMB cuts.
let layer;
const element = () => ({ classList: { add() {}, remove() {} }, listeners: new Map(), addEventListener(type, fn) { this.listeners.set(type, fn); },
  removeEventListener() {}, remove() {}, setPointerCapture() {}, releasePointerCapture() {} });
const identity = { getScale: () => 1, virtualToScreen: (x, y, out) => out.set(x, y), screenToVirtual: (x, y, out) => out.set(x, y) };
const tool = new ZoneEditorDragController({ state, map, projector: identity, config: cfg, canvasMetrics: { width: 400, height: 400 },
  documentTarget: { createElement: element, body: element() }, mountNode: { prepend: node => { layer = node; } },
  getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }) }), writeZones: write, zoneDrawing: drawing });
tool.sync();
const pointer = (type, x, y, button = 0) => { let taken = false;
  layer.listeners.get(type)({ clientX: x, clientY: y, button, pointerId: 1, preventDefault() { taken = true; } }); return taken; };
cfg.locations.map.draw.zones.collisions = [{ x: 7, y: 5, w: 2, h: 2 }]; map.refreshConfig(cfg.locations, { depthReader: { getDepthAtPixel: () => 3 } });
drawing.start("collisions");
assert(pointer("pointerdown", 330, 230), "a press on the old zone draws instead of taking it");
pointer("pointerup", 330, 230);
assert.deepEqual(zonesOf("collisions"), [{ x: 7, y: 5, w: 2, h: 2 }, { x: 8, y: 5, w: 1, h: 1 }], "the old zone is untouched");
pointer("pointerdown", 50, 90); pointer("pointermove", 130, 170); pointer("pointerup", 130, 170);
assert.deepEqual(zonesOf("collisions")[2], { x: 1, y: 2, w: 3, h: 3 }, "press, drag, release: a 3 x 3 zone");
assert(pointer("pointerdown", 100, 140), "the middle of a new zone is taken");
pointer("pointermove", 180, 140); pointer("pointerup", 180, 140);
assert.deepEqual(zonesOf("collisions")[2], { x: 3, y: 2, w: 3, h: 3 }, "a new zone moves like any zone, by whole cells");
assert(pointer("pointerdown", 239, 140), "its edge is taken");
pointer("pointermove", 280, 140); pointer("pointerup", 280, 140);
assert.deepEqual(zonesOf("collisions")[2], { x: 3, y: 2, w: 4, h: 3 }, "and it resizes by its edge");
let menuPrevented = false; layer.listeners.get("contextmenu")({ preventDefault() { menuPrevented = true; } });
assert(menuPrevented, "the context menu is suppressed while drawing");
pointer("pointerdown", 130, 100, 2); pointer("pointermove", 330, 220, 2); pointer("pointerup", 330, 220, 2);
assert.deepEqual(zonesOf("collisions")[0], { x: 7, y: 5, w: 2, h: 2 }, "a cut never touches the old zones");
assert.equal(zonesOf("collisions").length, 1, "the cut over cells 3..8 x 2..5 removes both new zones");

// The geometry builder dims the viewport outside the allowed area.
const geometry = new ZoneEditorGeometryBuilder({ state, map, projector: identity, config: cfg, getWaterMetric: () => null,
  canvasMetrics: { width: 400, height: 400 }, zoneDrawing: drawing });
const frame = {}; geometry.buildInto(frame);
const foreground = frame.annotations.foreground;
const shades = foreground.rects.slice(0, foreground.rectCount).filter(rect => rect.color === 0 && rect.fillAlpha > 0);
assert.equal(shades.reduce((area, rect) => area + rect.width * rect.height, 0), 400 * 400 - 400 * 240, "everything but the castable rows is dimmed");
drawing.apply(); geometry.buildInto(frame);
assert.equal(frame.annotations.foreground, null, "applying removes the dimming");

// The section: «Додати зону» turns on what it needs and draws; the list shows apply/cancel and the new zones only.
const rows = new Map(), sections = [], created = new Map();
const remember = (label, parent, args) => rows.set(`${parent?.label}/${label}`, args);
const ui = { syncValue() {}, releaseValueBindings() {}, createInfoRow: (label, value, parent) => remember(label, parent, [value]),
  createControlGroup: parent => ({ label: parent.label, replaceChildren() {} }),
  createInputRow: (label, value, parent) => remember(label, parent, [value]), createRangeRow: (label, value, parent) => remember(label, parent, [value]),
  createButtonRow: (label, parent, action) => remember(label, parent, [action]),
  createSelectRow: (label, options, value, parent) => remember(label, parent, [options, value]),
  createSwitcherRow: (label, value, parent) => remember(label, parent, [value]) };
state.setFlag("enabled", false); state.setEditing("collisions", false);
const section = new ZoneEditorSection({ ui, state, config: cfg, renderTree() {}, updateConfig: write, zoneDrawing: drawing,
  createSection: (label, parent) => { sections.push(`${parent?.label}/${label}`); const classes = new Set(); const node = { label, classes, replaceChildren() {},
    classList: { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } } }; created.set(label, node); return node; },
  getWaterMetric: () => new WaterMetric({ pixelsPerMeter: 50, shoreY: 320, topY: 80, centerX: 200 }),
  createWaterMetric: options => WaterMetric.illustrated(options) });
section.render({});
const obstacle = label => rows.get(`Перешкоди/${label}`);
assert(obstacle("Номер зони") && obstacle("Додати зону"), "the obstacles' list before drawing");
rows.clear(); sections.length = 0;
section.render({});
const addZone = obstacle("Додати зону")[0];
rows.clear(); sections.length = 0;
addZone();
assert(state.enabled && state.isEditable("collisions") && drawing.isActive("collisions"), "«Додати зону» turns the editor and editing on and draws");
assert(created.get("🗺️ РЕДАКТОР").classes.has("zone-editor--drawing") && created.get("Перешкоди").classes.has("zone-editor__drawing-list") &&
  !created.get("Зачепи").classes.has("zone-editor__drawing-list"), "everything but the drawn category's list is inactive");
assert(obstacle("Застосувати") && obstacle("Скасувати") && !obstacle("Номер зони") && !obstacle("Видалити вибрану зону") &&
  !obstacle("Додати зону"), "while drawing: apply and cancel, no number list, delete or add");
drawing.begin(10, 90); drawing.end(); rows.clear(); sections.length = 0; state.zonesEdited();
assert(sections.includes("Перешкоди/Зона 2") && !sections.includes("Перешкоди/Зона 1"), "only the new zone's coordinates are listed");
const applyDrawing = obstacle("Застосувати")[0];
rows.clear(); sections.length = 0;
applyDrawing();
assert(!drawing.isActive("collisions") && obstacle("Номер зони")[1] === "Всі" && obstacle("Додати зону"),
  "«Застосувати»: the number list is back on «Всі», the zones are kept");
assert.equal(zonesOf("collisions").length, 2);
assert(!created.get("🗺️ РЕДАКТОР").classes.has("zone-editor--drawing"), "applying makes the controls active again");

// Ordinary editing: a zone moved against another of its category merges with it on release; a plain click does not.
cfg.locations.map.draw.zones.collisions = [{ x: 0, y: 2, w: 1, h: 1 }, { x: 3, y: 2, w: 1, h: 1 }, { x: 0, y: 6, w: 2, h: 1 }, { x: 1, y: 6, w: 1, h: 1 }];
map.refreshConfig(cfg.locations, { depthReader: { getDepthAtPixel: () => 3 } });
state.selectAll("collisions");
pointer("pointerdown", 60, 260); pointer("pointerup", 60, 260);
assert.equal(zonesOf("collisions").length, 4, "a click that moves nothing merges nothing");
pointer("pointerdown", 20, 100); pointer("pointermove", 100, 100); pointer("pointerup", 100, 100);
assert.deepEqual(zonesOf("collisions").slice(0, 2), [{ x: 2, y: 2, w: 2, h: 1 }, { x: 0, y: 6, w: 2, h: 1 }],
  "moved next to the other, the two obstacles become one and the overlapping pair below joins too");
assert.equal(state.selectedIndex("collisions"), 0, "the merged zone is the shown one");
console.log("Zone drawing passed: LMB rectangles of whole cells inside the allowed area (castable: whole map, others: castable bounds), RMB cuts that keep one shape (L, ring) and split only pieces that fall apart, merging of overlapping or side-touching zones (drawing and ordinary editing), cancel/apply, ending with the editing, drag tool (draw off the new zones, move/resize new ones, old zones untouched, context menu), dimming outside the allowed area, section (add turns on the editor and editing, apply/cancel, new zones' coordinates only, other controls inactive while drawing).");
