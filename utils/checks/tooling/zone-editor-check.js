"use strict";
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const runtime = new SourceRuntime();
const load = path => runtime.importModule(path);
const { ZoneEditorState } = load("src/dev/location/zone_editor_state.js");
const { ZoneEditorGeometryBuilder } = load("src/dev/location/zone_editor_geometry_builder.js");
const { ZoneEditorSection } = load("src/dev/tools/zone_editor_section.js");
const { DevToolsEdgeOpener } = load("src/dev/tools/dev_tools_edge_opener.js");
const { PixiAnnotationRenderer } = load("src/platform/browser/scene/pixi_annotation_renderer.js");
const { WorldDebugRenderer } = load("src/dev/rendering/world_debug_renderer.js");
const { WaterMetric } = load("src/game/domain/locations/water_metric.js");
const { WorldRenderFrameBuilder } = load("src/game/presentation/rendering/world_render_frame_builder.js");
const { GameRenderFrame } = load("src/game/presentation/rendering/game_render_frame.js");
const { DevToolsControlBindingRegistry } = load("src/dev/services/dev_tools_control_binding_registry.js");
const { LocationDebugDataProvider } = load("src/dev/location/location_debug_data_provider.js");
const { WorldPerspective } = load("src/game/domain/locations/world_perspective.js");

// Spec 138: topology, exact queries and real pointer/file commands (including the owner's RMB erase gesture).
{
  const maskMath = load('src/engine/geometry/grid_mask.js');
  const { ZoneMaskEditor } = load('src/dev/location/zone_mask_editor.js');
  const { LocationMap } = load('src/game/domain/locations/location_map.js');
  const { DynamicZone } = load('src/game/domain/locations/dynamic_zone.js');
  const { ZoneEditorDragController } = load('src/dev/location/zone_editor_drag_controller.js');
  const { ZoneEditorConfigEdits } = load('src/dev/location/zone_editor_config_edits.js');
  const format = load('src/dev/location/zone_export_format.js');
  const cells = new Uint8Array(16).fill(1), cell = [.25, .25];
  const full = maskMath.bakeGridMask(cell, cells);
  assert.equal(JSON.stringify(full.rects), '[[0,0,4,4]]', 'a full mesh bakes to one rectangle');
  assert.equal(maskMath.compileGridMask(full).edges.length, 4, 'no internal edges remain in baked contour');
  assert.equal(maskMath.compileGridMask(full), maskMath.compileGridMask(full), 'topology is reused by identity');
  cells.fill(0); cells[0] = cells[5] = 1;
  assert.throws(() => maskMath.bakeGridMask(cell, cells), /connected/, 'diagonal contact cannot apply');
  cells.fill(1); cells[5] = cells[6] = cells[9] = cells[10] = 0;
  const ring = maskMath.bakeGridMask(cell, cells);
  assert.equal(maskMath.compileGridMask(ring).edges.length, 8, 'connected holes retain inner and outer contours');
  assert(!maskMath.gridMaskContains(ring, .5, .5));
  assert(maskMath.validateGridMask({ ...full, rects: [[0, 0, 4, 4], [0, 0, 1, 1]] }));
  assert(maskMath.validateGridMask({ ...full, cell: [1e-20, 1e-20] }));
  assert(maskMath.validateGridMask({ ...full, rects: [[0, 0, Infinity, 1]] }));

  const cfg = { locations: { cellSize: 40, designCellSize: 40, baseResolution: { width: 160, height: 160 },
    map: { masks: { depthBounds: { min: 1, max: 5 }, zones: {
      castable: [{ x: 0, y: 0, w: 2, h: 2 }], collisions: [], snags: [], dynamic: [] } } } } };
  const resources = { depthReader: { getDepthAtPixel: () => 3 } };
  const map = new LocationMap('masks', cfg.locations, { next: () => 0 }, resources);
  map.recalculateZones(null, 40);
  const st = new ZoneEditorState(); st.locationId = st.loadedLocationId = 'masks'; st.setFlag('enabled', true); st.setEditing('castable', true);
  const commands = new ZoneEditorConfigEdits({ config: cfg, getMap: () => map });
  let writes = 0;
  const write = (path, value) => {
    writes++; const command = commands.prepare(path, value);
    let object = cfg; for (const key of command.path.slice(1, -1)) object = object[key]; object[command.path.at(-1)] = command.value;
    map.refreshConfig(cfg.locations, resources);
  };
  const editor = new ZoneMaskEditor({ state: st, config: cfg, getMap: () => map, writeConfig: write });
  const proj = { getScale: () => 1, virtualToScreen: (x, y, out) => out.set(x, y), screenToVirtual: (x, y, out) => out.set(x, y) };
  let layer, captures = 0;
  const element = () => ({ classList: { add() {}, remove() {} }, listeners: new Map(),
    addEventListener(type, fn) { this.listeners.set(type, fn); }, removeEventListener(type) { this.listeners.delete(type); }, remove() {},
    setPointerCapture() { captures++; }, releasePointerCapture() { captures--; } });
  const drag = new ZoneEditorDragController({ state: st, map, projector: proj, config: cfg, maskEditor: editor,
    canvasMetrics: { width: 160, height: 160 }, getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 160, height: 160 }) }),
    documentTarget: { createElement: element, body: element() }, mountNode: { prepend: node => { layer = node; } }, writeZones: write });
  drag.sync();
  const pointer = (type, x, y, button = 0) => { let prevented = false;
    layer.listeners.get(type)({ clientX: x, clientY: y, button, pointerId: 1, preventDefault() { prevented = true; } }); return prevented; };
  assert(editor.start('castable', 0));
  const focusGeometry = new ZoneEditorGeometryBuilder({ state: st, map, projector: proj, config: cfg, maskEditor: editor,
    canvasMetrics: { width: 160, height: 160 }, getWaterMetric: () => null });
  const focused = {}; focusGeometry.buildInto(focused);
  const foreground = focused.annotations.foreground;
  const shades = foreground.rects.slice(0, foreground.rectCount).filter(r => r.color === 0 && r.fillAlpha > 0);
  assert.equal(shades.reduce((area, r) => area + r.width * r.height, 0), 160 * 160 - 80 * 80,
    'mesh mode immediately dims exactly the viewport outside the host');
  const focusRevision = foreground.revision;
  for (let i = 0; i < 120; i++) focusGeometry.buildInto(focused);
  assert.equal(foreground.revision, focusRevision, 'unchanged focus/mesh commands are cached');
  const layers = [];
  const graphics = function () { this.operations = []; this.visible = false; this.clear = () => { this.operations.length = 0; return this; };
    for (const method of ['moveTo', 'lineTo', 'stroke', 'fill', 'rect', 'ellipse']) this[method] = (...args) => { this.operations.push([method, ...args]); return this; }; };
  const pixi = new PixiAnnotationRenderer({ pixi: { Graphics: graphics }, stage: { addChild: (...items) => layers.push(...items) } });
  assert(pixi.update(focused.annotations));
  assert(layers[2].visible && layers[2].operations.some(op => op[0] === 'lineTo'), 'WebGL paints foreground grid and dimming after other annotations');
  let canvasSegments = 0, canvasShades = 0;
  const canvas = { globalAlpha: 1, drawImage() {}, strokeRect() {}, fillRect() { if (this.globalAlpha === .7) canvasShades++; },
    beginPath() {}, moveTo() {}, lineTo() { canvasSegments++; }, stroke() {} };
  new WorldDebugRenderer({ surface: canvas }).render({ visible: true, annotations: focused.annotations, debugImage: { visible: false }, dynamicZones: { count: 0 } });
  assert(canvasShades && canvasSegments, 'Canvas consumes the same foreground and segment commands');
  pointer('pointerdown', 10, 10); pointer('pointermove', 70, 10); pointer('pointerup', 70, 10);
  assert.equal(editor.draft.cells.slice(0, 4).reduce((a, b) => a + b, 0), 4, 'fast stroke fills intermediate cells');
  assert.equal(writes, 0, 'painting only changes a draft');
  pointer('pointerdown', 10, 30); pointer('pointermove', 10, 70); pointer('pointerup', 10, 70);
  assert(pointer('contextmenu', 0, 0), 'RMB mesh input suppresses browser context menu');
  pointer('pointerdown', 10, 70, 2); pointer('pointermove', 10, 50, 2); pointer('pointerup', 10, 50, 2);
  assert(!editor.draft.cells[12] && !editor.draft.cells[8] && editor.draft.cells[4], 'RMB drag removes only traversed cells');
  pointer('pointerdown', 10, 30, 2); pointer('pointerup', 10, 30, 2);
  assert(editor.apply()); assert.equal(writes, 1); assert.equal(captures, 0);
  focusGeometry.buildInto(focused); assert.equal(focused.annotations.foreground, null, 'applying leaves mesh mode and removes dimming');
  pixi.update(focused.annotations); assert(!layers[2].visible);
  const saved = cfg.locations.map.masks.zones.castable[0].mask;
  assert(map.isCastableAt(10, 10) && !map.isCastableAt(10, 30), 'two points in one coarse cell obey the fine mask');
  assert.equal(map.getCellAtVirtualPos(10, 30, 40).depth, 3, 'mask does not change depth');
  assert.equal(map.getCellAtVirtualPos(10, 30, 40).isWater, true, 'mask does not change water raster');
  const renderFrame = new GameRenderFrame();
  const water = new WorldRenderFrameBuilder({ map, projector: proj, config: cfg, canvasMetrics: { width: 160 }, locationId: 'masks', boatChumBuilder: { buildInto() {} } });
  water.buildInto({ target: renderFrame.world });
  const clip = renderFrame.world.clipRegions.getAt(0);
  assert.equal(JSON.stringify([clip.x, clip.y, clip.width, clip.height]), '[0,0,80,20]', 'water waves clip to the applied castable mask, excluding the shore');
  assert(renderFrame.world.waterPlane.masked, 'water renderer receives union-mask semantics');
  const json = format.canonicalZonesJson(cfg.locations.map.masks.zones);
  const roundTrip = JSON.parse(json);
  assert.equal(format.validateZones(roundTrip).length, 0);
  assert.equal(format.canonicalZonesJson(roundTrip), json);
  assert(format.zoneModuleSource('masks', roundTrip).includes('mask:'), 'apply:zones module keeps baked data');
  for (const size of [17, 40]) {
    cfg.locations.cellSize = size; map.refreshConfig(cfg.locations, resources);
    assert(map.isCastableAt(10, 10) && !map.isCastableAt(10, 30), 'global grid changes preserve exact mask boundaries');
  }
  assert(editor.start('castable', 0)); editor.setSubdivision(4);
  editor.paint(5, 5); editor.endStroke(); editor.paint(75, 75); editor.endStroke();
  assert(!editor.apply() && cfg.locations.map.masks.zones.castable[0].mask === saved, 'invalid draft cannot replace saved geometry');
  editor.setSubdivision(2);
  editor.paint(30, 10); editor.paint(30, 70); editor.endStroke(); editor.invert();
  assert(!editor.canApply && !editor.apply(), 'inversion cannot silently discard disconnected islands');
  editor.invert(); assert(editor.canApply, 'reversing twice restores the actual occupied cells');
  st.select('collisions', 0); editor.sync(); assert.equal(editor.draft, null, 'selection changes discard stale draft');
  st.select('castable', 0); editor.start('castable', 0);
  pointer('pointerdown', 10, 10); st.setEditing('castable', false); drag.sync();
  assert.equal(captures, 0, 'dependency change releases painting capture');
  assert.equal(editor.draft, null);
  drag.dispose(); assert.equal(layer.listeners.size, 0, 'all mesh pointer/context listeners are released');

  const zones = cfg.locations.map.masks.zones;
  zones.castable[0].mask = { ...saved, enabled: false }; map.refreshConfig(cfg.locations, resources);
  assert(map.isCastableAt(10, 30), 'disabled mask restores original shape');
  renderFrame.reset(); water.buildInto({ target: renderFrame.world });
  assert.equal(renderFrame.world.clipRegions.getAt(0).height, 80, 'disabled mask restores ordinary wave area');
  assert.equal(renderFrame.world.waterPlane.masked, false);
  zones.collisions = [{ x: 0, y: 0, w: 1, h: 1, mask: { enabled: true, cell: [.5, .5], rects: [[0, 0, 1, 2]] } }];
  zones.snags = JSON.parse(JSON.stringify(zones.collisions)); map.refreshConfig(cfg.locations, resources);
  assert(!map.isCastableAt(10, 10) && map.isCastableAt(30, 10), 'empty obstacle-mask corner accepts casts despite coarse obstacle flag');
  assert(map.hasSnagAt(10, 10) && !map.hasSnagAt(30, 10));
  const maskedFile = JSON.parse(format.canonicalZonesJson(zones));
  assert.equal(format.validateZones(maskedFile).length, 0);
  const bodyMask = { enabled: true, cell: [.25, .25], rects: [[1, 1, 2, 2]] };
  const moving = new DynamicZone({ id: 'mask', x: 0, y: 0, w: 4, h: 4, moving: true, speedX: 1, speedY: 0,
    bounds: { x: 0, y: 0, w: 4, h: 4 }, mask: bodyMask });
  moving.dirTimer = 10000; moving.update(3000);
  assert.equal(moving.x, -1, 'occupied edge reflects from movement boundary; empty host margins do not constrain it');
  assert(moving.speedX > 0);
  zones.dynamic = [{ id: 'editable-mask', x: 0, y: 0, w: 4, h: 4, moving: true, mask: bodyMask, bounds: { x: 0, y: 0, w: 4, h: 4 } }];
  map.refreshConfig(cfg.locations, resources);
  write(['CONFIG', 'locations', 'map', 'masks', 'zones', 'dynamic', 0, 'x'], -100);
  assert.equal(map.getDynamicZones()[0].x, -1, 'numeric editing constrains the occupied mask, not empty host margins');
  assert.equal(map.getDynamicZones()[0].w, 4, 'mask editing does not shrink the host');
  const rows = new Map(), maskSections = [], outerGroups = new Map(), treeParents = new Map(), controlParents = new Map();
  const remember = (label, parent, action) => { const key = `${parent.label}/${label}`; rows.set(key, action); controlParents.set(key, parent); };
  const ui = { createControlGroup(parent, path, { disabled = false } = {}) {
    const group = { label: parent.label, disabled, replaceChildren() {} };
    if (path?.[1] === 'outer') outerGroups.set(path[2], group);
    return group;
  }, syncValue() {}, releaseValueBindings() {}, createInfoRow() {},
    createRangeRow(label, value, parent, action) { remember(label, parent, action); },
    createSwitcherRow(label, value, parent, action) { remember(label, parent, action); if (label === 'Меш маски') maskSections.push(parent.label); },
    createButtonRow(label, parent, action) { remember(label, parent, action); },
    createInputRow(label, value, parent, type, action) { remember(label, parent, action); },
    createSelectRow(label, options, value, parent, action) { remember(label, parent, action); } };
  st.setFlag('enabled', true); st.setEditing('castable', true); st.select('castable', 0);
  const section = new ZoneEditorSection({ ui, state: st, config: cfg, maskEditor: editor,
    createSection: label => ({ label, replaceChildren() {} }), renderTree(value, parent, path) {
      assert(!Object.hasOwn(value, 'mask'), 'raw mask arrays are not editable parameter trees'); treeParents.set(path[5], parent);
    },
    updateConfig: write, getWaterMetric: () => null });
  section.render({});
  assert.equal(maskSections.length, 4, 'only the four ordinary categories have mesh controls');
  rows.get('Ігрова область (закидання)/Меш маски')(true);
  assert(editor.isActive('castable', 0));
  rows.get('Ігрова область (закидання)/Дроблення клітинки')('×4');
  assert.equal(editor.subdivision, 4);
  // TK-075: every host mutation belongs to the disabled group, while mesh/number controls remain usable.
  for (const [category, label] of [['castable', 'Ігрова область (закидання)'], ['collisions', 'Перешкоди'], ['snags', 'Зачепи'], ['dynamic', 'Рухомі зони']]) {
    st.setEditing(category, true);
    rows.get(`${label}/Меш маски`)(true);
    const group = outerGroups.get(category);
    assert(group.disabled, `${category} host parameters lock when its mesh starts`);
    assert.equal(treeParents.get(category), group, 'all nested coordinate/bounds fields share the lock');
    assert.equal(controlParents.get(`${label}/Додати зону`), group);
    assert.equal(controlParents.get(`${label}/Видалити вибрану зону`), group);
    if (category === 'dynamic') assert.equal(controlParents.get(`${label}/Форма зони`), group);
    assert(!controlParents.get(`${label}/Номер зони`).disabled && !controlParents.get(`${label}/Меш маски`).disabled);
    rows.get(`${label}/Меш маски`)(false);
    assert(!outerGroups.get(category).disabled, 'leaving mesh mode restores host controls');
  }
  rows.get('Ігрова область (закидання)/Меш маски')(true);
  editor.paint(5, 5); editor.endStroke();
  const beforeOpacity = { draft: editor.draft, preview: editor.preview, data: JSON.stringify(zones), writes };
  rows.get('Ігрова область (закидання)/Непрозорість маски')(50);
  assert.equal(editor.opacity, .5);
  assert.equal(editor.draft, beforeOpacity.draft); assert.equal(editor.preview, beforeOpacity.preview, 'opacity retains compiled draft topology');
  assert.equal(JSON.stringify(zones), beforeOpacity.data); assert.equal(writes, beforeOpacity.writes, 'view opacity cannot write zone config');
  focusGeometry.buildInto(focused);
  assert(focused.annotations.foreground.rects.slice(0, focused.annotations.foreground.rectCount).some(r => r.color !== 0 && r.fillAlpha === .5));
  rows.get('Ігрова область (закидання)/Непрозорість маски')(0);
  focusGeometry.buildInto(focused);
  assert(!focused.annotations.foreground.rects.slice(0, focused.annotations.foreground.rectCount).some(r => r.color !== 0 && r.fillAlpha > 0));
  assert(focused.annotations.foreground.rects.slice(0, focused.annotations.foreground.rectCount).some(r => r.shape === 'segment' && r.strokeAlpha > 0), 'transparent fill retains contour/grid input cues');
  const viewRevision = editor.revision; editor.setOpacity(0); assert.equal(editor.revision, viewRevision, 'unchanged opacity invalidates nothing');
  rows.get('Ігрова область (закидання)/Непрозорість маски')(100);
  focusGeometry.buildInto(focused);
  assert(focused.annotations.foreground.rects.slice(0, focused.annotations.foreground.rectCount).some(r => r.color !== 0 && r.fillAlpha === 1));
  // One grid-opacity owner drives the coarse grid, fine mesh lines and perspective model, never the contour/fill.
  for (const value of [0, .63, 1]) {
    st.setNumber('cellGridOpacity', value); focusGeometry.buildInto(focused);
    assert.equal(focused.annotations.cellLineAlpha, value); assert.equal(focused.annotations.lineAlpha, value);
    const segments = focused.annotations.foreground.rects.slice(0, focused.annotations.foreground.rectCount).filter(r => r.shape === 'segment' && r.lineWidth === 1);
    assert(segments.length && segments.every(r => r.strokeAlpha === value), 'mesh grid follows the editor opacity');
    assert(focused.annotations.foreground.rects.slice(0, focused.annotations.foreground.rectCount).some(r => r.shape === 'segment' && r.lineWidth === 2 && r.strokeAlpha === 1), 'mask contour remains visible independently');
  }
  editor.apply(); st.zonesEdited();
  assert(!outerGroups.get('castable').disabled, 'applying restores host controls');
  st.setCategory('castable', true); editor.setOpacity(.47); focusGeometry.buildInto(focused);
  assert(focused.annotations.rects.slice(0, focused.annotations.rectCount).some(r => r.fillAlpha === .47), 'shown applied masks use the same view opacity');
  section.dispose(); assert.equal(editor.draft, null, 'panel disposal releases its draft and focus');
  const meshState = new ZoneEditorState(); meshState.setCategory('castable', true);
  zones.castable[0].mask = ring; map.refreshConfig(cfg.locations, resources);
  const geometry = new ZoneEditorGeometryBuilder({ state: meshState, map, projector: proj, config: cfg, getWaterMetric: () => null });
  const frame = {}; geometry.buildInto(frame);
  assert(frame.annotations.rects.slice(0, frame.annotations.rectCount).some(r => r.shape === 'segment'), 'shared commands preserve mask hole contour');
  const rebuilds = geometry.rebuilds;
  for (let i = 0; i < 120; i++) geometry.buildInto(frame);
  assert.equal(geometry.rebuilds, rebuilds, 'unchanged masked frames do no topology work');
}

