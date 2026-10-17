"use strict";

// Spine in the engine (spec 099): the vendored 4.3 runtime against the owner's bamboo rod export, atlas reading,
// bundle loading through AssetLoadQueue, the GL surface lifecycle, the scene adapter (placement, tracks, points,
// bounds, failures, dispose), the transport and the scalar smoother. No WebGL: textures and the surface are fakes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "..");
const EXPORT_DIR = "assets/animations/rods/bamboo-rod-v1";
const DESCRIPTOR = Object.freeze({
  skeleton: `${EXPORT_DIR}/rod.json`, atlas: `${EXPORT_DIR}/rod.atlas`, skin: "rod-1", linePoint: "line-tip",
});
const near = (actual, expected, tolerance, label) =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);
const read = (file) => fs.readFileSync(path.join(ROOT_DIR, file), "utf8");
const timers = { setTimeout, clearTimeout };

function checkVendorManifest() {
  const manifest = JSON.parse(read("vendor/manifest.json"));
  const entry = manifest.packages.find((item) => item.name === "@esotericsoftware/spine-webgl");
  assert.equal(entry.version, "4.3.13", "the manifest pins the runtime the module reports");
  assert.equal(entry.importer, "src/platform/browser/animation/spine_runtime_module.js");
  const tracked = require("node:child_process").spawnSync("git", ["ls-files", "--", EXPORT_DIR, entry.file, entry.license],
    { cwd: ROOT_DIR, encoding: "utf8" }).stdout.split(/\r?\n/u).filter(Boolean);
  for (const file of [DESCRIPTOR.skeleton, DESCRIPTOR.atlas, `${EXPORT_DIR}/rod.webp`, entry.file, entry.license]) {
    assert(tracked.includes(file), `${file} is tracked in git (Pages serves tracked files only)`);
  }
  return entry.version;
}

function checkAtlasReader(SpineAtlasTextReader) {
  const { pages } = SpineAtlasTextReader.read(read(DESCRIPTOR.atlas));
  assert.equal(pages.length, 1);
  assert.deepEqual({ ...pages[0], regions: undefined },
    { name: "rod.webp", width: 2739, height: 89, pma: false, minFilter: "Linear", magFilter: "Linear", regions: undefined });
  assert.deepEqual({ ...pages[0].regions[0] },
    { name: "bamboo_rod--1", x: 2, y: 2, width: 85, height: 2735, rotate: 90, index: -1 });
  const twoPages = SpineAtlasTextReader.read("a.webp\nsize:4,4\npma:true\nr1\nbounds:0,0,2,2\n\nb.webp\nsize:8,8\nr2\nrotate:true\n");
  assert.deepEqual(twoPages.pages.map((page) => [page.name, page.pma, page.regions[0].name, page.regions[0].rotate]),
    [["a.webp", true, "r1", 0], ["b.webp", false, "r2", 90]], "a blank line starts the next page");
  assert.throws(() => SpineAtlasTextReader.read(""), /empty atlas/u);
  assert.throws(() => SpineAtlasTextReader.read("a.webp\nfilter:Linear,Linear\n"), /has no size/u);
  assert.throws(() => SpineAtlasTextReader.read("../a.webp\nsize:4,4\n"), /relative file name/u);
}

function fakeTransport({ failText = null, failJson = null, failImage = null } = {}) {
  const calls = [];
  return {
    calls,
    async loadText(url) {
      calls.push(url);
      if (url === failText) throw new Error(`404 ${url}`);
      return url.endsWith(".atlas") && url.includes("broken") ? "page\n" : read(url);
    },
    async loadJson(url) {
      calls.push(url);
      if (url === failJson) throw new Error(`404 ${url}`);
      return JSON.parse(read(url));
    },
    async loadImage(url) {
      calls.push(url);
      if (url === failImage) throw new Error(`404 ${url}`);
      return { url, width: 2739, height: 89 };
    },
  };
}

