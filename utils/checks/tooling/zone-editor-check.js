"use strict";
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const runtime = new SourceRuntime();
const load = path => runtime.importModule(path);
const { ZoneEditorState } = load("src/dev/location/zone_editor_state.js");
const { ZoneEditorGeometryBuilder } = load("src/dev/location/zone_editor_geometry_builder.js");
const { ZoneEditorSection } = load("src/dev/tools/zone_editor_section.js");
const { PixiAnnotationRenderer } = load("src/platform/browser/scene/pixi_annotation_renderer.js");
const { WorldDebugRenderer } = load("src/dev/rendering/world_debug_renderer.js");
const { WaterMetric } = load("src/game/domain/locations/water_metric.js");
const { WorldRenderFrameBuilder } = load("src/game/presentation/rendering/world_render_frame_builder.js");
const { GameRenderFrame } = load("src/game/presentation/rendering/game_render_frame.js");
const { DevToolsControlBindingRegistry } = load("src/dev/services/dev_tools_control_binding_registry.js");
const { LocationDebugDataProvider } = load("src/dev/location/location_debug_data_provider.js");
const { WorldPerspective } = load("src/game/domain/locations/world_perspective.js");

const state = new ZoneEditorState();
const config = { locations: { cellSize: 40, baseResolution: { width: 1000, height: 1000 }, map: {
  lake: { safeZone: { top: 0, bottom: 1000 }, waterProjection: { maxMeters: 40, tiltDegrees: 30, farScale: .3 },
    zones: { castable: [{ x: 0, y: 0, w: 25, h: 25 }], collisions: [{ x: 2, y: 3, w: 1, h: 2 }],
    snags: [{ x: 4, y: 8, w: 2, h: 1 }], dynamic: [{ x: 5, y: 6, w: 1, h: 1 }] } } } } };
let mapRevision = 1, scale = 1, cameraX = 0;
const moving = [{ x: 5, y: 6, w: 1, h: 1 }];
const map = { currentLocationId: "lake", getRevision: () => mapRevision, getDynamicZones: () => moving,
  getLocationZones: () => config.locations.map.lake.zones,
  getCastableBoundsVirtual: () => ({ left: 0, right: 1000, top: 0, bottom: 1000 }),
  getBackgroundRenderData: () => ({ loaded: true, dynamic: false, assetIds: { default: "image" }, width: 1000, height: 1000 }) };
const lakeMetric = projection => WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500, ...projection });
let metric = lakeMetric(config.locations.map.lake.waterProjection);
const perspective = new WorldPerspective({ getWaterMetric: () => metric });
const provider = new LocationDebugDataProvider({ configSource: () => config, perspectiveSource: y => perspective.getPerspective(y) });
assert.equal(provider.getPerspective({}, 200).scale, metric.surfaceScaleAt(200),
  "DEV diagnostics read the same metric as world rendering");
const projector = { virtualToScreen: (x, y, out) => out.set(x * scale + cameraX, y * scale), getScale: () => scale,
  screenToVirtual: (x, y, out) => out.set((x - cameraX) / scale, y / scale) };
const builder = new ZoneEditorGeometryBuilder({ state, map, projector, getWaterMetric: () => metric, config });
const target = {};
builder.buildInto(target); assert.equal(target.annotations, null); assert.equal(builder.rebuilds, 0);
state.setFlag("enabled", true); builder.buildInto(target);
const model = target.annotations, lines = model.lines, rects = model.rects;
assert.equal(model.rectCount + model.overlay.rectCount, 8, "all configured zones, including physically disabled categories, are visible (plus the selected zone's 4 handles)");
assert(model.lineCount > 40 && model.lineCount <= 96 * 24 + 97, "grid work is bounded");
const gridStep = metric.metersFromShore(lines[1].y1);
assert(gridStep + 1e-8 >= state.spacingMeters, "adaptive rows retain the selected minimum metre spacing");
for (let row = 0; row <= 40; row++) {
  const line = lines[row];
  assert(Math.abs(metric.metersFromShore(line.y1) - row * gridStep) < 1e-8, "every row uses exact ground metre intervals");
}
assert(lines.some((line, index) => index < model.lineCount && line.y1 === 0 && line.y2 === 0 && line.x1 !== line.x2),
  "the grid reaches the authored top even when the distance is not divisible by the metre step");
