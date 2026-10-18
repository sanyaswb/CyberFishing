"use strict";

// Spec 103 stage 0: the WebGL scene layer port (inactive in production), the lazy DEV layer, PixiSceneLayer over a fake
// Pixi namespace (async init, one render per frame, resize only on change, context loss, dispose), the coordinator
// drawing the scene before the 2D passes, the real runtime module (version, stopped tickers), the DEV flag, the scene
// canvas CSS, the vendor manifest entry and the self-contained bundle, and a production graph without Pixi.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const acorn = require("acorn");

const ROOT_DIR = path.resolve(__dirname, "..");
const RUNTIME_MODULE = "src/platform/browser/scene/pixi_runtime_module.js";
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
  return {
    tagName, className: "", attributes: {}, style: {}, removed: false, width: 0, height: 0, listeners,
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
  const gameCanvas = { before: (element) => inserted.push(element) };
  return { documentTarget, gameCanvas, inserted };
}

// A Pixi namespace whose Application records init options, renders, resizes and destroys; init is held open.
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
      this.renderer = { canvas, resize: (...args) => { this.resizes.push(args); size(...args); } };
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
  assert.deepEqual(SCENE_LAYER_METHODS, ["render", "dispose"]);
  const inactive = new InactiveSceneLayer();
  for (const method of SCENE_LAYER_METHODS) assert.equal(inactive[method]({}), undefined, `inactive ${method} does nothing`);
  assert.equal(FRAME_SECTIONS.scene, "scene");
  assert.equal(FRAME_GAUGES.scenePixels, "scene-pixels");

  const { DeferredSceneLayer } = await importSource("src/engine/scene/deferred_scene_layer.js");
  assert.throws(() => new DeferredSceneLayer({ onUnavailable() {} }), /requires load/u);
  assert.throws(() => new DeferredSceneLayer({ load() {} }), /requires onUnavailable/u);
  const frames = [];
  let disposals = 0;
  const loaded = { render: (frame) => frames.push(frame), dispose: () => { disposals += 1; } };
  const gate = deferred();
  const unavailable = [];
  const layer = new DeferredSceneLayer({ load: () => gate.promise, onUnavailable: (error) => unavailable.push(error) });
  layer.render("before");
  gate.resolve(loaded);
  assert.equal(await layer.ready, true);
  layer.render("frame-1");
  assert.deepEqual(frames, ["frame-1"], "nothing is drawn before the layer arrives, every frame after");
  layer.dispose();
  layer.render("after");
  assert.deepEqual([frames.length, disposals], [1, 1], "dispose reaches the loaded layer once and stops drawing");

  const late = deferred();
  const early = new DeferredSceneLayer({ load: () => late.promise, onUnavailable: (error) => unavailable.push(error) });
  early.dispose();
  late.resolve(loaded);
  assert.equal(await early.ready, false);
  assert.equal(disposals, 2, "a layer that arrives after dispose is disposed at once");

  const failed = new DeferredSceneLayer({ load: () => Promise.reject(new Error("no bundle")), onUnavailable: (error) => unavailable.push(error) });
  assert.equal(await failed.ready, false);
  const invalid = new DeferredSceneLayer({ load: () => ({ render() {} }), onUnavailable: (error) => unavailable.push(error) });
  assert.equal(await invalid.ready, false);
  assert.deepEqual(unavailable.map((error) => error.message), ["no bundle", "DeferredSceneLayer: the loaded layer lacks dispose"]);
  failed.render("frame");
  failed.dispose();
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
      background: "rgb(15, 23, 30)", probe, logger, ...overrides };
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
  assert.deepEqual([...canvas.listeners.keys()].sort(), ["webglcontextlost", "webglcontextrestored"]);
  const app = apps[0];
  assert.deepEqual({ ...app.options, preference: [...app.options.preference] }, {
    autoStart: false, sharedTicker: false, skipExtensionImports: true, eventMode: "none", autoDensity: false,
    preference: ["webgl"], gcActive: false, canvas, width: 400, height: 800, resolution: 2, background: "rgb(15, 23, 30)",
  }, "no ticker, events, browser extensions, auto density, WebGPU or GC; size and ratio from the metrics owner");
  layer.render({});
  assert.equal(app.renders, 0, "nothing renders before init resolves");
  app.initCall.resolve();
  assert.equal(await layer.ready, true);
  assert.deepEqual([canvas.style.width, canvas.style.height], ["400px", "800px"], "CSS size = logical size");
  assert.deepEqual(probe.calls, [["gauge", "scene-pixels", 800 * 1600]], "the backing pixels reach the frame probe");

  for (let frame = 0; frame < 3; frame += 1) layer.render({});
  assert.deepEqual([app.renders, app.resizes.length], [3, 0], "one render per frame, no resize while nothing changes");
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

  canvas.dispatch("webglcontextlost");
  layer.render({});
  assert.equal(app.renders, 6, "a lost context skips rendering; the 2D game is untouched");
  canvas.dispatch("webglcontextrestored");
  layer.render({});
  assert.equal(app.renders, 7, "rendering resumes when the browser restores the context");

  layer.dispose();
  layer.dispose();
  layer.render({});
  assert.equal(app.renders, 7);
  assert.deepEqual(app.destroyed, [{ removeView: false }, { children: true }]);
  assert.equal(canvas.removed, true);
  assert.equal(canvas.listeners.size, 0, "dispose removes the context listeners");

  const failing = compose();
  failing.apps[0].initCall.reject(new Error("WebGL unsupported"));
  assert.equal(await failing.layer.ready, false);
  assert.equal(warnings.length, 1, "no WebGL is reported once");
  assert.match(warnings[0][0], /2D canvas stays alone/u);
  assert.equal(failing.dom.inserted[0].removed, true, "a layer that cannot render leaves no canvas behind");
  failing.layer.render({});

  const early = compose();
  early.layer.dispose();
  early.apps[0].initCall.resolve();
  assert.equal(await early.layer.ready, false);
  assert.deepEqual([early.apps[0].destroyed !== null, early.apps[0].renders, warnings.length], [true, 0, 1],
    "an Application that finishes init after dispose is destroyed, silently");
  return metrics;
}