async function checkBundleLoader(SpineBundleLoader, AssetLoadQueue) {
  const queue = () => new AssetLoadQueue({ scheduler: timers, maxAttempts: 1 });
  const transport = fakeTransport();
  const loader = new SpineBundleLoader({ queue: queue(), transport });
  const load = loader.load(DESCRIPTOR);
  const pages = await load.pages;
  assert.equal(pages.status, "ready", "atlas and pages are ready on their own (static picture)");
  assert.deepEqual([...pages.pages.keys()], ["rod.webp"]);
  assert.equal(pages.pages.get("rod.webp").url, `${EXPORT_DIR}/rod.webp`, "pages resolve next to the atlas");
  const result = await load.result;
  assert.equal(result.status, "ready");
  assert.equal(result.bundle.version, "4.3.26");
  assert.equal(result.bundle.skin, "rod-1");
  assert.equal(result.bundle.linePoint, "line-tip");
  assert.deepEqual([...transport.calls].sort(), [DESCRIPTOR.atlas, `${EXPORT_DIR}/rod.webp`, DESCRIPTOR.skeleton].sort(),
    "one request per resource");

  const shared = fakeTransport();
  const sharedLoader = new SpineBundleLoader({ queue: queue(), transport: shared });
  const [one, two] = [sharedLoader.load(DESCRIPTOR), sharedLoader.load(DESCRIPTOR)];
  await Promise.all([one.result, two.result]);
  assert.equal(shared.calls.length, 3, "concurrent loads of one bundle share the queue jobs");

  const outcome = async (options, descriptor = DESCRIPTOR) =>
    (await new SpineBundleLoader({ queue: queue(), transport: fakeTransport(options) }).load(descriptor).result).reason;
  assert.equal(await outcome({ failText: DESCRIPTOR.atlas }), "atlas-failed");
  assert.equal(await outcome({ failImage: `${EXPORT_DIR}/rod.webp` }), "page-failed");
  assert.equal(await outcome({ failJson: DESCRIPTOR.skeleton }), "skeleton-failed");
  assert.equal(await outcome({}, { ...DESCRIPTOR, atlas: `${EXPORT_DIR}/broken.atlas` }), "atlas-invalid");
  const released = new SpineBundleLoader({ queue: queue(), transport: fakeTransport() }).load(DESCRIPTOR);
  released.release();
  assert.equal((await released.result).reason, "cancelled", "a released load settles as cancelled");
  assert.throws(() => new SpineBundleLoader({ queue: {}, transport }), /requires an AssetLoadQueue/u);
}

function fakeSurface({ height = 600, maxTextureSize = 4096 } = {}) {
  const listeners = new Set();
  return {
    width: 300, height, maxTextureSize, gl: null, canvas: { id: "gl-canvas" }, lost: false,
    ensureContext: () => true,
    resize(width, nextHeight) { this.width = Math.max(1, Math.ceil(width)); this.height = Math.max(1, Math.ceil(nextHeight)); },
    isContextLost() { return this.lost; },
    onContextChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    emit(lost) { this.lost = lost; for (const listener of listeners) listener(lost); },
    get listenerCount() { return listeners.size; },
  };
}

function fakeGraphics() {
  const graphics = { textures: [], restores: 0, disposed: 0 };
  graphics.createTexture = (image, pma) => {
    const texture = { image, pma, disposed: false, setFilters() {}, setWraps() {}, getImage: () => image,
      dispose() { this.disposed = true; } };
    graphics.textures.push(texture);
    return texture;
  };
  graphics.createRenderer = () => { throw new Error("no WebGL renderer in Node"); };
  graphics.restore = () => { graphics.restores += 1; };
  graphics.dispose = () => { graphics.disposed += 1; };
  return graphics;
}

async function realBundle(SpineBundleLoader, AssetLoadQueue, overrides = {}) {
  const loader = new SpineBundleLoader({ queue: new AssetLoadQueue({ scheduler: timers }), transport: fakeTransport() });
  const { bundle } = await loader.load(DESCRIPTOR).result;
  return { ...bundle, ...overrides };
}

