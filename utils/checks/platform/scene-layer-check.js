"use strict";

// Specs 103-106 (stages 0-3): the WebGL scene layer port (inactive in "canvas" mode), the lazy layer, the router
// (depth order, mode, availability, fallback), the scene's texture cache and background renderer, the water's wave field
// and renderer, PixiSceneLayer over a fake Pixi namespace (warm-up, frames only on change, art-based resolution, water
// steps, context loss, DEV status, dispose), the
// coordinator's routing per frame, the 2D surface's clear, the production composition (config mode, DEV override,
// transparent canvas, a real no-WebGL fallback in Node), the 2D gates, the DEV section, the runtime module, the CSS,
// the vendored bundle and a production graph that loads Pixi only lazily.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const acorn = require("acorn");

const ROOT_DIR = path.resolve(__dirname, "../../..");
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

// A 2D context for the water's map canvas: image data and the number of puts.
function fakeContext2d() {
  return { puts: 0, texts: [], font: "", createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData(image) { this.puts += 1; this.last = image; },
    measureText(text) { return { width: String(text).length * (Number.parseFloat(this.font.match(/(\d+)px/u)?.[1]) || 10) * 0.6 }; },
    fillText(text, x, y) { this.texts.push({ text, x, y, font: this.font, fillStyle: this.fillStyle }); },
    createRadialGradient: () => ({ stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } }),
    fillRect() {} };
}

function fakeElement(tagName) {
  const listeners = new Map();
  const classes = new Set();
  const context = tagName === "canvas" ? fakeContext2d() : null;
  return {
    tagName, className: "", attributes: {}, style: {}, removed: false, width: 0, height: 0, listeners, classes,
    getContext: (type) => (type === "2d" ? context : null),
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
// context has WEBGL_lose_context, which dispatches the canvas events like a browser would. Textures record their upload
// and destruction; a canvas texture (the water's map) counts its updates; sprites, containers and the displacement filter
// are plain records.
function fakePixi() {
  const apps = [];
  const textures = [];
  const canvasTextures = [];
  class Container {
    constructor() { this.children = []; this.visible = true; }

    addChild(...children) {
      for (const child of children) child.parent = this;
      this.children.push(...children);
      return children[0];
    }

    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      child.parent = null;
      return child;
    }
  }
  class Sprite {
    constructor(texture = null) {
      Object.assign(this, { texture, x: 0, y: 0, width: 0, height: 0, alpha: 1, rotation: 0, visible: true });
      this.anchor = { x: 0, y: 0, set: (x, y) => { this.anchor.x = x; this.anchor.y = y; } };
    }
  }
  // Records its path and paint calls as [name, ...args]; clear() empties the record.
  class Graphics {
    constructor() { this.ops = []; this.mask = null; this.visible = true; }

    clear() { this.ops = []; return this; }
  }
  for (const name of ["rect", "ellipse", "circle", "moveTo", "lineTo", "closePath", "fill", "stroke", "quadraticCurveTo"]) {
    Graphics.prototype[name] = function record(...args) { this.ops.push([name, ...args]); return this; };
  }
  class DisplacementFilter {
    constructor({ sprite, scale }) {
      this.sprite = sprite;
      this.scale = { x: scale, y: scale };
      sprite.renderable = false;
    }
  }
  class Texture {
    // A sub-texture: a frame of another texture's source (the static rod's atlas region).
    constructor({ source, frame }) { Object.assign(this, { source, frame, destroyed: null }); }

    destroy(destroySource) { this.destroyed = destroySource; }

    // After a frame change (an image float's waterline crop): counts the uv updates.
    update() { this.updates = (this.updates || 0) + 1; }

    static from(options, skipCache) {
      if (options?.tagName === "canvas") {
        const texture = { canvas: options, skipCache, updates: 0, destroyed: null,
          source: { update: () => { texture.updates += 1; } }, destroy(destroySource) { this.destroyed = destroySource; } };
        canvasTextures.push(texture);
        return texture;
      }
      const { naturalWidth: pixelWidth, naturalHeight: pixelHeight } = options.resource;
      const texture = { resource: options.resource, skipCache, uploaded: false, destroyed: null, width: pixelWidth,
        height: pixelHeight, source: { pixelWidth, pixelHeight, width: pixelWidth, height: pixelHeight,
          autoGenerateMipmaps: options.autoGenerateMipmaps },
        destroy(destroySource) { this.destroyed = destroySource; } };
      textures.push(texture);
      return texture;
    }
  }
  class Rectangle {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  }
  class Application {
    constructor() {
      this.initCall = deferred();
      this.renders = 0;
      this.resizes = [];
      this.destroyed = null;
      this.stage = new Container();
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
        gl: { getExtension: (name) => (name === "WEBGL_lose_context" ? loseContext : null) },
        texture: { initSource: (source) => { textures.find((texture) => texture.source === source).uploaded = true; } },
        background: { color: options.background } };
      return this.initCall.promise;
    }

    render() { this.renders += 1; }

    destroy(...args) { this.destroyed = args; }
  }
  return { pixi: { Application, Container, DisplacementFilter, Graphics, Rectangle, Sprite, Texture }, apps, textures,
    canvasTextures };
}

// Loaded images by asset id, as ImageAssetProvider.tryGet serves them.
function fakeImages(entries) {
  const images = new Map(entries.map(([id, width, height]) => [id, { id, naturalWidth: width, naturalHeight: height }]));
  return { images, tryGet: (id) => images.get(id) ?? null };
}

// A world model like WorldRenderFrameBuilder's: the location's phases and the drawn layers.
function worldModel({ layers, assets = ["day", "evening", "night"], color = "#0f171e" }) {
  return { world: { visible: true, backgroundColor: color, backgroundAssetIds: assets,
    backgroundLayers: { count: layers.length, getAt: (index) => layers[index] } } };
}

function recordingProbe() {
  const calls = [];
  return { calls, beginFrame() {}, begin: (id) => calls.push(["begin", id]), end: (id) => calls.push(["end", id]),
    gauge: (id, value) => calls.push(["gauge", id, value]), endFrame() {} };
}

async function checkPorts() {
  const { InactiveSceneLayer, SCENE_LAYER_METHODS } = await importSource("src/engine/scene/inactive_scene_layer.js");
  const { FRAME_SECTIONS, FRAME_GAUGES } = await importSource("src/engine/diagnostics/inactive_frame_probe.js");
  assert.deepEqual(SCENE_LAYER_METHODS, ["render", "isActive", "whenReady", "prepare", "getStatus", "loseContext",
    "restoreContext", "dispose"]);
  const inactive = new InactiveSceneLayer();
  for (const method of SCENE_LAYER_METHODS) assert.equal(typeof inactive[method], "function", `inactive ${method}`);
  assert.equal(inactive.isActive(), false);
  assert.equal(await inactive.whenReady(), false, "the inactive layer never renders, so startup does not wait");
  assert.deepEqual(inactive.getStatus(), { state: "inactive" });
  assert.equal(inactive.prepare(["day"]), undefined, "the inactive layer prepares nothing");
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
    prepare: (assetIds) => calls.push(`prepare ${assetIds}`), dispose: () => { disposals += 1; } };
  const gate = deferred();
  const unavailable = [];
  const layer = new DeferredSceneLayer({ load: () => gate.promise, onUnavailable: (error) => unavailable.push(error) });
  layer.render("before");
  layer.prepare(["day"]);
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
  layer.prepare(["day", "night"]);
  assert.deepEqual([calls, layer.getStatus().state], [["lose", "restore", "prepare day,night"], "active"],
    "DEV methods and prepare reach the loaded layer; nothing before it arrives");
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

