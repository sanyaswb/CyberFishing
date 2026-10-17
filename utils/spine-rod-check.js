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
    width: 300, height, maxTextureSize, gl: null, canvas: null, lost: false,
    ensureContext: () => true,
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
  console.log(`Spine rod passed: runtime ${version} (manifest, tracked export), atlas reader, bundle loading through the `
    + "queue (shared jobs, failures, release), scene from the real export (failures, placement, line-tip at setup and full "
    + "bends, side blend, idle loop and time scale, missing clips, bounds, context restore, dispose), GL surface lifecycle, "
    + "transport and frame-rate independent smoothing.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