const state = new ZoneEditorState();
// TK-049: zone areas start hidden (and the depth numbers off); the checks below show every category explicitly.
assert(Object.values(state.categories).every(shown => shown === false) && state.depth === false, "zones and depth start hidden");
state.setFlag("enabled", true); assert(state.grid === false && state.cellGrid === true, "TK-050: enabling the editor shows the cell grid, not the perspective grid");
state.setFlag("enabled", false);
assert(!state.cellGrid && !state.grid, 'disabling the editor also disables its automatic grid');
state.setFlag("enabled", true); state.setFlag("grid", true); state.setFlag("enabled", false);
assert(!state.cellGrid && !state.grid, 'disabling editing also clears a perspective grid selected while editing');
const config = { locations: { cellSize: 40, baseResolution: { width: 1000, height: 1000 }, map: {
  lake: { safeZone: { top: 0, bottom: 1000 }, waterProjection: { maxMeters: 40, tiltDegrees: 30, farScale: .3 },
    zones: { castable: [{ x: 0, y: 0, w: 25, h: 25 }], collisions: [{ x: 2, y: 3, w: 1, h: 2 }],
    snags: [{ x: 4, y: 8, w: 2, h: 1 }], dynamic: [{ x: 5, y: 6, w: 1, h: 1 }] } } } } };
let mapRevision = 1, scale = 1, cameraX = 0;
const moving = [{ x: 5, y: 6, w: 1, h: 1 }];
const map = { currentLocationId: "lake", getRevision: () => mapRevision, getDynamicZones: () => moving,
  getLocationZones: () => {
    const zones = config.locations.map.lake.zones, ratio = (config.locations.designCellSize || config.locations.cellSize) / config.locations.cellSize;
    if (ratio === 1) return zones;
    return Object.fromEntries(Object.entries(zones).map(([category, entries]) => [category,
      entries.map(zone => ({ ...zone, x: Math.round(zone.x * ratio), y: Math.round(zone.y * ratio),
        w: Math.round(zone.w * ratio), h: Math.round(zone.h * ratio) }))]));
  },
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
state.setFlag("enabled", true); state.setFlag("grid", true);
for (const category of Object.keys(state.categories)) state.setCategory(category, true);
builder.buildInto(target);
const model = target.annotations, lines = model.lines, rects = model.rects;
assert.equal(model.rectCount + model.overlay.rectCount, 4, "every shown zone is drawn; nothing is hovered, so no handles (Revision 3)");
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
for (const name of ["rect", "ellipse", "fill", "stroke", "moveTo", "lineTo"]) Graphics.prototype[name] = function (...args) {
  this.operations.push([name, ...args]); return this;
};
let graphics, overlayGraphics;
const renderer = new PixiAnnotationRenderer({ pixi: { Graphics }, stage: { addChild: (first, second) => { graphics = first; overlayGraphics = second; } } });
assert.equal(renderer.update(model), true); const clears = graphics.clears;
for (let frame = 0; frame < 120; frame++) assert.equal(renderer.update(model), false);
assert.equal(graphics.clears, clears, "unchanged WebGL annotations make no Graphics writes");
state.setNumber('cellGridOpacity', .29); builder.buildInto(target); renderer.update(model);
assert(graphics.operations.some(([operation, options]) => operation === 'stroke' && options.color === 0x88ddff && options.alpha === .29),
  'WebGL perspective lines consume the shared grid opacity');
model.overlay = { revision: 1, rectCount: 0, lineCount: 0, rects: [], lines: [] };
renderer.update(model); const staticClears = graphics.clears, dynamicClears = overlayGraphics.clears;
model.overlay.revision++; renderer.update(model);
assert.equal(graphics.clears, staticClears); assert.equal(overlayGraphics.clears, dynamicClears + 1, "only moving annotation Graphics rebuilds");
model.overlay = null;
assert.equal(renderer.update(null), true); assert.equal(renderer.update(null), false); assert.equal(renderer.update(model), true);
const drawn = [];
const surface = { globalAlpha: 1, drawImage() {}, strokeRect: (...args) => drawn.push(args), fillRect() {}, beginPath() {},
  moveTo() {}, lineTo() {}, stroke() { this.lastStrokeStyle = this.strokeStyle; } };
const debugModel = { visible: true, annotations: model, debugImage: { visible: false }, dynamicZones: { count: 0 } };
new WorldDebugRenderer({ surface, sceneRouter: { drawsOnScene: () => true } }).render(debugModel);
assert.equal(drawn.length, 0, "WebGL annotations are not also drawn on Canvas");
new WorldDebugRenderer({ surface, sceneRouter: { drawsOnScene: () => false } }).render(debugModel);
assert.equal(drawn.length, model.rectCount, "Canvas fallback consumes the exact same zone geometry");
assert.equal(surface.lastStrokeStyle, 'rgba(136, 221, 255, 0.29)', 'Canvas perspective lines use the same opacity');
const frame = new GameRenderFrame();
new WorldRenderFrameBuilder({ map, projector, config, canvasMetrics: { width: 1000 }, locationId: "lake",
  boatChumBuilder: { buildInto() {} }, debugBuilder: builder }).buildInto({ target: frame.world, debugEnabled: true });
assert.equal(frame.world.backgroundLayers.count, 0); assert.equal(frame.world.backgroundColor, "#000000");
frame.reset(); assert.equal(frame.world.annotations, null); assert.equal(frame.world.backgroundHidden, false);

const actions = new Map(), edits = [], trees = [], candidateInputs = [];
const synced = [], infoRows = new Map();
const baseProjection = JSON.parse(JSON.stringify(config.locations.map.lake.waterProjection));
let resetCalls = 0;
const refreshMetric = () => {
  metric = lakeMetric(config.locations.map.lake.waterProjection);
};
// Rows of the per-category zone lists are keyed "<list>/<label>" (their labels repeat in every list).
const ZONE_LISTS = new Set(["Ігрова область (закидання)", "Перешкоди", "Зачепи", "Рухомі зони"]);
const keyOf = (label, parent) => ZONE_LISTS.has(parent?.label) ? `${parent.label}/${label}` : label;
const ui = { createControlGroup: () => ({ label: "Локація", replaceChildren() {} }), syncValue: (path, value) => synced.push([path, value]), releaseValueBindings() {},
  createSwitcherRow(label, value, parent, callback) { actions.set(keyOf(label, parent), callback); },
  createInputRow(label, value, parent, type, callback) { actions.set(keyOf(label, parent), callback); },
  createRangeRow(label, value, parent, callback) { actions.set(keyOf(label, parent), callback); },
  createInfoRow(label, value) { const element = { innerText: value }; infoRows.set(label, element); return element; },
  createSelectRow(label, options, value, parent, callback) { actions.set(keyOf(label, parent), callback); },
  createButtonRow(label, parent, callback) { actions.set(keyOf(label, parent), callback); } };
const stubSection = (label) => ({ label, replaceChildren() {} });
new ZoneEditorSection({ ui, state, config, createSection: stubSection,
  getWaterMetric: () => metric,
  createWaterMetric: options => { candidateInputs.push(options); return WaterMetric.illustrated(options); },
  resetPerspective: id => {
    resetCalls++; config.locations.map[id].waterProjection = JSON.parse(JSON.stringify(baseProjection)); refreshMetric();
  },
  renderTree: (value, parent, path) => trees.push(path), updateConfig: (path, value) => {
    edits.push(path); let target = config;
    for (const key of path.slice(1, -1)) target = target[key];
    target[path.at(-1)] = value; mapRevision++; refreshMetric();
  } }).render({});
assert(trees.some(path => path.join(".") === "CONFIG.locations.map.lake.zones.castable.0"));
actions.get("Крок сітки, м")(-1); assert.equal(synced.at(-1)[1], .25, "the displayed spacing matches the clamped setting");
const castableAction = (label) => actions.get(`Ігрова область (закидання)/${label}`);
config.locations.map.lake.zones.castable[0].bounds = { x: 10, y: 20, w: 30, h: 40 };
castableAction("Додати зону")(); assert.equal(config.locations.map.lake.zones.castable.length, 2);
assert.notEqual(config.locations.map.lake.zones.castable[0].bounds, config.locations.map.lake.zones.castable[1].bounds,
  "duplicated zones never share writable nested bounds");
castableAction("Видалити вибрану зону")(); assert.equal(config.locations.map.lake.zones.castable.length, 1);
// TK-051: the last zone can be deleted too; the refilled list then offers no delete button.
const lastCastable = config.locations.map.lake.zones.castable;
const deleteLast = castableAction("Видалити вибрану зону");
actions.delete("Ігрова область (закидання)/Видалити вибрану зону");
deleteLast();
assert.equal(config.locations.map.lake.zones.castable.length, 0, "the only castable zone is deleted");
assert(!actions.has("Ігрова область (закидання)/Видалити вибрану зону") && actions.has("Ігрова область (закидання)/Додати зону"),
  "with no zones left the delete button is gone and adding stays");
config.locations.map.lake.zones.castable = lastCastable;
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
assert(!actions.has("Експорт правок (усі налаштування DEV)"), "spec 130: the editor exports the location's zones, not every override");
actions.get("Скинути перспективу цієї локації")();
assert.equal(resetCalls, 1);
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
  new ZoneEditorSection({ ui, state: uniformState, config: uniformConfig, createSection: stubSection,
    getWaterMetric: () => pondMetric, createWaterMetric: options => WaterMetric.illustrated(options),
    renderTree() {}, updateConfig: (path, value) => {
      let target = uniformConfig;
      for (const key of path.slice(1, -1)) target = target[key];
      target[path.at(-1)] = value; pondMetric = lakeMetric(value);
    } }).render({});
  assert.match(infoRows.get("Стан").innerText, /рівномірна/u, "uniform water says so");
  assert.equal(actions.has("Нахил площини, °"), false, "no projection controls without a projection");
  actions.get("Фізика перспективи")(true);
  assert.equal(JSON.stringify(uniformConfig.locations.map.pond.waterProjection),
    JSON.stringify({ maxMeters: 20, tiltDegrees: 30, farScale: .3, lateralContraction: false }),
    "adding a projection keeps the uniform length and takes the documented defaults");
  assert.equal(typeof actions.get("Нахил площини, °"), "function", "the added projection is editable at once");
}
state.setFlag("enabled", false); builder.buildInto(target); assert(target.annotations, "explicit visibility survives leaving edit mode"); assert.equal(target.backgroundHidden, false);
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
// TK-075: use native fieldset disabling, including controls created later inside nested parameter sections.
{
  const host = createElement('div'); controlDocument.body.appendChild(host);
  const locked = controlUI.createControlGroup(host, ['test', 'locked'], { disabled: true });
  const nested = controlUI.createSection('Bounds', locked, true, () => {});
  controlUI.createInputRow('x', 1, nested, 'number', () => {}, ['test', 'x']);
  assert(locked.tagName === 'fieldset' && locked.disabled === true && locked.getAttribute('aria-disabled') === 'true',
    'native disabled semantics cover the entire outer-zone parameter tree');
  assert(locked.contains(controlDocument.byClass('devtools__input').at(-1)));
  controlUI.createRangeRow('Mask opacity', 30, host, () => {});
  assert(!locked.contains(controlDocument.byClass('devtools__range').at(-1)), 'mask controls remain outside the host lock');
  controlUI.releaseValueBindings(host); host.replaceChildren();
  const unlocked = controlUI.createControlGroup(host, ['test', 'locked']);
  assert(!unlocked.disabled, 'a rebuilt group restores native editing');
  host.remove();
}
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
// TK-064: insertion order must also be the keyboard/reading order, including late controls and partial refreshes.
const ordered = createElement('div'); controlDocument.body.appendChild(ordered);
const firstInfo = controlUI.createInfoRow('First info', '1', ordered);
const nested = controlUI.createSection('Nested', ordered, true, () => {});
const orderGroup = controlUI.createControlGroup(ordered);
controlUI.createSelectRow('Location', ['A', 'B'], 'A', orderGroup, () => {});
const groupInfo = controlUI.createInfoRow('Group status', 'ready', orderGroup);
let controlChanges = 0;
controlUI.createSwitcherRow('Direct', false, ordered, () => controlChanges++, ['order', 'direct']);
const direct = ordered.children.find(node => node.classList.contains('devtools__row'));
const lastInfo = controlUI.createInfoRow('Last info', '2', ordered);
const secondNested = controlUI.createSection('Second nested', ordered, false, () => {});
const infoSection = firstInfo.parentNode.parentNode.parentNode;
assert.deepEqual(ordered.children, [orderGroup, direct, nested.parentNode, secondNested.parentNode, infoSection],
  'controls precede nested sections; the one description is last even when created first');