for (let frame = 0; frame < 120; frame++) builder.buildInto(target);
assert.equal(builder.rebuilds, 1, "120 unchanged frames produce zero geometry rebuilds");
assert.equal(target.annotations, model); assert.equal(model.lines, lines); assert.equal(model.rects, rects);
const beforeTilt = builder.rebuilds;
config.locations.map.lake.waterProjection.tiltDegrees = 15;
metric = lakeMetric(config.locations.map.lake.waterProjection);
builder.buildInto(target);
assert.equal(builder.rebuilds, beforeTilt + 1, "camera edits invalidate the shared metre-grid geometry");
assert.equal(metric.pixelsPerMeter, 50, "the fitted screen scale never changes engine units");
config.locations.map.lake.waterProjection.tiltDegrees = 30;
metric = lakeMetric({ ...config.locations.map.lake.waterProjection, maxMeters: 60 });
builder.buildInto(target);
assert.equal(builder.rebuilds, beforeTilt + 2, "distance changes invalidate the grid too");
state.setFlag("background", false); builder.buildInto(target); assert.equal(target.backgroundHidden, true);
state.setCategory("collisions", false); builder.buildInto(target); assert.equal(model.rectCount + model.overlay.rectCount, 7);
assert.equal(config.locations.map.lake.zones.collisions.length, 1, "visibility never changes gameplay config");
const beforeMove = builder.rebuilds, beforeOverlay = builder.overlayRebuilds;
moving[0].x++; builder.buildInto(target); assert.equal(builder.rebuilds, beforeMove, "moving zones never rebuild the static grid");
assert.equal(builder.overlayRebuilds, beforeOverlay + 1);
state.setCategory("dynamic", false); builder.buildInto(target); const hidden = builder.rebuilds;
moving[0].x++; builder.buildInto(target); assert.equal(builder.rebuilds, hidden, "hidden moving zones do no work");
scale = 2; cameraX = 13; builder.buildInto(target);
assert.equal(model.lines[0].x1, 13); assert.equal(model.lines[0].y1, 2000, "one camera transform for grid and zones");
mapRevision++; builder.buildInto(target); assert.equal(target.annotations, model);
metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500 }); builder.buildInto(target);
state.setSpacing(.001); builder.buildInto(target); assert.equal(state.spacingMeters, .25);
assert(model.lineCount <= 96 * 24 + 97);

class Graphics {
  visible = true; clears = 0; operations = [];
  clear() { this.clears++; this.operations.length = 0; return this; }
}
for (const name of ["rect", "fill", "stroke", "moveTo", "lineTo"]) Graphics.prototype[name] = function (...args) {
  this.operations.push([name, ...args]); return this;
};
let graphics, overlayGraphics;
const renderer = new PixiAnnotationRenderer({ pixi: { Graphics }, stage: { addChild: (first, second) => { graphics = first; overlayGraphics = second; } } });
assert.equal(renderer.update(model), true); const clears = graphics.clears;
for (let frame = 0; frame < 120; frame++) assert.equal(renderer.update(model), false);
assert.equal(graphics.clears, clears, "unchanged WebGL annotations make no Graphics writes");
model.overlay = { revision: 1, rectCount: 0, lineCount: 0, rects: [], lines: [] };
renderer.update(model); const staticClears = graphics.clears, dynamicClears = overlayGraphics.clears;
model.overlay.revision++; renderer.update(model);
assert.equal(graphics.clears, staticClears); assert.equal(overlayGraphics.clears, dynamicClears + 1, "only moving annotation Graphics rebuilds");
model.overlay = null;
assert.equal(renderer.update(null), true); assert.equal(renderer.update(null), false); assert.equal(renderer.update(model), true);
const drawn = [];
const surface = { globalAlpha: 1, drawImage() {}, strokeRect: (...args) => drawn.push(args), fillRect() {}, beginPath() {},
  moveTo() {}, lineTo() {}, stroke() {} };
