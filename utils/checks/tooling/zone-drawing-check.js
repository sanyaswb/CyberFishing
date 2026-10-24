"use strict";
// Spec 141: drawing new zones on the grid in the DEV zone editor (LMB rectangles, RMB cuts, apply/cancel), on the real
// LocationMap and validated config edits, through the drag tool, the geometry builder and the editor section.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const runtime = new SourceRuntime();
const load = path => runtime.importModule(path);
const { ZoneEditorState } = load("src/dev/location/zone_editor_state.js");
const { ZoneDrawing, subtractRect } = load("src/dev/location/zone_drawing.js");
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

// The cut: up to four rectangles round the hole, the zone itself when apart.
assert.deepEqual(plain(subtractRect({ x: 0, y: 0, w: 4, h: 4 }, { x: 1, y: 1, w: 2, h: 2 })),
  [{ x: 0, y: 0, w: 4, h: 1 }, { x: 0, y: 3, w: 4, h: 1 }, { x: 0, y: 1, w: 1, h: 2 }, { x: 3, y: 1, w: 1, h: 2 }]);
assert.deepEqual(plain(subtractRect({ x: 0, y: 0, w: 2, h: 2 }, { x: 5, y: 5, w: 1, h: 1 })), [{ x: 0, y: 0, w: 2, h: 2 }]);
assert.deepEqual(plain(subtractRect({ x: 0, y: 0, w: 2, h: 2 }, { x: -1, y: -1, w: 5, h: 5 })), [], "a covered zone is gone");

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

// RMB: the rectangle cuts its cells out of the new zones; a partly covered zone splits (D2).
assert(drawing.begin(90, 170, true)); drawing.extend(130, 210);
assert.deepEqual(plain(drawing.eraseArea()), { left: 80, top: 160, right: 160, bottom: 240 }, "the cut shows while it is drawn");
const before = writes; drawing.end();
assert.equal(writes, before + 1, "one write for the cut");
assert.deepEqual(zonesOf("collisions"), [{ x: 0, y: 3, w: 6, h: 1 }, { x: 0, y: 6, w: 6, h: 2 }, { x: 0, y: 4, w: 2, h: 2 },
  { x: 4, y: 4, w: 2, h: 2 }, { x: 9, y: 7, w: 1, h: 1 }], "the 6 x 5 zone loses a 2 x 2 hole and splits into four");
drawing.begin(370, 290, true); drawing.end();
assert.equal(zonesOf("collisions").length, 4, "a zone the cut covers is removed");

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
const rows = new Map(), sections = [];
const remember = (label, parent, args) => rows.set(`${parent?.label}/${label}`, args);
const ui = { syncValue() {}, releaseValueBindings() {}, createInfoRow: (label, value, parent) => remember(label, parent, [value]),
  createControlGroup: parent => ({ label: parent.label, replaceChildren() {} }),
  createInputRow: (label, value, parent) => remember(label, parent, [value]), createRangeRow: (label, value, parent) => remember(label, parent, [value]),
  createButtonRow: (label, parent, action) => remember(label, parent, [action]),
  createSelectRow: (label, options, value, parent) => remember(label, parent, [options, value]),
  createSwitcherRow: (label, value, parent) => remember(label, parent, [value]) };
state.setFlag("enabled", false); state.setEditing("collisions", false);
const section = new ZoneEditorSection({ ui, state, config: cfg, renderTree() {}, updateConfig: write, zoneDrawing: drawing,
  createSection: (label, parent) => { sections.push(`${parent?.label}/${label}`); return { label, replaceChildren() {} }; },
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
console.log("Zone drawing passed: LMB rectangles of whole cells inside the allowed area (castable: whole map, others: castable bounds), RMB cuts that split partly covered new zones, cancel/apply, ending with the editing, drag tool (draw off the new zones, move/resize new ones, old zones untouched, context menu), dimming outside the allowed area, section (add turns on the editor and editing, apply/cancel, new zones' coordinates only).");