async function checkScene(spine, SpineScene, SKELETAL_SCENE_METHODS, bundle) {
  const create = (overrides = {}) => {
    const surface = overrides.surface ?? fakeSurface();
    const graphics = fakeGraphics();
    const created = SpineScene.create({ spine, bundle: overrides.bundle ?? bundle, surface, graphics,
      runtimeVersion: overrides.runtimeVersion ?? "4.3.13" });
    return { ...created, surface, graphics };
  };
  for (const method of SKELETAL_SCENE_METHODS) {
    assert.equal(typeof SpineScene.prototype[method], "function", `SpineScene implements ${method}`);
  }
  assert.equal(create({ runtimeVersion: "4.2.120" }).reason, "version-mismatch");
  assert.equal(create({ bundle: { ...bundle, skin: "rod-9" } }).reason, "skin-missing");
  assert.equal(create({ bundle: { ...bundle, pages: new Map() } }).reason, "page-missing");
  assert.equal(create({ surface: fakeSurface({ maxTextureSize: 2048 }) }).reason, "texture-too-large");
  const invalid = create({ bundle: { ...bundle, skeleton: "{ not json" } });
  assert.equal(invalid.reason, "skeleton-invalid");
  assert(invalid.graphics.textures.every((texture) => texture.disposed), "a failed scene disposes its textures");

  const { scene, surface, graphics } = create();
  assert(scene, "the bamboo rod builds a scene");
  assert.equal(graphics.textures.length, 1);
  assert.equal(graphics.textures[0].pma, false, "the page's straight alpha reaches the texture");
  for (const clip of ["rod_idle-2", "rod_idle-1--left", "rod_idle-1--right", "rod_fighting-1--left",
    "rod_fighting-1--front", "rod_fighting-1--right"]) {
    assert(scene.hasClip(clip), `${clip} exists`);
  }
  near(scene.clipDuration("rod_fighting-1--front"), 3.333333, 1e-5, "fight ramp duration");

  const point = { x: 0, y: 0 };
  scene.setPlacement(0, surface.height, 1);
  scene.update(0);
  assert(scene.getPoint("line-tip", point));
  near(point.x, 1.21, 0.01, "setup line-tip x");
  near(point.y, surface.height - 466.06, 0.01, "setup line-tip y (surface y down)");
  scene.setPlacement(100, 500, 0.5);
  scene.update(0);
  scene.getPoint("line-tip", point);
  near(point.x, 100 + 1.21 * 0.5, 0.01, "placed x");
  near(point.y, 500 - 466.06 * 0.5, 0.01, "placed y");

  scene.setPlacement(0, surface.height, 1);
  scene.setSampled(1, "rod_fighting-1--front", 1, 1);
  scene.update(0.016);
  scene.getPoint("line-tip", point);
  near(point.x, 1.27, 0.02, "full front bend x");
  near(surface.height - point.y, 328.27, 0.02, "full front bend height");
  const front = { ...point };
  // Front keys only scale, the sides only rotation, so front alpha 1 - |side| and side alpha |side| blend exactly.
  scene.setSampled(1, "rod_fighting-1--front", 1, 0);
  scene.setSampled(2, "rod_fighting-1--left", 1, 1);
  scene.update(0.016);
  scene.getPoint("line-tip", point);
  near(point.x, -237.54, 0.02, "full side weight is the pure left bend x");
  near(surface.height - point.y, 326.65, 0.02, "full side weight is the pure left bend height");
  scene.setSampled(1, "rod_fighting-1--front", 1, 0.5);
  scene.setSampled(2, "rod_fighting-1--left", 1, 0.5);
  scene.update(0.016);
  scene.getPoint("line-tip", point);
  assert(point.x < front.x && point.x > -237.54, "half side weight lies between front and left");
  scene.setSampled(1, "rod_fighting-1--front", 0, 1);
  scene.setSampled(2, "rod_fighting-1--left", 0, 1);
  scene.update(0.016);
  scene.getPoint("line-tip", point);
  near(point.x, 1.21, 0.01, "zero bend is the setup pose again (no build-up between frames)");
  scene.clearTrack(1);
  scene.clearTrack(2);

  scene.setLoop(0, "rod_idle-2");
  scene.update(1.3333334);
  scene.getPoint("line-tip", point);
  assert(Math.abs(point.x - 1.21) > 0.05, "the idle clip moves the tip");
  const swayed = point.x;
  scene.setLoop(0, "rod_idle-2");
  scene.update(0);
  scene.getPoint("line-tip", point);
  near(point.x, swayed, 1e-9, "setting the same loop does not restart it");
  scene.setTrackTimeScale(0, 0);
  scene.update(1);
  scene.getPoint("line-tip", point);
  near(point.x, swayed, 1e-9, "time scale 0 holds the idle (reduced motion)");

  assert.equal(scene.setLoop(3, "rod_cast-1"), false);
  assert.deepEqual(scene.getMissingClips(), ["rod_cast-1"], "a missing clip is recorded, not thrown");
  assert(scene.getPoint("bone30", point), "a bone name is a point");
  assert(scene.getPoint("no-such-point", point), "an unknown point falls back to the deepest bone tip");

  const bounds = scene.getLocalBounds({});
  assert(bounds.x <= -237.54 && bounds.x + bounds.width >= 10 && bounds.y <= -2 && bounds.y + bounds.height >= 466,
    `bounds cover the setup pose and the full bends: ${JSON.stringify(bounds)}`);

  surface.emit(true);
  assert.equal(scene.render(), false, "nothing is drawn while the context is lost");
  surface.emit(false);
  assert.equal(graphics.restores, 1, "a restored context re-uploads once");
  scene.dispose();
  scene.dispose();
  assert.equal(surface.listenerCount, 0, "dispose unsubscribes from the surface");
  assert(graphics.textures.every((texture) => texture.disposed), "dispose releases the page textures");
  assert.equal(graphics.disposed, 1);
}