const debugModel = { visible: true, annotations: model, debugImage: { visible: false }, dynamicZones: { count: 0 } };
new WorldDebugRenderer({ surface, sceneRouter: { drawsOnScene: () => true } }).render(debugModel);
assert.equal(drawn.length, 0, "WebGL annotations are not also drawn on Canvas");
new WorldDebugRenderer({ surface, sceneRouter: { drawsOnScene: () => false } }).render(debugModel);
assert.equal(drawn.length, model.rectCount, "Canvas fallback consumes the exact same zone geometry");
const frame = new GameRenderFrame();
new WorldRenderFrameBuilder({ map, projector, config, canvasMetrics: { width: 1000 }, locationId: "lake",
  boatChumBuilder: { buildInto() {} }, debugBuilder: builder }).buildInto({ target: frame.world, debugEnabled: true });
assert.equal(frame.world.backgroundLayers.count, 0); assert.equal(frame.world.backgroundColor, "#000000");
frame.reset(); assert.equal(frame.world.annotations, null); assert.equal(frame.world.backgroundHidden, false);

const actions = new Map(), edits = [], trees = [], candidateInputs = [];
const synced = [], infoRows = new Map();
const baseProjection = JSON.parse(JSON.stringify(config.locations.map.lake.waterProjection));
let exportCalls = 0, importCalls = 0, resetCalls = 0;
const refreshMetric = () => {
  metric = lakeMetric(config.locations.map.lake.waterProjection);
};
const ui = { syncValue: (path, value) => synced.push([path, value]), releaseValueBindings() {}, createSwitcherRow(label, value, parent, callback) { actions.set(label, callback); },
  createInputRow(label, value, parent, type, callback) { actions.set(label, callback); },
  createInfoRow(label, value) { const element = { innerText: value }; infoRows.set(label, element); return element; },
  createSelectRow(label, options, value, parent, callback) { actions.set(label, callback); },
  createButtonRow(label, parent, callback) { actions.set(label, callback); } };
new ZoneEditorSection({ ui, state, config, createSection: () => ({ replaceChildren() {} }),
  getWaterMetric: () => metric,
  createWaterMetric: options => { candidateInputs.push(options); return WaterMetric.illustrated(options); },
  exportOverrides: () => exportCalls++, importOverrides: () => importCalls++,
  resetPerspective: id => {
    resetCalls++; config.locations.map[id].waterProjection = JSON.parse(JSON.stringify(baseProjection)); refreshMetric();
  },
  renderTree: (value, parent, path) => trees.push(path), updateConfig: (path, value) => {
    edits.push(path); let target = config;
    for (const key of path.slice(1, -1)) target = target[key];
    target[path.at(-1)] = value; mapRevision++; refreshMetric();
  } }).render({});
assert(trees.some(path => path.join(".") === "CONFIG.locations.map.lake.zones.castable.0"));
actions.get("Мін. крок сітки, м")(-1); assert.equal(synced.at(-1)[1], .25, "the displayed spacing matches the clamped setting");
actions.get("Видалити вибрану зону")(); assert.equal(edits.length, 0, "keep at least one castable zone");
config.locations.map.lake.zones.castable[0].bounds = { x: 10, y: 20, w: 30, h: 40 };
actions.get("Додати зону")(); assert.equal(config.locations.map.lake.zones.castable.length, 2);
assert.notEqual(config.locations.map.lake.zones.castable[0].bounds, config.locations.map.lake.zones.castable[1].bounds,
  "duplicated zones never share writable nested bounds");