async function checkTextureCacheAndBackground() {
  const { SceneTextureCache } = await importSource("src/platform/browser/scene/scene_texture_cache.js");
  const { PixiBackgroundRenderer } = await importSource("src/platform/browser/scene/pixi_background_renderer.js");
  const { pixi, textures } = fakePixi();
  const app = new pixi.Application();
  app.init({ canvas: fakeElement("canvas"), width: 1, height: 1, resolution: 1, background: 0 });
  const images = fakeImages([["day", 2560, 1440], ["evening", 2560, 1440]]);
  assert.throws(() => new SceneTextureCache({ pixi, images: {}, renderer: app.renderer }), /requires images/u);
  assert.throws(() => new SceneTextureCache({ pixi, images, renderer: {} }), /requires a renderer/u);
  const cache = new SceneTextureCache({ pixi, images, renderer: app.renderer });
  assert.equal(cache.get("night"), null, "an image still loading has no texture yet");
  const day = cache.get("day");
  assert.equal(cache.get("day"), day, "one texture per image");
  assert.deepEqual([day.skipCache, day.source.autoGenerateMipmaps, day.uploaded], [true, true, true],
    "mipmapped, outside Pixi's global cache and uploaded at once (spec 105 D2)");
  assert.equal(cache.prepareNext(["day", "evening", "night"]), true, "the next missing image uploads: evening");
  assert.equal(cache.prepareNext(["day", "evening", "night"]), false, "night is still loading: nothing to upload");
  const phaseBytes = 2560 * 1440 * 4 * 4 / 3;
  assert.deepEqual([cache.size, cache.bytes], [2, 2 * phaseBytes], "RGBA plus a third for mipmaps");
  images.images.set("day", { id: "day", naturalWidth: 2560, naturalHeight: 1440 });
  assert.notEqual(cache.get("day"), day, "a reloaded image gets a new texture");
  assert.deepEqual([day.destroyed, cache.size, cache.bytes], [true, 2, 2 * phaseBytes], "and releases the old one");
  cache.dispose();
  assert.deepEqual([cache.size, cache.bytes, textures.every((texture) => texture.destroyed === true)], [0, 0, true],
    "dispose releases every texture with its source (rule 19)");

  const stage = new pixi.Container();
  const sceneTextures = new SceneTextureCache({ pixi, images, renderer: app.renderer });
  assert.throws(() => new PixiBackgroundRenderer({ pixi, stage, textures: {}, renderer: app.renderer }), /requires textures/u);
  const background = new PixiBackgroundRenderer({ pixi, stage, textures: sceneTextures, renderer: app.renderer });
  const sprites = stage.children[0].children;
  assert.deepEqual(sprites.map((sprite) => sprite.visible), [false, false], "two pooled sprites, hidden until drawn");
  const base = { assetId: "day", alpha: 1, x: -12, y: 0, width: 1451, height: 816 };
  const overlay = { assetId: "evening", alpha: 0.4, x: -12, y: 0, width: 1451, height: 816 };
  let frame = worldModel({ layers: [base, overlay] });
  assert.equal(background.update(frame.world), true);
  assert.deepEqual(sprites.map(({ texture, x, y, width, height, alpha, visible }) => [texture.resource.id, x, y, width, height,
    alpha, visible]), [["day", -12, 0, 1451, 816, 1, true], ["evening", -12, 0, 1451, 816, 0.4, true]],
  "the base phase and one translucent phase, as the model places them");
  assert.equal(sceneTextures.size, 2, "the visible phases upload on the first frame");
  assert.equal(background.artDensity, 1440 / 816, "art pixels per drawn logical pixel");
  images.images.set("night", { id: "night", naturalWidth: 2560, naturalHeight: 1440 });
  assert.equal(background.update(frame.world), false, "an unchanged background presents nothing (D3)");
  assert.equal(sceneTextures.size, 3, "a frame without other uploads uploads the next phase of the location (D2)");
  base.y = overlay.y = 0.04;
  overlay.alpha = 0.4015;
  assert.equal(background.update(frame.world), false, "steps too small to see present nothing (the camera's easing tail)");
  base.y = overlay.y = 0.06;
  assert.equal(background.update(frame.world), true, "they add up: drift past a tenth of a backing pixel is a change");
  assert.equal(sprites[0].y, 0.06, "and the sprite takes the exact position");
  overlay.alpha = 0.5;
  assert.equal(background.update(frame.world), true, "a time-of-day blend step is a change");
  base.x = overlay.x = -20;
  assert.equal(background.update(frame.world), true, "a camera move is a change");
  frame = worldModel({ layers: [base] });
  assert.equal(background.update(frame.world), true);
  assert.deepEqual(sprites.map((sprite) => sprite.visible), [true, false], "a single phase hides the overlay sprite");
  assert.equal(background.update(frame.world), false);
  frame = worldModel({ layers: [base], color: "#112233" });
  assert.deepEqual([background.update(frame.world), app.renderer.background.color], [true, "#112233"], "the clear colour");
  assert.deepEqual([background.update(null), background.artDensity, sprites[0].visible], [true, null, false],
    "off the scene the background hides");
  assert.equal(background.update(null), false);
  sceneTextures.dispose();
}

