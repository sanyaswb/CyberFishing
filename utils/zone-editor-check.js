"use strict";
const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");
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
  lake: { safeZone: { top: 0, bottom: 1000 }, perspective: { angleTop: 0, angleBottom: 30 },
    zones: { castable: [{ x: 0, y: 0, w: 25, h: 25 }], collisions: [{ x: 2, y: 3, w: 1, h: 2 }],
    snags: [{ x: 4, y: 8, w: 2, h: 1 }], dynamic: [{ x: 5, y: 6, w: 1, h: 1 }] },
  distanceProfile: { enabled: true, maxMeters: 40, linearShare: .5 } } } } };
let mapRevision = 1, scale = 1, cameraX = 0;
const moving = [{ x: 5, y: 6, w: 1, h: 1 }];
const map = { currentLocationId: "lake", getRevision: () => mapRevision, getDynamicZones: () => moving,
  getLocationZones: () => config.locations.map.lake.zones,
  getCastableBoundsVirtual: () => ({ left: 0, right: 1000, top: 0, bottom: 1000 }),
  getBackgroundRenderData: () => ({ loaded: true, dynamic: false, assetIds: { default: "image" }, width: 1000, height: 1000 }) };
let metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500, maxMeters: 40, linearShare: .5 });
const perspective = new WorldPerspective({ getLocation: () => config.locations.map.lake });
const provider = new LocationDebugDataProvider({ configSource: () => config, perspectiveSource: y => perspective.getPerspective(y) });
assert.equal(provider.getPerspective({}, 200).scale, Math.tan(6 * Math.PI / 180) / Math.tan(30 * Math.PI / 180),
  "DEV diagnostics read the actual visual perspective query");
const projector = { virtualToScreen: (x, y, out) => out.set(x * scale + cameraX, y * scale), getScale: () => scale,
  screenToVirtual: (x, y, out) => out.set((x - cameraX) / scale, y / scale) };
const builder = new ZoneEditorGeometryBuilder({ state, map, projector, getWaterMetric: () => metric, config });
const target = {};
builder.buildInto(target); assert.equal(target.annotations, null); assert.equal(builder.rebuilds, 0);
state.setFlag("enabled", true); builder.buildInto(target);
const model = target.annotations, lines = model.lines, rects = model.rects;
assert.equal(model.rectCount + model.overlay.rectCount, 4, "all configured zones, including physically disabled categories, are visible");
assert(model.lineCount > 40 && model.lineCount <= 96 * 24 + 97, "grid work is bounded");
for (let row = 0; row <= 40; row++) {
  const line = lines[row];
  assert(Math.abs(metric.metersFromShore(line.y1) - row) < 1e-8, "every row uses exact ground metres");
}
for (let frame = 0; frame < 120; frame++) builder.buildInto(target);
assert.equal(builder.rebuilds, 1, "120 unchanged frames produce zero geometry rebuilds");
assert.equal(target.annotations, model); assert.equal(model.lines, lines); assert.equal(model.rects, rects);
const beforeTilt = builder.rebuilds;
config.locations.map.lake.perspective.angleBottom = 15;
builder.buildInto(target);
assert.equal(builder.rebuilds, beforeTilt, "visual angles do not change physical grid geometry");
assert(Math.abs(model.lines[0].y1 - model.lines[1].y1 - 50) < 1e-8,
  "angle edits keep depth-axis metre positions");
assert.equal(metric.pixelsPerMeterX(1000), 50, "visual angles never enlarge the physical 50 px/m scale");
config.locations.map.lake.perspective.angleBottom = 30;
metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500,
  maxMeters: 60, linearShare: .5 });
builder.buildInto(target);
assert.equal(builder.rebuilds, beforeTilt + 1, "a physical distance change invalidates the cached grid");
state.setFlag("background", false); builder.buildInto(target); assert.equal(target.backgroundHidden, true);
state.setCategory("collisions", false); builder.buildInto(target); assert.equal(model.rectCount + model.overlay.rectCount, 3);
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

const actions = new Map(), edits = [], trees = [];
const synced = [], infoRows = new Map();
const baseProfile = JSON.parse(JSON.stringify(config.locations.map.lake.distanceProfile));
const baseAngles = { ...config.locations.map.lake.perspective };
let exportCalls = 0, importCalls = 0, resetCalls = 0;
const ui = { syncValue: (path, value) => synced.push([path, value]), releaseValueBindings() {}, createSwitcherRow(label, value, parent, callback) { actions.set(label, callback); },
  createInputRow(label, value, parent, type, callback) { actions.set(label, callback); },
  createInfoRow(label, value) { const element = { innerText: value }; infoRows.set(label, element); return element; },
  createSelectRow(label, options, value, parent, callback) { actions.set(label, callback); },
  createButtonRow(label, parent, callback) { actions.set(label, callback); } };