assert(lastInfo.parentNode.parentNode === firstInfo.parentNode.parentNode, 'late descriptions share the same bottom disclosure');
assert(groupInfo.parentNode.parentNode === firstInfo.parentNode.parentNode, 'transparent control groups keep descriptions at their logical parent');
const checkbox = direct.children[1].children[0];
controlUI.syncValue(['order', 'direct'], true); checkbox.fire('change');
assert(checkbox.checked && controlChanges === 1, 'ordered insertion preserves binding identity and callbacks');
controlUI.releaseValueBindings(orderGroup); orderGroup.replaceChildren();
controlUI.createSelectRow('Location', ['B'], 'B', orderGroup, () => {});
controlUI.createInfoRow('New group status', 'updated', orderGroup);
assert(!ordered.contains(groupInfo) && ordered.contains(firstInfo), 'group refresh removes its own status without deleting sibling descriptions');
assert.equal(ordered.children.at(-1), infoSection, 'partial refresh leaves the description last');
controlUI.dispose();
// Spec 131: dependencies are live conditions, not inferred from section nesting; fake clock, real controls.
{
  const { DevToolsDependencyFeedback } = controlRuntime.importModule("src/dev/services/dev_tools_dependency_feedback.js");
  let now = 0, nextTimer = 0;
  const timers = new Map();
  const scheduler = {
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const advance = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  };
  const feedback = new DevToolsDependencyFeedback({ scheduler, durationMs: 3000 });
  const mount = createElement('div'); controlDocument.body.appendChild(mount);
  const ui = new DevToolsUI(() => {}, {}, null, null, null, mount, mount, feedback);
  const body = ui.body;
  const parentSection = ui.createSection('Parent', body, false, () => {});
  let parentOn = false, childOn = false, writes = 0;
  const parentPath = ['test', 'parent'];
  ui.createSwitcherRow('Parent enabled', false, parentSection, value => { parentOn = value; }, parentPath);
  ui.createSwitcherRow('Child enabled', false, body, value => { childOn = value; writes++; }, ['test', 'child'], ['test', 'child'],
    { requires: [{ path: parentPath, isEnabled: () => parentOn }] });
  const parentRow = parentSection.children[0];
  const childRow = body.children.find(node => node.classList.contains('devtools__row'));
  const parentControl = parentRow.children[1].children[0], childControl = childRow.children[1].children[0];
  assert.equal(childControl.getAttribute('aria-disabled'), 'true', 'unmet dependencies are unavailable immediately on creation');
  const attempt = () => { childControl.checked = true; childControl.fire('change'); };
  attempt();
  assert(!childControl.checked && !childOn && writes === 0, 'blocked activation restores the checkbox without calling the command');
  assert(parentRow.getAttribute('aria-invalid') === 'true' && parentSection.style.display === 'block', 'the actual blocking parent is revealed and identified');
  advance(2999); assert.equal(parentRow.getAttribute('aria-invalid'), 'true');
  attempt(); assert.equal(timers.size, 1, 'repeated attempts restart one timer');
  advance(1); assert.equal(parentRow.getAttribute('aria-invalid'), 'true');
  advance(2999); assert.equal(parentRow.getAttribute('aria-invalid'), null, 'the highlight ends after 3000 ms from the last attempt');
  attempt(); parentControl.checked = true; parentControl.fire('change');
  assert(parentOn && timers.size === 0 && parentRow.getAttribute('aria-invalid') === null, 'enabling the blocker clears feedback immediately');
  assert.equal(childControl.getAttribute('aria-disabled'), 'false', 'parent input makes its child available without polling');
  attempt(); assert(childOn && childControl.checked && writes === 1, 'the child succeeds once the prerequisite is met');
  parentOn = false; ui.syncValue(parentPath, false);
  assert.equal(childControl.getAttribute('aria-disabled'), 'true', 'bound updates also mark an active child unavailable');
  childControl.checked = false; childControl.fire('change');
  assert(!childOn && writes === 2, 'turning a child off remains allowed with the parent off');
  attempt(); ui.syncValue(parentPath, true);
  assert.equal(timers.size, 0, 'a bound parent update also clears feedback');
  attempt(); ui.releaseValueBindings(parentSection);
  assert(timers.size === 0 && parentRow.getAttribute('aria-invalid') === null, 'releasing blocker controls cancels feedback');
  ui.createSwitcherRow('Parent enabled again', false, parentSection, () => {}, parentPath);
  attempt(); ui.releaseValueBindings(childRow); assert.equal(timers.size, 0, 'rebuilding the dependent control cancels feedback too');
  attempt(); ui.togglePanel(false); assert.equal(timers.size, 0, 'closing the panel cancels feedback');
  let secondParent = false, checks = 0;
  ui.createSwitcherRow('Multiple prerequisites', false, body, () => {}, ['test', 'multi'], ['test', 'multi'],
    { requires: [{ path: parentPath, isEnabled: () => { checks++; return parentOn; } },
      { path: ['test', 'second'], isEnabled: () => secondParent }] });
  const multiRow = body.children.find(node => node.dataset.devtoolsPath === 'test.multi');
  const multiControl = multiRow.children[1].children[0];
  parentOn = true; ui.syncValue(parentPath, true);
  assert.equal(multiControl.getAttribute('aria-disabled'), 'true', 'one missing prerequisite keeps the control unavailable');
  secondParent = true; ui.syncValue(['test', 'second'], true);
  assert.equal(multiControl.getAttribute('aria-disabled'), 'false', 'all prerequisites restore availability');
  ui.releaseValueBindings(multiRow);
  const releasedChecks = checks; ui.syncValue(parentPath, false);
  assert.equal(checks, releasedChecks, 'releasing a dependent row also removes its availability subscription');
  parentOn = false;
  attempt(); ui.clearValueBindings(); assert.equal(timers.size, 0, 'rebuilding controls cancels feedback');
  ui.createSwitcherRow('Parent after rebuild', false, parentSection, () => {}, parentPath);
  attempt(); ui.dispose(); assert.equal(timers.size, 0, 'disposal leaves no feedback work');
}
// Spec 129, Revision 2 (TK-044…TK-048): one enable switch, the selected zone filled and the others muted, zone lists
// gated by their physics, the cell grid's opacity/size and one-cell snapping, the editor's depth map, the perspective's physics
// and dragging the selected zone's edges.
{
  const { ZONE_CATEGORY_COLORS } = load("src/dev/location/zone_category_colors.js");
  const { ZoneEditorDragController } = load("src/dev/location/zone_editor_drag_controller.js");
  const { LocationDebugRenderFrameBuilder } = load("src/dev/location/location_debug_render_frame_builder.js");
  const { LocationDebugMapBuilder } = load("src/dev/location/location_debug_map_builder.js");
  scale = 1; cameraX = 0; mapRevision++;
  const lake = config.locations.map.lake;
  const locations = config.locations;
  lake.zones.castable = [{ x: 0, y: 0, w: 25, h: 25 }];
  lake.zones.snags = [{ x: 4, y: 8, w: 2, h: 1 }];
  state.setFlag("enabled", false); state.setFlag("cellGrid", false); state.setFlag("grid", false);
  for (const category of ["castable", "collisions", "snags", "dynamic"]) state.setCategory(category, true);
  // TK-044: turning the editor on turns the cell grid on.
  state.setFlag("enabled", true);
  assert.equal(state.cellGrid, true, "enabling the editor shows the cell grid");

  // TK-055 (R3-2): an editable zone keeps a 2 px outline; hovered, it fills and shows handles and its move area;
  // shown zones are filled lightly; zones neither editable nor shown are not drawn.
  const geometry = {};
  const snagColor = Number.parseInt(ZONE_CATEGORY_COLORS.snags.slice(1), 16);
  const castColor = Number.parseInt(ZONE_CATEGORY_COLORS.castable.slice(1), 16);
  const drawn = () => geometry.annotations.rects.slice(0, geometry.annotations.rectCount);
  state.setEditing("snags", true); builder.buildInto(geometry);
  let rects = drawn();
  let snag = rects.filter(rect => rect.color === snagColor);
  assert(snag.length === 1 && snag[0].x === 160 && snag[0].y === 320 && snag[0].lineWidth === 2 && snag[0].strokeAlpha === 0.95 &&
    snag[0].fillAlpha === 0.15, "an editable shown zone: 2 px outline, the shown fill");
  const castable = rects.find(rect => rect.color === castColor);
  assert(castable.fillAlpha === 0.15 && castable.strokeAlpha === 0.6 && castable.lineWidth === 1, "a shown zone that is not editable");
  state.setCategory("snags", false); state.setCategory("castable", false); builder.buildInto(geometry);
  rects = drawn(); snag = rects.filter(rect => rect.color === snagColor);
  assert(snag.length === 1 && snag[0].fillAlpha === 0 && snag[0].lineWidth === 2 && !rects.some(rect => rect.color === castColor),
    "without \"Показати зону\" an editable zone is only outlined and the others are not drawn");
  const hoverBefore = builder.rebuilds;
  state.setHovered(["snags:0"]); builder.buildInto(geometry);
  rects = drawn(); snag = rects.filter(rect => rect.color === snagColor);
  assert(snag[0].fillAlpha === 0.35 && snag.filter(rect => rect.fillAlpha === 0.9).length === 4 && snag.length === 5,
    "the hovered zone fills and shows its handles; its move area is not drawn (TK-057)");
  state.setHovered(["snags:0"]); builder.buildInto(geometry);
  assert.equal(builder.rebuilds, hoverBefore + 1, "an unchanged hover set rebuilds nothing");
  state.setHovered([]); builder.buildInto(geometry);
  assert.equal(drawn().filter(rect => rect.color === snagColor)[0].fillAlpha, 0, "leaving clears the fill");
  state.setCategory("snags", true); state.setCategory("castable", true);
  // Category permissions cover every current/new zone without per-index state.
  state.setEditing("snags", true);
  // TK-048: a zone category whose physics is off is not drawn.
  locations.enableSnags = false; mapRevision++; builder.buildInto(geometry);
  rects = geometry.annotations.rects.slice(0, geometry.annotations.rectCount);
  assert.equal(rects.some(rect => rect.color === snagColor), false, "zones without physics are not drawn");
  locations.enableSnags = true; mapRevision++;

  // TK-072: every cell line uses the selected opacity; an unchanged grid is reused.
  builder.buildInto(geometry);
  assert(geometry.annotations.cellLineCount === 52 && geometry.annotations.cellLineAlpha === state.cellGridOpacity,
    "every cell line at the section's opacity");
  const before = builder.rebuilds;
  builder.buildInto(geometry); assert.equal(builder.rebuilds, before, "an unchanged cell grid is not rebuilt");
  state.setNumber("cellGridOpacity", 0); builder.buildInto(geometry);
  assert.equal(geometry.annotations.cellLineCount, 0, "opacity 0 draws no lines");
  state.setNumber("cellGridOpacity", 0.25);
  for (const [key, value, expected] of [["cellGridOpacity", 3, 1], ["depthOpacity", -1, 0]]) {
    state.setNumber(key, value); assert.equal(state[key], expected, `${key} is clamped`);
  }
  state.setNumber("cellGridOpacity", 0.25); state.setNumber("depthOpacity", 0.7);

  // TK-047: depth numbers come from the location's depth map while the editor shows them, at their own opacity.
  let builds = 0;
  const depthMap = { build: () => { builds++; return { width: 1000, height: 1000 }; } };
  const depthFrame = new LocationDebugRenderFrameBuilder({ map, projector, config, debugMapBuilder: depthMap, zoneEditor: builder,
    editorState: state });
  const frameTarget = () => ({ debugImage: { visible: false } });
  let frame = frameTarget(); depthFrame.buildInto(frame);
  assert(frame.debugImage.visible === false && builds === 0, "no depth numbers until they are switched on");
  state.setFlag("enabled", false); state.setFlag("depth", true); frame = frameTarget(); depthFrame.buildInto(frame);
  assert(frame.debugImage.visible === true && frame.debugImage.alpha === 0.7 && builds === 1, "depth numbers display at their opacity without enabling editing");
  frame = frameTarget(); depthFrame.buildInto(frame); assert.equal(builds, 1, "the depth map is reused");
  state.setNumber("depthOpacity", 0); frame = frameTarget(); depthFrame.buildInto(frame);
  assert.equal(frame.debugImage.visible, false, "opacity 0 hides the depth numbers");
  state.setNumber("depthOpacity", 0.7); state.setFlag("enabled", false); frame = frameTarget(); depthFrame.buildInto(frame);
  assert(frame.debugImage.visible && builds === 1, "restoring opacity reuses the depth map with editing still off");
  state.setFlag("enabled", true); frame = frameTarget(); depthFrame.buildInto(frame);
  assert(frame.debugImage.visible && builds === 1, "enabling editing leaves the depth display and cache intact");
  state.setFlag("enabled", false); state.setFlag("depth", false); frame = frameTarget(); depthFrame.buildInto(frame);
  assert.equal(frame.debugImage.visible, false, "the depth switch hides the display with editing off");
  state.setFlag("enabled", true); state.setFlag("depth", false);
  const strokes = [], texts = [];
  const surface = { canvas: { width: 1000, height: 1000 }, clearRect() {}, fillRect() {}, strokeRect: () => strokes.push(1),
    fillText: (text) => texts.push(text) };
  new LocationDebugMapBuilder({ canvasFactory: { createSurface: () => surface } }).build({
    map: { getGrid: () => [[{ x: 0, y: 0, isWater: true, depth: 2.5 }, { x: 0, y: 1, isWater: false, depth: 0 }]],
      getCols: () => 1, getRows: () => 2 }, locationsConfig: locations });
  assert(strokes.length === 0 && texts.join() === "2.5", "the map writes only the water cells' depths");

  // TK-044…TK-048: the sections, the zone lists gated by physics, the moved controls.
  const sections = [], rows = new Map(), controlValues = new Map();
  const record = (kind) => (label, ...args) => {
    const parent = kind === "button" ? args[0] : kind === "select" ? args[2] : args[1];
    rows.set(`${parent?.label}/${label}`, { kind, args });
  };
  const structureUi = { createControlGroup: () => ({ label: "Локація", replaceChildren() {} }),
    syncValue(path, value) { controlValues.set(path.join("."), value); },
    releaseValueBindings(parent) { for (const key of [...rows.keys()]) if (key.startsWith(`${parent.label}/`)) rows.delete(key); },
    createInfoRow: () => ({}), createInputRow: record("input"), createRangeRow: record("range"), createButtonRow: record("button"),
    createSelectRow: record("select"), createSwitcherRow: record("switch") };
  const written = [];
  locations.enableCollisions = false;
  new ZoneEditorSection({ ui: structureUi, state, config, updateConfig: (path, value) => { written.push([path.join("."), value]);
    let node = config; for (const key of path.slice(1, -1)) node = node[key]; node[path.at(-1)] = value; },
  createSection: (label) => { const section = { label, replaceChildren() {} }; sections.push(section); return section; },
  renderTree() {}, getWaterMetric: () => metric, createWaterMetric: (options) => WaterMetric.illustrated(options) }).render({});
  const enable = rows.get("🗺️ РЕДАКТОР/Увімкнути");
  enable.args[2](true);
  assert(state.enabled && state.cellGrid, "the top-level enable control still enables editing and the cell grid");
  enable.args[2](false);
  assert(!state.enabled && !state.cellGrid && !state.grid, "the same control disables editing and both grids");
  assert(!controlValues.get('ZONE_EDITOR.cellGrid') && !controlValues.get('ZONE_EDITOR.grid'), 'editor off synchronizes both grid switches');
  const shownBefore = { ...state.categories }, writesBeforeShow = written.length;
  rows.get("Зони/Показати всі").args[2](true);
  assert(Object.values(state.categories).every(Boolean) && !state.enabled, "show all changes visibility without enabling editing");
  rows.get("Зачепи/Показати зону").args[2](false);
  assert(!state.categories.snags && state.categories.castable, "individual category visibility remains independent");
  assert.equal(controlValues.get("ZONE_EDITOR.showAll"), false, "individual visibility updates the aggregate control");
  rows.get("Зачепи/Показати зону").args[2](true);
  assert.equal(controlValues.get("ZONE_EDITOR.showAll"), true, "the final shown category checks show all again");
  rows.get("Зони/Показати всі").args[2](false);
  assert(Object.values(state.categories).every(value => !value) && written.length === writesBeforeShow,
    "hide all never changes gameplay physics or config");
  for (const [category, shown] of Object.entries(shownBefore)) state.setCategory(category, shown);
  rows.get("Сітка перспективи/Показати сітку").args[2](true);
  assert(controlValues.get("ZONE_EDITOR.grid") && !controlValues.get("ZONE_EDITOR.cellGrid"), "perspective synchronizes both grid controls");
  rows.get("🗺️ РЕДАКТОР/Показати сітку").args[2](true);
  assert(!controlValues.get("ZONE_EDITOR.grid") && controlValues.get("ZONE_EDITOR.cellGrid"), "map grid synchronizes both controls");
  const physics = rows.get("Зачепи/Фізика зони");
  const editableDependency = rows.get("Зони/Редагувати ігрову").args[5].requires[0];
  const depthSwitch = rows.get("🗺️ РЕДАКТОР/Глибина в клітинках");
  assert.equal(editableDependency.path.join('.'), 'ZONE_EDITOR.enabled');
  assert(!editableDependency.isEnabled(), 'zone editing still requires the editor');
  assert(!depthSwitch.args[5]?.requires?.length, 'depth visibility declares no editor prerequisite');
  depthSwitch.args[2](true);
  assert(state.depth && !state.enabled, 'depth switch activates without enabling editing');
  depthSwitch.args[2](false);
  state.setFlag('enabled', true);
  assert(editableDependency.isEnabled(), 'editing prerequisite reads current editor state');
  state.setFlag('enabled', false);
  assert.deepEqual([physics.args[3].join("."), physics.args[5].swatch], ["CONFIG.locations.enableSnags", ZONE_CATEGORY_COLORS.snags],
    "each list's first switch is the zone's physics, with its colour");
  assert(rows.has("Зачепи/Показати зону") && rows.has("Зачепи/Номер зони") && rows.has("Зачепи/Додати зону"), "items while on");
  assert(!rows.has("Зачепи/Редагувати цю зону на мапі"), "the drag tool takes the checked zones, not the selected one");
  const editableSnag = rows.get("Зони/Редагувати зачепи");
  assert(editableSnag.args[5].swatch === ZONE_CATEGORY_COLORS.snags, "category editing keeps its color");
  editableSnag.args[2](false); assert.equal(state.isEditable("snags"), false);
  editableSnag.args[2](true); assert.equal(state.isEditable("snags"), true);
  rows.get("Зони/Редагувати всі").args[2](true);
  assert(Object.values(state.editing).every(Boolean), "edit all enables the category choices");
  editableSnag.args[2](false);
  assert.equal(controlValues.get("ZONE_EDITOR.editAll"), false, "individual editing updates the aggregate");
  rows.get("Зони/Редагувати всі").args[2](false);
  assert(Object.values(state.editing).every(value => !value), "edit all off clears all categories");
  assert(!rows.has("Перешкоди/Показати зону") && !rows.has("Перешкоди/Додати зону"), "no items while the physics is off");
  rows.get("Перешкоди/Фізика зони").args[2](true);
  assert(locations.enableCollisions === true && rows.has("Перешкоди/Показати зону"), "turning the physics on shows the items");
  for (const label of ["Показати сітку", "Непрозорість сітки", "Розмір клітинки, px",
    "Глибина в клітинках", "Непрозорість глибини"]) assert(rows.has(`🗺️ РЕДАКТОР/${label}`), `cell grid: ${label}`);
  assert.equal(rows.get("🗺️ РЕДАКТОР/Непрозорість сітки").kind, "range");
  rows.get("🗺️ РЕДАКТОР/Розмір клітинки, px").args[3](1000);
  assert.deepEqual(written.at(-1), ["CONFIG.locations.cellSize", 200], "the cell size is clamped and written to the game config");
  locations.cellSize = 40;
  rows.get("🗺️ РЕДАКТОР/Непрозорість глибини").args[2](40);
  assert.equal(state.depthOpacity, 0.4, "the depth slider sets 0..1");
  state.setNumber("depthOpacity", 0.7);
  for (const label of ["Показати сітку", "Фізика перспективи", "Крок сітки, м", "Дальність води, м", "Нахил площини, °",
    "Масштаб вдалині", "Звужувати сітку по ширині"]) assert(rows.has(`Сітка перспективи/${label}`), `perspective: ${label}`);
  rows.get("Сітка перспективи/Фізика перспективи").args[2](false);
  assert.deepEqual(written.at(-1), ["CONFIG.locations.map.lake.waterProjection", null], "physics off writes no projection");
  assert(!rows.has("Сітка перспективи/Дальність води, м"), "uniform water has no projection controls");
  lake.waterProjection = JSON.parse(JSON.stringify(baseProjection));
  // Spec 136 (Revision 2): the zones inside the castable area live in their own section "Зони риболовлі".
  assert.equal(rows.get("Зони риболовлі/Показувати оверлеї гри").args[3].join("."), "CONFIG.locations.debugVisuals");
  for (const [label, key] of [["Зона ручної прикормки", "showAimingZone"], ["Показати зону підсаки", "showNetZone"],
    ["Показати зону останнього ривка", "showLastDashZone"], ["Показати зону підведення", "showCatchZone"],
    ["Показати сектор виважування", "showPoleFightSector"], ["Показати радіус ліски", "showFightLineRadius"],
    ["Показати зони прикормки", "showChumZones"]]) {
    assert.equal(rows.get(`Зони риболовлі/${label}`)?.args[3].join("."), `CONFIG.locations.${key}`, label);
  }
  assert(![...rows.keys()].some(key => key.startsWith("Оверлеї гри")), "the overlay section is gone");
  assert(![...rows.keys()].some(key => /debugGrid|debugDepthText|debugZones|Налагоджувальна|Категорії в редакторі|Зони в грі/u.test(key)),
    "no old debug-map or category sections remain");
  delete locations.enableCollisions; delete locations.enableSnags;

  // TK-044 / R4: with the editor on, drag the selected zone's edges, snapped to the map's cells.
  const makeElement = () => { const listeners = new Map(), classes = new Set();
    return { listeners, classes, removed: false, addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type) => listeners.delete(type), remove() { this.removed = true; },
      setPointerCapture() {}, releasePointerCapture() {},
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } }; };
  const mounted = [], writes = [];
  const body = makeElement();
  let edited = 0;
  const unsubscribe = state.subscribeZonesEdited(() => edited++);
  const drag = new ZoneEditorDragController({ state, map, projector, config, canvasMetrics: { width: 1000, height: 1000 },
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }) }),
    documentTarget: { createElement: makeElement, body }, mountNode: { prepend: (element) => mounted.push(element) },
    writeZones: (path, zones) => { writes.push({ path: path.join("."), zones });
      lake.zones[path.at(-1)] = zones; } });
  state.setFlag("enabled", false); drag.sync(); assert.equal(drag.active, false, "no layer without the editor");
  state.setFlag("enabled", true); drag.sync();
  const layer = mounted[0];
  assert(drag.active && layer && layer.listeners.has("pointerdown"), "the editor puts a layer over the canvas");
  assert(body.classes.has("game-shell--zone-editor"), "TK-052: the editor hides the game's UI");
  const pointer = (type, x, y, id = 1) => { let prevented = false;
    layer.listeners.get(type)({ clientX: x / 2, clientY: y / 2, pointerId: id, preventDefault: () => { prevented = true; } });
    return prevented; };
  state.setEditing("castable", true);
  assert.equal(pointer("pointerdown", 300, 500), false, "inside the zone, away from its edges and middle, nothing is taken");
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
  lake.zones.castable = [{ x: 0, y: 0, w: 25, h: 25 }];
  pointer("pointerdown", 1000, 500); pointer("pointermove", 830, 500); pointer("pointerup", 830, 500);
  assert.equal(lake.zones.castable[0].w, 21, "the edge always snaps to one cell (830 px -> 21 cells)");
  locations.designCellSize = 20;
  lake.zones.castable = [{ x: 0, y: 0, w: 50, h: 50 }];
  pointer("pointerdown", 1000, 500); pointer("pointermove", 870, 500); pointer("pointerup", 870, 500);
  assert.equal(lake.zones.castable[0].w, 44, "zones keep design cells; the edge snaps to the visible 40 px grid (880 px)");
  delete locations.designCellSize;
  lake.zones.castable = [{ x: 0, y: 2, w: 1, h: 3, adaptiveX: true }];
  assert.equal(pointer("pointerdown", 0, 100), false, "an adaptive-width zone has no side edges");
  assert.equal(pointer("pointerdown", 500, 200), true, "its bottom edge is taken");
  pointer("pointermove", 500, 400); pointer("pointerup", 500, 400);
  assert.deepEqual([lake.zones.castable[0].y, lake.zones.castable[0].h], [2, 8], "the bottom edge follows the cells");
  // TK-056: the middle 30% moves the whole zone, snapped, without resizing.
  // TK-058: the window is 1000 x 1000 logical px = 25 x 25 cells; a moved zone stays inside it.
  lake.zones.castable = [{ x: 0, y: 0, w: 25, h: 25 }];
  pointer("pointerdown", 500, 500); pointer("pointermove", 585, 618); pointer("pointerup", 585, 618);
  assert.equal(JSON.stringify(lake.zones.castable[0]), JSON.stringify({ x: 0, y: 0, w: 25, h: 25 }),
    "a zone as large as the window cannot be moved out of it");
  lake.zones.castable = [{ x: 0, y: 0, w: 10, h: 10 }];
  pointer("pointermove", 200, 200);
  assert(layer.classes.has("zone-editor-drag-layer--move") && state.isHovered("castable", 0), "the middle shows the move cursor and hovers");
  assert.equal(pointer("pointerdown", 200, 200), true, "the middle takes the zone");
  pointer("pointermove", 285, 318); pointer("pointerup", 285, 318);
  assert.equal(JSON.stringify(lake.zones.castable[0]), JSON.stringify({ x: 2, y: 3, w: 10, h: 10 }),
    "the zone moves by whole cells (85 px, 118 px -> 2, 3 cells) and keeps its size");
  pointer("pointerdown", 280, 320); pointer("pointermove", 3000, -3000); pointer("pointerup", 3000, -3000);
  assert.equal(JSON.stringify(lake.zones.castable[0]), JSON.stringify({ x: 15, y: 0, w: 10, h: 10 }),
    "dragged past the window's right and top edges, the zone stops at them");
  lake.zones.castable = [{ x: 0, y: 0, w: 30, h: 10, id: "wide" }];
  pointer("pointerdown", 600, 200); pointer("pointermove", 800, 200);
  assert.equal(lake.zones.castable[0].x, 0, "a zone wider than the window never uncovers its left edge");
  pointer("pointermove", 400, 200); pointer("pointerup", 400, 200);
  assert.equal(lake.zones.castable[0].x, -5, "it slides left until its right side meets the window's right edge");
  lake.zones.castable = [{ x: 2, y: 3, w: 10, h: 10 }];
  // TK-055: a small editable zone inside a large one hovers both; the smallest is taken and selected.
  lake.zones.snags = [{ x: 4, y: 8, w: 2, h: 1 }];
  state.setEditing("snags", true);
  pointer("pointermove", 200, 340);
  assert(state.isHovered("castable", 0) && state.isHovered("snags", 0), "a small zone inside a large one hovers both");
  pointer("pointerdown", 200, 340); pointer("pointermove", 240, 340); pointer("pointerup", 240, 340);
  assert(lake.zones.snags[0].x === 5 && lake.zones.snags[0].w === 2 && lake.zones.castable[0].x === 2 && state.selection.category === "snags",
    "the smallest zone under the pointer is moved and becomes the selected one");
  pointer("pointermove", 1900, 1900); assert.equal(state.hovered.size, 0, "away from every zone nothing is hovered");
  // TK-065: only the dropdown's index can be hovered/taken, even with overlapping bodies.
  lake.zones.castable = [{ x: 1, y: 1, w: 2, h: 2 }, { x: 4, y: 4, w: 4, h: 4 }];
  state.setEditing("snags", false); state.select("castable", 1);
  const beforeSelectionWrites = writes.length;
  pointer("pointermove", 80, 80);
  assert(!state.isHovered("castable", 0) && !pointer("pointerdown", 80, 80), "zone 1 ignores hover/down while zone 2 is selected");
  pointer("pointermove", 120, 80); pointer("pointerup", 120, 80);
  assert.equal(writes.length, beforeSelectionWrites, "unselected zone never writes geometry");
  pointer("pointermove", 240, 240);
  assert(state.isHovered("castable", 1), "selected zone 2 receives hover");
  pointer("pointerdown", 240, 240);
  let releases = 0; layer.releasePointerCapture = () => { releases++; };
  state.select("castable", 0);
  assert.equal(state.hovered.size, 0, "changing the dropdown immediately clears previous hover");
  drag.sync();
  pointer("pointermove", 280, 240); pointer("pointerup", 280, 240);
  assert(releases === 1 && writes.length === beforeSelectionWrites, "selection change cancels capture and forbids the previous drag write");
  assert(pointer("pointerdown", 80, 80), "zone 1 becomes clickable after explicit selection");
  pointer("pointermove", 120, 80); pointer("pointerup", 120, 80);
  assert.equal(lake.zones.castable[0].x, 2, "the explicitly selected body is edited");
  state.select("castable", 1); state.select("snags", 0);
  assert.equal(state.selectedIndex("castable"), 1, "category changes retain the dropdown's chosen index");
  lake.zones.castable[0] = { x: 5, y: 5, w: 2, h: 2 };
  pointer("pointermove", 240, 240);
  assert(!state.isHovered("castable", 0) && state.isHovered("castable", 1), "overlap cannot give hover to the smaller unselected body");
  pointer("pointerdown", 240, 240); pointer("pointerup", 240, 240);
  assert.equal(state.selectedIndex("castable"), 1, "overlapping clicks never steal selection");
  pointer("pointermove", 500, 500); layer.listeners.get("pointerleave")();
  assert.equal(state.hovered.size, 0, "leaving the layer clears the hover");
  state.setEditing("castable", false);
  assert.equal(pointer("pointerdown", 600, 600), false, "an unchecked zone is never taken");
  state.setFlag("enabled", false); drag.sync();
  assert(layer.removed && !drag.active, "switching the editor off removes the layer");
  assert(!body.classes.has("game-shell--zone-editor"), "TK-052: switching the editor off brings the game's UI back");

  // TK-053: the left-edge strip opens the panel on mouse hover (no button held), a mouse press, or a right swipe.
  let opens = 0;
  const edgeMount = [];
  const opener = new DevToolsEdgeOpener({ documentRef: { createElement: makeElement },
    mountNode: { appendChild: element => edgeMount.push(element) }, open: () => opens++ });
  const edge = edgeMount[0], fire = (type, fields) => edge.listeners.get(type)({ preventDefault() {}, ...fields });
  fire("pointerenter", { pointerType: "mouse", buttons: 1 }); assert.equal(opens, 0, "no opening while a drag holds a button");
  fire("pointerenter", { pointerType: "mouse", buttons: 0 }); assert.equal(opens, 1, "a mouse at the left edge opens DevTools");
  fire("pointerdown", { pointerType: "touch", pointerId: 7, clientX: 2 });
  fire("pointermove", { pointerType: "touch", pointerId: 7, clientX: 20 }); assert.equal(opens, 1, "a short touch move does not open");
  fire("pointermove", { pointerType: "touch", pointerId: 7, clientX: 30 }); assert.equal(opens, 2, "a swipe right from the edge opens");
  fire("pointermove", { pointerType: "touch", pointerId: 7, clientX: 90 }); assert.equal(opens, 2, "one swipe opens once");
  opener.dispose(); assert(edge.removed && edge.listeners.size === 0, "the strip leaves with DevTools");
  unsubscribe(); drag.dispose();
}