actions.get("Видалити вибрану зону")(); assert.equal(config.locations.map.lake.zones.castable.length, 1);
assert(edits.every(path => path.join(".") === "CONFIG.locations.map.lake.zones.castable"));
actions.get("Нахил площини, °")(45);
assert.equal(config.locations.map.lake.waterProjection.tiltDegrees, 45);
assert.match(infoRows.get("Стан").innerText, /45°/u);
actions.get("Нахил площини, °")(1);
assert.equal(config.locations.map.lake.waterProjection.maxMeters, baseProjection.maxMeters, "tilt preserves authored length");
actions.get("Дальність води, м")(5);
assert.equal(config.locations.map.lake.waterProjection.maxMeters, 5, "short locations fit automatically");
assert.equal(config.locations.map.lake.waterProjection.tiltDegrees, 1);
const beforeInvalidEdits = edits.length;
for (const value of [0, 91, NaN, Infinity]) actions.get("Нахил площини, °")(value);
for (const value of [0, -1, NaN, Infinity]) {
  actions.get("Дальність води, м")(value);

}
for (const value of [0,.01,1.1,-1,NaN,Infinity]) actions.get("Масштаб вдалині")(value);
assert.equal(edits.length, beforeInvalidEdits, "invalid camera and distance edits never write config");
assert.match(infoRows.get("Стан").innerText, /Не застосовано/u);
actions.get("Дальність води, м")(60);
actions.get("Масштаб вдалині")(.6);
assert.equal(config.locations.map.lake.waterProjection.farScale,.6);
assert.equal(metric.topMeters,60,"far scale edits keep exactly the configured metres");
actions.get("Нахил площини, °")(90);
assert.equal(metric.surfaceSquashY,1,"90 degrees makes surface markers circular without recalibrating metres");
actions.get("Звужувати сітку по ширині")(false);
assert.equal(config.locations.map.lake.waterProjection.lateralContraction, false);
assert.equal(metric.pixelsPerMeterX(0),50);
actions.get("Звужувати сітку по ширині")(true);
const beforeWidthEdits = JSON.stringify(config.locations.map.lake.zones);
actions.get("Звужувати сітку по ширині")(false);
let firstTop;
for (const angle of [17, 53, 90, 17]) {
  actions.get("Нахил площини, °")(angle);
  const referenceScale = lakeMetric({ maxMeters: 60, tiltDegrees: 90 }).pixelsPerMeterX(0);
  assert.equal(metric.pixelsPerMeterX(metric.topY), referenceScale, "editor angle changes retain the base width");
  assert.equal(metric.topY, 0, "editor tilt leaves the full green zone height in place");
  if (firstTop === undefined) firstTop = metric.topY;
}
assert.equal(metric.topY, firstTop, "repeated angle edits preserve the same full-height edge");
assert.equal(JSON.stringify(config.locations.map.lake.zones), beforeWidthEdits, "camera edits preserve authored geometry");
assert(candidateInputs.every(input => input.topY === 0), "candidate validation uses the full authored bounds");
actions.get("Експорт правок (усі налаштування DEV)")();
actions.get("Імпорт правок (усі налаштування DEV)")();
actions.get("Скинути перспективу цієї локації")();
assert.equal(exportCalls, 1); assert.equal(importCalls, 1); assert.equal(resetCalls, 1);
assert.equal(config.locations.map.lake.waterProjection.maxMeters, baseProjection.maxMeters);
assert.deepEqual(config.locations.map.lake.waterProjection, baseProjection);
assert.match(infoRows.get("Стан").innerText, /біля берега 54\.2 \/ 50, вдалині 16\.3 \/ 50/u,
  "the status shows the derived near/far pixels per metre along and across the water");