function fakeCanvas({ webgl = true } = {}) {
  const listeners = new Map();
  const gl = { MAX_TEXTURE_SIZE: 0x0d33, getParameter: () => 4096, getExtension: () => null };
  return {
    width: 300, height: 150, contexts: [],
    getContext(kind, attributes) { this.contexts.push([kind, attributes]); return webgl && kind === "webgl" ? gl : null; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    fire(type) { listeners.get(type)?.({ preventDefault: () => { this.prevented = true; } }); },
    get listenerTypes() { return [...listeners.keys()]; },
  };
}

function checkSurface(SpineGlSurface) {
  const none = new SpineGlSurface({ createCanvas: () => fakeCanvas({ webgl: false }) });
  assert.equal(none.ensureContext(), false, "no WebGL: no context, the caller keeps the static picture");
  const canvas = fakeCanvas();
  const surface = new SpineGlSurface({ createCanvas: () => canvas });
  assert.equal(surface.ensureContext(), true);
  assert.deepEqual(canvas.contexts.map(([kind]) => kind), ["webgl2", "webgl"], "WebGL 2 first, WebGL 1 next");
  assert.equal(canvas.contexts[0][1].preserveDrawingBuffer, false);
  assert.equal(canvas.contexts[0][1].premultipliedAlpha, true);
  assert.equal(surface.maxTextureSize, 4096);
  surface.resize(120.2, 0);
  assert.deepEqual([surface.width, surface.height], [121, 1], "integer pixels, at least 1");
  const seen = [];
  const unsubscribe = surface.onContextChange((lost) => seen.push(lost));
  canvas.fire("webglcontextlost");
  assert.equal(canvas.prevented, true, "the lost event is prevented so the context can come back");
  assert.equal(surface.isContextLost(), true);
  assert.equal(surface.maxTextureSize, 0);
  canvas.fire("webglcontextrestored");
  assert.deepEqual(seen, [true, false]);
  unsubscribe();
  surface.dispose();
  assert.deepEqual(canvas.listenerTypes, [], "dispose removes the context listeners");
  assert.equal(surface.ensureContext(), false, "a disposed surface stays without context");
}

async function checkTransport(BrowserAssetTransport) {
  const transport = new BrowserAssetTransport({
    fetchResource: async (url) => (url.includes("missing")
      ? { ok: false, status: 404 } : { ok: true, text: async () => (url.endsWith(".json") ? '{"a":1}' : "text") }),
    createImage: () => ({ src: "", decoding: "", decode: async () => {} }),
  });
  assert.equal(await transport.loadText("a.atlas"), "text");
  assert.deepEqual(await transport.loadJson("a.json"), { a: 1 });
  await assert.rejects(transport.loadText("missing.atlas"), /HTTP 404/u);
  const image = await transport.loadImage("a.webp");
  assert.equal(image.src, "a.webp");
  assert.equal(image.decoding, "async");
  assert.equal(await transport.loadImage("a.webp", { cancelled: true }), null, "a cancelled image is dropped");
  assert.equal(await transport.loadText("a.atlas", { cancelled: true }), null);
}

function checkSmoother(ScalarSmoother) {
  for (const fps of [30, 60, 144]) {
    const smoother = new ScalarSmoother({ timeConstantSec: 0.12 });
    const frames = Math.round(0.12 * fps);
    for (let frame = 0; frame < frames; frame += 1) smoother.step(1, 1 / fps);
    near(smoother.value, 1 - Math.exp(-frames / fps / 0.12), 1e-12, `exact approach at ${fps} fps`);
    near(smoother.value, 0.632, 0.06, `about 63 % after one time constant at ${fps} fps`);
  }
  const snap = new ScalarSmoother({ timeConstantSec: 0 });
  assert.equal(snap.step(0.7, 0.016), 0.7, "no time constant follows at once");
  assert.equal(snap.step(Number.NaN, 0.016), 0.7, "a non-finite target keeps the value");
  snap.reset(0.2);
  assert.equal(snap.value, 0.2);
}

function checkSetupPose(SpineSetupPoseReader, bundle) {
  const pose = bundle.staticPose;
  assert(pose, "the bundle carries the static setup pose");
  near(pose.bounds.x, -6.404351, 1e-6, "header bounds x");
  near(pose.bounds.height, 468.857, 1e-6, "header bounds height");
  near(pose.linePoint.x, 1.21, 0.01, "setup line-tip x without the runtime");
  near(pose.linePoint.y, 466.06, 0.01, "setup line-tip y without the runtime");
  assert.deepEqual([pose.region.pageName, pose.region.name, pose.region.rotate, pose.region.width, pose.region.height],
    ["rod.webp", "bamboo_rod--1", 90, 85, 2735], "the one drawn region");
  const atlas = { pages: [{ name: "p.webp", regions: [{ name: "a", x: 0, y: 0, width: 4, height: 8, rotate: 0 }] }] };
  const json = (overrides = {}) => ({
    skeleton: { x: 0, y: 0, width: 4, height: 8 },
    bones: [{ name: "root" }, { name: "tip", parent: "root", y: 8, ...overrides.tip }],
    slots: overrides.slots ?? [{ name: "s", bone: "root", attachment: "a" }],
    skins: [{ name: "default", attachments: { s: { a: { type: "mesh" }, p: { type: "point", x: 1, y: 2 } } } }],
  });
  assert.deepEqual({ ...SpineSetupPoseReader.read(json(), atlas, { linePoint: "p" }).linePoint }, { x: 1, y: 2 },
    "a point attachment is a line point");
  assert.equal(SpineSetupPoseReader.read(json({ tip: { shearX: 5 } }), atlas, { linePoint: "tip" }).linePoint, null,
    "a sheared chain is not followed");
  const twoSlots = json({ slots: [{ name: "s", bone: "root", attachment: "a" }, { name: "s", bone: "root", attachment: "a" }] });
  assert.equal(SpineSetupPoseReader.read(twoSlots, atlas, {}).region, null, "two drawn slots have no single picture");
}

function checkResolver(RodAnimationStateResolver, config) {
  const resolver = new RodAnimationStateResolver();
  const out = resolver.createSnapshot();
  const input = (overrides) => ({ state: "waiting", stressRatio: 0.5, fishScreenX: 640, rodBaseX: 640, canvasWidth: 1000,
    windDirection: 0, rainMultiplier: 1, reducedMotion: false, ...overrides });
  for (const [wind, clip] of [[-1, config.windClips.left], [0, config.windClips.calm], [1, config.windClips.right]]) {
    resolver.resolve(input({ windDirection: wind }), config, out);
    assert.equal(out.idleClip, clip, `wind ${wind} plays ${clip}`);
    assert.equal(out.fighting, false);
    assert.equal(out.bendTarget, 0, "no bend outside the fight");
  }
  resolver.resolve(input({ reducedMotion: true }), config, out);
  assert.equal(out.idleTimeScale, 0, "reduced motion holds the idle");
  resolver.resolve(input({ rainMultiplier: 1.5 }), { ...config, windRainTimeScale: true }, out);
  assert.equal(out.idleTimeScale, 1.5, "rain speeds the sway only when enabled");
  resolver.resolve(input({ rainMultiplier: 1.5 }), config, out);
  assert.equal(out.idleTimeScale, 1);
  resolver.resolve(input({ state: "playing", fishScreenX: 640 - 350 * 0.5, stressRatio: 1.4 }), config, out);
  assert.equal(out.fighting, true);
  assert.equal(out.sideClip, config.fightClips.left, "a fish left of the rod bends it left");
  near(out.side, -0.5, 1e-12, "side is the offset over sideRangeRatio of the width");
  near(out.frontAlpha + out.sideAlpha, 1, 1e-12, "front and side weights sum to one");
  assert.equal(out.bendTarget, 1, "rod stress is clamped to 0..1");
  resolver.resolve(input({ state: "playing", fishScreenX: 5000 }), config, out);
  assert.deepEqual([out.sideClip, out.side, out.frontAlpha], [config.fightClips.right, 1, 0], "far right is the pure side");
}

function recordingSurface() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    set strokeStyle(value) { calls.push(["strokeStyle", value]); },
    set lineWidth(value) { calls.push(["lineWidth", value]); },
    fillRect: record("fillRect"), save: record("save"), restore: record("restore"), beginPath: record("beginPath"),
    moveTo: record("moveTo"), quadraticCurveTo: record("quadraticCurveTo"), stroke: record("stroke"),
    translate: record("translate"), rotate: record("rotate"), drawImage: record("drawImage"),
  };
}