async function checkCoordinatorOrder() {
  const { GameRenderCoordinator } = await importSource("src/game/presentation/rendering/game_render_coordinator.js");
  const order = [];
  const frame = { id: "frame" };
  const ports = {
    stateMachine: { getRenderState() {} },
    frameBuffer: { acquire: () => frame },
    frameBuilder: { buildInto: () => order.push("build") },
    pipeline: { render: (value) => { assert.equal(value, frame); order.push("2d"); } },
    sceneLayer: { render: (value) => { assert.equal(value, frame); order.push("scene"); } },
    probe: { begin: (id) => order.push(`+${id}`), end: (id) => order.push(`-${id}`) },
    getBounds: () => ({}), getInvalidCastMarker: () => null, isDebugEnabled: () => false,
    beginFrame: () => order.push("begin-2d"),
  };
  assert.throws(() => new GameRenderCoordinator({ ...ports, sceneLayer: {} }), /requires sceneLayer/u);
  assert.throws(() => new GameRenderCoordinator({ ...ports, probe: undefined }), /requires a frame probe/u);
  assert.equal(new GameRenderCoordinator(ports).render(0.016), frame);
  assert.deepEqual(order, ["build", "+scene", "scene", "-scene", "begin-2d", "2d"],
    "the scene draws after the frame is built and before every 2D pass, inside its probe section");
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
  const { PixiSceneLayer } = await importSource("src/platform/browser/scene/pixi_scene_layer.js");
  const dom = fakeDom();
  const warnings = [];
  const layer = runtime.createSceneLayer({ documentTarget: dom.documentTarget, gameCanvas: dom.gameCanvas,
    canvasMetrics: { width: 4, height: 4, pixelRatio: 1 }, background: 0, probe: recordingProbe(),
    logger: { warn: (...args) => warnings.push(args) } });
  assert(layer instanceof PixiSceneLayer, "createSceneLayer binds PixiSceneLayer to the vendored namespace");
  assert.equal(await layer.ready, false, "without WebGL (Node) the real Application never renders");
  assert.equal(warnings.length, 1);
  assert.equal(dom.inserted[0].removed, true);
}