// R1 (spec 126): a location without waterProjection is uniform water with an "add" action, not a crash.
{
  const uniformConfig = { locations: { cellSize: 40, map: { pond: { zones: { castable: [] } } } } };
  const uniformState = new ZoneEditorState(); uniformState.locationId = "pond";
  let pondMetric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500 });
  infoRows.clear(); actions.clear();
  new ZoneEditorSection({ ui, state: uniformState, config: uniformConfig, createSection: () => ({ replaceChildren() {} }),
    getWaterMetric: () => pondMetric, createWaterMetric: options => WaterMetric.illustrated(options),
    renderTree() {}, updateConfig: (path, value) => {
      let target = uniformConfig;
      for (const key of path.slice(1, -1)) target = target[key];
      target[path.at(-1)] = value; pondMetric = lakeMetric(value);
    } }).render({});
  assert.match(infoRows.get("Стан").innerText, /рівномірна/u, "uniform water says so");
  assert.equal(actions.has("Нахил площини, °"), false, "no projection controls without a projection");
  actions.get("Додати перспективу води")();
  assert.equal(JSON.stringify(uniformConfig.locations.map.pond.waterProjection),
    JSON.stringify({ maxMeters: 20, tiltDegrees: 30, farScale: .3, lateralContraction: false }),
    "adding a projection keeps the uniform length and takes the documented defaults");
  assert.equal(typeof actions.get("Нахил площини, °"), "function", "the added projection is editable at once");
}
state.setFlag("enabled", false); builder.buildInto(target); assert.equal(target.annotations, null); assert.equal(target.backgroundHidden, false);
const bindings = new DevToolsControlBindingRegistry();
const panel = { contains: element => element === "inside" };
let outsideCalls = 0, insideCalls = 0;
bindings.register("same", () => outsideCalls++, "outside");
for (let i = 0; i < 100; i++) {
  bindings.register("same", () => insideCalls++, "inside");
  bindings.releaseWithin(panel);
}
bindings.register("same", () => insideCalls++, "inside"); bindings.sync("same", 1);
assert.equal(outsideCalls, 1); assert.equal(insideCalls, 1, "repeated editor selections release detached bindings and preserve other controls");

// Real DOM-control construction over the existing test document; the panel shell's two selectors are irrelevant
// to this control contract and are supplied by the document adapter instead of parsing its fixed header HTML.
const { TestDocument } = require("../../testing/keepnet/test_document");
const controlDocument = new TestDocument(), createElement = controlDocument.createElement.bind(controlDocument);
controlDocument.createElement = tag => {
  const element = createElement(tag);
  element.querySelector = selector => {
    const child = createElement("div"); child.className = selector.slice(1); element.appendChild(child); return child;
  };
  return element;
};
const controlRuntime = new SourceRuntime({ globals: { document: controlDocument } });
const { DevToolsUI } = controlRuntime.importModule("src/dev/tools/dev_tools_ui.js");
const controlUI = new DevToolsUI(() => {}, {}, null, null, null, controlDocument.body, createElement("div"));
const fullLabel = "Дальність води, м";
controlUI.createInputRow(fullLabel, 40, controlDocument.body, "number", () => {});
assert.equal(controlDocument.byClass("devtools__label").at(-1).innerText, fullLabel,
  "phone users see the complete parameter name instead of a 15-character truncation");
