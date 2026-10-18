const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

const runtime = new SourceRuntime();
const { WorldPerspective } = runtime.importModule("src/game/domain/locations/world_perspective.js");
const { ViewportProjector } = runtime.importModule("src/game/application/viewport/viewport_projector.js");
const { Vector2 } = runtime.importModule("src/engine/math/vector2.js");
const { WaterMetric } = runtime.importModule("src/game/domain/locations/water_metric.js");
const config = {
  baseResolution: { width: 1000, height: 800 },
  cameraFocusY: 0.7,
  map: { lake: { safeZone: { top: 100, bottom: 500 } } },
};
let metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 500, topY: 100, maxMeters: 20, linearShare: .2 });
const perspective = new WorldPerspective({ getWaterMetric: () => metric });
let calls = 0;
const query = (y) => { calls++; return perspective.getPerspective(y); };
const projector = new ViewportProjector(config, "lake", query);
assert.equal(projector.getPerspective, query, "the injected query is used without a wrapper");
assert(projector.getPerspective(0).scale > 0, "finite metres above the water never collapse objects to zero size");
assert.equal(projector.getPerspective(600).scale, 1, "positions below the shore clamp to shore scale");
for (const y of [0, 100, 300, 500, 600]) {
  const sample = projector.getPerspective(y);
  assert.equal(sample.scale, metric.pixelsPerMeterX(y) / 50, "world width follows the physical metre grid");
  assert(Math.abs(sample.scale * sample.squashY - metric.pixelsPerMeterY(y) / 50) < 1e-12,
    "world ground height follows the same metric, without another angle curve");
}
for (const y of [150, 300, 450]) {
  const sample = projector.getPerspective(y), point = { x: 0, y: 0 }, epsilon = 1e-5;
  const meters = metric.metersFromShore(y);
  metric.toVirtual(epsilon, meters, point); const right = point.x;
  metric.toVirtual(-epsilon, meters, point); const left = point.x;
  metric.toVirtual(0, meters - epsilon, point); const near = point.y;
  metric.toVirtual(0, meters + epsilon, point); const far = point.y;
  assert(Math.abs((right - left) / (2 * epsilon * 50) - sample.scale) < 1e-8, "render width equals measured ground-to-map width");
  assert(Math.abs((near - far) / (2 * epsilon * 50) - sample.scale * sample.squashY) < 1e-8,
    "render ground height equals measured ground-to-map height");
}
const screen = new Vector2();
const virtual = new Vector2();
const expected = JSON.stringify(projector.getPerspective(300));
calls = 0;
for (let frame = 0; frame < 120; frame++) {
  projector.update(640 + frame % 7, 360 + frame % 11);
  projector.pan(frame % 3 - 1, frame % 5 - 2);
  projector.focusOnVirtualPos(100 + frame, [0, 8, 16.66, 33, 100][frame % 5]);
  assert.equal(projector.virtualToScreen(300, 250, screen), screen);
  assert.equal(projector.screenToVirtual(screen.x, screen.y, virtual), virtual);
  assert(Math.abs(virtual.x - 300) < 1e-10 && Math.abs(virtual.y - 250) < 1e-10,
    "camera transforms remain inverses using reusable output vectors");
  assert.equal(JSON.stringify(projector.getPerspective(300)), expected,
    "camera movement and viewport size do not own world perspective");
}
assert.equal(calls, 120, "one perspective query per frame; camera operations do not query perspective");
// Spec 105: the first focus after the camera is placed snaps to its target; later focuses ease.
config.map.tall = { safeZone: { top: 0, bottom: 300 }, initialAlignment: { x: "center", y: "top" } };
const opening = new ViewportProjector({ ...config, cameraFocusY: 0.7 }, "tall", query);
opening.update(400, 300);
opening.focusOnVirtualPos(250, 16.66, 0.03);
const focusY = () => opening.virtualToScreen(0, 250, screen).y;
assert(Math.abs(focusY() - 300 * 0.7) < 1e-9, "the game opens on the focus target, not easing toward it");
opening.focusOnVirtualPos(300, 16.66, 0.03);
const eased = opening.virtualToScreen(0, 300, screen).y;
assert(eased > 210 + 1 && eased < 300 - 40, "a later target is still followed smoothly: part of the way per frame");
opening.update(400, 300);
opening.focusOnVirtualPos(300, 16.66, 0.03);
const unchanged = opening.virtualToScreen(0, 300, screen).y;
assert(unchanged < eased && unchanged > 210, "an unchanged canvas size keeps easing");
opening.update(300, 200);
opening.focusOnVirtualPos(300, 16.66, 0.03);
assert(Math.abs(opening.virtualToScreen(0, 300, screen).y - 200 * 0.7) < 1e-9,
  "a resized canvas (a phone turned) opens on the focus target instead of easing toward it");