// Spec 130: the editor works on a chosen location; only the loaded one is drawn; its zone file is exported,
// imported into the session and reset to the code, and reopening another location warns about unexported edits.
// TK-061..063: passive visibility never enables interaction; grids have one authoritative choice.
{
  const { ZoneEditorDragController } = load("src/dev/location/zone_editor_drag_controller.js");
  const passive = new ZoneEditorState();
  assert(!passive.cellGrid && !passive.grid, "both grids start hidden");
  const passiveBuilder = new ZoneEditorGeometryBuilder({ state: passive, map, projector, config, getWaterMetric: () => metric });
  const passiveFrame = {};
  passiveBuilder.buildInto(passiveFrame); assert.equal(passiveFrame.annotations, null);
  passive.setEditing("castable", true); passive.setHovered(["castable:0"]); passive.setFlag("background", false);
  passive.setCategory("castable", true); passiveBuilder.buildInto(passiveFrame);
  assert(passiveFrame.annotations.rectCount > 0 && passiveFrame.annotations.rects.slice(0, passiveFrame.annotations.rectCount)
    .every(rect => rect.lineWidth === 1 && rect.fillAlpha === .15), "passive zones have no edit handles or hover feedback");
  assert.equal(passiveFrame.backgroundHidden, false, "passive viewing preserves the game background");
  let attached = 0;
  const passiveTool = new ZoneEditorDragController({ state: passive, map, projector, config, canvasMetrics: { width: 1000, height: 1000 },
    getCanvas() {}, documentTarget: { createElement() { attached++; } }, mountNode: {}, writeZones() {} });
  passiveTool.sync(); assert(!passiveTool.active && attached === 0, "passive viewing does not intercept game input");
  passive.setCategory("castable", false); passiveBuilder.buildInto(passiveFrame); assert.equal(passiveFrame.annotations, null);
  passive.setFlag("cellGrid", true); passiveBuilder.buildInto(passiveFrame);
  assert(passive.cellGrid && !passive.grid && passiveFrame.annotations.cellLineCount > 0, "map grid visible without editing");
  passive.setFlag("grid", true); passiveBuilder.buildInto(passiveFrame);
  assert(passive.grid && !passive.cellGrid && passiveFrame.annotations.cellLineCount === 0 && passiveFrame.annotations.lineCount > 0,
    "perspective replaces the map grid without editing");
  passive.setFlag("cellGrid", true); assert(passive.cellGrid && !passive.grid, "map grid replaces perspective");
  passive.setFlag("cellGrid", false); assert(!passive.cellGrid && !passive.grid, "both grids may be off");
  passive.setFlag("grid", true); passive.setFlag("enabled", true);
  assert(passive.cellGrid && !passive.grid, "entering edit mode selects the map grid exclusively");
  passiveTool.dispose();
}

