"use strict";

// Specs 103 and 104 (stages 0 and 1): the WebGL scene layer port (inactive in "canvas" mode), the lazy layer, the
// router (depth order, mode, availability, fallback), PixiSceneLayer over a fake Pixi namespace (warm-up, activity,
// context loss, DEV status, dispose), the coordinator's routing per frame, the 2D surface's clear, the production
// composition (config mode, DEV override, transparent canvas, a real no-WebGL fallback in Node), the 2D gates, the
// DEV section, the runtime module, the CSS, the vendored bundle and a production graph that loads Pixi only lazily.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const acorn = require("acorn");

const ROOT_DIR = path.resolve(__dirname, "..");
const RUNTIME_MODULE = "src/platform/browser/scene/pixi_runtime_module.js";
const SCENE_COMPOSITION = "src/bootstrap/production/scene_layer_composition.js";
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);
const read = (file) => fs.readFileSync(path.join(ROOT_DIR, file), "utf8");
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fakeElement(tagName) {
  const listeners = new Map();
  const classes = new Set();
  return {
    tagName, className: "", attributes: {}, style: {}, removed: false, width: 0, height: 0, listeners, classes,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.({ type }); },
    remove() { this.removed = true; },
  };
}

function fakeDom() {
  const inserted = [];
  const documentTarget = { createElement: (tagName) => fakeElement(tagName) };
  const gameCanvas = Object.assign(fakeElement("canvas"), { before: (element) => inserted.push(element) });
  return { documentTarget, gameCanvas, inserted };
}

// A Pixi namespace whose Application records init options, renders, resizes and destroys; init is held open. Its GL
// context has WEBGL_lose_context, which dispatches the canvas events like a browser would.
function fakePixi() {
  const apps = [];
  class Application {
    constructor() {
      this.initCall = deferred();
      this.renders = 0;
      this.resizes = [];
      this.destroyed = null;
      apps.push(this);
    }

    init(options) {
      this.options = options;
      const canvas = options.canvas;
      const size = (width, height, resolution) => {
        canvas.width = Math.round(width * resolution);
        canvas.height = Math.round(height * resolution);
      };
      size(options.width, options.height, options.resolution);
      const loseContext = { loseContext: () => canvas.dispatch("webglcontextlost"),
        restoreContext: () => canvas.dispatch("webglcontextrestored") };
      this.renderer = { canvas, context: { webGLVersion: 2 }, resize: (...args) => { this.resizes.push(args); size(...args); },
        gl: { getExtension: (name) => (name === "WEBGL_lose_context" ? loseContext : null) } };
      return this.initCall.promise;
    }

    render() { this.renders += 1; }

    destroy(...args) { this.destroyed = args; }
  }
  return { pixi: { Application }, apps };
}

function recordingProbe() {
  const calls = [];
  return { calls, beginFrame() {}, begin: (id) => calls.push(["begin", id]), end: (id) => calls.push(["end", id]),
    gauge: (id, value) => calls.push(["gauge", id, value]), endFrame() {} };
}