async function checkPixiSceneLayer() {
  const { PixiSceneLayer } = await importSource("src/platform/browser/scene/pixi_scene_layer.js");
  const metrics = { width: 400, height: 816, pixelRatio: 2 };
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };
  let onScene = true;
  const router = { drawsOnScene: (kind) => onScene && kind === "background" };
  const images = fakeImages([["day", 2560, 1440], ["evening", 2560, 1440], ["night", 2560, 1440]]);
  const clock = { now: 1000 };
  const water = { enabled: true, frameRate: 30, amplitude: 8, verticalShare: 0.5, wavelength: 140, speed: 24,
    currentScale: 3 };
  const { FightAreaStyleResolver } = await importSource("src/game/presentation/styles/fight_area_style_resolver.js");
  const fightAreaStyles = new FightAreaStyleResolver({ configProvider: () => ({}) });
  const compose = (overrides = {}) => {
    const dom = fakeDom();
    const { pixi, apps, textures, canvasTextures } = fakePixi();
    const probe = recordingProbe();
    const options = { pixi, documentTarget: dom.documentTarget, gameCanvas: dom.gameCanvas, canvasMetrics: metrics,
      background: "#0f171e", images, router, clock, getWaterSettings: () => water, fightAreaStyles, probe, logger,
      ...overrides };
    return { layer: new PixiSceneLayer(options), dom, apps, textures, canvasTextures, probe };
  };
  for (const [name, overrides, pattern] of [
    ["pixi", { pixi: {} }, /requires the Pixi namespace/u],
    ["game canvas", { gameCanvas: {} }, /requires the game canvas/u],
    ["images", { images: {} }, /requires images/u],
    ["router", { router: {} }, /requires the router/u],
    ["water settings", { getWaterSettings: null }, /requires getWaterSettings/u],
    ["clock", { clock: null }, /requires clock/u],
    ["fight area styles", { fightAreaStyles: null }, /requires fightAreaStyles/u],
    ["metrics", { canvasMetrics: null }, /requires canvasMetrics/u],
    ["probe", { probe: undefined }, /requires probe/u],
  ]) assert.throws(() => compose(overrides), pattern, `PixiSceneLayer validates ${name}`);

  const { layer, dom, apps, textures, probe } = compose();
  const canvas = dom.inserted[0];
  assert.equal(dom.inserted.length, 1, "one scene canvas, inserted right before the game canvas");
  assert.deepEqual([canvas.tagName, canvas.className, canvas.attributes["aria-hidden"]], ["canvas", "game-shell__scene", "true"]);
  assert(dom.gameCanvas.classes.has("game-shell__canvas--over-scene"), "the game canvas drops its CSS background");
  const app = apps[0];
  assert.deepEqual({ ...app.options, preference: [...app.options.preference] }, {
    autoStart: false, sharedTicker: false, skipExtensionImports: true, eventMode: "none", autoDensity: false,
    preference: ["webgl"], gcActive: false, canvas, width: 400, height: 816, resolution: 2, background: "#0f171e",
  }, "no ticker, events, browser extensions, auto density, WebGPU or GC; size and ratio from the metrics owner");
  const base = { assetId: "day", alpha: 1, x: -12, y: 0, width: 1451, height: 816 };
  const frame = worldModel({ layers: [base] });
  layer.render(frame);
  assert.deepEqual([app.renders, layer.isActive(), layer.getStatus()], [0, false, { state: "starting" }],
    "nothing renders and the router sees no scene before init resolves");
  app.initCall.resolve();
  assert.equal(await layer.whenReady(), true);
  assert.equal(app.renders, 1, "one warm-up render before the layer reports ready (spec 104 D8)");
  assert.deepEqual(probe.calls, [["gauge", "scene-pixels", 800 * 1632]], "the backing pixels reach the frame probe");

  layer.render(frame);
  assert.deepEqual([app.renders, app.resizes], [2, [[400, 816, 1.76]]],
    "portrait: the scene drops to the art's 1440 / 816 = 1.76 pixels per logical pixel, so the art is drawn 1:1 (D4)");
  assert.deepEqual([canvas.style.width, canvas.style.height, canvas.width, canvas.height], ["400px", "816px", 704, 1436],
    "the CSS size stays logical; the compositor scales the smaller backing store");
  assert.equal(textures.length, 1, "the first frame uploads only the visible phase");
  for (let index = 0; index < 3; index += 1) layer.render(frame);
  assert.deepEqual([app.renders, app.resizes.length], [2, 1], "a still background presents no frame and resizes nothing (D3)");
  assert.deepEqual(textures.map((texture) => texture.resource.id), ["day", "evening", "night"],
    "the other phases follow one per frame, in the location's order, without presenting a frame (D2)");
  assert.deepEqual(layer.getStatus(), { state: "active", webglVersion: 2, width: 400, height: 816, pixelRatio: 1.76,
    textures: 3, textureBytes: 3 * 2560 * 1440 * 4 * 4 / 3,
    water: { active: false, mapWidth: 192, mapHeight: 48, stepMs: 0, driftSpeed: 0 } },
  "no castable zones in this frame: still water");
  base.x = -20;
  layer.render(frame);
  assert.equal(app.renders, 3, "a camera move presents one frame");

  metrics.width = 816;
  metrics.height = 400;
  Object.assign(base, { width: 816, height: 459 });
  layer.render(frame);
  assert.deepEqual(app.resizes.at(-1), [816, 400, 2], "landscape: the art is shrunk, so the scene keeps the canvas ratio");
  metrics.pixelRatio = 1.5;
  layer.render(frame);
  assert.deepEqual(app.resizes.at(-1), [816, 400, 1.5], "never above the game canvas's ratio");
  assert.equal(app.renders, 5);

  layer.loseContext();
  layer.render(frame);
  assert.deepEqual([app.renders, layer.isActive(), layer.getStatus().state], [5, false, "context-lost"],
    "a lost context skips rendering and makes the layer inactive, so the router falls back to the 2D canvas");
  layer.restoreContext();
  layer.render(frame);
  assert.deepEqual([app.renders, layer.isActive()], [6, true], "a restored context presents a frame although nothing moved");
  layer.render(frame);
  assert.equal(app.renders, 6);
  onScene = false;
  layer.render(frame);
  layer.render(frame);
  assert.equal(app.renders, 7, "a background sent back to the 2D canvas is hidden once");
  onScene = true;

  layer.dispose();
  layer.dispose();
  layer.render(frame);
  assert.equal(app.renders, 7);
  assert.deepEqual(app.destroyed, [{ removeView: false }, { children: true }]);
  assert.deepEqual([canvas.removed, canvas.listeners.size, dom.gameCanvas.classes.size, layer.getStatus().state,
    textures.every((texture) => texture.destroyed === true)], [true, 0, 0, "disposed", true],
  "dispose removes the canvas, its listeners, the game canvas modifier and every texture");

  // Spec 105 D2: startup prepares every phase under the loading screen, so play starts without uploads.
  const prepared = compose();
  prepared.layer.prepare(["day", "evening", "night"]);
  assert.equal(prepared.textures.length, 0, "nothing is prepared before the layer is ready");
  prepared.apps[0].initCall.resolve();
  assert.equal(await prepared.layer.whenReady(), true);
  prepared.layer.prepare(["day", "evening", "night"]);
  assert.deepEqual(prepared.textures.map((texture) => texture.resource.id), ["day", "evening", "night"],
    "prepare uploads every listed phase at once");
  prepared.layer.render(frame);
  prepared.layer.render(frame);
  assert.deepEqual([prepared.textures.length, prepared.apps[0].renders], [3, 2],
    "the first frames of play upload nothing more; the first presents the picture");
  prepared.layer.dispose();

  await checkSceneWater(compose, clock, water, metrics);

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