async function checkController({ RodAnimationController, RodAnimationStateResolver, SpineScene, spine, bundle, config }) {
  const surface = fakeSurface();
  const runtimeOutcome = { available: true, reason: null, runtime: { version: "4.3.13",
    createScene: (sceneBundle, glSurface) => SpineScene.create({ spine, bundle: sceneBundle, surface: glSurface,
      graphics: fakeGraphics(), runtimeVersion: "4.3.13" }) } };
  let runtime = runtimeOutcome;
  let forceStatic = false;
  const loads = [];
  const controller = new RodAnimationController({
    loadBundle: (descriptor) => {
      const load = { descriptor, released: false, release() { this.released = true; } };
      load.result = Promise.resolve({ status: "ready", bundle });
      loads.push(load);
      return load;
    },
    loadRuntime: async () => runtime,
    glSurface: surface,
    resolver: new RodAnimationStateResolver(),
    getConfig: () => config,
    forceStatic: () => forceStatic,
  });
  const context = (overrides = {}) => ({ dtSec: 1 / 60, state: "waiting", stressRatio: 0, fishScreenX: 640, baseX: 640,
    baseY: 800, canvasWidth: 1280, canvasHeight: 800, windDirection: 0, rainMultiplier: 1, ...overrides });
  const flush = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve(); };

  controller.setSkin(null);
  let anchor = controller.advance(context());
  assert.deepEqual([anchor.mode, anchor.tipX, anchor.tipY], ["rectangle", 640, 600], "no animated skin: today's rectangle top");

  const animation = { skeleton: DESCRIPTOR.skeleton, atlas: DESCRIPTOR.atlas, skin: "rod-1", linePoint: "line-tip" };
  runtime = { available: false, runtime: null, reason: "import-failed" };
  controller.setSkin(animation);
  controller.setSkin({ ...animation });
  assert.equal(loads.length, 1, "the same descriptor does not reload");
  assert.equal(controller.advance(context()).mode, "rectangle", "the rectangle stays until the bundle is ready");
  await flush();
  anchor = controller.advance(context());
  assert.equal(anchor.mode, "static", "an unavailable runtime keeps the static picture");
  assert.equal(controller.getStatus().reason, "import-failed");
  const scale = (800 * config.heightRatio) / bundle.staticPose.bounds.height;
  near(anchor.tipX, 640 + 1.21 * scale, 0.01, "static tip x from the setup pose");
  near(anchor.tipY, 800 - 466.06 * scale, 0.01, "static tip y from the setup pose");
  const staticTip = { x: anchor.tipX, y: anchor.tipY };

  runtime = runtimeOutcome;
  controller.setSkin(null);
  assert.equal(loads[0].released, true, "a skin change releases the previous load");
  controller.setSkin(animation);
  await flush();
  anchor = controller.advance(context({ dtSec: 0 }));
  assert.equal(anchor.mode, "spine");
  near(anchor.tipX, staticTip.x, 0.02, "the Spine tip at rest matches the static tip x");
  near(anchor.tipY, staticTip.y, 0.02, "the Spine tip at rest matches the static tip y");
  const originX = 640 - anchor.destX;
  const originY = 800 - anchor.destY;
  assert(originX > 0 && originX < surface.width && originY > 0 && originY <= surface.height,
    `the rod base lies inside the GL surface: origin ${originX},${originY} in ${surface.width}x${surface.height}`);
  for (let frame = 0; frame < 60; frame += 1) {
    anchor = controller.advance(context({ state: "playing", stressRatio: 1, fishScreenX: 0 }));
  }
  assert(anchor.tipX < staticTip.x - 50 * scale, "a loaded rod bends toward a fish on its left");
  assert(controller.getStatus().bend > 0.99, "the bend reaches the load after many time constants");
  const bentX = anchor.tipX;
  for (let frame = 0; frame < 3; frame += 1) anchor = controller.advance(context());
  assert(anchor.tipX < staticTip.x && anchor.tipX > bentX, "after the fight the rod springs back on the same side");
  for (let frame = 0; frame < 120; frame += 1) anchor = controller.advance(context());
  near(controller.getStatus().bend, 0, 0.001, "the bend relaxes to zero");
  surface.lost = true;
  assert.equal(controller.advance(context()).mode, "static", "a lost context shows the static picture");
  surface.lost = false;
  forceStatic = true;
  assert.equal(controller.advance(context()).mode, "static", "DEV spine=off forces the static picture");
  forceStatic = false;
  assert.equal(controller.advance(context()).mode, "spine");
  controller.setSkin(null);
  assert.equal(controller.advance(context()).mode, "rectangle", "removing the skin returns to the rectangle");
  controller.setSkin(animation);
  controller.setSkin(null);
  await flush();
  assert.equal(controller.advance(context()).mode, "rectangle", "a stale load does not come back");
  controller.dispose();
  controller.dispose();
}