async function checkPorts() {
  const { InactiveSceneLayer, SCENE_LAYER_METHODS } = await importSource("src/engine/scene/inactive_scene_layer.js");
  const { FRAME_SECTIONS, FRAME_GAUGES } = await importSource("src/engine/diagnostics/inactive_frame_probe.js");
  assert.deepEqual(SCENE_LAYER_METHODS, ["render", "isActive", "whenReady", "getStatus", "loseContext", "restoreContext",
    "dispose"]);
  const inactive = new InactiveSceneLayer();
  for (const method of SCENE_LAYER_METHODS) assert.equal(typeof inactive[method], "function", `inactive ${method}`);
  assert.equal(inactive.isActive(), false);
  assert.equal(await inactive.whenReady(), false, "the inactive layer never renders, so startup does not wait");
  assert.deepEqual(inactive.getStatus(), { state: "inactive" });
  assert.equal(FRAME_SECTIONS.scene, "scene");
  assert.equal(FRAME_GAUGES.scenePixels, "scene-pixels");

  const { DeferredSceneLayer } = await importSource("src/engine/scene/deferred_scene_layer.js");
  assert.throws(() => new DeferredSceneLayer({ onUnavailable() {} }), /requires load/u);
  assert.throws(() => new DeferredSceneLayer({ load() {} }), /requires onUnavailable/u);
  const frames = [];
  const calls = [];
  let disposals = 0;
  let active = true;
  const layerReady = deferred();
  const loaded = { render: (frame) => frames.push(frame), isActive: () => active, whenReady: () => layerReady.promise,
    getStatus: () => ({ state: "active" }), loseContext: () => calls.push("lose"), restoreContext: () => calls.push("restore"),
    dispose: () => { disposals += 1; } };
  const gate = deferred();
  const unavailable = [];
  const layer = new DeferredSceneLayer({ load: () => gate.promise, onUnavailable: (error) => unavailable.push(error) });
  layer.render("before");
  assert.deepEqual([layer.isActive(), layer.getStatus().state], [false, "loading"], "inactive while the runtime loads");
  let readyValue = null;
  const ready = layer.whenReady().then((value) => { readyValue = value; });
  gate.resolve(loaded);
  await settle();
  assert.equal(readyValue, null, "whenReady waits for the loaded layer's warm-up, not only for the import");
  layerReady.resolve(true);
  await ready;
  assert.equal(readyValue, true);
  layer.render("frame-1");
  assert.deepEqual(frames, ["frame-1"], "nothing is drawn before the layer arrives, every frame after");
  assert.equal(layer.isActive(), true);
  active = false;
  assert.equal(layer.isActive(), false, "activity is the loaded layer's (a lost context)");
  layer.loseContext();
  layer.restoreContext();
  assert.deepEqual([calls, layer.getStatus().state], [["lose", "restore"], "active"], "DEV methods reach the layer");
  layer.dispose();
  layer.render("after");
  assert.deepEqual([frames.length, disposals, layer.getStatus().state], [1, 1, "disposed"]);

  const late = deferred();
  const early = new DeferredSceneLayer({ load: () => late.promise, onUnavailable: (error) => unavailable.push(error) });
  early.dispose();
  late.resolve(loaded);
  assert.equal(await early.whenReady(), false);
  assert.equal(disposals, 2, "a layer that arrives after dispose is disposed at once");

  const failed = new DeferredSceneLayer({ load: () => Promise.reject(new Error("no bundle")), onUnavailable: (error) => unavailable.push(error) });
  assert.equal(await failed.whenReady(), false);
  assert.deepEqual([failed.isActive(), failed.getStatus().state], [false, "unavailable"]);
  const invalid = new DeferredSceneLayer({ load: () => ({ render() {} }), onUnavailable: (error) => unavailable.push(error) });
  assert.equal(await invalid.whenReady(), false);
  assert.deepEqual(unavailable.map((error) => error.message), ["no bundle", "DeferredSceneLayer: the loaded layer lacks isActive"]);
  failed.render("frame");
  failed.loseContext();
  failed.dispose();
}