// Spec 106: the water's displacement map.
async function checkWaterWaveField() {
  const { WaterWaveField } = await importSource("src/platform/browser/scene/water_wave_field.js");
  assert.throws(() => new WaterWaveField({ width: 1, height: 8 }), /at least 2×2/u);
  const field = new WaterWaveField({ width: 192, height: 48 });
  const { WaterMetric } = await importSource("src/game/domain/locations/water_metric.js");
  const metric = WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 640, topY: 0, centerX: 1280,
    maxMeters: 30, tiltDegrees: 45, farScale: .3, lateralContraction: true });
  const settings = { artWidth: 2560, artHeight: 640, wavelength: 140, speed: 24,
    plane: { metric, left: 0, right: 2560, top: 0, bottom: 640 } };
  const first = Array.from(field.write(2, settings));
  assert.equal(first.length, 192 * 48 * 4);
  assert.deepEqual(Array.from(field.write(2, settings)), first, "a moment of the animation is deterministic");
  assert.notDeepEqual(Array.from(field.write(2.1, settings)), first, "the waves move with time");
  assert.deepEqual(Array.from(field.write(7, { ...settings, speed: 0 })), Array.from(field.write(0, { ...settings, speed: 0 })),
    "speed 0 holds the waves still");
  // D9: the current carries the whole pattern. A drift of one texel's width of water on a row (art pixels per column
  // over that row's surface size, farScale at the far edge to 1 at the near one) moves that row one texel along.
  const still = { ...settings, speed: 0 };
  const near = 47 - 4;
  const perspective = metric.surfaceScaleAt(metric.topY + (metric.shoreY - metric.topY) * (near + .5) / 48);
  const before = Array.from(field.write(0, still));
  const after = Array.from(field.write(0, { ...still, driftX: 2560 / 192 / perspective }));
  let shifted = 0;
  for (let index = 10; index < 182; index += 1) { // inside the side fades, where neighbouring texels share an envelope
    shifted = Math.max(shifted, Math.abs(after[(near * 192 + index) * 4] - before[(near * 192 + index - 1) * 4]));
  }
  assert(shifted <= 3, `a drift of one column at the near edge shifts the near pattern one texel (${shifted})`);
  assert.notDeepEqual(Array.from(field.write(0, { ...still, driftY: 30 })), before, "the current can carry it along y too");
  const pixels = field.write(2, settings);
  const at = (column, row, channel) => pixels[(row * 192 + column) * 4 + channel];
  let edge = 0;
  for (let row = 0; row < 48; row += 1) edge = Math.max(edge, Math.abs(at(0, row, 0) - 128), Math.abs(at(191, row, 0) - 128));
  for (let column = 0; column < 192; column += 1) {
    edge = Math.max(edge, Math.abs(at(column, 0, 0) - 128), Math.abs(at(column, 47, 0) - 128));
  }
  assert(edge <= 6, `the waves fade out at every edge, so the water meets the still art without a seam (${edge})`);
  for (let index = 0; index < pixels.length; index += 4) {
    assert(pixels[index + 2] === 128 && pixels[index + 3] === 255, "blue is neutral and every texel opaque");
  }
  const tiltedPixels = Array.from(pixels);
  const meanShift = (values, fromRow, toRow) => {
    let sum = 0;
    for (let row = fromRow; row < toRow; row += 1) {
      for (let column = 20; column < 172; column += 1) sum += Math.abs(values[(row * 192 + column) * 4] - 128);
    }
    return sum / ((toRow - fromRow) * 152);
  };
  assert(meanShift(tiltedPixels, 10, 16) < meanShift(tiltedPixels, 30, 36) * 0.75,
    "the far water moves less than the near water (surface size)");
  // R4 (spec 126): the waves are a surface pattern, so the optional grid contraction does not change them.
  const parallel = WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 640, topY: 0, centerX: 1280,
    maxMeters: 30, tiltDegrees: 45, farScale: .3, lateralContraction: false });
  assert.deepEqual(Array.from(field.write(2, { ...settings, plane: { ...settings.plane, metric: parallel } })), tiltedPixels,
    "far waves shrink in both axes with or without lateral grid contraction");
  const overhead = WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 640, topY: 0, centerX: 1280,
    maxMeters: 30, tiltDegrees: 90, farScale: 1, lateralContraction: true });
  const overheadPixels = field.write(2, { ...settings, plane: { ...settings.plane, metric: overhead } });
  assert.equal(overheadPixels, pixels, "projection edits reuse the same fixed-size displacement field");
  assert.notDeepEqual(Array.from(overheadPixels), tiltedPixels,
    "wave spacing and displacement consume the changed shared projection instead of an independent far-scale curve");
  const evenNear = meanShift(overheadPixels, 18, 24), evenFar = meanShift(overheadPixels, 30, 36);
  assert(Math.abs(evenNear - evenFar) < 0.25 * evenFar, "without a far scale the waves keep one size over the water");
}