new ZoneEditorSection({ ui, state, config, createSection: () => ({ replaceChildren() {} }),
  getWaterMetric: () => metric,
  createWaterMetric: options => new WaterMetric(options),
  exportOverrides: () => exportCalls++, importOverrides: () => importCalls++,
  resetPerspective: id => {
    resetCalls++; config.locations.map[id].distanceProfile = JSON.parse(JSON.stringify(baseProfile));
    config.locations.map[id].perspective = { ...baseAngles };
  },
  renderTree: (value, parent, path) => trees.push(path), updateConfig: (path, value) => {
    edits.push(path); let target = config;
    for (const key of path.slice(1, -1)) target = target[key];
    target[path.at(-1)] = value; mapRevision++;
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
actions.get("Нахил біля берега, °")(45);
assert.equal(config.locations.map.lake.perspective.angleBottom, 45, "readable angle control writes the visual perspective");
assert.match(infoRows.get("Стан перспективи").innerText, /45°/u);
const validEdits = edits.length;
actions.get("Нахил біля берега, °")(1);
assert.equal(edits.length, validEdits + 1, "a low angle is accepted without increasing the length");
assert.equal(config.locations.map.lake.perspective.angleBottom, 1);
assert.equal(config.locations.map.lake.distanceProfile.maxMeters, baseProfile.maxMeters, "editing the angle preserves the authored length");
actions.get("Від берега до дальнього краю, м")(5);
assert.equal(config.locations.map.lake.distanceProfile.maxMeters, baseProfile.maxMeters,
  "a location shorter than height / 50 is rejected without fitting a larger scale");
assert.equal(config.locations.map.lake.perspective.angleBottom, 1, "editing the length preserves the angle");
assert.match(infoRows.get("Стан перспективи").innerText, /20\.00 м/u);
const beforeInvalidEdits = edits.length;
actions.get("Нахил біля берега, °")(0);
assert.equal(edits.length, beforeInvalidEdits, "out-of-range angles still reject before a config write");
assert.equal(synced.at(-1)[1], 1, "the displayed invalid angle returns to the accepted value");
assert.match(infoRows.get("Стан перспективи").innerText, /Не застосовано/u);
actions.get("Від берега до дальнього краю, м")(0);
assert.equal(edits.length, beforeInvalidEdits, "non-positive distances still reject before a config write");
actions.get("Кут верхнього краю, °")(2);
assert.equal(edits.length, beforeInvalidEdits, "a reversed angle pair is rejected before a config write");
assert.equal(config.locations.map.lake.perspective.angleTop, 0);
actions.get("Від берега до дальнього краю, м")(60);
actions.get("Нахил біля берега, °")(30);
assert.equal(config.locations.map.lake.perspective.angleBottom, 30);
assert.equal(config.locations.map.lake.distanceProfile.maxMeters, 60);
actions.get("Експорт правок (усі налаштування DEV)")();
actions.get("Імпорт правок (усі налаштування DEV)")();
actions.get("Скинути перспективу цієї локації")();
assert.equal(exportCalls, 1); assert.equal(importCalls, 1); assert.equal(resetCalls, 1);
assert.equal(config.locations.map.lake.distanceProfile.maxMeters, baseProfile.maxMeters);
assert.deepEqual(config.locations.map.lake.perspective, baseAngles);
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
const { TestDocument } = require("./testing/keepnet/test_document");
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
const fullLabel = "Від берега до дальнього краю, м";
controlUI.createInputRow(fullLabel, 40, controlDocument.body, "number", () => {});
assert.equal(controlDocument.byClass("devtools__label").at(-1).innerText, fullLabel,
  "phone users see the complete parameter name instead of a 15-character truncation");
const notice = controlUI.createInfoRow("Стан перспективи", "Ready", controlDocument.body);
notice.innerText = "Rejected";
assert.equal(controlDocument.byClass("devtools__value").at(-1).innerText, "Rejected");
controlUI.dispose();
console.log("Zone editor passed: metre-grid projection, zone edits and visibility, black background, camera/live changes, bounded and zero unchanged rebuilds, reused WebGL Graphics and Canvas fallback without duplicate drawing.");