async function checkRouter() {
  const { SceneLayerRouter, SCENE_KINDS, SCENE_MODES } = await importSource("src/game/presentation/rendering/scene_layer_router.js");
  assert.deepEqual(SCENE_KINDS, ["background", "world-entities", "fight-areas", "line", "rod", "float"],
    "world kinds in depth order, bottom first");
  assert.deepEqual(SCENE_MODES, ["canvas", "webgl"]);
  let active = true;
  const create = (options) => new SceneLayerRouter({ kinds: SCENE_KINDS, sceneKinds: [], isSceneActive: () => active,
    mode: "webgl", ...options });
  assert.throws(() => create({ kinds: ["a", "a"] }), /unique kinds/u);
  assert.throws(() => create({ sceneKinds: ["water"] }), /scene kinds from its kinds/u);
  assert.throws(() => create({ isSceneActive: null }), /requires isSceneActive/u);
  assert.throws(() => create({ mode: "gl" }), /mode must be one of canvas, webgl/u);
  const onCanvas = (router) => SCENE_KINDS.filter((kind) => !router.drawsOnScene(kind));

  const stageOne = create();
  stageOne.update();
  assert.equal(stageOne.rendersScene(), false, "an active scene with no kind on it keeps its warm-up frame (rule 22)");
  assert.deepEqual(onCanvas(stageOne), SCENE_KINDS, "stage 1: no scene renderer, every kind on the 2D canvas");
  assert.equal(stageOne.clearsCanvas(), false, "the 2D background still paints every pixel: no clear");

  const router = create({ sceneKinds: ["background", "line"] });
  const visibility = router.canvasVisibility("background");
  assert.equal(router.canvasVisibility("background"), visibility, "one visibility function per kind");
  assert.throws(() => router.canvasVisibility("hud"), /has no kind hud/u);
  assert.equal(visibility({ visible: true }), true, "before the first update everything is on the 2D canvas");
  router.update();
  assert.equal(router.rendersScene(), true, "a kind on the scene makes it draw every frame");
  assert.deepEqual(router.getRouting().filter((entry) => entry.layer === "scene").map((entry) => entry.kind), ["background"],
    "the line stays on the 2D canvas while world entities and fight areas under it do (rule 14)");
  assert.deepEqual(router.getRouting()[3], { kind: "line", layer: "canvas", sceneRenderer: true });
  assert.equal(visibility({ visible: true }), false, "the background's 2D component steps aside");
  assert.equal(router.canvasVisibility("line")({ visible: true }), true);
  assert.equal(router.canvasVisibility("line")({ visible: false }), false, "the component's own visibility still counts");
  assert.equal(router.clearsCanvas(), true, "with the background on the scene the 2D canvas starts cleared");

  active = false;
  assert.equal(router.drawsOnScene("background"), true, "a decision holds for the whole frame");
  router.update();
  assert.deepEqual([router.rendersScene(), onCanvas(router), router.clearsCanvas()], [false, SCENE_KINDS, false],
    "a lost context sends every kind back to the 2D canvas at the next frame (fallback)");
  active = true;
  router.setMode("canvas");
  router.update();
  assert.deepEqual([router.mode, router.rendersScene(), onCanvas(router)], ["canvas", false, SCENE_KINDS],
    "the DEV switch draws everything on the 2D canvas and stops the scene");
  router.setMode("webgl");
  router.update();
  assert.equal(router.drawsOnScene("background"), true, "and back");
  const canvasMode = create({ sceneKinds: ["background"], mode: "canvas" });
  canvasMode.update();
  assert.equal(canvasMode.rendersScene(), false);
}