// Spec 106: the water over the background, stepping at its own frame rate.
async function checkSceneWater(compose, clock, water, metrics) {
  metrics.width = 400;
  metrics.height = 816;
  metrics.pixelRatio = 2;
  const wet = compose();
  const app = wet.apps[0];
  app.initCall.resolve();
  assert.equal(await wet.layer.whenReady(), true);
  const [, waterContainer, mapSprite] = app.stage.children;
  const filter = waterContainer.filters[0];
  assert.equal(filter.sprite, mapSprite, "the filter's map sprite lives in the scene (it is not drawn)");
  assert.equal(mapSprite.renderable, false);
  const map = wet.canvasTextures[0];
  assert.deepEqual([map.canvas.width, map.canvas.height, map.skipCache], [192, 48, true]);
  const regions = [{ x: -100, y: 300, width: 1600, height: 400 }];
  const base = { assetId: "day", alpha: 1, x: -500, y: 0, width: 1451, height: 816 };
  const dusk = { assetId: "evening", alpha: 0.4, x: -500, y: 0, width: 1451, height: 816 };
  const frame = worldModel({ layers: [base, dusk] });
  frame.world.clipRegions = { count: 1, getAt: (index) => regions[index] };
  frame.world.current = { x: 5, y: 0.5 };
  wet.layer.render(frame);
  assert.equal(app.renders, 2, "the first water step presents with the background");
  assert.equal(waterContainer.visible, true);
  assert.deepEqual({ ...waterContainer.filterArea }, { x: 0, y: 300, width: 400, height: 400 },
    "only the visible water is filtered: the castable zone clipped to the screen");
  assert.deepEqual([mapSprite.x, mapSprite.y, mapSprite.width, mapSprite.height], [-100, 300, 1600, 400],
    "the map spans the whole zone, so the waves stay put on the water when the camera moves");
  const copy = waterContainer.children;
  assert.deepEqual(copy.map((sprite) => [sprite.texture.resource.id, sprite.alpha, sprite.x, sprite.visible]),
    [["day", 1, -500, true], ["evening", 0.4, -500, true]], "the water draws the same phases as the background");
  const artScale = 1451 / 2560;
  assert(Math.abs(filter.scale.x - 2 * 8 * artScale) < 1e-9, "amplitude in art pixels, the filter shifts by half its scale");
  assert(Math.abs(filter.scale.y - filter.scale.x * 0.5) < 1e-9, "vertical share of the shift");
  assert.equal(map.updates, 1, "each step uploads the map once");
  wet.layer.render(frame);
  clock.now += 20;
  wet.layer.render(frame);
  assert.deepEqual([app.renders, map.updates], [2, 1], "between steps the scene presents nothing");
  clock.now += 20;
  wet.layer.render(frame);
  assert.deepEqual([app.renders, map.updates], [3, 2], "30 steps per second: a step after 1/30 s presents one frame");
  const status = wet.layer.getStatus().water;
  assert.deepEqual([status.active, status.mapWidth, status.mapHeight, status.stepMs >= 0], [true, 192, 48, true]);
  assert(Math.abs(status.driftSpeed - 3 * Math.hypot(5, 0.5)) < 1e-9, "the water drifts with the location's current × currentScale");
  const mapBefore = Array.from(map.canvas.getContext("2d").last.data);
  water.speed = 0;
  clock.now += 40;
  wet.layer.render(frame);
  assert.notDeepEqual(Array.from(map.canvas.getContext("2d").last.data), mapBefore,
    "with still waves (speed 0) the current alone still moves the pattern");
  water.currentScale = 0;
  const heldStill = (() => { clock.now += 40; wet.layer.render(frame); return Array.from(map.canvas.getContext("2d").last.data); })();
  clock.now += 40;
  wet.layer.render(frame);
  assert.deepEqual(Array.from(map.canvas.getContext("2d").last.data), heldStill, "currentScale 0 and speed 0: still water");
  assert.equal(wet.layer.getStatus().water.driftSpeed, 0);
  Object.assign(water, { speed: 24, currentScale: 3 });
  water.frameRate = 60;
  clock.now += 17;
  wet.layer.render(frame);
  assert.equal(app.renders, 7, "the settings are read every frame");
  water.frameRate = 30;

  water.enabled = false;
  wet.layer.render(frame);
  wet.layer.render(frame);
  assert.deepEqual([app.renders, waterContainer.visible], [8, false], "disabled water is hidden once, then costs nothing");
  water.enabled = true;
  clock.now += 40;
  wet.layer.render(frame);
  assert.deepEqual([app.renders, waterContainer.visible], [9, true]);
  regions[0].y = 900;
  clock.now += 40;
  wet.layer.render(frame);
  assert.deepEqual([app.renders, waterContainer.visible], [10, false], "water below the screen is not filtered");
  regions[0].y = 300;
  frame.world.clipRegions = { count: 0, getAt: () => null };
  wet.layer.render(frame);
  assert.equal(app.renders, 10, "no castable zone: no water");
  wet.layer.dispose();
  assert.equal(map.destroyed, true, "the map's texture is released with the scene");
}

// A reusable list as the frame models use it ({ count, getAt }).
const list = (items) => ({ count: items.length, getAt: (index) => items[index] ?? null });