opening.focusOnVirtualPos(250, 16.66, 0.03);
assert(Math.abs(opening.virtualToScreen(0, 250, screen).y - 200 * 0.7) > 1, "after the resize the camera eases again");
opening.update(400, 300);
opening.pan(-1000);
opening.pan(70);
const centreX = opening.screenToVirtual(200, 0, virtual).x;
opening.update(300, 200);
assert(Math.abs(opening.virtualToScreen(centreX, 0, screen).x - 150) < 1e-9, "a resize keeps the scene point at the centre");
opening.update(2000, 300);
opening.update(300, 200);
assert(Math.abs(opening.virtualToScreen(500, 0, screen).x - 150) < 1e-9,
  "back from a layout that shows the whole width, the camera opens centred, not at the left edge");
metric = new WaterMetric({ pixelsPerMeter: 50, shoreY: 700, topY: 300 });
assert.equal(projector.getPerspective(300).scale, 1, "a live uniform metric replacement reaches the existing perspective query");
assert.equal(projector.getPerspective(300).squashY, 1, "uniform ground has uniform world-object size");

// Spec 098: the landscape split inventory policy.
const { InventorySplitLayoutPolicy } = runtime.importModule("src/game/presentation/viewport/inventory_split_layout_policy.js");
const policy = new InventorySplitLayoutPolicy();
const on = { enabled: true, inventoryShare: 0.7 };
const wide = { settings: on, width: 1280, height: 800, open: true, side: "left" };
const left = policy.resolve(wide);
assert.deepEqual({ ...left }, { active: true, side: "left", inventoryWidth: 896, stageLeft: 896, stageWidth: 384,
  stageHeight: 800 }, "the inventory takes 70% on its side and the game strip the rest");
assert(Object.isFrozen(left));
assert.deepEqual({ ...policy.resolve({ ...wide, side: "right" }) }, { active: true, side: "right", inventoryWidth: 896,
  stageLeft: 0, stageWidth: 384, stageHeight: 800 });
for (const [label, input] of [["switch off", { ...wide, settings: { enabled: false } }], ["closed", { ...wide, open: false }],
  ["820px", { ...wide, width: 820, height: 400 }], ["portrait", { ...wide, width: 900, height: 1400 }],
  ["no side", { ...wide, side: null }]]) {
  const layout = policy.resolve(input);
  assert.equal(layout.active, false, label + " keeps the full-screen inventory");
  assert.equal(layout.stageWidth, input.width, label + " keeps the whole viewport for the game");
}
assert.equal(policy.share({ inventoryShare: 0.95 }), 0.85);
assert.equal(policy.share({ inventoryShare: 0.1 }), 0.2);
assert.equal(policy.resolve({ ...wide, settings: { enabled: true, inventoryShare: 0.3 } }).inventoryWidth, 384,
  "a share under 821px still narrows the inventory (its mobile layout)");
assert.equal(policy.resolve({ ...wide, width: 1000, height: 700, settings: { enabled: true, inventoryShare: 0.2 } })
  .inventoryWidth, 320, "the mobile design's 320px is the floor");
assert.equal(policy.share({ inventoryShare: "x" }), 0.7, "an invalid share uses the default");
assert.equal(policy.sideForRod(300, 1280), "right", "a rod left of the centre sends the inventory right");
assert.equal(policy.sideForRod(640, 1280), "left", "a centred rod sends the inventory left");
assert.equal(policy.sideForRod(1000, 1280), "left");
assert.equal(policy.sideForRod(null, 1280), "right", "without a cast the inventory opens on the default right side");
assert.equal(policy.sideForRod(null, 1280, "left"), "left", "the default side can be left");
assert.equal(policy.sideForRod(null, 1280, "up"), "right", "an invalid default side is right");
assert.equal(policy.sideForRod(300, 1280, "left"), "right", "a cast rod decides over the default side");