async function checkPixiSceneLayer() {
  const { PixiSceneLayer } = await importSource("src/platform/browser/scene/pixi_scene_layer.js");
  const metrics = { width: 400, height: 800, pixelRatio: 2 };
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };
  const compose = (overrides = {}) => {
    const dom = fakeDom();
    const { pixi, apps } = fakePixi();
    const probe = recordingProbe();
    const options = { pixi, documentTarget: dom.documentTarget, gameCanvas: dom.gameCanvas, canvasMetrics: metrics,
      background: "#0f171e", probe, logger, ...overrides };
    return { layer: new PixiSceneLayer(options), dom, apps, probe };
  };
  for (const [name, overrides, pattern] of [
    ["pixi", { pixi: {} }, /requires the Pixi namespace/u],
    ["game canvas", { gameCanvas: {} }, /requires the game canvas/u],
    ["metrics", { canvasMetrics: null }, /requires canvasMetrics/u],
    ["probe", { probe: undefined }, /requires probe/u],
  ]) assert.throws(() => compose(overrides), pattern, `PixiSceneLayer validates ${name}`);

  const { layer, dom, apps, probe } = compose();
  const canvas = dom.inserted[0];
  assert.equal(dom.inserted.length, 1, "one scene canvas, inserted right before the game canvas");
  assert.deepEqual([canvas.tagName, canvas.className, canvas.attributes["aria-hidden"]], ["canvas", "game-shell__scene", "true"]);
  assert(dom.gameCanvas.classes.has("game-shell__canvas--over-scene"), "the game canvas drops its CSS background");
  assert.deepEqual([...canvas.listeners.keys()].sort(), ["webglcontextlost", "webglcontextrestored"]);
  const app = apps[0];
  assert.deepEqual({ ...app.options, preference: [...app.options.preference] }, {
    autoStart: false, sharedTicker: false, skipExtensionImports: true, eventMode: "none", autoDensity: false,
    preference: ["webgl"], gcActive: false, canvas, width: 400, height: 800, resolution: 2, background: "#0f171e",
  }, "no ticker, events, browser extensions, auto density, WebGPU or GC; size and ratio from the metrics owner");
  layer.render({});
  assert.deepEqual([app.renders, layer.isActive(), layer.getStatus()], [0, false, { state: "starting" }],
    "nothing renders and the router sees no scene before init resolves");
  app.initCall.resolve();
  assert.equal(await layer.whenReady(), true);
  assert.equal(app.renders, 1, "one warm-up render before the layer reports ready (spec 104 D8)");
  assert.deepEqual([canvas.style.width, canvas.style.height], ["400px", "800px"], "CSS size = logical size");
  assert.deepEqual(probe.calls, [["gauge", "scene-pixels", 800 * 1600]], "the backing pixels reach the frame probe");
  assert.deepEqual([layer.isActive(), layer.getStatus()],
    [true, { state: "active", webglVersion: 2, width: 400, height: 800, pixelRatio: 2 }]);

  for (let frame = 0; frame < 3; frame += 1) layer.render({});
  assert.deepEqual([app.renders, app.resizes.length], [4, 0], "one render per frame, no resize while nothing changes");
  metrics.width = 800;
  metrics.height = 400;
  layer.render({});
  layer.render({});
  assert.deepEqual(app.resizes, [[800, 400, 2]], "a rotation resizes once, in logical pixels with the ratio");
  assert.deepEqual([canvas.style.width, canvas.style.height, canvas.width, canvas.height], ["800px", "400px", 1600, 800]);
  metrics.pixelRatio = 1.5;
  layer.render({});
  assert.deepEqual(app.resizes.at(-1), [800, 400, 1.5], "a pixel ratio change resizes too");
  assert.deepEqual(probe.calls.at(-1), ["gauge", "scene-pixels", 1200 * 600]);

  layer.loseContext();
  layer.render({});
  assert.deepEqual([app.renders, layer.isActive(), layer.getStatus().state], [7, false, "context-lost"],
    "a lost context skips rendering and makes the layer inactive, so the router falls back to the 2D canvas");
  layer.restoreContext();
  layer.render({});
  assert.deepEqual([app.renders, layer.isActive()], [8, true], "rendering resumes when the context is restored");
  canvas.dispatch("webglcontextlost");
  assert.equal(layer.isActive(), false, "a context lost by the browser counts the same");
  canvas.dispatch("webglcontextrestored");

  layer.dispose();
  layer.dispose();
  layer.render({});
  assert.equal(app.renders, 8);
  assert.deepEqual(app.destroyed, [{ removeView: false }, { children: true }]);
  assert.deepEqual([canvas.removed, canvas.listeners.size, dom.gameCanvas.classes.size, layer.getStatus().state],
    [true, 0, 0, "disposed"], "dispose removes the canvas, its listeners and the game canvas modifier");

  const failing = compose();
  failing.apps[0].initCall.reject(new Error("WebGL unsupported"));
  assert.equal(await failing.layer.whenReady(), false);
  assert.equal(warnings.length, 1, "no WebGL is reported once");
  assert.match(warnings[0][0], /2D canvas stays alone/u);
  assert.deepEqual([failing.dom.inserted[0].removed, failing.dom.gameCanvas.classes.size, failing.layer.getStatus().state],
    [true, 0, "unavailable"], "a layer that cannot render leaves no canvas or modifier behind");
  failing.layer.dispose();
  assert.equal(failing.layer.getStatus().state, "unavailable");

  const early = compose();
  early.layer.dispose();
  early.apps[0].initCall.resolve();
  assert.equal(await early.layer.whenReady(), false);
  assert.deepEqual([early.apps[0].destroyed !== null, early.apps[0].renders, warnings.length], [true, 0, 1],
    "an Application that finishes init after dispose is destroyed, silently");
}