// Spec 133 / G-119: reflect the entire body at every edge, without centre-only overflow.
{
  const { DynamicZone } = load("src/game/domain/locations/dynamic_zone.js");
  const { containsRectangle } = load("src/engine/math/rectangle_bounds.js");
  const bounds = { x: 0, y: 0, w: 10, h: 10 };
  const moving = (x, y, sx, sy, area = bounds) => {
    const zone = new DynamicZone({ id: 'edge', x, y, w: 2, h: 2, moving: true, speedX: sx, speedY: sy, bounds: area }, { next: () => 0 });
    zone.speedX = sx; zone.speedY = sy; zone.dirTimer = 1e9;
    return zone;
  };
  for (const [x, y, sx, sy] of [[8, 2, 1, 0], [0, 2, -1, 0], [2, 8, 0, 1], [2, 0, 0, -1], [8, 8, 1, 1]]) {
    const zone = moving(x, y, sx, sy); zone.update(100);
    assert(containsRectangle(bounds, zone), 'the body never overflows by half its width/height');
    if (sx) assert.equal(zone.speedX, -sx, 'horizontal edge contact reflects horizontal speed');
    if (sy) assert.equal(zone.speedY, -sy, 'vertical edge contact reflects vertical speed');
  }
  const contact = moving(7, 3, 1, .5); contact.update(1000);
  assert(contact.x === 8 && contact.speedX === -1 && contact.speedY === .5, 'exact contact reflects only the colliding axis');
  const huge = moving(3, 3, 9, 7); huge.update(100000);
  assert(containsRectangle(bounds, huge) && Math.abs(huge.speedX) === 9 && Math.abs(huge.speedY) === 7, 'large steps reflect without escaping or losing configured speed');
  const escaped = moving(9, -1, 1, -1); escaped.update(100);
  assert(containsRectangle(bounds, escaped), 'old centre-only placements are recovered into the nearest fitting area');
  const invalid = moving(2, 2, 1, 0, { x: 0, y: 0, w: 1, h: 1 }); invalid.update(100);
  assert(invalid.x === 2 && invalid.w === 2, 'an impossible body is frozen, never silently resized');
  const gap = moving(1, 1, 1, 0, [bounds, { x: 30, y: 0, w: 10, h: 10 }]); gap.update(50000);
  assert(containsRectangle(bounds, gap), 'disjoint areas are never joined into a permissive bounding box');
}

// Spec 132: real live zones, one body each, pause/current-position edits/resume and untouched siblings.
{
  const { LocationMap } = load("src/game/domain/locations/location_map.js");
  const { GameWorld } = load("src/game/application/world/game_world.js");
  const { DevFlagsProvider } = load("src/dev/runtime/dev_flags_provider.js");
  const { ZoneEditorConfigEdits } = load("src/dev/location/zone_editor_config_edits.js");
  const { ZoneEditorDragController } = load("src/dev/location/zone_editor_drag_controller.js");
  const cfg = { locations: { cellSize: 40, designCellSize: 40, baseResolution: { width: 400, height: 400 }, enableDynamicZones: true,
    map: { live: { depthBounds: { min: 1, max: 5 }, zones: { castable: [], collisions: [], snags: [], dynamic: [
      { id: 'a', x: 1, y: 1, w: 1, h: 1, moving: true, speedX: 1, speedY: 0, bounds: [{ x: 0, y: 0, w: 10, h: 10 }] },
      { id: 'b', x: 4, y: 4, w: 1, h: 1, moving: true, speedX: 1, speedY: 0, bounds: [{ x: 0, y: 0, w: 10, h: 10 }] },
    ] } } } } };
  const liveMap = new LocationMap('live', cfg.locations, { next: () => 0 }, {}), st = new ZoneEditorState();
  // Spec 134: controlled fresh starts reach both grid extrema; config refresh never randomizes.
  assert.deepEqual([liveMap.getDynamicZones()[0].x, liveMap.getDynamicZones()[0].y], [0, 0], 'low random draw selects first legal grid start');
  const highMap = new LocationMap('live', cfg.locations, { next: () => .999999 }, {});
  assert.deepEqual([highMap.getDynamicZones()[0].x, highMap.getDynamicZones()[0].y], [9, 9], 'high draw selects last full-body grid start');
  let gameplayDraws = 0;
  new LocationMap('live', cfg.locations, { next: () => { gameplayDraws++; return 0; } }, {}, { next: () => .75 });
  assert.equal(gameplayDraws, 0, 'injected start sampling leaves gameplay RNG untouched');
  const { DynamicZone } = load('src/game/domain/locations/dynamic_zone.js');
  const single = new DynamicZone({ x: 99, y: 99, w: 2, h: 2, moving: true,
    bounds: [{ x: .5, y: .5, w: .5, h: .5 }, { x: 7, y: 8, w: 2, h: 2 }] });
  single.randomizeStart({ next: () => .5 });
  assert.deepEqual([single.x, single.y], [7, 8], 'disjoint bounds skip non-fitting regions and support a single legal start');
  const noStart = new DynamicZone({ x: .2, y: .3, w: 1, h: 1, moving: true, bounds: { x: .2, y: .3, w: 1, h: 1 } });
  noStart.randomizeStart({ next() { throw new Error('no legal grid start must not sample'); } });
  assert.deepEqual([noStart.x, noStart.y], [.2, .3], 'no legal grid point retains authored geometry');
  const stationary = new DynamicZone({ x: 2, y: 3, w: 1, h: 1, moving: false, bounds: { x: 0, y: 0, w: 10, h: 10 } });
  stationary.randomizeStart({ next() { throw new Error('stationary zone must not sample'); } });
  assert.deepEqual([stationary.x, stationary.y], [2, 3]);
  const fineConfig = JSON.parse(JSON.stringify(cfg.locations));
  fineConfig.cellSize = 20;
  fineConfig.map.live.zones.dynamic[0].x = 1.125;
  fineConfig.map.live.zones.dynamic[0].y = 1.375;
  const fineMap = new LocationMap('live', fineConfig, { next: () => .5 }, {});
  assert(Number.isInteger(fineMap.getDynamicZones()[0].x) && Number.isInteger(fineMap.getDynamicZones()[0].y), 'start uses active map cells');
  fineMap.refreshConfig(fineConfig, {});
  assert.deepEqual([fineMap.getDynamicZones()[0].x, fineMap.getDynamicZones()[0].y], [2.25, 2.75], 'fine-grid refresh preserves exact fractional design position');
  liveMap.refreshConfig(cfg.locations, {}); // Existing edit/resume scenario starts from deliberate authored geometry.
  const proj = { update() {}, getScale: () => 1, getCanvasWidth: () => 400,
    virtualToScreen: (x, y, out) => out ? out.set(x, y) : { x, y }, screenToVirtual: (x, y, out) => out ? out.set(x, y) : { x, y } };
  const geo = new ZoneEditorGeometryBuilder({ state: st, map: liveMap, projector: proj, config: cfg, getWaterMetric: () => null });
  const flags = new DevFlagsProvider({ config: cfg, zoneEditorState: st });
  const world = new GameWorld({ map: liveMap, projector: proj, env: { update() {}, getSnapshot: () => ({ time: 12 }) },
    chum: { update() {}, updateBoats() {} }, location: {}, canvasMetrics: { width: 400, height: 400 }, clock: { realNow: 0 },
    locationConfig: cfg.locations, waterMetricSource: { current: () => null }, isZoneMotionPaused: () => flags.isEnabled('pauseDynamicZones') });
  const step = dt => world.update(dt, 1, { left: 0, top: 0, right: 400, bottom: 400 });
  step(1000); assert.equal(liveMap.getDynamicZones()[0].x, 2, 'zone moves away from its authored start');
  st.setFlag('enabled', true); st.setEditing('dynamic', true); st.setCategory('dynamic', true);
  step(1000); assert.equal(liveMap.getDynamicZones()[0].x, 2, 'enabling category editing pauses actual game motion');
  const frame = {}; geo.buildInto(frame);
  assert.equal(frame.annotations.overlay.rectCount, 2, 'one live body per dynamic zone with editing and visibility together');
  assert(!frame.annotations.rects.slice(0, frame.annotations.rectCount).some(rect => rect.lineWidth === 2), 'no static editable copies');
  assert.equal(frame.annotations.overlay.rects[0].x, 80, 'drawing uses the current game position');
  const commands = new ZoneEditorConfigEdits({ config: cfg, getMap: () => liveMap });
  assert.equal(commands.readDynamicZones('live')[0].x, 2, 'parameter fields read current coordinates');
  commands.prepare(['CONFIG', 'locations', 'map', 'live', 'zones', 'dynamic', '0', 'bounds', '0', 'x'], -1);
  assert.equal(cfg.locations.map.live.zones.dynamic[0].bounds[0].x, 0, 'preparing nested edits never mutates authored data before validation');
  let writes = 0;
  const write = (path, value) => {
    const command = commands.prepare(path, value); writes++;
    let target = cfg; for (const key of command.path.slice(1, -1)) target = target[key]; target[command.path.at(-1)] = command.value;
    world.refreshLocationConfig(cfg.locations, {});
  };
  write(['CONFIG', 'locations', 'map', 'live', 'zones', 'dynamic', '0', 'w'], 2);
  assert(liveMap.getDynamicZones()[0].x === 2 && liveMap.getDynamicZones()[1].x === 5, 'a size edit preserves both live positions');
  let layer;
  const makeElement = () => ({ listeners: new Map(), classList: { add() {}, remove() {} },
    addEventListener(type, fn) { this.listeners.set(type, fn); }, removeEventListener() {}, remove() {} });
  const tool = new ZoneEditorDragController({ state: st, map: liveMap, projector: proj, config: cfg, canvasMetrics: { width: 400, height: 400 },
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }) }),
    documentTarget: { createElement: makeElement, body: makeElement() }, mountNode: { prepend: node => { layer = node; } }, writeZones: write });
  tool.sync();
  const pointer = (type, x, y) => { let taken = false; layer.listeners.get(type)({ clientX: x, clientY: y, pointerId: 1,
    preventDefault() { taken = true; } }); return taken; };
  assert(!pointer('pointerdown', 60, 60), 'the old authored position is not a drag target');
  assert(pointer('pointerdown', 120, 60), 'the current live body is the drag target');
  pointer('pointermove', 160, 100); pointer('pointerup', 160, 100);
  const moved = liveMap.getDynamicZones()[0];
  assert(moved.x === 3 && moved.y === 2 && moved.w === 2 && liveMap.getDynamicZones()[1].x === 5, 'drag updates the game body and preserves its sibling');
  pointer('pointerdown', 160, 100); pointer('pointermove', 165, 103); pointer('pointerup', 165, 103);
  assert.deepEqual([liveMap.getDynamicZones()[0].x, liveMap.getDynamicZones()[0].y], [3.125, 2.075], 'dynamic translation stays continuous and survives config refresh');
  pointer('pointerdown', 165, 103); pointer('pointermove', 160, 100); pointer('pointerup', 160, 100);
  // Spec 133: body selection exposes its own bounds; area and body edits cannot exclude each other.
  assert(st.boundsEditing && st.selection.category === 'dynamic' && st.selection.index === 0, 'body press selects its movement area');
  geo.buildInto(frame);
  assert.equal(frame.annotations.rects.slice(0, frame.annotations.rectCount).filter(rect => rect.fillAlpha === .9).length, 4,
    'only the selected area exposes its four handles');
  pointer('pointerdown', 400, 200); pointer('pointermove', 160, 200); pointer('pointerup', 160, 200);
  let bounded = liveMap.getDynamicZones()[0];
  assert(bounded.bounds[0].w === 5 && bounded.x === 3 && bounded.w === 2, 'shrinking the area stops at the body edge');
  pointer('pointerdown', 160, 100); pointer('pointermove', 2000, 2000); pointer('pointerup', 2000, 2000);
  bounded = liveMap.getDynamicZones()[0];
  assert(bounded.x === 3 && bounded.y === 9, 'body movement intersects window and movement-area constraints');
  pointer('pointerdown', 200, 380); pointer('pointermove', 1200, 380); pointer('pointerup', 1200, 380);
  bounded = liveMap.getDynamicZones()[0];
  assert(bounded.x + bounded.w <= 5, 'body resize cannot extend beyond its area');
  const coordinateEdit = commands.prepare(['CONFIG', 'locations', 'map', 'live', 'zones', 'dynamic', '0', 'x'], 1000);
  assert(coordinateEdit.value[0].x + coordinateEdit.value[0].w <= 5, 'direct coordinate edits obey containment too');
  const numericArea = commands.prepare(['CONFIG', 'locations', 'map', 'live', 'zones', 'dynamic', '0', 'bounds', '0', 'w'], 1);
  assert(numericArea.value[0].bounds[0].w >= bounded.w, 'numeric area size cannot become smaller than its body');
  pointer('pointerdown', 100, 200); pointer('pointermove', 140, 200); pointer('pointerup', 140, 200);
  bounded = liveMap.getDynamicZones()[0];
  assert(bounded.bounds[0].x === 1 && bounded.x === 3, 'the area middle moves its bounds while retaining the body');
  pointer('pointerdown', 40, 0); pointer('pointermove', 1000, 1000); pointer('pointerup', 1000, 1000);
  bounded = liveMap.getDynamicZones()[0];
  assert(bounded.bounds[0].x <= bounded.x && bounded.bounds[0].y <= bounded.y && bounded.bounds[0].w >= bounded.w && bounded.bounds[0].h >= bounded.h,
    'area corner resize cannot exclude the body');
  const separateConfig = JSON.parse(JSON.stringify(cfg));
  separateConfig.locations.map.live.zones.dynamic[0].bounds.push({ x: 30, y: 0, w: 10, h: 10 });
  const separateCommands = new ZoneEditorConfigEdits({ config: separateConfig, getMap: () => liveMap });
  const separateArea = separateCommands.prepare(['CONFIG', 'locations', 'map', 'live', 'zones', 'dynamic', '0', 'bounds', '0', 'w'], 1);
  assert.equal(separateArea.value[0].bounds[1].x, 30, 'editing the containing area never moves a separate allowed region');
  const before = bounded.x; step(1000); assert.equal(bounded.x, before, 'edited zone remains paused');
  st.setEditing('dynamic', false); step(100);
  assert(bounded.x !== before, 'motion resumes and bounces from the edited area edge');
  const untouched = commands.prepare(['CONFIG', 'ui', 'x'], 7);
  assert.equal(untouched.value, 7, 'unrelated config edits are unchanged');
  assert(writes >= 7 && writes <= 8, 'only accepted geometry gestures write coordinates');
  st.setEditing('dynamic', true);
  pointer('pointerdown', 220, 180); pointer('pointerup', 220, 180);
  assert.equal(st.selectedIndex('dynamic'), 0, 'clicking another body never changes the dropdown selection');
  st.select('dynamic', 1);
  pointer('pointerdown', 220, 180); pointer('pointerup', 220, 180);
  assert(st.boundsEditing && st.selection.index === 1, 'explicit selection permits that body and its own bounds');
  geo.buildInto(frame);
  assert.equal(frame.annotations.rects.slice(0, frame.annotations.rectCount).filter(rect => rect.fillAlpha === .9).length, 4,
    'switching the selection removes the previous area handles');
  const beforeIdChange = writes;
  pointer('pointerdown', 220, 180);
  cfg.locations.map.live.zones.dynamic[1].id = 'replacement';
  pointer('pointermove', 260, 180); pointer('pointerup', 260, 180);
  assert.equal(writes, beforeIdChange, 'replacing an ID at the same index cancels the old target instead of editing its replacement');
  cfg.locations.map.live.zones.dynamic[1].id = 'b';
  st.setFlag('enabled', false);
  assert(!st.boundsEditing && st.hoveredBound === -1, 'leaving editing clears bounds selection and hover');
  assert(!flags.isEnabled('pauseDynamicZones'), 'leaving editor mode always releases motion');
  tool.dispose();
}