// Spec 098: the page stage applies the policy to the canvas, the HUD edges and the inventory surface.
const { GameStageLayout } = runtime.importModule("src/platform/browser/ui/game_stage_layout.js");
const makeNode = () => {
  const value = { classes: new Set(), props: new Map() };
  value.classList = { toggle: (name, enabled) => enabled ? value.classes.add(name) : value.classes.delete(name) };
  value.style = { setProperty: (name, prop) => value.props.set(name, prop), removeProperty: (name) => value.props.delete(name) };
  return value;
};
const stageShell = makeNode();
const stageWindow = { innerWidth: 1280, innerHeight: 800 };
const surfaceProps = new Map();
const surface = { props: surfaceProps,
  setLayoutProperty: (name, value) => value == null ? surfaceProps.delete(name) : surfaceProps.set(name, value) };
const modal = makeNode();
let settings = { enabled: true, inventoryShare: 0.7 }, sourceListener = null, sourceDisposed = 0;
const source = { resolve: () => settings, subscribe(listener) { sourceListener = listener; return () => { sourceListener = null; }; },
  dispose() { sourceDisposed++; } };
const stageListeners = [];
let listenersDisposed = 0;
const lifecycle = { add(target, type, handler) { stageListeners.push({ target, type, handler }); }, dispose() { listenersDisposed++; } };
let visibility = null;
const inventoryUI = { surfaceNode: modal, isOpen: false,
  onVisibilityChange(listener) { visibility = listener; return () => { visibility = null; }; } };
const stage = new GameStageLayout({ shell: stageShell, windowRef: stageWindow, uiSurface: surface, source, policy,
  listeners: lifecycle });
let rodX = 300, splitChanges = 0;
stage.attachInventory(inventoryUI);
stage.attachGame({ getRodScreenX: () => rodX, onSplitChange: () => splitChanges++ });
assert.deepEqual({ ...stage.getViewport() }, { width: 1280, height: 800 }, "closed: the canvas fills the window");
assert.equal(stage.originX, 0);
visibility(true);
assert.equal(splitChanges, 1, "opening the split tells the game once");
assert.deepEqual([stage.layout.side, stage.originX, stage.getViewport().width], ["right", 0, 384],
  "a rod left of the centre keeps the game strip on the left");
assert(stageShell.classes.has("game-shell--staged") && stageShell.props.get("--game-stage-left") === "0px",
  "the page shell places both canvases in the strip (spec 104)");
assert.equal(surface.props.get("--ui-edge-right"), "calc(896px + max(12px, var(--ui-safe-area-right, 0px)))",
  "HUD anchored to the right edge moves to the strip");
assert(!surface.props.has("--ui-edge-left"));
assert.equal(surface.props.get("--ui-stage-center-x"), "192px");
assert(modal.classes.has("inventory-surface--split") && modal.classes.has("inventory-surface--split-right") &&
  modal.props.get("--inventory-split-width") === "896px" && modal.props.get("--ui-logical-width") === "896px",
  "the inventory surface takes its share and reports it as its logical width");
settings = { enabled: true, inventoryShare: 0.6 };
sourceListener();
assert.equal(splitChanges, 2, "a live share edit is a split change");
assert.deepEqual([stage.layout.inventoryWidth, stage.getViewport().width], [768, 512]);
sourceListener();
assert.equal(splitChanges, 2, "an unchanged edit changes nothing");
stageWindow.innerWidth = 1400;
stageListeners.find((entry) => entry.type === "resize").handler();
assert.equal(splitChanges, 2, "a plain window resize keeps the existing resize path");
assert.equal(stage.layout.inventoryWidth, 840);
rodX = 1000;
visibility(false);
assert.equal(splitChanges, 3, "closing tells the game");
assert(!stage.layout.active && !stageShell.classes.has("game-shell--staged") && stageShell.props.size === 0 &&
  surface.props.size === 0 && modal.props.size === 0 && !modal.classes.has("inventory-surface--split"),
  "closing restores the full-screen page");
visibility(true);
assert.deepEqual([stage.layout.side, stage.originX], ["left", 840], "a rod right of the centre keeps the strip on the right");
assert(surface.props.has("--ui-edge-left") && !surface.props.has("--ui-edge-right"));
assert(modal.classes.has("inventory-surface--split-left"));
visibility(false);
rodX = null;
settings = { enabled: true, inventoryShare: 0.7, defaultSide: "left" };
visibility(true);
assert.deepEqual([stage.layout.side, stage.originX], ["left", 980], "an uncast rod opens on the configured default side");
visibility(false);
settings = { enabled: true, inventoryShare: 0.7 };
visibility(true);
assert.equal(stage.layout.side, "right", "the default side is right");
stage.dispose();
assert.deepEqual([sourceDisposed, listenersDisposed, sourceListener, visibility], [1, 1, null, null],
  "the stage disposes its source, listeners and subscriptions");