const notice = controlUI.createInfoRow("Стан", "Ready", controlDocument.body);
notice.innerText = "Rejected";
assert.equal(controlDocument.byClass("devtools__value").at(-1).innerText, "Rejected");
const description = notice.parentNode.parentNode;
assert.equal(description.classList.contains('devtools__section-content'), true, 'read-only rows use a description disclosure');
assert.equal(description.style.display, 'none', 'descriptions start collapsed');
assert.equal(description.parentNode.children[0].tagName,'button','the description uses a keyboard-accessible disclosure');
assert.equal(description.parentNode.children[0].getAttribute('aria-expanded'),'false');
description.parentNode.children[0].fire('click');
assert.equal(description.style.display, 'block', 'the description remains readable on demand');
assert.equal(description.parentNode.children[0].getAttribute('aria-expanded'),'true');
const nextNotice = controlUI.createInfoRow('Second status', 'Updated', controlDocument.body);
assert.equal(nextNotice.parentNode.parentNode, description, 'one description per container groups all read-only rows');
const editable = controlDocument.byClass('devtools__input').at(-1);
assert.equal(description.contains(editable), false, 'editable parameters stay outside the description');
const refreshParent = createElement('div'); controlDocument.body.appendChild(refreshParent);
controlUI.createInfoRow('Before refresh', '1', refreshParent);
refreshParent.replaceChildren();
const refreshedNotice = controlUI.createInfoRow('After refresh', '2', refreshParent);
assert.equal(refreshParent.contains(refreshedNotice), true, 'refresh never reuses a detached description');
controlUI.dispose();
// Spec 129 (TK-040…TK-043): colours, selection, the map cell grid, the debug map's own switches, the editor's
// structure and dragging the selected zone's edges.
{
  const { ZONE_CATEGORY_COLORS } = load("src/dev/location/zone_category_colors.js");
  const { ZoneEditorDragController } = load("src/dev/location/zone_editor_drag_controller.js");
  const { LocationDebugRenderFrameBuilder } = load("src/dev/location/location_debug_render_frame_builder.js");
  const { LocationDebugMapBuilder } = load("src/dev/location/location_debug_map_builder.js");
  scale = 1; cameraX = 0; mapRevision++;
  const lake = config.locations.map.lake;
  lake.zones.castable = [{ x: 0, y: 0, w: 25, h: 25 }];
  lake.zones.snags = [{ x: 4, y: 8, w: 2, h: 1 }];
  state.setFlag("enabled", true); state.setFlag("grid", false);
  for (const category of ["castable", "collisions", "snags", "dynamic"]) state.setCategory(category, true);

  // TK-040: one colour table for the editor outlines (and the debug map, the swatches).
  const geometry = {};
  state.select("snags", 0); builder.buildInto(geometry);
  const rects = geometry.annotations.rects.slice(0, geometry.annotations.rectCount);
  const snagColor = Number.parseInt(ZONE_CATEGORY_COLORS.snags.slice(1), 16);
  assert(rects.some(rect => rect.color === Number.parseInt(ZONE_CATEGORY_COLORS.castable.slice(1), 16)), "castable uses the shared colour");
  // TK-043 (D4): the selected zone is outlined thicker with four filled corner handles.
  const selected = rects.filter(rect => rect.color === snagColor && rect.lineWidth === 3);
  const handles = rects.filter(rect => rect.color === snagColor && rect.fillAlpha === 0.9);
  assert(selected.length === 1 && selected[0].x === 160 && selected[0].y === 320 && handles.length === 4,
    "the selected zone is outlined with handles");
  assert(rects.filter(rect => rect.lineWidth === 3).length === 1, "only the selected zone is outlined");
  // D5: the map cell grid (1000 / 40 = 25 cells: 26 lines per axis); off draws none; unchanged frames reuse it.
  assert.equal(geometry.annotations.cellLineCount, 52, "the map's cell lines");
  const before = builder.rebuilds;
  builder.buildInto(geometry); assert.equal(builder.rebuilds, before, "an unchanged cell grid is not rebuilt");
  state.setFlag("cellGrid", false); builder.buildInto(geometry);
  assert.equal(geometry.annotations.cellLineCount, 0, "the cell grid switch hides it");
  state.setFlag("cellGrid", true);

  // TK-041 (D2): the debug map follows its own switches, also under the open editor and without the DEV debug flag.
  let builds = 0;
  const debugMap = { build: () => { builds++; return { width: 1000, height: 1000 }; } };
  const debugMapFrame = new LocationDebugRenderFrameBuilder({ map: { ...map, getDynamicZones: () => [{ x: 1, y: 1, w: 1, h: 1 }] },
    projector, config, debugMapBuilder: debugMap, zoneEditor: builder });
  const debugTarget = () => ({ debugImage: { visible: false }, dynamicZones: { count: 0, acquire() { this.count++; return {}; } } });
  const locations = config.locations;
  Object.assign(locations, { debugVisuals: true, debugZones: false, debugGrid: false, debugDepthText: false });
  let frame = debugTarget(); debugMapFrame.buildInto(frame, false);
  assert(frame.debugImage.visible === false && builds === 0, "with every map switch off nothing is built");
  for (const key of ["debugGrid", "debugDepthText", "debugZones"]) {
    Object.assign(locations, { debugGrid: false, debugDepthText: false, debugZones: false, [key]: true });
    frame = debugTarget(); debugMapFrame.buildInto(frame, false);
    assert.equal(frame.debugImage.visible, true, `${key} shows the map without the DEV debug flag and under the editor`);
  }
  assert.equal(frame.dynamicZones.count, 0, "moving zones stay off while the editor draws its own");
  state.setFlag("enabled", false); frame = debugTarget(); debugMapFrame.buildInto(frame, false);
  assert.equal(frame.dynamicZones.count, 1, "moving zones follow debugZones without the editor");
  locations.debugVisuals = false; frame = debugTarget(); debugMapFrame.buildInto(frame, false);
  assert.equal(frame.debugImage.visible, false, "debugVisuals is still the master switch");
  locations.debugVisuals = true; state.setFlag("enabled", true);
  // The map draws a visible grid (35 %) and the depth numbers.
  const strokes = [], texts = [];
  const surface = { canvas: { width: 1000, height: 1000 }, clearRect() {}, fillRect() {}, strokeRect() { strokes.push(this.strokeStyle); },
    fillText: (text) => texts.push(text) };
  const realMap = new LocationDebugMapBuilder({ canvasFactory: { createSurface: () => surface } });
  const cells = [[{ x: 0, y: 0, isWater: true, depth: 2.5 }]];
  realMap.build({ map: { getLocationZones: () => ({}), getGrid: () => cells, getCols: () => 1, getRows: () => 1 },
    locationsConfig: { ...locations, debugGrid: true, debugDepthText: true } });
  assert(strokes[0] === "rgba(255, 255, 255, 0.35)" && texts[0] === "2.5", "grid lines are visible and depths are written");
  Object.assign(locations, { debugZones: false, debugGrid: false, debugDepthText: false });

  // TK-042 (D3): one structured place; switches keep their config paths and appear once.
  const sections = [], switches = new Map();
  let structureDone = false;
  const structureUi = { syncValue() {}, releaseValueBindings() {}, createInfoRow: () => ({}), createInputRow() {}, createButtonRow() {},
    createSelectRow(label, options, value, parent, callback, path, extra) { switches.set(label, { swatches: extra?.swatches }); },
    createSwitcherRow(label, value, parent, callback, path, bindingPath, extra) {
      const key = path ? path.join(".") : `${parent.label}/${label}`;
      // A drag's refresh rebuilds the geometry rows later; during the first render every switch appears once.
      assert(structureDone || !switches.has(key), `one control per switch: ${key}`);
      switches.set(key, { parent: parent.label, swatch: extra?.swatch, callback });
    } };
  new ZoneEditorSection({ ui: structureUi, state, config, updateConfig: (path, value) => { let node = config;
    for (const key of path.slice(1, -1)) node = node[key]; node[path.at(-1)] = value; },
  createSection: (label, parent) => { const section = { label, parent: parent?.label, replaceChildren() {} }; sections.push(section); return section; },
  renderTree() {}, getWaterMetric: () => metric, createWaterMetric: () => metric }).render({});
  structureDone = true;
  assert.deepEqual(sections.slice(0, 7).map(section => section.label), ["🗺️ РЕДАКТОР ЗОН", "Редактор", "Категорії в редакторі",
    "Зони в грі", "Оверлеї гри", "Налагоджувальна карта", "Геометрія й перспектива"], "the editor's sections in order");
  for (const key of ["enableCastable", "enableCollisions", "enableSnags", "enableDynamicZones"]) {
    assert.equal(switches.get(`CONFIG.locations.${key}`).parent, "Зони в грі");
  }
  assert.equal(switches.get("CONFIG.locations.enableSnags").swatch, ZONE_CATEGORY_COLORS.snags, "gameplay zone switches carry the colour");
  for (const key of ["debugVisuals", "debugZones", "debugGrid", "debugDepthText"]) {
    assert.equal(switches.get(`CONFIG.locations.${key}`).parent, "Налагоджувальна карта");
  }
  assert.equal(switches.get("CONFIG.locations.showChumZones").parent, "Оверлеї гри");
  assert.equal(switches.get("Категорії в редакторі/Зачепи · жовтий").swatch, ZONE_CATEGORY_COLORS.snags, "editor categories carry the colour");
  assert.equal(switches.get("Категорія зони").swatches, ZONE_CATEGORY_COLORS, "the category select shows the colour");
  switches.get("CONFIG.locations.debugGrid").callback(true);
  assert.equal(locations.debugGrid, true, "the moved switch still writes CONFIG.locations.debugGrid");
  locations.debugGrid = false;

  // TK-043 (D6): drag the selected zone's edges, snapped to cells, through one config write per cell.
  const makeElement = () => { const listeners = new Map(), classes = new Set();
    return { listeners, classes, removed: false, addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type) => listeners.delete(type), remove() { this.removed = true; },
      setPointerCapture() {}, releasePointerCapture() {},
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } }; };
  const mounted = [], writes = [];
  let edited = 0;
  const unsubscribe = state.subscribeZonesEdited(() => edited++);
  const drag = new ZoneEditorDragController({ state, map, projector, config, canvasMetrics: { width: 1000, height: 1000 },
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }) }),
    documentTarget: { createElement: makeElement }, mountNode: { prepend: (element) => mounted.push(element) },
    writeZones: (path, zones) => { writes.push({ path: path.join("."), zones });
      lake.zones[path.at(-1)] = zones; } });
  drag.sync(); assert.equal(drag.active, false, "no layer without drag editing");
  state.setFlag("dragEdit", true); drag.sync();
  const layer = mounted[0];
  assert(drag.active && layer && layer.listeners.has("pointerdown"), "drag editing puts a layer over the canvas");
  const pointer = (type, x, y, id = 1) => { let prevented = false;
    layer.listeners.get(type)({ clientX: x / 2, clientY: y / 2, pointerId: id, preventDefault: () => { prevented = true; } });
    return prevented; };
  state.select("castable", 0);
  assert.equal(pointer("pointerdown", 500, 500), false, "inside the zone, away from its edges, nothing is taken");
  pointer("pointermove", 1000, 500);
  assert(layer.classes.has("zone-editor-drag-layer--x"), "hovering an edge shows the resize cursor");
  assert.equal(pointer("pointerdown", 1000, 500), true, "the right edge is taken");
  pointer("pointermove", 870, 500);
  assert.deepEqual(writes.map(write => [write.path, write.zones[0].w]), [["CONFIG.locations.map.lake.zones.castable", 22]],
    "the edge snaps to the nearest cell (870 px -> 22 cells)");
  pointer("pointermove", 875, 500);
  assert.equal(writes.length, 1, "no write while the snapped cell stays the same");
  pointer("pointermove", -200, 500);
  assert.equal(lake.zones.castable[0].w, 1, "a zone keeps at least one cell");
  pointer("pointerup", -200, 500);
  assert.equal(edited, 1, "releasing tells the section to refresh its rows");
  lake.zones.castable = [{ x: 0, y: 0, w: 25, h: 25, id: "keep" }];
  assert.equal(pointer("pointerdown", 0, 0), true, "a corner is taken");
  pointer("pointermove", 85, 125);
  assert.equal(JSON.stringify(lake.zones.castable[0]), JSON.stringify({ x: 2, y: 3, w: 23, h: 22, id: "keep" }),
    "a corner moves two edges; other fields stay");
  pointer("pointerup", 85, 125);
  lake.zones.castable = [{ x: 0, y: 2, w: 1, h: 3, adaptiveX: true }];
  assert.equal(pointer("pointerdown", 0, 100), false, "an adaptive-width zone has no side edges");
  assert.equal(pointer("pointerdown", 500, 200), true, "its bottom edge is taken");
  pointer("pointermove", 500, 400); pointer("pointerup", 500, 400);
  assert.deepEqual([lake.zones.castable[0].y, lake.zones.castable[0].h], [2, 8], "the bottom edge follows the cells");
  state.setFlag("dragEdit", false); drag.sync();
  assert(layer.removed && !drag.active, "switching drag editing off removes the layer");
  unsubscribe(); drag.dispose(); state.setFlag("enabled", false);
}

console.log("Zone editor passed: metre-grid projection, zone edits and visibility, black background, perspective/live changes, bounded and zero unchanged rebuilds, reused WebGL Graphics and Canvas fallback without duplicate drawing; spec 129 colours, selection outline, map cell grid, debug map switches, structure and edge dragging with cell snap.");