// Spec 137: grid changes preserve map-space geometry, live motion and authored coordinates.
{
  const { LocationMap } = load('src/game/domain/locations/location_map.js');
  const { ZoneEditorConfigEdits } = load('src/dev/location/zone_editor_config_edits.js');
  const locations = { cellSize: 40, designCellSize: 40, baseResolution: { width: 400, height: 400 }, map: {
    stable: { depthBounds: { min: 1, max: 5 }, zones: {
      castable: [{ x: 1, y: 1, w: 8, h: 8 }], collisions: [{ x: 2, y: 2, w: 1, h: 1 }],
      snags: [{ x: 6, y: 6, w: 1, h: 1 }, { x: 2.25, y: 3.25, w: .125, h: .125 }],
      dynamic: [{ id: 'round', shape: 'circle', x: 2, y: 2, w: 1, h: 1, moving: true, speedX: .6, speedY: .8,
        bounds: [{ x: 1, y: 1, w: 8, h: 8 }] }],
    } } } };
  const cfg = { locations }, resources = { depthReader: { getDepthAtPixel: () => 3 } };
  let randomDraws = 0;
  const map = new LocationMap('stable', locations, { next: () => { randomDraws++; return 0; } }, resources);
  map.recalculateZones(null, 40);
  const body = map.getDynamicZones()[0]; body.x = 3.125; body.y = 2.25; body.dirTimer = 5000;
  const rect = (zone, size) => [zone.x * size, zone.y * size, zone.w * size, zone.h * size];
  const equalRect = (a, b, label) => a.forEach((number, index) => assert(Math.abs(number - b[index]) < 1e-8, label));
  const before = map.getLocationZones(), authored = JSON.stringify(locations.map.stable.zones);
  const expected = Object.fromEntries(['castable', 'collisions', 'snags'].map(category => [category, rect(before[category][0], 40)]));
  let liveX = 125, liveY = 90;
  const commands = new ZoneEditorConfigEdits({ config: cfg, getMap: () => map });
  const proj = { virtualToScreen: (x, y, out) => out.set(x, y), screenToVirtual: (x, y, out) => out.set(x, y), getScale: () => 1 };
  const st = new ZoneEditorState(); st.setCategory('castable', true); st.setCategory('dynamic', true);
  const geo = new ZoneEditorGeometryBuilder({ state: st, map, projector: proj, config: cfg, getWaterMetric: () => null });
  for (const size of [30, 17, 20, 100, 40]) {
    locations.cellSize = size;
    // Config changes before the async reload: snapshots must still interpret the old map's cells correctly.
    equalRect(rect(commands.readDynamicZones('stable')[0], 40), [liveX, liveY, 40, 40], 'pending resize keeps live command units');
    const pending = {}; geo.buildInto(pending);
    equalRect([pending.annotations.overlay.rects[0].x, pending.annotations.overlay.rects[0].y,
      pending.annotations.overlay.rects[0].width, pending.annotations.overlay.rects[0].height], [liveX, liveY, 40, 40], 'pending reload cannot reinterpret the existing map with new cells');
    map.refreshConfig(locations, resources);
    for (const category of ['castable', 'collisions', 'snags']) equalRect(rect(map.getLocationZones()[category][0], size), expected[category], `${category} stays put at cell size ${size}`);
    equalRect(rect(map.getLocationZones().snags[1], size), [90, 130, 5, 5], 'a subcell zone stays nonzero on both finer and coarser grids');
    const current = map.getDynamicZones()[0];
    equalRect(rect(current, size), [liveX, liveY, 40, 40], 'moving circle keeps its current position and full diameter');
    equalRect(rect(current.bounds[0], size), [40, 40, 320, 320], 'movement bounds stay put');
    assert.equal(map.getCellAtVirtualPos(100, 100, size).hasCollision, true, 'collision coverage survives fractional grid coordinates');
    assert.equal(map.getCellAtVirtualPos(260, 260, size).hasSnag, true, 'snag coverage survives fractional grid coordinates');
    assert.equal(map.getCellAtVirtualPos(160, 160, size).depth, 3, 'depth reads use valid integer grid indices');
    const frame = {}; geo.buildInto(frame);
    equalRect([frame.annotations.overlay.rects[0].x, frame.annotations.overlay.rects[0].y,
      frame.annotations.overlay.rects[0].width, frame.annotations.overlay.rects[0].height], [liveX, liveY, 40, 40], 'live annotations retain map-space geometry');
    const worldFrame = new GameRenderFrame();
    new WorldRenderFrameBuilder({ map, projector: proj, config: cfg, canvasMetrics: { width: 400 }, locationId: 'stable',
      boatChumBuilder: { buildInto() {} } }).buildInto({ target: worldFrame.world });
    const clip = worldFrame.world.clipRegions.getAt(0);
    equalRect([clip.x, clip.y, clip.width, clip.height], [40, 40, 320, 320], 'water clip uses the same design geometry');
    current.update(100); liveX += 2.4; liveY += 3.2;
    equalRect(rect(current, size), [liveX, liveY, 40, 40], 'motion keeps its physical speed through grid changes');
  }
  assert.equal(JSON.stringify(locations.map.stable.zones), authored, 'grid refinement never rewrites authored/exported geometry');
  assert.equal(randomDraws, 1, 'grid changes never randomize starts or reset direction scheduling');
  // Subsequent static edits use the new 20px cell while storing fractional design coordinates.
  locations.cellSize = 20; map.refreshConfig(locations, resources);
  st.setFlag('enabled', true); st.setEditing('castable', true);
  const { ZoneEditorDragController } = load('src/dev/location/zone_editor_drag_controller.js');
  let layer;
  const element = () => ({ classList: { add() {}, remove() {} }, listeners: new Map(), addEventListener(type, fn) { this.listeners.set(type, fn); }, removeEventListener() {}, remove() {} });
  const drag = new ZoneEditorDragController({ state: st, map, projector: proj, config: cfg, canvasMetrics: { width: 400, height: 400 },
    documentTarget: { createElement: element, body: element() }, mountNode: { prepend: node => { layer = node; } },
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }) }),
    writeZones: (path, value) => { locations.map.stable.zones[path.at(-1)] = value; map.refreshConfig(locations, resources); } });
  drag.sync();
  for (const [type, x] of [['pointerdown', 200], ['pointermove', 220], ['pointerup', 220]]) {
    layer.listeners.get(type)({ clientX: x, clientY: 200, pointerId: 1, preventDefault() {} });
  }
  assert.equal(locations.map.stable.zones.castable[0].x, 1.5, 'next drag advances exactly one 20px cell, stored as half a design cell');
  equalRect(rect(map.getLocationZones().castable[0], 20), [60, 40, 320, 320], 'next drag retains the existing width and height');
  drag.dispose();
  // Adaptive bounds track exact viewport edges, not the raster's rounded outer columns.
  locations.map.stable.zones.castable[0].adaptiveX = true;
  locations.map.stable.zones.dynamic[0].bounds = { x: 0, y: 1, w: 10, h: 8 };
  const viewport = { getCanvasWidth: () => 280, screenToVirtual: x => ({ x: x + 10.25 }) };
  for (const size of [30, 17, 40]) {
    locations.cellSize = size; map.refreshConfig(locations, resources); map.recalculateZones(viewport, size);
    const bound = map.getDynamicZones()[0].bounds;
    equalRect(rect(bound, size), [10.25, 40, 280, 320], 'adaptive movement bounds keep their viewport edges');
  }
}

// Spec 135: actual map/command/creation pipeline, circle input and shared renderer commands.
{
  const { LocationMap } = load('src/game/domain/locations/location_map.js');
  const { ZoneEditorConfigEdits } = load('src/dev/location/zone_editor_config_edits.js');
  const { ZoneEditorDragController } = load('src/dev/location/zone_editor_drag_controller.js');
  const format = load('src/dev/location/zone_export_format.js');
  const cfg = { locations: { cellSize: 40, designCellSize: 40, baseResolution: { width: 400, height: 400 },
    map: { shapes: { depthBounds: { min: 1, max: 5 }, zones: { castable: [], collisions: [], snags: [], dynamic: [] } } } } };
  const map = new LocationMap('shapes', cfg.locations, { next: () => 0 }, {});
  const st = new ZoneEditorState(); st.loadedLocationId = 'shapes'; st.locationId = 'shapes';
  const commands = new ZoneEditorConfigEdits({ config: cfg, getMap: () => map });
  const write = (path, value) => {
    const command = commands.prepare(path, value);
    let target = cfg; for (const key of command.path.slice(1, -1)) target = target[key]; target[command.path.at(-1)] = command.value;
    map.refreshConfig(cfg.locations, {});
  };
  const rows = new Map();
  const ui = { createControlGroup: () => ({ label: 'Локація', replaceChildren() {} }), releaseValueBindings() {}, syncValue() {}, createInfoRow() {},
    createSelectRow: (label, options, value, parent, action) => rows.set(`${parent.label}/${label}`, action),
    createInputRow: (label, value, parent, type, action) => rows.set(`${parent.label}/${label}`, action),
    createSwitcherRow() {}, createRangeRow() {}, createButtonRow: (label, parent, action) => rows.set(`${parent.label}/${label}`, action) };
  const section = new ZoneEditorSection({ ui, state: st, config: cfg, createSection: label => ({ label, replaceChildren() {} }),
    renderTree() {}, updateConfig: write, readDynamicZones: id => commands.readDynamicZones(id), getWaterMetric: () => metric,
    createWaterMetric: options => WaterMetric.illustrated(options) });
  section.render({});
  const action = label => rows.get(`Рухомі зони/${label}`);
  action('Форма нової зони')('Коло'); action('Додати зону')();
  const first = cfg.locations.map.shapes.zones.dynamic[0];
  assert(first.shape === 'circle' && first.w === first.h && first.moving && first.bounds.length === 1, 'empty-list circle creation has valid motion and bounds');
  action('Форма нової зони')('Квадрат'); action('Додати зону')();
  const second = cfg.locations.map.shapes.zones.dynamic[1];
  assert(second.shape === 'square' && second.w === second.h && second.id !== first.id, 'creation choice overrides copied shape and gives a fresh identity');
  action('Видалити вибрану зону')();
  const path = ['CONFIG', 'locations', 'map', 'shapes', 'zones', 'dynamic'];
  write(path, [{ ...first, x: 2, y: 2, w: 4, h: 4 }]); st.zonesEdited();
  action('Діаметр, клітинок')(3);
  assert.deepEqual([map.getDynamicZones()[0].w, map.getDynamicZones()[0].h], [3, 3], 'numeric diameter updates both live dimensions');
  write([...path, 0, 'h'], 4);
  st.setFlag('enabled', true); st.setEditing('dynamic', true); st.setCategory('dynamic', true);
  const proj = { getScale: () => 1, virtualToScreen: (x, y, out) => out.set(x, y), screenToVirtual: (x, y, out) => out.set(x, y) };
  let layer;
  const element = () => ({ classList: { add() {}, remove() {} }, listeners: new Map(), addEventListener(type, fn) { this.listeners.set(type, fn); }, removeEventListener() {}, remove() {} });
  const drag = new ZoneEditorDragController({ state: st, map, projector: proj, config: cfg, canvasMetrics: { width: 400, height: 400 },
    documentTarget: { createElement: element, body: element() }, mountNode: { prepend: node => { layer = node; } },
    getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }) }), writeZones: write });
  drag.sync();
  const pointer = (type, x, y) => { let taken = false; layer.listeners.get(type)({ clientX: x, clientY: y, pointerId: 1, preventDefault() { taken = true; } }); return taken; };
  pointer('pointermove', 80, 80);
  assert(!st.isHovered('dynamic', 0) && !pointer('pointerdown', 80, 80), 'circle bounding-box corner neither hovers nor selects the body');
  assert(pointer('pointerdown', 160, 160), 'circle centre is movable');
  pointer('pointermove', 165, 163); pointer('pointerup', 165, 163);
  assert.deepEqual([map.getDynamicZones()[0].x, map.getDynamicZones()[0].y], [2.125, 2.075], 'circle translation stays continuous');
  pointer('pointerdown', 245, 163); pointer('pointermove', 1000, 163); pointer('pointerup', 1000, 163);
  const body = map.getDynamicZones()[0];
  assert(body.w === body.h && body.x + body.w <= 10 && body.y + body.h <= 10, 'contour resizing stays round and inside its movement area');
  const geo = new ZoneEditorGeometryBuilder({ state: st, map, projector: proj, config: cfg, getWaterMetric: () => metric });
  const frame = {}; geo.buildInto(frame);
  assert.equal(frame.annotations.overlay.rects[0].shape, 'ellipse', 'live circle emits the shared ellipse primitive');
  const movingBuilds = geo.overlayRebuilds;
  geo.buildInto(frame); assert.equal(geo.overlayRebuilds, movingBuilds, 'unchanged circle has no geometry rebuild');
  let overlay;
  const render = new PixiAnnotationRenderer({ pixi: { Graphics }, stage: { addChild: (a, b) => { overlay = b; } } });
  render.update(frame.annotations);
  assert(overlay.operations.some(entry => entry[0] === 'ellipse'), 'WebGL consumes the ellipse command');
  let canvasEllipses = 0;
  const canvas = { ...surface, ellipse() { canvasEllipses++; }, fill() {} };
  new WorldDebugRenderer({ surface: canvas }).render({ visible: true, annotations: frame.annotations, debugImage: { visible: false }, dynamicZones: { count: 0 } });
  assert.equal(canvasEllipses, 1, 'Canvas fallback consumes the same circular body once');
  const zones = cfg.locations.map.shapes.zones;
  assert.equal(format.validateZones(zones).length, 0);
  const source = format.zoneModuleSource('shapes', zones);
  assert(source.includes('shape: "circle"'), 'code serialization retains circle shape');
  assert(format.validateZones({ dynamic: [{ ...zones.dynamic[0], shape: 'triangle' }] }).length > 0, 'unknown imported shape refused');
  assert(format.validateZones({ dynamic: [{ ...zones.dynamic[0], h: 1 }] }).length > 0, 'unequal circle size refused');
  assert.equal(format.validateZones({ dynamic: [{ id: 'old', x: 0, y: 0, w: 2, h: 3 }] }).length, 0, 'legacy rectangle remains accepted');
  drag.dispose(); section.dispose();
}