assert(!stageShell.classes.has("game-shell--staged") && modal.props.size === 0);

// Spec 098: the DEV source reacts to CONFIG.debug edits only.
const { DevInventorySplitSource } = runtime.importModule("src/dev/runtime/dev_inventory_split_source.js");
const { EventLifecycle } = runtime.importModule("src/engine/events/event_lifecycle.js");
const documentHandlers = new Map();
const documentRef = { addEventListener: (type, handler) => documentHandlers.set(type, handler),
  removeEventListener: (type) => documentHandlers.delete(type) };
const devConfig = { debug: { inventorySplit: { enabled: false, inventoryShare: 0.7 } } };
const devSource = new DevInventorySplitSource({ config: devConfig, documentRef, listeners: new EventLifecycle() });
assert.deepEqual({ ...devSource.resolve() }, { enabled: false, inventoryShare: 0.7, defaultSide: undefined });
let devChanges = 0;
devSource.subscribe(() => devChanges++);
const emit = (detail) => documentHandlers.get("config-updated")({ detail });
emit({ path: ["CONFIG", "debug", "inventorySplit", "enabled"] });
emit({ path: ["CONFIG", "ui", "rod", "x"] });
emit({ path: ["CONFIG"], resetAll: true });
assert.equal(devChanges, 2, "debug edits and a reset reach the stage; other config edits do not");
devConfig.debug.inventorySplit.enabled = true;
assert.equal(devSource.resolve().enabled, true, "live values are read on demand");
devSource.dispose();
assert(!documentHandlers.has("config-updated"), "dispose removes the config listener");

// Spec 098: a split change keeps the rod's world position and pans the camera to the new canvas centre.
const { GameViewportFacade } = runtime.importModule("src/game/presentation/viewport/game_viewport_facade.js");
const stripConfig = { baseResolution: { width: 1000, height: 800 }, cameraFocusY: 0.7,
  map: { lake: { safeZone: { top: 100, bottom: 500 } } } };
const stripProjector = new ViewportProjector(stripConfig, "lake", () => ({ scale: 1 }));
const metrics = { width: 640, height: 360 };
stripProjector.update(metrics.width, metrics.height);
const facade = new GameViewportFacade({ rodVisualOffsetSystem: new (runtime.importModule("src/game/application/fishing/rod_visual_offset_system.js").RodVisualOffsetSystem)(), world: { pan: (dx, dy) => stripProjector.pan(dx, dy) }, projector: stripProjector,
  canvasMetrics: metrics, config: { ui: { rod: { x: "center" } } }, biteEnvironmentService: {} });
const castRodX = 500;
const rodWorldX = facade.rodAnchorVirtualX(castRodX);
metrics.width = 192;
stripProjector.update(metrics.width, metrics.height);
const stripRodX = facade.recenterRod(rodWorldX);
assert(Math.abs(stripRodX - 96) < 1e-9, "the rod stands at the strip centre");
assert(Math.abs(stripProjector.screenToVirtual(stripRodX, 0).x - rodWorldX) < 1e-9, "the rod keeps its world position");
// As in GameApplication: the anchor is read before the projector learns the new canvas size.
const anchorAgain = facade.rodAnchorVirtualX(stripRodX);
assert(Math.abs(anchorAgain - rodWorldX) < 1e-9);
metrics.width = 640;
stripProjector.update(metrics.width, metrics.height);
const wideRodX = facade.recenterRod(anchorAgain);
assert(Math.abs(stripProjector.screenToVirtual(wideRodX, 0).x - rodWorldX) < 1e-9, "closing keeps the world position too");
const edgeWorldX = 5;
metrics.width = 192;
stripProjector.update(metrics.width, metrics.height);
const edgeRodX = facade.recenterRod(edgeWorldX);
assert(edgeRodX < 96 && Math.abs(stripProjector.screenToVirtual(edgeRodX, 0).x - edgeWorldX) < 1e-9,
  "at the map edge the camera stops and the rod keeps its world position off centre");

console.log("Viewport passed: perspective boundaries/live config, 120 camera frames, one query per frame and reused function/vector identities; split inventory policy, stage, DEV source and rod recentring.");