async function checkCoordinator() {
  const { GameRenderCoordinator } = await importSource("src/game/presentation/rendering/game_render_coordinator.js");
  const order = [];
  const frame = { id: "frame" };
  let rendersScene = true;
  const ports = {
    stateMachine: { getRenderState() {} },
    frameBuffer: { acquire: () => frame },
    frameBuilder: { buildInto: () => order.push("build") },
    pipeline: { render: (value) => { assert.equal(value, frame); order.push("2d"); } },
    sceneLayer: { render: (value) => { assert.equal(value, frame); order.push("scene"); } },
    sceneRouter: { update: () => order.push("route"), rendersScene: () => rendersScene },
    probe: { begin: (id) => order.push(`+${id}`), end: (id) => order.push(`-${id}`) },
    getBounds: () => ({}), getInvalidCastMarker: () => null, isDebugEnabled: () => false,
    beginFrame: () => order.push("begin-2d"),
  };
  assert.throws(() => new GameRenderCoordinator({ ...ports, sceneLayer: {} }), /requires sceneLayer/u);
  assert.throws(() => new GameRenderCoordinator({ ...ports, sceneRouter: {} }), /requires sceneRouter/u);
  assert.throws(() => new GameRenderCoordinator({ ...ports, probe: undefined }), /requires a frame probe/u);
  const coordinator = new GameRenderCoordinator(ports);
  assert.equal(coordinator.render(0.016), frame);
  assert.deepEqual(order, ["build", "route", "+scene", "scene", "-scene", "begin-2d", "2d"],
    "one routing decision, then the scene inside its probe section, then every 2D pass");
  order.length = 0;
  rendersScene = false;
  coordinator.render(0.016);
  assert.deepEqual(order, ["build", "route", "begin-2d", "2d"], "no scene work while the router keeps it off");
}

async function checkSurfaceClear() {
  const { Canvas2DSurface } = await importSource("src/platform/browser/canvas/canvas_2d_surface.js");
  const calls = [];
  const context = { setTransform: (...args) => calls.push(["setTransform", ...args]),
    clearRect: (...args) => calls.push(["clearRect", ...args]), set imageSmoothingEnabled(value) {} };
  const canvas = { width: 800, height: 1600, getContext: (type, attributes) => { calls.push(["getContext", attributes]); return context; } };
  const surface = new Canvas2DSurface(canvas, { contextAttributes: { alpha: true }, resolution: { width: 400, height: 800, pixelRatio: 2 } });
  surface.beginFrame();
  surface.beginFrame(true);
  assert.deepEqual(calls, [["getContext", { alpha: true }], ["setTransform", 2, 0, 0, 2, 0, 0],
    ["setTransform", 1, 0, 0, 1, 0, 0], ["clearRect", 0, 0, 800, 1600], ["setTransform", 2, 0, 0, 2, 0, 0]],
    "a cleared frame clears the whole backing store, then applies the base transform");
}