async function checkDevComposition() {
  const { createDevSceneLayerFactory } = await importSource("src/bootstrap/development/dev_scene_layer_composition.js");
  const windowFor = (search) => ({ URLSearchParams, location: { search } });
  assert.equal(createDevSceneLayerFactory({ windowTarget: windowFor(""), documentTarget: {}, probe: {} }), null,
    "plain dev.html keeps the inactive layer");
  assert.equal(createDevSceneLayerFactory({ windowTarget: windowFor("?scene=canvas"), documentTarget: {}, probe: {} }), null);
  const factory = createDevSceneLayerFactory({ windowTarget: windowFor("?scene=webgl"), documentTarget: {}, probe: {} });
  assert.equal(typeof factory, "function", "dev.html?scene=webgl composes the Pixi layer");
  const startup = read("src/bootstrap/development/development_game_startup.js");
  assert.match(startup, /createSceneLayer: createDevSceneLayerFactory\(\{ windowTarget, documentTarget, probe: frameProfiler \}\)/u);
  assert.doesNotMatch(read("src/bootstrap/production/game.js") + read("src/entrypoints/game.entry.js"), /createSceneLayer/u,
    "production composes the inactive layer");
}

// The production page's static and dynamic imports never reach the Pixi modules or the bundle.
function checkProductionGraph() {
  const seen = new Set();
  const queue = ["src/entrypoints/game.entry.js"];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file) || !file.endsWith(".js")) continue;
    seen.add(file);
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      const source = node.type === "ImportExpression" ? node.source : node.source ?? null;
      if (source?.type === "Literal" && typeof source.value === "string" && source.value.startsWith(".")) {
        queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), source.value)));
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    };
    visit(acorn.parse(read(file), { ecmaVersion: "latest", sourceType: "module" }));
  }
  assert(seen.has("src/game/presentation/rendering/game_render_coordinator.js"), "the walk reaches the renderer");
  assert(seen.has("src/engine/scene/inactive_scene_layer.js"), "production composes the inactive layer");
  const pixi = [...seen].filter((file) => file.includes("/scene/pixi_") || file.startsWith("vendor/pixi/"));
  assert.deepEqual(pixi, [], "index.html never loads Pixi in stage 0");
  return seen.size;
}

function checkCss() {
  const css = read("src/game/presentation/styles/game-shell.css");
  const rule = css.match(/\.game-shell__scene \{([^}]*)\}/u)?.[1] ?? "";
  for (const declaration of ["position: fixed;", "inset: 0;", "z-index: -1;", "margin: auto;", "pointer-events: none;"]) {
    assert(rule.includes(declaration), `.game-shell__scene declares ${declaration}`);
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
  await checkPixiSceneLayer();
  await checkCoordinatorOrder();
  const { entry, size } = checkVendor();
  await checkRuntimeModule(entry);
  await checkDevComposition();
  const productionModules = checkProductionGraph();
  checkCss();
  await settle();
  console.log(`Scene layer passed: inactive port and lazy DEV layer (late arrival, failure, invalid layer), PixiSceneLayer `
    + `over a fake Pixi (no ticker/events/extensions/GC, async init, one render per frame, resize only on change, `
    + `context loss, dispose, no-WebGL fallback), scene before the 2D passes, runtime ${entry.version} with stopped `
    + `tickers, dev.html?scene=webgl flag, scene canvas CSS, self-contained bundle (${size} bytes) and licence, `
    + `${productionModules} production modules without Pixi.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