// Spec 107 (stage 4a): change fingerprints, dashes, text textures, the world entities and the fight areas.
async function checkSceneWorldKinds() {
  const { SceneChangeFingerprint } = await importSource("src/platform/browser/scene/scene_change_fingerprint.js");
  const print = new SceneChangeFingerprint();
  const feed = (x, alpha, text) => { print.begin(); print.length(x); print.alpha(alpha); print.text(text); return print.finish(); };
  assert.equal(feed(10, 0.5, "⛵"), true, "the first picture is a change");
  assert.equal(feed(10.02, 0.5005, "⛵"), false, "steps under 0.05 px and half an 8-bit opacity step are not a change");
  assert.equal(feed(10.2, 0.5, "⛵"), true);
  assert.equal(feed(10.2, 0.5, "🚤"), true, "a different emoji is a change");
  print.invalidate();
  assert.equal(feed(10.2, 0.5, "🚤"), true, "after invalidate the same picture is drawn again");

  const { appendDashedLine } = await importSource("src/platform/browser/scene/pixi_dashed_line.js");
  const { pixi } = fakePixi();
  const dashes = new pixi.Graphics();
  appendDashedLine(dashes, 0, 5, 50, 5, [10, 10]);
  assert.deepEqual(dashes.ops, [["moveTo", 0, 5], ["lineTo", 10, 5], ["moveTo", 20, 5], ["lineTo", 30, 5], ["moveTo", 40, 5],
    ["lineTo", 50, 5]], "a [10, 10] dash over 50 px is three dashes, as Canvas 2D draws it");
  dashes.clear();
  appendDashedLine(dashes, 0, 0, 3, 4, []);
  assert.deepEqual(dashes.ops, [["moveTo", 0, 0], ["lineTo", 3, 4]], "no pattern: a solid line");

  const { SceneTextTextures } = await importSource("src/platform/browser/scene/scene_text_textures.js");
  const dom = fakeDom();
  const fake = fakePixi();
  const texts = new SceneTextTextures({ pixi: fake.pixi, documentTarget: dom.documentTarget });
  const boat = texts.get("⛵", 20, 2);
  assert.equal(texts.get("⛵", 20.2, 2), boat, "sizes that round to the same backing pixels share one texture");
  assert.notEqual(texts.get("⛵", 24, 2), boat);
  assert.equal(boat.height, boat.pixelHeight / 2, "drawn at logical size: backing pixels over the ratio");
  const drawn = boat.texture.canvas.getContext("2d").texts[0];
  assert.deepEqual([drawn.text, drawn.font], ["⛵", "40px sans-serif"], "drawn once at the scene's pixel ratio");
  texts.dispose();
  assert.equal(fake.canvasTextures.every((texture) => texture.destroyed === true), true, "released with the scene");

  const { PixiWorldEntitiesRenderer } = await importSource("src/platform/browser/scene/pixi_world_entities_renderer.js");
  const stage = new fake.pixi.Container();
  const entities = new PixiWorldEntitiesRenderer({ pixi: fake.pixi,
    stage, texts: new SceneTextTextures({ pixi: fake.pixi, documentTarget: dom.documentTarget }) });
  const [container] = stage.children;
  const [zones, zoneMask, overlay, boatLayer] = container.children;
  const zone = { x: 200, y: 400, radiusX: 60, radiusY: 20, opacity: 0.5 };
  const boatModel = { x: 150, y: 380, angle: 0.3, emoji: "⛵", fontSize: 24, energyRatio: 0.5, energyColor: "#00ff00",
    barWidth: 40, barHeight: 4, barY: -16 };
  const world = { visible: true, clipRegions: list([{ x: 0, y: 300, width: 400, height: 300 }]), chumZones: list([zone]),
    waypoints: list([{ x: 100, y: 350, scale: 1, index: 2, showIndex: true }]), boats: list([boatModel]),
    sensorRays: list([{ startX: 150, startY: 380, endX: 180, endY: 360, blocked: true }]) };
  assert.equal(entities.update(world, 2), true);
  assert.equal(container.visible, true);
  assert.deepEqual(zones.ops, [["ellipse", 200, 400, 60, 20], ["fill", { color: 0xc8ff64, alpha: 0.1 }],
    ["stroke", { width: 2, color: 0xc8ff64, alpha: 0.25 }]], "chum zones: BoatChumRenderer's colours and opacities");
  assert.equal(zones.mask, zoneMask, "chum zones are clipped to the castable water");
  assert.deepEqual(zoneMask.ops, [["rect", 0, 300, 400, 300], ["fill", 0xffffff]]);
  const boatSprite = boatLayer.children.find((sprite) => sprite.texture?.canvas?.getContext("2d").texts[0]?.text === "⛵");
  assert.deepEqual([boatSprite.x, boatSprite.y, boatSprite.rotation, boatSprite.anchor.x, boatSprite.anchor.y],
    [150, 380, 0.3 + Math.PI, 0.5, 0.5], "the boat emoji turns with the boat around its centre");
  assert(overlay.ops.some((op) => op[0] === "rect" && op[1] === 130 && op[2] === 364 && op[3] === 20),
    "the energy bar fills its share");
  assert(overlay.ops.some((op) => op[0] === "stroke" && op[1].color === 0xff0000), "a blocked sensor ray is red");
  assert.equal(entities.update(world, 2), false, "an unchanged world presents nothing");
  zone.radiusY += 1;
  assert.equal(entities.update(world, 2), true, "a changed surface ellipse invalidates the scene");
  boatModel.x += 1;
  assert.equal(entities.update(world, 2), true, "a moving boat is a change");
  assert.equal(entities.update(null, 2), true, "off the scene it hides once");
  assert.equal(container.visible, false);
  assert.equal(entities.update(null, 2), false);
  assert.equal(entities.update({ ...world, chumZones: list([]), waypoints: list([]), boats: list([]), sensorRays: list([]) }, 2),
    false, "nothing to draw: hidden, no frame");

  const { PixiFightAreaRenderer } = await importSource("src/platform/browser/scene/pixi_fight_area_renderer.js");
  const { FightAreaStyleResolver } = await importSource("src/game/presentation/styles/fight_area_style_resolver.js");
  const styles = new FightAreaStyleResolver({ configProvider: () => ({ lastDashDash: [5, 5] }) });
  const areaStage = new fake.pixi.Container();
  const areas = new PixiFightAreaRenderer({ pixi: fake.pixi, stage: areaStage, styles });
  const [areaContainer] = areaStage.children;
  const [shapes, areaMask] = areaContainer.children;
  const style = styles.resolve();
  const model = { visible: true, clipRegions: list([{ x: 0, y: 200, width: 400, height: 500 }]),
    lastDashZone: { visible: true, y: 300, width: 20, height: 40 },
    catchZone: { visible: true, kind: "ellipse", x: 200, y: 600, radiusX: 80, radiusY: 30 },
    netZone: { visible: true, y: 650, width: 400, height: 50 },
    showSector: true, sectorClamped: true, sectorPoints: list([{ x: 200, y: 700 }, { x: 100, y: 300 }, { x: 300, y: 300 }]),
    apexX: 200, apexY: 700, axisEndX: 200, axisEndY: 686,
    showLineRadius: true, lineRadiusPoints: list([{ x: 100, y: 400 }, { x: 300, y: 400 }]) };
  assert.equal(areas.update(model), true);
  const ops = shapes.ops;
  assert.deepEqual(ops.slice(0, 2), [["rect", 0, 300, 20, 40], ["fill", style.lastDashFill]], "the last-dash band");
  assert.deepEqual(ops.slice(2, 7), [["moveTo", 0, 300], ["lineTo", 5, 300], ["moveTo", 10, 300], ["lineTo", 15, 300],
    ["stroke", { width: 2, color: style.lastDashStroke }]], "its line in the configured dash");
  assert(ops.some((op) => op[0] === "ellipse" && op[3] === 80), "the catch ellipse");
  assert(ops.some((op) => op[0] === "fill" && op[1] === style.sectorClampedFill), "a clamped sector uses its colours");
  assert(ops.some((op) => op[0] === "stroke" && op[1].width === 3 && op[1].color === style.sectorClampedStroke));
  const axis = ops.filter((op) => op[0] === "moveTo" && op[1] === 200 && op[2] >= 686 && op[2] <= 700);
  assert.equal(axis.length, 2, "the sector axis is dashed [6, 8]: 14 px is one dash and the start of the next");
  assert(ops.some((op) => op[0] === "stroke" && op[1].width === 4 && op[1].color === style.lineRadiusStroke));
  assert.equal(shapes.mask, areaMask, "clipped to the fight's water");
  assert.equal(areas.update(model), false);
  model.showSector = false;
  assert.equal(areas.update(model), true);
  styles.invalidate();
  assert.equal(areas.update(model), true, "a new style (config edit) redraws");
  assert.equal(areas.update({ visible: false }), true);
  assert.equal(areaContainer.visible, false);
}