async function checkComposition() {
  const { composeSceneLayer } = await importSource(SCENE_COMPOSITION);
  const { InactiveSceneLayer } = await importSource("src/engine/scene/inactive_scene_layer.js");
  const { DeferredSceneLayer } = await importSource("src/engine/scene/deferred_scene_layer.js");
  const { CONFIG } = await importSource("src/game/config/runtime/game_config.js");
  assert.equal(CONFIG.canvas.scene, "canvas", "production stays on the 2D canvas until stage 2 is measured (D1)");
  const warnings = [];
  const options = (overrides) => {
    const dom = fakeDom();
    return { dom, value: { config: { canvas: { scene: "canvas", backgroundColor: "#0f171e" } }, documentTarget: dom.documentTarget,
      gameCanvas: dom.gameCanvas, canvasMetrics: { width: 4, height: 4, pixelRatio: 1 }, probe: recordingProbe(),
      logger: { warn: (...args) => warnings.push(args) }, ...overrides } };
  };
  const canvasMode = composeSceneLayer(options({}).value);
  assert(canvasMode.sceneLayer instanceof InactiveSceneLayer);
  assert.deepEqual([canvasMode.sceneRouter.mode, canvasMode.transparentCanvas], ["canvas", false],
    "\"canvas\": inactive layer, opaque 2D canvas, no Pixi download");
  const typo = composeSceneLayer(options({ modeOverride: "gl" }).value);
  assert.deepEqual([typo.sceneRouter.mode, warnings.length], ["canvas", 1], "an unknown ?scene= keeps the config and warns");
  assert.match(warnings[0][0], /Unknown scene mode "gl"/u);

  const { dom, value } = options({ modeOverride: "webgl" });
  const webgl = composeSceneLayer(value);
  assert(webgl.sceneLayer instanceof DeferredSceneLayer);
  assert.deepEqual([webgl.sceneRouter.mode, webgl.transparentCanvas], ["webgl", true]);
  // The real runtime module and Pixi bundle in Node: no WebGL, so the layer never becomes active.
  assert.equal(await webgl.sceneLayer.whenReady(), false, "startup does not hang without WebGL");
  webgl.sceneRouter.update();
  assert.deepEqual([webgl.sceneRouter.rendersScene(), webgl.sceneLayer.getStatus().state, dom.inserted[0].removed],
    [false, "unavailable", true], "without WebGL every kind stays on the 2D canvas and no scene canvas is left");
  assert.equal(warnings.length, 2, "the missing WebGL is reported once");
  webgl.sceneLayer.dispose();

  const renderComposition = read("src/bootstrap/production/game_render_composition.js");
  const { SCENE_KINDS } = await importSource("src/game/presentation/rendering/scene_layer_router.js");
  for (const kind of SCENE_KINDS) {
    assert(renderComposition.includes(`sceneRouter.canvasVisibility("${kind}")`), `the ${kind} 2D component is gated`);
  }
  assert.match(renderComposition, /surface\.beginFrame\(runtime\.rendering\.sceneRouter\.clearsCanvas\(\)\)/u);
  const root = read("src/bootstrap/production/game_composition_root.js");
  assert.match(root, /contextAttributes: \{ alpha: transparentCanvas \}/u, "the scene mode decides the 2D canvas alpha");
  assert.match(root, /await sceneLayer\.whenReady\(\);/u, "startup waits for the scene's warm-up frame");
  assert.match(root, /shell: this\.#documentTarget\.body/u, "the split stage places both canvases through the shell");
}

async function checkRuntimeModule(manifestEntry) {
  const { createPixiRuntime } = await importSource(RUNTIME_MODULE);
  const pixi = await importSource(manifestEntry.file);
  const runtime = createPixiRuntime();
  assert.equal(runtime.version, manifestEntry.version, "the manifest pins the runtime the module reports");
  for (const name of ["system", "shared"]) {
    assert.equal(pixi.Ticker[name].autoStart, false, `Ticker.${name} never starts a frame loop`);
    assert.equal(pixi.Ticker[name].started, false);
  }
  assert.deepEqual(Object.keys(pixi).sort(), manifestEntry.exports, "the bundle exports exactly the manifest's list");
}

async function checkDevWiring() {
  const startup = read("src/bootstrap/development/development_game_startup.js");
  assert.match(startup, /sceneMode: pageParams\.get\("scene"\)/u, "dev.html?scene= picks the mode for the page load");
  assert.doesNotMatch(read("src/bootstrap/production/game.js") + read("src/entrypoints/game.entry.js"), /sceneMode/u,
    "production reads CONFIG.canvas.scene only");
  const { SceneLayerDevSection } = await importSource("src/dev/tools/scene_layer_dev_section.js");
  const { SceneLayerRouter, SCENE_KINDS } = await importSource("src/game/presentation/rendering/scene_layer_router.js");
  const rows = [];
  const actions = new Map();
  let switchHandler = null;
  const ui = {
    createInfoRow: (label, value) => rows.push(`${label}: ${value}`),
    createSwitcherRow: (label, value, parent, onChange) => { rows.push(`${label}: ${value}`); switchHandler = onChange; },
    createButtonRow: (label, parent, onClick) => { rows.push(label); actions.set(label, onClick); },
  };
  const content = { replaceChildren: () => { rows.length = 0; actions.clear(); } };
  const layerCalls = [];
  let status = { state: "active", webglVersion: 2, width: 400, height: 800, pixelRatio: 2 };
  const layer = { getStatus: () => status, loseContext: () => layerCalls.push("lose"), restoreContext: () => layerCalls.push("restore") };
  const router = new SceneLayerRouter({ kinds: SCENE_KINDS, sceneKinds: [], isSceneActive: () => true, mode: "webgl" });
  router.update();
  new SceneLayerDevSection({ ui, scene: { layer, router }, createSection: () => content }).render({});
  assert(rows.includes("шар WebGL: активний") && rows.includes("рендерер: WebGL 2 · 400×800 @ 2×"));
  assert(rows.includes("background: 2D (рендерера сцени ще немає)"), "the routing per kind is shown");
  switchHandler(false);
  assert.equal(router.mode, "canvas", "the switch flips the router without a reload");
  actions.get("Втратити WebGL-контекст")();
  actions.get("Відновити WebGL-контекст")();
  assert.deepEqual(layerCalls, ["lose", "restore"]);
  status = { state: "inactive" };
  actions.get("↻ Оновити")();
  assert(rows[0].startsWith("шар WebGL: немає: режим canvas"));
  assert(!rows.some((row) => row.startsWith("Сцена WebGL")) && !actions.has("Втратити WebGL-контекст"),
    "\"canvas\" mode shows no switch and no context buttons");
}

// The production page reaches Pixi only through the lazy import in the scene composition ("webgl" mode).
function checkProductionGraph() {
  const staticGraph = new Set();
  const lazyImporters = [];
  const queue = [["src/entrypoints/game.entry.js", false]];
  while (queue.length > 0) {
    const [file, lazy] = queue.pop();
    if (!file.endsWith(".js") || staticGraph.has(file)) continue;
    if (!lazy) staticGraph.add(file);
    if (lazy || file.startsWith("vendor/")) continue;
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      const source = node.source ?? null;
      if (source?.type === "Literal" && typeof source.value === "string" && source.value.startsWith(".")) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), source.value));
        if (node.type === "ImportExpression") lazyImporters.push([file, target]);
        else queue.push([target, false]);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    };
    visit(acorn.parse(read(file), { ecmaVersion: "latest", sourceType: "module" }));
  }
  assert(staticGraph.has(SCENE_COMPOSITION) && staticGraph.has("src/game/presentation/rendering/scene_layer_router.js"));
  assert.deepEqual([...staticGraph].filter((file) => file.includes("/scene/pixi_") || file.startsWith("vendor/pixi/")), [],
    "index.html loads no Pixi module statically");
  assert.deepEqual(lazyImporters.filter(([, target]) => target.includes("/scene/pixi_")), [[SCENE_COMPOSITION, RUNTIME_MODULE]],
    "the only way to Pixi is the scene composition's lazy import");
  return staticGraph.size;
}