function checkRenderModel({ FishingEquipmentRenderModelBuilder, RodAnimationController, RodAnimationStateResolver,
  RodLineRenderer, RodStaticRenderer, RodSpineRenderer, config }) {
  const controller = new RodAnimationController({
    loadBundle: () => ({ result: new Promise(() => {}), release() {} }), loadRuntime: async () => ({ available: false }),
    glSurface: fakeSurface(), resolver: new RodAnimationStateResolver(), getConfig: () => config,
  });
  const gameConfig = { ui: { rod: { x: "center", yOffset: 12 }, line: { sagOffset: 60 } } };
  const builder = new FishingEquipmentRenderModelBuilder({
    projector: {}, canvasMetrics: { width: 1280, height: 800 }, clock: { now: 1000, delta: 16 }, config: gameConfig,
    getRodScreenX: () => 610.5, rodAnimation: controller, getWind: () => ({ direction: 1, rainMult: 1 }),
  });
  const lineFrame = { renderRatio: 0.73, renderDrop: 4.5, straightFactor: 0.4 };
  const floatPosition = { x: 900.25, y: 333.5 };
  const anchor = builder.prepareRod({ state: "waiting", equipment: { rod: {} }, fightFrame: null, floatScreenX: 900.25 });
  assert.equal(anchor.tipY, 800 - 12 - 200, "the line frame's rod top equals today's base - 200");
  const target = {};
  builder.buildRodLine({ target, floatPosition, state: "waiting", tension: 0, lineFrame });
  // Today's formulas (before spec 099) for the same inputs.
  const rodBaseX = 610.5;
  const rodTopY = 800 - 12 - 200;
  const targetX = rodBaseX + (floatPosition.x - rodBaseX) * lineFrame.renderRatio;
  const targetY = rodTopY + (floatPosition.y - rodTopY) * lineFrame.renderRatio + lineFrame.renderDrop;
  const straightY = (rodTopY + targetY) / 2;
  const slackY = Math.max(rodTopY, targetY) + 60;
  assert.deepEqual(
    [target.rodMode, target.rodBaseX, target.rodTopY, target.rodWidth, target.rodHeight, target.lineStartX,
      target.lineStartY, target.targetX, target.targetY, target.controlX, target.controlY],
    ["rectangle", rodBaseX, rodTopY, 3, 200, rodBaseX, rodTopY, targetX, targetY, (rodBaseX + targetX) / 2,
      slackY + (straightY - slackY) * lineFrame.straightFactor],
    "without an animated skin the rod line model is bit for bit today's");

  const lineSurface = recordingSurface();
  new RodLineRenderer({ surface: lineSurface }).render({ ...target, lineVisible: true });
  assert.deepEqual(lineSurface.calls.find((call) => call[0] === "fillRect"), ["fillRect", rodBaseX - 1.5, rodTopY, 3, 200]);
  const spineLine = recordingSurface();
  new RodLineRenderer({ surface: spineLine }).render({ ...target, rodMode: "spine", lineStartX: 5, lineStartY: 6, lineVisible: true });
  assert(!spineLine.calls.some((call) => call[0] === "fillRect"), "no rectangle under a skinned rod");
  assert.deepEqual(spineLine.calls.find((call) => call[0] === "moveTo"), ["moveTo", 5, 6], "the line starts at the tip");

  const staticSurface = recordingSurface();
  const region = { x: 2, y: 2, width: 85, height: 2735, rotate: 90 };
  const bounds = { x: -6, y: -2, width: 16, height: 468 };
  new RodStaticRenderer({ surface: staticSurface }).render({ visible: true, rodMode: "static", rodImage: "img",
    rodRegion: region, rodBounds: bounds, rodScale: 0.5, rodBaseX: 100, rodBaseY: 700 });
  assert.deepEqual(staticSurface.calls.map((call) => call[0]), ["save", "translate", "rotate", "drawImage", "restore"]);
  assert.deepEqual(staticSurface.calls[1], ["translate", 100 + (-6 + 16) * 0.5, 700 - (466) * 0.5]);
  assert.deepEqual(staticSurface.calls[3], ["drawImage", "img", 2, 2, 2735, 85, 0, 0, 234, 8],
    "a 90 degree region is drawn from its rotated page footprint");

  const spineSurface = recordingSurface();
  let rendered = true;
  const spineRenderer = new RodSpineRenderer({ surface: spineSurface,
    controller: { renderScene: () => rendered, glSurface: { canvas: "gl" } } });
  spineRenderer.render({ visible: true, rodMode: "static", rodDestX: 1, rodDestY: 2 });
  spineRenderer.render({ visible: true, rodMode: "spine", rodDestX: 1, rodDestY: 2 });
  rendered = false;
  spineRenderer.render({ visible: true, rodMode: "spine", rodDestX: 1, rodDestY: 2 });
  assert.deepEqual(spineSurface.calls, [["drawImage", "gl", 1, 2]], "the GL surface is copied only in Spine mode after a draw");
}