// Spec 107 part B: the line, the rod (static picture and Spine view) and the float on the scene.
async function checkSceneTackle() {
  const fake = fakePixi();
  const dom = fakeDom();
  const stage = new fake.pixi.Container();
  const { PixiLineRenderer } = await importSource("src/platform/browser/scene/pixi_line_renderer.js");
  const { PixiRodRenderer } = await importSource("src/platform/browser/scene/pixi_rod_renderer.js");
  const { PixiFloatRenderer } = await importSource("src/platform/browser/scene/pixi_float_renderer.js");
  const line = new PixiLineRenderer({ pixi: fake.pixi, stage });
  const rod = new PixiRodRenderer({ pixi: fake.pixi, stage });
  const float = new PixiFloatRenderer({ pixi: fake.pixi, stage, documentTarget: dom.documentTarget });
  const [lineGraphics, rodContainer, floatContainer] = stage.children;
  const model = { visible: true, rodMode: "rectangle", rodBaseX: 200, rodBaseY: 700, rodTopY: 500, rodWidth: 3,
    rodHeight: 200, lineVisible: true, lineStartX: 200, lineStartY: 500, controlX: 210, controlY: 560, targetX: 220,
    targetY: 300, lineColor: "rgba(255, 255, 255, 0.3)", lineWidth: 1 };
  assert.equal(line.update(model), true);
  assert.deepEqual(lineGraphics.ops, [["rect", 198.5, 500, 3, 200], ["fill", 0x000000], ["moveTo", 200, 500],
    ["quadraticCurveTo", 210, 560, 220, 300], ["stroke", { width: 1, color: "rgba(255, 255, 255, 0.3)" }]],
    "RodLineRenderer's bar and curve, in the model's colour and width");
  assert.equal(line.update(model), false, "an unchanged line presents nothing");
  model.targetX += 1;
  assert.equal(line.update(model), true);
  assert.equal(rod.update(model), false, "the rectangle bar is the line's");
  assert.equal(rodContainer.visible, false);

  const image = { id: "rod-page", naturalWidth: 2739, naturalHeight: 89 };
  Object.assign(model, { rodMode: "static", rodImage: image, rodScale: 0.5,
    rodRegion: { x: 2, y: 2, width: 85, height: 2735, rotate: 90 }, rodBounds: { x: -40, y: 0, width: 85, height: 2735 } });
  assert.equal(rod.update(model), true);
  const [sprite] = rodContainer.children;
  assert.deepEqual([sprite.texture.frame.x, sprite.texture.frame.y, sprite.texture.frame.width, sprite.texture.frame.height],
    [2, 2, 2735, 85], "a region stored rotated is cut with its sides swapped");
  assert.equal(sprite.texture.source.pixelWidth, 2739, "from the atlas page");
  assert.deepEqual([sprite.x, sprite.y, sprite.rotation, sprite.width, sprite.height],
    [200 + (-40 + 85) * 0.5, 700 - 2735 * 0.5, Math.PI / 2, 2735 * 0.5, 85 * 0.5],
    "turned back over the setup bounds, as RodStaticRenderer draws it");
  assert.equal(rod.update(model), false, "a still static rod presents nothing");
  assert.equal(fake.textures.length, 1, "one page texture, reused");

  const view = new fake.pixi.Container();
  view.scale = { set: (x, y) => { view.scaleX = x; view.scaleY = y; } };
  Object.assign(model, { rodMode: "spine", rodView: view, rodViewScale: 0.5, rodDestX: 80, rodDestY: 250 });
  assert.equal(rod.update(model), true);
  assert.equal(view.parent, rodContainer, "the scene's Spine view is drawn at the rod's depth");
  assert.deepEqual([view.x, view.y, view.scaleX, sprite.visible], [80, 250, 0.5, false],
    "placed where the GL surface used to be copied, surface pixels scaled to logical ones");
  assert.equal(rod.update(model), true, "a Spine pose moves every frame");
  const next = new fake.pixi.Container();
  next.scale = view.scale;
  model.rodView = next;
  rod.update(model);
  assert.deepEqual([view.parent, next.parent], [null, rodContainer], "a new skin's view replaces the old one");
  assert.equal(rod.update(null), true, "off the scene it hides once");
  assert.equal(next.parent, null);
  rod.dispose();
  assert.deepEqual([fake.textures[0].destroyed], [true], "the page texture is released with the scene");

  const floatModel = { visible: true, kind: "float", x: 300, y: 400, color: "#ff3300", glow: true, glowBlur: 8, width: 3,
    height: 15, radius: 2.5, radiusX: 6, radiusY: 3, rotationRad: 0.2 };
  assert.equal(float.update(floatModel), true);
  const [glow, shape] = floatContainer.children;
  assert.deepEqual([floatContainer.x, floatContainer.y, shape.rotation], [300, 400, 0.2]);
  assert.deepEqual(shape.ops, [["rect", -1.5, -15, 3, 15], ["fill", "#ff3300"]], "FloatRenderer's float body");
  assert.deepEqual([glow.visible, glow.tint, glow.width, glow.height], [true, "#ff3300", 3 + 24, 15 + 24],
    "the glow is a halo in the tackle's colour over the shape plus the blur's reach");
  assert.equal(float.update(floatModel), false);
  floatModel.kind = "lure";
  floatModel.glow = false;
  assert.equal(float.update(floatModel), true);
  assert.deepEqual([shape.ops[0], glow.visible, shape.rotation], [["circle", 0, 0, 2.5], false, 0]);
  assert.equal(float.update({ visible: false }), true);
  assert.equal(floatContainer.visible, false);
  float.dispose();

  // Spec 127: an image float shows the top visibleShare of its art through its own texture frame (no mask, no
  // stretching); a night float adds its tip glow additively, cropped the same way.
  const art = fake.pixi.Texture.from({ resource: { naturalWidth: 33, naturalHeight: 384 }, autoGenerateMipmaps: true }, true);
  const glowArt = fake.pixi.Texture.from({ resource: { naturalWidth: 49, naturalHeight: 392 }, autoGenerateMipmaps: true }, true);
  const sceneTextures = { get: (id) => ({ "float.webp": art, "glow.webp": glowArt })[id] ?? null };
  const imageFloat = new PixiFloatRenderer({ pixi: fake.pixi, stage, documentTarget: dom.documentTarget,
    textures: sceneTextures });
  const imageContainer = stage.children.at(-1);
  const [, imageShape, body, tipGlow] = imageContainer.children;
  const imageModel = { visible: true, kind: "float", x: 10, y: 20, color: "#ffffff", glow: false, glowBlur: 8, width: 6,
    height: 30, radius: 2.5, radiusX: 6, radiusY: 3, rotationRad: -0.3, imageId: "float.webp", tipGlowId: "",
    tipGlowPad: 8, bodyHeight: 100, visibleShare: 0.3 };
  assert.equal(imageFloat.update(imageModel), true);
  assert.deepEqual([body.visible, body.texture.frame.height, body.texture.source, body.width, body.height, body.rotation,
    body.anchor.x, body.anchor.y], [true, 384 * 0.3, art.source, 100 * 33 / 384, 30, -0.3, 0.5, 1],
  "the body shows the art's top 30 % from the waterline up, in the art's proportions, turned by the roll");
  assert.deepEqual([tipGlow.visible, imageShape.ops.length], [false, 0], "a day float has no glow and no bar");
  const frameTexture = body.texture;
  imageModel.visibleShare = 0.1;
  assert.equal(imageFloat.update(imageModel), true);
  assert.equal(body.texture, frameTexture, "a dip reuses the frame texture");
  assert.deepEqual([body.texture.frame.height, body.height], [384 * 0.1, 10], "sinking crops the art, never stretches it");
  imageModel.tipGlowId = "glow.webp";
  assert.equal(imageFloat.update(imageModel), true);
  const toScreen = 100 / 384;
  assert.deepEqual([tipGlow.visible, tipGlow.blendMode, tipGlow.texture.frame.height, tipGlow.height, tipGlow.width],
    [true, "add", 8 + 384 * 0.1, 10 + 8 * toScreen, 100 * 33 / 384 + 16 * toScreen],
    "the night tip glow adds light over the same visible part, plus its blur margin");
  assert.equal(imageFloat.update(imageModel), false, "an unchanged image float presents nothing");
  imageFloat.dispose();
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
  assert.equal(CONFIG.canvas.scene, "webgl", "production draws the background on the scene (spec 105 D6)");
  const warnings = [];
  const options = (overrides) => {
    const dom = fakeDom();
    return { dom, value: { config: { canvas: { scene: "canvas", backgroundColor: "#0f171e" } }, documentTarget: dom.documentTarget,
      gameCanvas: dom.gameCanvas, canvasMetrics: { width: 4, height: 4, pixelRatio: 1 }, images: fakeImages([]),
      clock: { now: 0 }, fightAreaStyles: { resolve: () => ({}) }, probe: recordingProbe(),
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

  assert.match(read(SCENE_COMPOSITION),
    /SCENE_RENDERED_KINDS = Object\.freeze\(\["background", "world-entities", "fight-areas", "line", "rod", "float"\]\)/u,
    "stage 4: the scene draws every world kind (specs 105, 107)");
  const rodComposition = read("src/bootstrap/production/rod_animation_composition.js");
  assert.match(rodComposition, /drawsRod: \(\) => scene\.router\.drawsOnScene\("rod"\)/u,
    "with the WebGL scene the rod's surface is the scene's (spec 107 D6)");
  assert.match(rodComposition, /scene\.layer\.whenReady\(\)\.then[\s\S]*import\("\.\.\/\.\.\/platform\/browser\/scene\/pixi_runtime_module\.js"\)/u,
    "the Spine runtime is the scene's own bundle, once the scene is ready");
  assert.match(read("src/bootstrap/production/game_composition_root.js"),
    /scene: \{ layer: sceneLayer, router: sceneRouter, webgl: transparentCanvas \}/u);
  assert.match(read(SCENE_COMPOSITION), /fightAreaStyles, probe, logger,/u, "the scene gets the 2D fight area styles");
  assert.match(read("src/bootstrap/production/game_composition_root.js"), /fightAreaStyles: fightAreaStyleResolver/u,
    "one fight area style resolver for both layers");
  assert.match(read(SCENE_COMPOSITION), /clock, getWaterSettings: \(\) => config\.canvas\?\.water,/u,
    "the scene times its water with the game clock and reads the water settings live (spec 106)");
  assert.equal(CONFIG.canvas.water.enabled, true, "production animates the water (spec 106)");
  const renderComposition = read("src/bootstrap/production/game_render_composition.js");
  const { SCENE_KINDS } = await importSource("src/game/presentation/rendering/scene_layer_router.js");
  for (const kind of SCENE_KINDS) {
    assert(renderComposition.includes(`sceneRouter.canvasVisibility("${kind}")`), `the ${kind} 2D component is gated`);
  }
  assert.match(renderComposition, /surface\.beginFrame\(runtime\.rendering\.sceneRouter\.clearsCanvas\(\)\)/u);
  const root = read("src/bootstrap/production/game_composition_root.js");
  assert.match(root, /contextAttributes: \{ alpha: transparentCanvas \}/u, "the scene mode decides the 2D canvas alpha");
  assert.match(root, /await sceneLayer\.whenReady\(\);\n\s*sceneLayer\.prepare\(\[\.\.\.Object\.values\(systems\.map\.getBackgroundRenderData\(\)\.assetIds\)\.filter\(Boolean\), \.\.\.floatArt\]\)/u,
    "startup waits for the scene's warm-up frame, then uploads every background phase and the float art during loading");
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
  let status = { state: "active", webglVersion: 2, width: 400, height: 816, pixelRatio: 1.76, textures: 3,
    textureBytes: 3 * 2560 * 1440 * 4 * 4 / 3, water: { active: true, mapWidth: 192, mapHeight: 48, stepMs: 0.123,
      driftSpeed: 15.04 } };
  const layer = { getStatus: () => status, loseContext: () => layerCalls.push("lose"), restoreContext: () => layerCalls.push("restore") };
  const router = new SceneLayerRouter({ kinds: SCENE_KINDS, sceneKinds: [], isSceneActive: () => true, mode: "webgl" });
  router.update();
  const waterEditors = [];
  new SceneLayerDevSection({ ui, scene: { layer, router }, createSection: () => content,
    renderWaterConfig: (parent) => waterEditors.push(parent) }).render({});
  assert(rows.includes("вода: анімується · карта 192×48 · крок 0.12 мс · течія 15.0 пікс/с"),
    "the water's state, step cost and drift are shown");
  assert.equal(waterEditors.length, 1, "the live editor of CONFIG.canvas.water sits in the section");
  assert.match(read("src/dev/tools/dev_tools.js"),
    /renderWaterConfig: \(parent\) => this\.#buildTree\(this\.#config\.canvas\.water, parent, \["CONFIG", "canvas", "water"\]\)/u);
  assert(rows.includes("шар WebGL: активний") && rows.includes("рендерер: WebGL 2 · 400×816 @ 1.76×"));
  assert(rows.includes("текстури сцени: 3 · 56.3 МБ"), "texture memory is shown (rule 19)");
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
  assert.deepEqual(lazyImporters.filter(([, target]) => target.includes("/scene/pixi_")).sort(),
    [["src/bootstrap/production/rod_animation_composition.js", RUNTIME_MODULE], [SCENE_COMPOSITION, RUNTIME_MODULE]],
    "Pixi is reached only lazily: by the scene composition, and by the rod's Spine runtime once the scene is ready");
  return staticGraph.size;
}

function checkSceneInputShield() {
  const css = read("src/game/presentation/styles/game-shell.css");
  const rule = (selector) => css.match(new RegExp(`${selector.replace(/[.]/gu, "\\.")} \\{([^}]*)\\}`, "u"))?.[1] ?? "";
  assert(rule(".game-shell__scene").includes("pointer-events: none;"), "the scene canvas cannot steal game input");
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
  await checkTextureCacheAndBackground();
  await checkWaterWaveField();
  await checkSceneWorldKinds();
  await checkSceneTackle();
  await checkPixiSceneLayer();
  await checkCoordinator();
  await checkSurfaceClear();
  const { entry, size } = checkVendor();
  await checkComposition();
  await checkRuntimeModule(entry);
  await checkDevWiring();
  const productionModules = checkProductionGraph();
  checkSceneInputShield();
  await settle();
  console.log(`Scene layer passed: port and lazy layer (warm-up wait, late arrival, failure), router (depth order, `
    + `mode switch, fallback on a lost context, 2D clear), texture cache (mipmaps, upload, one more per frame, reload, release) and background `
    + `(phases, change detection, art density), water wave field (deterministic, moving, edge fade, perspective), `
    + `change fingerprints, dashes, text textures, world entities and fight areas (2D colours, clips, frames only on change), `
    + `line, rod (static region, Spine view at the rod's depth) and float (shapes, glow halo), `
    + `PixiSceneLayer over a fake Pixi (no ticker/events/GC, warm-up, frames only on change, portrait art 1:1, water `
    + `steps at its frame rate over the visible zone, context loss and restore, DEV status, dispose), one routing decision per frame, `
    + `"canvas"/"webgl" composition with a real no-WebGL fallback, every world kind gated on the 2D canvas, DEV `
    + `section, runtime ${entry.version} with stopped tickers, CSS, bundle (${size} bytes), ${productionModules} `
    + `production modules loading Pixi only lazily.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