function checkCss() {
  const css = read("src/game/presentation/styles/game-shell.css");
  const rule = (selector) => css.match(new RegExp(`${selector.replace(/[.]/gu, "\\.")} \\{([^}]*)\\}`, "u"))?.[1] ?? "";
  for (const [selector, declarations] of [
    [".game-shell__scene", ["position: fixed;", "inset: 0;", "z-index: -1;", "margin: auto;", "pointer-events: none;"]],
    [".game-shell__canvas--over-scene", ["background-color: transparent;"]],
    [".game-shell--staged .game-shell__canvas", ["position: fixed;", "top: 0;", "left: var(--game-stage-left, 0px);"]],
    [".game-shell--staged .game-shell__scene", ["inset: 0 auto auto var(--game-stage-left, 0px);", "margin: 0;"]],
  ]) {
    for (const declaration of declarations) assert(rule(selector).includes(declaration), `${selector} declares ${declaration}`);
  }
}

function checkVendor() {
  const manifest = JSON.parse(read("vendor/manifest.json"));
  assert.deepEqual(manifest.packages.map((entry) => entry.name), ["@esotericsoftware/spine-webgl", "pixi.js"],
    "one manifest, written by utils/vendor-libraries.js, holds both libraries");
  const entry = manifest.packages[1];
  assert.equal(entry.importer, RUNTIME_MODULE, "the runtime module is the bundle's single importer");
  assert.equal(entry.file, `vendor/pixi/${entry.version}/pixi-scene.js`);
  for (const name of ["@esotericsoftware/spine-pixi-v8@4.3.13", "@esotericsoftware/spine-core@4.3.13"]) {
    assert(entry.bundles.includes(name), `the bundle records ${name}`);
  }
  const bundle = read(entry.file);
  const imports = [];
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (["ImportDeclaration", "ImportExpression"].includes(node.type) || node.source) imports.push(node.type);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === "string") visit(value);
    }
  };
  visit(acorn.parse(bundle, { ecmaVersion: "latest", sourceType: "module" }));
  assert.deepEqual(imports, [], "the bundle has no import, re-export or import() left");
  const license = read(entry.license);
  for (const text of ["Spine Runtimes License Agreement", "pixi.js@8.22.0 (MIT)", "Copyright (c) 2020 Vlad Shilov"]) {
    assert(license.includes(text), `the licence file includes ${text}`);
  }
  const tracked = spawnSync("git", ["ls-files", "--", entry.file, entry.license], { cwd: ROOT_DIR, encoding: "utf8" })
    .stdout.split(/\r?\n/u).filter(Boolean);
  assert.deepEqual(tracked.sort(), [entry.file, entry.license].sort(), "the bundle and its licence are tracked (Pages)");
  return { entry, size: Buffer.byteLength(bundle) };
}

async function main() {
  await checkPorts();
  await checkRouter();
  await checkPixiSceneLayer();
  await checkCoordinator();
  await checkSurfaceClear();
  const { entry, size } = checkVendor();
  await checkComposition();
  await checkRuntimeModule(entry);
  await checkDevWiring();
  const productionModules = checkProductionGraph();
  checkCss();
  await settle();
  console.log(`Scene layer passed: port and lazy layer (warm-up wait, late arrival, failure), router (depth order, `
    + `mode switch, fallback on a lost context, 2D clear), PixiSceneLayer over a fake Pixi (no ticker/events/GC, warm-up, `
    + `resize only on change, context loss and restore, DEV status, dispose), one routing decision per frame, `
    + `"canvas"/"webgl" composition with a real no-WebGL fallback, every world kind gated on the 2D canvas, DEV `
    + `section, runtime ${entry.version} with stopped tickers, CSS, bundle (${size} bytes), ${productionModules} `
    + `production modules loading Pixi only lazily.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