async function main() {
  const version = checkVendorManifest();
  const spine = await importSource("vendor/spine-webgl/4.3.13/spine-webgl.js");
  const { SpineAtlasTextReader } = await importSource("src/platform/browser/animation/spine_atlas_text_reader.js");
  const { SpineBundleLoader } = await importSource("src/platform/browser/animation/spine_bundle_loader.js");
  const { SpineGlSurface } = await importSource("src/platform/browser/animation/spine_gl_surface.js");
  const { SpineScene } = await importSource("src/platform/browser/animation/spine_scene.js");
  const { createSpineRuntime } = await importSource("src/platform/browser/animation/spine_runtime_module.js");
  const { BrowserAssetTransport } = await importSource("src/platform/browser/assets/browser_asset_transport.js");
  const { AssetLoadQueue } = await importSource("src/engine/assets/asset_load_queue.js");
  const { ScalarSmoother } = await importSource("src/engine/animation/scalar_smoother.js");
  const { SKELETAL_SCENE_METHODS } = await importSource("src/engine/animation/skeletal_scene_contract.js");

  const runtime = createSpineRuntime();
  assert.equal(runtime.version, version, "the runtime module reports the manifest version");
  const bundle = await realBundle(SpineBundleLoader, AssetLoadQueue);
  assert.equal(runtime.createScene(bundle, { ensureContext: () => false }).reason, "context-unavailable");
  checkAtlasReader(SpineAtlasTextReader);
  await checkBundleLoader(SpineBundleLoader, AssetLoadQueue);
  await checkScene(spine, SpineScene, SKELETAL_SCENE_METHODS, bundle);
  checkSurface(SpineGlSurface);
  await checkTransport(BrowserAssetTransport);
  checkSmoother(ScalarSmoother);

  const { SpineSetupPoseReader } = await importSource("src/platform/browser/animation/spine_setup_pose_reader.js");
  const { RodAnimationStateResolver } = await importSource("src/game/presentation/fishing/rod_animation_state_resolver.js");
  const { RodAnimationController } = await importSource("src/game/presentation/fishing/rod_animation_controller.js");
  const { RodLineRenderer } = await importSource("src/game/presentation/fishing/rod_line_renderer.js");
  const { RodStaticRenderer } = await importSource("src/game/presentation/fishing/rod_static_renderer.js");
  const { RodSpineRenderer } = await importSource("src/game/presentation/fishing/rod_spine_renderer.js");
  const { FishingEquipmentRenderModelBuilder } =
    await importSource("src/game/presentation/fishing/fishing_equipment_render_model_builder.js");
  const { CONFIG } = await importSource("src/game/config/runtime/game_config.js");
  const { ITEM_DB } = await importSource("src/game/config/raw/items/item_database.js");
  const config = CONFIG.ui.rod.spine;
  assert.deepEqual({ ...ITEM_DB.rods.rod_test_float.skin.animation }, { ...DESCRIPTOR },
    "the bamboo rod skin names the tracked export");
  checkSetupPose(SpineSetupPoseReader, bundle);
  checkResolver(RodAnimationStateResolver, config);
  await checkController({ RodAnimationController, RodAnimationStateResolver, SpineScene, spine, bundle, config });
  checkRenderModel({ FishingEquipmentRenderModelBuilder, RodAnimationController, RodAnimationStateResolver,
    RodLineRenderer, RodStaticRenderer, RodSpineRenderer, config });
  console.log(`Spine rod passed: runtime ${version} (manifest, tracked export), atlas reader, bundle loading through the `
    + "queue (shared jobs, failures, release), scene from the real export (failures, placement, line-tip at setup and full "
    + "bends, side blend, idle loop and time scale, missing clips, bounds, context restore, dispose), GL surface lifecycle, "
    + "transport and frame-rate independent smoothing; setup pose without the runtime, pose resolver (wind, reduced "
    + "motion, rain, side weights), controller modes rectangle -> static -> spine (unavailable runtime, context loss, "
    + "DEV static, stale loads, spring-back), static/Spine/line renderers and the bit-for-bit rod line model without a "
    + "skin.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
