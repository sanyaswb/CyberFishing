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
  lake: { zones: { castable: [{ x: 0, y: 0, w: 25, h: 25 }], collisions: [{ x: 2, y: 3, w: 1, h: 2 }],
    snags: [{ x: 4, y: 8, w: 2, h: 1 }], dynamic: [{ x: 5, y: 6, w: 1, h: 1 }] },
  distanceProfile: { enabled: true, maxMeters: 40, linearShare: .5 } } } } };
let mapRevision = 1, scale = 1, cameraX = 0;
const moving = [{ x: 5, y: 6, w: 1, h: 1 }];
const map = { currentLocationId: "lake", getRevision: () => mapRevision, getDynamicZones: () => moving,
  getLocationZones: () => config.locations.map.lake.zones,
  getCastableBoundsVirtual: () => ({ left: 0, right: 1000, top: 0, bottom: 1000 }),
  getBackgroundRenderData: () => ({ loaded: true, dynamic: false, assetIds: { default: "image" }, width: 1000, height: 1000 }) };
let metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500, maxMeters: 40, linearShare: .5 });
const perspective = new WorldPerspective({ getWaterMetric: () => metric });
const provider = new LocationDebugDataProvider({ configSource: () => config, perspectiveSource: y => perspective.getPerspective(y) });
assert.equal(provider.getPerspective({}, 200).scale, metric.pixelsPerMeterX(200) / metric.pixelsPerMeter,
  "DEV diagnostics read the actual session metric, not an angle copy");
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
const synced = [];
const ui = { syncValue: (path, value) => synced.push([path, value]), releaseValueBindings() {}, createSwitcherRow(label, value, parent, callback) { actions.set(label, callback); },
  createInputRow(label, value, parent, type, callback) { actions.set(label, callback); }, createInfoRow() {},
  createSelectRow(label, options, value, parent, callback) { actions.set(label, callback); },
  createButtonRow(label, parent, callback) { actions.set(label, callback); } };
new ZoneEditorSection({ ui, state, config, createSection: () => ({ replaceChildren() {} }),
  renderTree: (value, parent, path) => trees.push(path), updateConfig: (path, value) => {
    edits.push(path); config.locations.map.lake.zones[path.at(-1)] = value; mapRevision++;
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
console.log("Zone editor passed: metre-grid projection, zone edits and visibility, black background, camera/live changes, bounded and zero unchanged rebuilds, reused WebGL Graphics and Canvas fallback without duplicate drawing.");