(async () => {
  const format = load("src/dev/location/zone_export_format.js");
  const { createHash } = require("node:crypto");
  const hashText = text => createHash("sha256").update(text, "utf8").digest("hex");
  const clone = value => JSON.parse(JSON.stringify(value));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const baseZones = { lake: { castable: [{ x: 0, y: 0, w: 10, h: 10 }], collisions: [], snags: [], dynamic: [] },
    pond: { castable: [{ x: 1, y: 1, w: 2, h: 2 }] } };
  const cfg = { locations: { cellSize: 40, designCellSize: 40, baseResolution: { width: 2560, height: 1440 },
    map: { lake: { name: "Lake", zones: clone(baseZones.lake) }, pond: { name: "Pond", zones: clone(baseZones.pond) } } } };
  const st = new ZoneEditorState();
  const shownMap = { currentLocationId: "lake", getRevision: () => 1, getDynamicZones: () => [],
    getLocationZones: () => cfg.locations.map.lake.zones, getCastableBoundsVirtual: () => ({ left: 0, right: 2560, top: 0, bottom: 1440 }) };
  const geometry = new ZoneEditorGeometryBuilder({ state: st, map: shownMap, projector, getWaterMetric: () => metric, config: cfg });
  assert(st.loadedLocationId === "lake" && st.locationId === "lake", "the editor starts on the location on screen");
  const rows = new Map(), info = new Map();
  const record = (kind) => (label, ...args) => {
    const parent = kind === "button" ? args[0] : kind === "select" ? args[2] : args[1];
    rows.set(`${parent?.label}/${label}`, { kind, args });
  };
  const ui = { createControlGroup: () => ({ label: "Локація", replaceChildren() {} }), syncValue() {}, releaseValueBindings(parent) {
    for (const map of [rows, info]) for (const key of [...map.keys()]) if (key.startsWith(`${parent.label}/`)) map.delete(key);
  }, createInfoRow: (label, value, parent) => { const element = { innerText: value }; info.set(`${parent?.label}/${label}`, element); return element; },
  createInputRow: record("input"), createRangeRow: record("range"), createButtonRow: record("button"),
  createSelectRow: record("select"), createSwitcherRow: record("switch") };
  const downloads = [], confirms = [], opened = [], writes = [], resets = [];
  let picked = null, confirmAnswer = false;
  const files = { download: (name, text) => downloads.push({ name, text }), pickFile: async () => picked,
    confirm: (message) => { confirms.push(message); return confirmAnswer; }, openLocation: id => opened.push(id), hashText };
  new ZoneEditorSection({ ui, state: st, config: cfg, createSection: label => ({ label, replaceChildren() {} }), renderTree() {},
    updateConfig: (path, value) => { writes.push(path.join(".")); let node = cfg; for (const key of path.slice(1, -1)) node = node[key]; node[path.at(-1)] = value; },
    getWaterMetric: () => metric, createWaterMetric: options => WaterMetric.illustrated(options), files,
    getBaseZones: id => baseZones[id], resetZones: (id) => { resets.push(id); cfg.locations.map[id].zones = clone(baseZones[id]); },
    gameVersion: "0.46.22" }).render({});
  const status = () => info.get("Збереження/Стан зон").innerText;
  const press = label => rows.get(label).args[1]();
  let select = rows.get("Локація/Локація");
  assert.deepEqual([...select.args[0]], ["Lake (lake)", "Pond (pond)"]); assert.equal(select.args[1], "Lake (lake)");
  assert(!rows.has("Локація/Відкрити локацію") && status() === "Зони збігаються з кодом.", "the location on screen, unchanged");

  // Export: the chosen location's full zones, the code's hash, a dated file name.
  cfg.locations.map.lake.zones.castable[0].x = 3; st.zonesEdited();
  cfg.locations.map.lake.zones.dynamic.push({ id: 'roundtrip-circle', shape: 'circle', x: 1, y: 2, w: 2, h: 2, moving: true });
  assert.match(status(), /Змінено \(ще не в коді\): Ігрова область/u, "the status names the changed categories");
  press("Збереження/Експорт зон"); await settle();
  const file = JSON.parse(downloads[0].text);
  assert.match(downloads[0].name, /^zones-lake-v0\.46\.22-\d{8}-\d{4}\.json$/u);
  assert(file.locationId === "lake" && file.zones.castable[0].x === 3 && file.zones.snags.length === 0 &&
    file.baseHash === await format.zoneHash(baseZones.lake, hashText) && format.validateZoneFile(file, cfg.locations).length === 0,
    "the file holds the location's current zones, the code's hash and passes the importer's validation");
  assert(!("pond" in file.zones) && !("locations" in file), "only this location's zones, not the config");

  // Reset to the code, then import the file back into the session.
  st.setEditing("castable", true);
  press("Збереження/Скинути зміни зон до коду");
  assert(resets.join() === "lake" && Object.values(st.editing).every(value => !value) && status() === "Зони збігаються з кодом.", "reset returns to the code");
  picked = downloads[0].text; press("Збереження/Імпорт зон"); await settle();
  assert(writes.at(-1) === "CONFIG.locations.map.lake.zones" && cfg.locations.map.lake.zones.castable[0].x === 3,
    "an imported file becomes the session's zones of the location");
  assert.equal(cfg.locations.map.lake.zones.dynamic[0].shape, 'circle', 'browser export/reset/import retains the circular body');
  const before = writes.length;
  picked = JSON.stringify({ ...file, locationId: "pond" }); press("Збереження/Імпорт зон"); await settle();
  assert(writes.length === before && /Файл для локації pond/u.test(status()), "a file of another location is refused");
  picked = "{"; press("Збереження/Імпорт зон"); await settle();
  assert.equal(status(), "Файл не є JSON.");
  picked = JSON.stringify({ ...file, zones: { castable: [{ x: 0, y: 0, w: -1, h: 1 }] } }); press("Збереження/Імпорт зон"); await settle();
  assert(writes.length === before && /не прийнято: zones\.castable\.0/u.test(status()), "a broken zone is refused with its path");

  // Another location: lists only, nothing drawn or dragged, reopening warns about unexported edits.
  st.setEditing("castable", true);
  select.args[3]("Pond (pond)");
  select = rows.get("Локація/Локація");
  assert(st.locationId === "pond" && Object.values(st.editing).every(value => !value) && select.args[1] === "Pond (pond)", "choosing a location starts it clean");
  assert(/На екрані: Lake \(lake\)/u.test(info.get("Локація/На екрані").innerText) && rows.has("Зони/Редагувати ігрову"),
    "the lists follow the chosen location and the screen is named");
  st.setFlag("enabled", true); const frame = {}; geometry.buildInto(frame);
  assert.equal(frame.annotations, null, "the editor draws nothing for a location that is not on screen");
  press("Локація/Відкрити локацію");
  assert(confirms.length === 1 && opened.length === 0, "unexported edits ask before the page reloads");
  confirmAnswer = true; press("Локація/Відкрити локацію");
  assert.deepEqual(opened, ["pond"], "confirmed, the page reopens on the chosen location");
  cfg.locations.map.lake.zones = clone(baseZones.lake); confirms.length = 0; opened.length = 0;
  press("Локація/Відкрити локацію");
  assert(confirms.length === 0 && opened.join() === "pond", "without edits it reopens at once");
  st.setFlag("enabled", false);
  console.log("Zone editor passed: metre-grid projection, zone edits and visibility, black background, perspective/live changes, bounded and zero unchanged rebuilds, reused WebGL Graphics and Canvas fallback without duplicate drawing; spec 129 rev. 2: one enable switch, physics-gated zone lists, cell grid visibility/opacity/size and fixed one-cell snap, editor depth map, perspective physics, edge dragging with snap; rev. 3: editable zone list, outlines and hover fill, middle 30% moves the zone inside the window (not drawn), smallest hovered zone taken; spec 130: location select and on-screen binding, zone file export/import/reset and status, reopen with confirmation.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
// Spec 136, Revision 2: the zones inside the castable area preview the real values (location, equipment, chosen net
// and fish) from the rod's real position; the sector and the line radius use the editor's line length and a draggable
// conditional float; only hand chum writes (the location's chumCastDistance); test chum zones look like real ones.
(async () => {
  const { CastableZoneReadings } = load("src/dev/location/castable_zone_readings.js");
  const { CastableDependentZones } = load("src/dev/location/castable_dependent_zones.js");
  const { Net } = load("src/game/domain/tackle/net.js");
  const { FISH_DB } = load("src/game/config/databases/fish_database.js");
  const physics = { getPixelsPerMeter: () => 50, getDistanceConfig: () => ({}),
    getCatchZoneConfig: () => ({ reel: { landingDistanceMeters: 4 } }),
    getPoleFightSectorConfig: () => ({ enabled: true, maxAngleFromCenterDeg: 50, shoreOpeningWidthMeters: 3 }) };
  const cfg = { fightPhysicsConfig: physics, locations: { cellSize: 40, enableCastable: true, baseResolution: { width: 2560, height: 1440 },
    debugVisuals: true, showAimingZone: true, showNetZone: true, showLastDashZone: true, showCatchZone: true, showFightLineRadius: true,
    showPoleFightSector: true, showChumZones: true, map: { lake: { name: "Lake", zones: {} }, pond: { name: "Pond", zones: { castable: [{ x: 0, y: 0, w: 1, h: 1 }] } } } } };
  let equipment = { rod: { effectiveStats: {} }, reel: { effectiveStats: { basePower: 5 } } };
  const nets = { net_small: { id: "net_small", name: "Мала", gameplayStats: { active: true, length: 3 } },
    net_big: { id: "net_big", name: "Велика", gameplayStats: { active: true, length: 6 } } };
  const fish = FISH_DB.find(entry => entry.physics?.movementProfile?.lastDashTrigger?.enabled === true);
  const readings = new CastableZoneReadings({ config: cfg, getEquipment: () => equipment, nets, fishes: [fish] });
  assert.equal(readings.netPx("net_big"), new Net(nets.net_big.gameplayStats, {}).getReachPixels(), "the game's own Net converts the reach");
  assert.equal(readings.lastDashMeters(fish.id), 4 * fish.physics.movementProfile.lastDashTrigger.catchZoneMultiplier,
    "the fish's trigger over the equipped landing distance, as the fight resolves it");
  const st = new ZoneEditorState();
  st.loadedLocationId = "lake"; st.setLocation("lake"); st.setFlag("enabled", true);
  const identity = { virtualToScreen: (x, y, out) => out.set(x, y), screenToVirtual: (x, y, out) => out.set(x, y), getScale: () => 1 };
  const flat = new WaterMetric({ pixelsPerMeter: 50, shoreY: 1000, topY: 0, centerX: 500 });
  const writes = [];
  let rodScreenX = null;
  const zones = new CastableDependentZones({ state: st, config: cfg, readings, projector: identity, getWaterMetric: () => flat,
    map: { getCastableBoundsVirtual: () => ({ left: 0, right: 1000, top: 0, bottom: 1000 }) }, canvasMetrics: { width: 1000 },
    getRodScreenX: () => rodScreenX,
    writeConfig: (path, value) => { writes.push([path.join("."), value]); cfg.locations.map.lake.chumCastDistance = value; } });
  const draw = () => {
    zones.refresh();
    const drawn = { bands: [], polygons: [], handles: [] };
    zones.buildInto({ band: (left, top, right, bottom, look) => drawn.bands.push({ top, bottom, ...look }),
      polygon: (points, look) => drawn.polygons.push({ points, ...look }), handle: (x, y, look) => drawn.handles.push({ x, y, ...look }) });
    return drawn;
  };
  const byColor = (list, color) => list.find(entry => entry.color === color);
  let drawn = draw();
  assert.deepEqual(drawn.bands.map(band => [band.color, band.top]), [["#ffb347", 700], ["#33dd88", 1000 - readings.netPx("net_small")],
    ["#b366ff", 1000 - readings.lastDashMeters(fish.id) * 50]], "hand chum 300 px (no rod aim band), the first net, the fish");
  const landing = byColor(drawn.polygons, "#3388ff").points;
  assert(landing[0] === 700 && Math.abs(landing[33] - 800) < 1e-9, "the landing half-circle: 4 m round the rod");
  const line = byColor(drawn.polygons, "#dddddd").points;
  assert(Math.abs(line[0] - 0) < 1e-9 && line[1] === 1000 && Math.abs(line[65] - 500) < 1e-9 && line[64] === 500,
    "the line radius: the 10 m line length round the rod");
  const sector = byColor(drawn.polygons, "#ff8844").points;
  assert(sector.length === 2 * 66 && sector[1] > 1000, "the fight sector: its apex behind the shore, the arc at the float's distance");
  assert.deepEqual([drawn.handles[0].x, drawn.handles[0].y, drawn.handles[0].color], [500, 500, "#ffffff"],
    "the conditional float straight ahead at the line length");

  // The line length drives the line radius and the sector; the float stays within it.
  zones.setLineMeters(4); drawn = draw();
  assert(Math.abs(byColor(drawn.polygons, "#dddddd").points[65] - 800) < 1e-9 && drawn.handles[0].y === 800, "4 m of line");
  assert.equal(zones.hit(500, 800), null, "the float moves only while its switch is on");
  zones.setMovingFloat(true);
  const float = zones.hit(500, 805);
  assert.deepEqual([float?.kind, float?.cursor], ["float", "move"]);
  zones.drag(float, 650, 900); drawn = draw();
  assert(Math.abs(drawn.handles[0].x - 650) < 1e-9 && Math.abs(drawn.handles[0].y - 900) < 1e-9, "the float follows the pointer");
  const shortSector = byColor(drawn.polygons, "#ff8844").points;
  assert(Math.abs(Math.hypot(shortSector[66] - 500, shortSector[67] - 1000) - Math.hypot(150, 100)) < 1e-6,
    "the sector's radius is the rod-to-float distance, as in the game");
  zones.drag(float, 500, 0); drawn = draw();
  assert(Math.abs(drawn.handles[0].y - 800) < 1e-9, "the float cannot pull more line than the line length");
  rodScreenX = 300; drawn = draw();
  assert.equal(byColor(drawn.polygons, "#3388ff").points[0], 500, "previews follow the rod's real position");
  rodScreenX = null;

  // Hand chum: its far line is dragged like a zone edge, snapped to the cell step, into the location's setting.
  assert.equal(zones.hit(500, 700), null, "nothing is dragged before its editing is on");
  zones.setEditingChumLine(true);
  const chumLine = zones.hit(500, 705);
  assert.deepEqual([chumLine?.kind, chumLine?.cursor], ["line", "y"]);
  zones.drag(chumLine, 500, 612);
  assert.deepEqual(writes.at(-1), ["CONFIG.locations.map.lake.chumCastDistance", 400], "612 px snaps to 600: 400 px from the shore");
  drawn = draw(); assert.equal(drawn.bands[0].top, 600, "the preview follows the written setting");
  zones.hover(500, 650); drawn = draw();
  assert(drawn.bands[0].hovered === true && zones.hovered === "handChum", "the pointer inside the edited band fills it");
  zones.hover(50, 1100); assert.equal(zones.hovered, null, "below the shore nothing is hovered");

  // Test chum zones: drawn as the game's chum records; middle moves, edge resizes; nothing else changes.
  const chumZones = zones.chumZones;
  zones.addChumZone();
  const frame = { chumZones: { records: [], acquire() { const record = {}; this.records.push(record); return record; } } };
  zones.buildChumZonesInto(frame);
  assert.deepEqual(frame.chumZones.records, [{ opacity: 1, x: 500, y: 500, radiusX: 100, radiusY: 100 }],
    "a new test zone is a full-bonus chum record of 2 m in the middle of the water");
  assert.equal(zones.hit(500, 500), null, "test zones are dragged only while their editing is on");
  chumZones.setEditing(true);
  const middle = zones.hit(510, 500);
  assert.deepEqual([middle?.kind, middle?.move], ["chum", true]);
  zones.drag(middle, 615, 430);
  const edge = zones.hit(705, 440);
  assert.deepEqual([edge?.kind, edge?.move], ["chum", false], "its rim takes the edge");
  zones.drag(edge, 770, 440);
  frame.chumZones.records.length = 0; zones.buildChumZonesInto(frame);
  assert.deepEqual(frame.chumZones.records[0], { opacity: 1, x: 600, y: 440, radiusX: 160, radiusY: 160 },
    "moved to the snapped 600/440 and resized to 160 px");
  cfg.locations.showChumZones = false; frame.chumZones.records.length = 0; zones.buildChumZonesInto(frame);
  assert.equal(frame.chumZones.records.length, 0, "the game's show switch hides the test zones too");
  cfg.locations.showChumZones = true;
  chumZones.remove("lake", 0);
  assert.equal(chumZones.list("lake").length, 0);
  assert.equal(writes.length, 1, "the float, the line length and test chum zones never write a game value");

  // TK-069: with "Брати значення зі спорядження" the equipped line and net drive the previews; without them, the editor's.
  const typedLine = zones.effectiveLineMeters;
  zones.setFromEquipment(true);
  assert.equal(zones.effectiveLineMeters, typedLine, "nothing equipped: the typed length still applies");
  equipment = { ...equipment, line: { effectiveStats: { lengthMeters: 6 } }, net: { effectiveStats: { active: true, length: 6 } } };
  drawn = draw();
  assert(Math.abs(byColor(drawn.polygons, "#dddddd").points[65] - 700) < 1e-9, "the equipped 6 m line sets the line radius");
  assert.equal(byColor(drawn.bands, "#33dd88").top, 1000 - new Net({ active: true, length: 6 }, {}).getReachPixels(),
    "the equipped net's reach, not the selected one");
  assert(Math.hypot(drawn.handles[0].x - 500, drawn.handles[0].y - 1000) <= 6 * 50 + 1e-6, "a dragged float is pulled in by the shorter line");
  // A line longer than the water keeps the float on it: at the water's far edge (owner: it vanished with a 50 m line).
  equipment = { ...equipment, line: { effectiveStats: { lengthMeters: 50 } } };
  const typed = zones.lineMeters;
  zones.setLineMeters(typed + 1); zones.setLineMeters(typed); // a new typed length resets a dragged float to straight ahead
  drawn = draw();
  assert(Math.abs(drawn.handles[0].y - 0) < 1e-9 && drawn.handles[0].x === 500, "50 m of line over 20 m of water: the float at the far edge");
  zones.setFromEquipment(false);
  equipment = { rod: equipment.rod, reel: equipment.reel };
  // R3-2/R3-3: with the equipment's values and a real cast, the game draws the overlays itself; the anchor sits on the
  // real float and, while it waits, moves it within the equipped line's reach over the water.
  const realFloat = { position: { x: 600, y: 700 }, velocity: { x: 3, y: -2, set(x, y) { this.x = x; this.y = y; } },
    getPosition() { return this.position; }, getVelocity() { return this.velocity; }, setPosition(x, y) { this.position = { x, y }; } };
  let gameState = "waiting", reachCalls = 0;
  const castZones = new CastableDependentZones({ state: st, config: cfg, readings, projector: identity, getWaterMetric: () => flat,
    map: { getCastableBoundsVirtual: () => ({ left: 0, right: 1000, top: 0, bottom: 1000 }) }, canvasMetrics: { width: 1000 },
    getRodScreenX: () => null, writeConfig() {}, getFloat: () => realFloat, getGameStateName: () => gameState,
    checkWater: (x, y) => y < 1000 && x >= 0 && x <= 1000, getEquipment: () => equipment, getHookDepthMeters: () => 2,
    equipmentRules: { getMaxCastDistance: (eq, fallback, depth) => { reachCalls++; return depth === 2 ? 400 : fallback; } } });
  const drawCast = () => {
    castZones.refresh();
    const out = { bands: [], polygons: [], handles: [] };
    castZones.buildInto({ band: (l, top, r, b, look) => out.bands.push({ top, ...look }), polygon: (points, look) => out.polygons.push(look),
      handle: (x, y, look) => out.handles.push({ x, y, ...look }) });
    return out;
  };
  let cast = drawCast();
  assert(cast.polygons.length > 0 && cast.handles.every(handle => handle.x !== 600), "without the equipment's values the static anchor is used");
  castZones.setFromEquipment(true);
  cast = drawCast();
  assert(cast.polygons.length === 0 && !cast.bands.some(band => band.color === "#33dd88") &&
    cast.handles.length === 1 && cast.handles[0].x === 600 && cast.handles[0].y === 700,
    "with a real cast the game draws the overlays; the editor marks the real float only");
  assert.equal(castZones.hit(600, 700), null, "the real float is taken only while its moving switch is on");
  castZones.setMovingFloat(true);
  const real = castZones.hit(603, 702);
  assert.deepEqual([real?.kind], ["float"]);
  castZones.drag(real, 800, 750);
  assert(realFloat.position.x === 800 && realFloat.position.y === 750 && realFloat.velocity.x === 0 && realFloat.velocity.y === 0,
    "the waiting float moves to the pointer and stops");
  castZones.drag(real, 500, 0);
  assert(Math.abs(Math.hypot(realFloat.position.x - 500, realFloat.position.y - 1000) - 400) < 1e-9 && reachCalls > 0,
    "the equipped line's reach (the selected depth included) limits it");
  const before = { ...realFloat.position };
  castZones.drag(real, 500, 1200);
  assert.deepEqual(realFloat.position, before, "never onto the shore: a position off the water is refused");
  gameState = "playing"; cast = drawCast();
  assert(castZones.hit(realFloat.position.x, realFloat.position.y) === null && cast.handles[0].editable === false,
    "with a fish on, the anchor only shows the float");
  castZones.drag(real, 700, 700);
  assert.deepEqual(realFloat.position, before, "and never moves it");
  gameState = "scouting"; cast = drawCast();
  assert(cast.polygons.length > 0, "no cast out: the previews are back");

  // Choices, live values and the game's show switches.
  zones.setNet("net_big"); drawn = draw();
  assert.equal(drawn.bands[1].top, 1000 - readings.netPx("net_big"), "the chosen net's reach");
  equipment = {}; drawn = draw();
  assert(!byColor(drawn.polygons, "#3388ff"), "without a rod: no landing half-circle");
  cfg.locations.showFightLineRadius = false; cfg.locations.showPoleFightSector = false; cfg.locations.showAimingZone = false;
  drawn = draw();
  // Without a rod the landing distance is unknown, so the fish's landing-based trigger is too: only the net band stays.
  assert(drawn.polygons.length === 0 && drawn.handles.length === 0 && drawn.bands.length === 1 && zones.hit(500, 605) === null,
    "a zone the game hides is neither previewed nor dragged");
  // Showing needs no editor (owner): previews draw with it off, but nothing is hovered or dragged.
  st.setFlag("enabled", false); drawn = draw();
  assert(drawn.bands.length > 0 && zones.hit(500, 605) === null, "with the editor off the zones show but cannot be taken");
  st.setFlag("enabled", true);
  // The fight-area overlays follow the game's master switch, as FightAreaRenderFrameBuilder does.
  cfg.locations.debugVisuals = false; drawn = draw();
  assert(drawn.bands.length === 0 && zones.isShown("net") === false, "without the overlay master the net band is not previewed");
  cfg.locations.debugVisuals = true;
  // A show switch alone redraws: it changes what is drawn though no real value changed (owner: the hand chum switch
  // did nothing until something else redrew).
  const hidden = zones.revision;
  cfg.locations.showAimingZone = true; draw();
  assert(zones.revision > hidden, "switching a zone on redraws the preview at once");
  cfg.locations.showFightLineRadius = true; cfg.locations.showCatchZone = true; cfg.locations.showAimingZone = true;

  // The section: its own tab with the line length, float, hand chum, net, fish and test chum zone controls.
  const rows = new Map();
  const record = (kind) => (label, ...args) => {
    const parent = kind === "button" ? args[0] : kind === "select" ? args[2] : args[1];
    rows.set(`${parent?.label}/${label}`, { kind, args });
  };
  const sectionUi = { syncValue() {}, releaseValueBindings() {}, createInfoRow: () => ({}), createControlGroup: () => ({ label: "group", replaceChildren() {} }),
    createInputRow: record("input"), createRangeRow: record("range"), createButtonRow: record("button"), createSelectRow: record("select"),
    createSwitcherRow: record("switch") };
  new ZoneEditorSection({ ui: sectionUi, state: st, config: cfg, createSection: label => ({ label, replaceChildren() {} }), renderTree() {},
    updateConfig() {}, getWaterMetric: () => flat, createWaterMetric: options => WaterMetric.illustrated(options),
    getDependentZones: () => zones }).render({});
  const fishing = label => rows.get(`Зони риболовлі/${label}`);
  assert(fishing("Довжина ліски, м") && fishing("Рухати поплавок") && fishing("Редагувати ручну прикормку") &&
    fishing("Редагувати зони прикормки") && fishing("Додати зону прикормки") && fishing("Зона ручної прикормки"),
    "the fishing zones' controls");
  assert(!fishing("Показати зону прицілювання") && !fishing("Редагувати радіус ліски") && !fishing("Редагувати зону підведення") &&
    !rows.has("Ігрова область (закидання)/Зона ручної прикормки"), "renamed aim, no anchors or line editing, nothing left in the castable list");
  fishing("Довжина ліски, м").args[3](25); assert.equal(zones.lineMeters, 25, "the line length is typed in metres");
  assert.deepEqual([...fishing("Брати значення зі спорядження").args[5]?.requires ?? []], [], "taking the equipment needs no editor");
  const takeEquipment = fishing("Брати значення зі спорядження").args[2];
  rows.clear(); takeEquipment(true);
  assert(zones.fromEquipment && !fishing("Довжина ліски, м") && !fishing("Підсака"), "with the equipment the field and the net select are gone");
  rows.clear(); takeEquipment(false);
  // Spec 131 prerequisites: a switch that cannot work while its parent is off is blocked and names that parent.
  const requires = label => [...fishing(label).args[5].requires].map(requirement => [...requirement.path].join("."));
  assert.deepEqual(requires("Показати зону підсаки"), ["CONFIG.locations.debugVisuals"], "the game overlay master gates the net zone");
  assert.deepEqual(requires("Зона ручної прикормки"), [], "hand chum's aim and chum zones do not depend on the overlay master");
  assert.deepEqual(requires("Редагувати ручну прикормку"), ["ZONE_EDITOR.enabled", "CONFIG.locations.showAimingZone"]);
  assert.deepEqual(requires("Рухати поплавок"), ["ZONE_EDITOR.enabled", "CONFIG.locations.debugVisuals", "CONFIG.locations.showPoleFightSector"]);
  assert.deepEqual(requires("Редагувати зони прикормки"), ["ZONE_EDITOR.enabled", "CONFIG.locations.showChumZones"]);
  const floatRequires = fishing("Рухати поплавок").args[5].requires;
  cfg.locations.showPoleFightSector = false; cfg.locations.showFightLineRadius = false;
  assert.equal(floatRequires[2].isEnabled(), false, "the float waits for the sector or the line radius");
  cfg.locations.showFightLineRadius = true;
  assert.equal(floatRequires[2].isEnabled(), true);
  assert.deepEqual([...fishing("Підсака").args[0]], ["Мала", "Велика"]); assert.equal(fishing("Підсака").args[1], "Велика");
  fishing("Додати зону прикормки").args[1]();
  assert(chumZones.list("lake").length === 1 && rows.has("Зони риболовлі/Номер зони прикормки"), "adding a test zone lists its number");
  const geometry = new ZoneEditorGeometryBuilder({ state: st, map: { currentLocationId: "lake", getRevision: () => 1, getDynamicZones: () => [],
    getLocationZones: () => ({}), getCastableBoundsVirtual: () => ({ left: 0, right: 1000, top: 0, bottom: 1000 }) },
  projector: identity, getWaterMetric: () => flat, config: cfg, dependentZones: zones });
  const annotationFrame = {}; geometry.buildInto(annotationFrame);
  const polygon = annotationFrame.annotations.rects.slice(0, annotationFrame.annotations.rectCount).find(rect => rect.shape === "polygon");
  assert(polygon && polygon.points.length === 130 && polygon.color === 0xdddddd, "the line radius as a polygon record");
  const polyOps = [];
  const fakeGraphics = { clear() { polyOps.length = 0; return this; }, visible: true };
  for (const name of ["rect", "ellipse", "poly", "fill", "stroke", "moveTo", "lineTo"]) fakeGraphics[name] = function () { polyOps.push(name); return this; };
  new PixiAnnotationRenderer({ pixi: { Graphics: function () { return fakeGraphics; } }, stage: { addChild() {} } }).update(annotationFrame.annotations);
  assert(polyOps.includes("poly"), "WebGL draws the polygon");
  const canvasOps = [];
  const canvas = { globalAlpha: 1, drawImage() {}, strokeRect() {}, fillRect() {}, beginPath() {}, moveTo() { canvasOps.push("moveTo"); },
    lineTo() { canvasOps.push("lineTo"); }, closePath() { canvasOps.push("closePath"); }, fill() {}, stroke() {}, ellipse() {} };
  new WorldDebugRenderer({ surface: canvas, sceneRouter: { drawsOnScene: () => false } })
    .render({ visible: true, annotations: annotationFrame.annotations, debugImage: { visible: false }, dynamicZones: { count: 0 } });
  assert(canvasOps.includes("closePath"), "the Canvas fallback draws the same polygon");
  console.log("Castable fishing zones passed: real readings (Net, landing policy, fish trigger), hand chum band and far-line drag into chumCastDistance, line length for the line radius and the game's sector from a draggable conditional float, rod's real position, test chum zones as game chum records (move, resize), game show switches, own section, polygon on both renderers.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
