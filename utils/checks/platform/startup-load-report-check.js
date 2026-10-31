"use strict";

// Spec 157 stage A: the startup marks (one per stage, ready once with data-game-ready), the startup report shared by
// the DEV overlay and `npm run measure:startup` (stages, T-paint/T-play, requests before T-play, cache hits, kinds,
// request waves and the deepest chain), the overlay's report cache and copy outcomes, the release-activated overlay
// control (pointerup, not pointerdown; no second run from the click), and the measurer's medians and budget verdicts.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);

async function checkMarks() {
  const { PerformanceStartupMarks } = await importSource("src/platform/browser/diagnostics/performance_startup_marks.js");
  const marks = [];
  const attributes = [];
  const startup = new PerformanceStartupMarks({ performance: { mark: (name) => marks.push(name) },
    rootElement: { setAttribute: (name, value) => attributes.push([name, value]) } });
  startup.mark("entry");
  startup.mark("entry");
  assert.throws(() => startup.mark("lobby"), /Unknown startup stage/u, "only the declared stages are marked");
  startup.markReady();
  startup.markReady();
  assert.deepEqual(marks, ["startup:entry", "startup:ready"], "each stage is marked once");
  assert.deepEqual(attributes, [["data-game-ready", ""]], "the ready signal is set once");
}

function resource(name, startTime, responseEnd, sizes = {}) {
  return { name: `https://site/releases/0.0.0-abc/${name}`, initiatorType: "script", startTime, responseEnd,
    transferSize: sizes.transfer ?? 100, encodedBodySize: sizes.encoded ?? 80, decodedBodySize: sizes.decoded ?? 300 };
}

async function checkReport() {
  const { StartupLoadReport } = await importSource("src/dev/diagnostics/startup_load_report.js");
  const report = StartupLoadReport.build({
    marks: [{ name: "startup:entry", startTime: 300 }, { name: "startup:ready", startTime: 900 },
      { name: "startup:config", startTime: 350 }, { name: "other", startTime: 1 }, { name: "startup:entry", startTime: 999 }],
    paints: [{ name: "first-paint", startTime: 120 }],
    navigation: { name: "https://site/index.html", startTime: 0, responseEnd: 50, transferSize: 600, encodedBodySize: 500,
      decodedBodySize: 1500 },
    resources: [
      resource("src/entrypoints/game.entry.js", 40, 100),
      resource("src/game/presentation/styles/tokens.css?v=1", 40, 90, { transfer: 0, encoded: 70, decoded: 200 }),
      resource("src/bootstrap/a.js", 101, 200),
      resource("src/bootstrap/b.js", 101, 150),
      resource("src/bootstrap/c.js", 201, 250),
      // Discovered early but slow (queued): it deepens nothing that started before it ended.
      resource("vendor/pixi/8.22.0/pixi-scene.js", 101, 800, { transfer: 5000, encoded: 4900, decoded: 20000 }),
      resource("assets/items/keepnet/keepnet--0.webp", 260, 400, { transfer: 9000, encoded: 9000, decoded: 9000 }),
      resource("assets/audio/radio/vinyl/vinyl-5.mp3", 950, 2000),
    ],
  });
  assert.equal(report.paintMs, 120, "first paint stands in when no contentful paint is reported");
  assert.equal(report.playMs, 900);
  assert.deepEqual(report.stages.map((stage) => [stage.stage, stage.atMs, stage.sinceMs]),
    [["entry", 300, 300], ["config", 350, 50], ["ready", 900, 550]], "declared order, first mark of each stage");
  assert.equal(report.beforePlay.count, 8, "the HTML and the requests finished before T-play");
  assert.equal(report.all.count, 9);
  assert.equal(report.beforePlay.cached, 1, "transferSize 0 with a body is a cache hit");
  assert.equal(report.beforePlay.byKind.vendor.count, 1, "vendor modules count as vendor");
  assert.equal(report.beforePlay.byKind.modules.count, 4);
  assert.equal(report.beforePlay.byKind.styles.transferred, 0);
  assert.equal(report.beforePlay.byKind.document.transferred, 600);
  assert.equal(report.beforePlay.transferred, 600 + 100 * 4 + 0 + 5000 + 9000);
  assert.equal(report.networkSteps, 4, "the entry starts while the HTML streams: entry -> a -> c -> keepnet art");
  assert.deepEqual(report.deepestChain.map((url) => url.replace(/^.*\//u, "")),
    ["game.entry.js", "a.js", "c.js", "keepnet--0.webp"], "ties go to the request that finished last");
  assert.equal(report.moduleSteps, 3, "the module waves leave the art out");
  assert.equal(report.largest[0].url.endsWith("keepnet--0.webp"), true, "largest by compressed size");
  assert.equal(report.longest[0].url.endsWith("pixi-scene.js"), true);
  assert.equal(StartupLoadReport.build({}).playMs, null, "no ready mark: the game is not ready yet");
  assert.equal(StartupLoadReport.kindOf("https://x/assets/a.atlas"), "data");
}

async function checkOverlay() {
  const { StartupLoadOverlayModule } = await importSource("src/dev/overlay/modules/startup_load_overlay_module.js");
  const { OverlayHtmlBuilder } = await importSource("src/dev/overlay/services/overlay_html_builder.js");
  let revision = "1";
  let reads = 0;
  const reader = {
    revision: () => revision,
    read: () => { reads += 1; return { marks: [{ name: "startup:ready", startTime: 700 }], paints: [], navigation: null, resources: [] }; },
    environment: () => ({ viewport: "412x915" }),
  };
  const copies = [];
  const saved = [];
  let copyResult = "copied";
  let saveError = null;
  const now = new Date(2026, 9, 30, 21, 5, 7).getTime();
  const module = new StartupLoadOverlayModule({ htmlBuilder: new OverlayHtmlBuilder(), reader, gameVersion: "1.2.3", now: () => now,
    copyText: async (text, title) => { copies.push([JSON.parse(text), title]); if (copyResult instanceof Error) throw copyResult; return copyResult; },
    saveFile: async (text, fileName) => { if (saveError) throw saveError; saved.push([text, fileName]); } });
  let html = module.render();
  module.render();
  assert.equal(reads, 1, "an unchanged timing revision reuses the report");
  assert.match(html, /ЗАВАНТАЖЕННЯ/u);
  assert.match(html, /700 мс/u, "T-play is shown");
  assert.match(html, /data-overlay-control="startup-report-copy" data-overlay-activate="release"/u);
  assert.match(html, /data-overlay-control="startup-report-download" data-overlay-activate="release"/u);
  revision = "2";
  module.render();
  assert.equal(reads, 2, "a new timing entry rebuilds the report");
  assert.equal(await module.copyReport(), "copied");
  assert.equal(copies[0][0].version, "1.2.3");
  assert.equal(copies[0][0].playMs, 700);
  assert.deepEqual(copies[0][0].environment, { viewport: "412x915" });
  assert.equal(typeof copies[0][1], "string", "the prompt fallback gets a title");
  assert.match(module.render(), /скопійовано/u);
  copyResult = new Error("denied");
  assert.equal(await module.copyReport(), "copyFailed", "a failing copy is reported, not thrown");
  // TK-168: the same JSON saved as a file named by version and local time.
  assert.equal(await module.downloadReport(), "saved");
  assert.deepEqual(saved.map(([, fileName]) => fileName), ["cyber-fishing-startup-1.2.3-2026-10-30_21-05-07.json"]);
  assert.equal(saved[0][0], module.reportText(), "the file holds the copied report");
  assert.match(module.render(), /збережено у файл cyber-fishing-startup-1.2.3-2026-10-30_21-05-07.json/u);
  saveError = new Error("blocked");
  assert.equal(await module.downloadReport(), "saveFailed", "a failing save is reported, not thrown");
  assert.match(module.render(), /Не вдалося зберегти/u);
  assert.throws(() => new StartupLoadOverlayModule({ htmlBuilder: new OverlayHtmlBuilder(), reader: { read() {} },
    copyText() {}, saveFile() {}, now() {} }), /requires reader/u);
  assert.throws(() => new StartupLoadOverlayModule({ htmlBuilder: new OverlayHtmlBuilder(), reader, copyText() {}, now() {} }),
    /requires saveFile/u);
}

async function checkFileSaver() {
  const { BrowserTextFileSaver } = await importSource("src/dev/services/browser_text_file_saver.js");
  const events = [];
  const timers = [];
  const link = { click() { events.push(["click", this.href, this.download, this.hidden]); }, remove() { events.push(["remove"]); } };
  class FakeBlob { constructor(parts, options) { this.parts = parts; this.type = options.type; } }
  const windowTarget = { Blob: FakeBlob, setTimeout: (callback, ms) => timers.push([callback, ms]),
    URL: { createObjectURL: (blob) => { events.push(["url", blob.parts.join(""), blob.type]); return "blob:1"; },
      revokeObjectURL: (url) => events.push(["revoke", url]) } };
  const documentTarget = { createElement: (tag) => { assert.equal(tag, "a"); return link; },
    body: { appendChild: (node) => { assert.equal(node, link); events.push(["append"]); } } };
  new BrowserTextFileSaver({ documentTarget, windowTarget }).save("{}", "report.json");
  assert.deepEqual(events, [["url", "{}", "application/json"], ["append"], ["click", "blob:1", "report.json", true], ["remove"]],
    "one hidden download link, clicked once and removed");
  assert.equal(timers.length, 1);
  assert.equal(timers[0][1], BrowserTextFileSaver.RELEASE_DELAY_MS, "the URL is released after the download started");
  timers[0][0]();
  assert.deepEqual(events.at(-1), ["revoke", "blob:1"]);
  link.click = () => { throw new Error("blocked"); };
  assert.throws(() => new BrowserTextFileSaver({ documentTarget, windowTarget }).save("{}", "x.json"), /blocked/u);
  assert.deepEqual(events.at(-1), ["remove"], "a failed click still removes the link");
}

async function checkReleaseControl() {
  const { OverlayInteractionBridge } = await importSource("src/dev/overlay/dom/overlay_interaction_bridge.js");
  const listeners = new Map();
  const root = { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: (type) => listeners.delete(type),
    contains: () => true };
  const control = { getAttribute: (name) => ({ "data-overlay-control": "startup-report-copy", "data-overlay-activate": "release" })[name] };
  const event = (type) => ({ type, target: { closest: () => control }, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } });
  let runs = 0;
  const bridge = new OverlayInteractionBridge({ rootElement: root, viewStateStore: { get() {}, set() {} },
    actions: { "startup-report-copy": () => { runs += 1; } } });
  bridge.attach();
  listeners.get("pointerdown")(event("pointerdown"));
  assert.equal(runs, 0, "pointerdown carries no user activation on touch: nothing runs yet");
  const release = event("pointerup");
  listeners.get("pointerup")(release);
  assert.equal(runs, 1, "the release runs the action");
  assert(release.prevented && release.stopped);
  listeners.get("click")(event("click"));
  assert.equal(runs, 1, "the click that follows a release does not run it again");
  bridge.detach();
  assert.equal(listeners.size, 0, "detach removes every listener, pointerup included");
}

// Spec 157 D0: both game pages paint the startup screen from their HTML alone. Its markup and inline style come
// before every game stylesheet (a stylesheet before it would hold back the first paint), and the rule that hides it
// keys on the very attribute PerformanceStartupMarks sets at ready (another name would leave a black screen).
async function checkStartupScreen() {
  const fs = require("node:fs");
  const { PerformanceStartupMarks } = await importSource("src/platform/browser/diagnostics/performance_startup_marks.js");
  const attributes = [];
  new PerformanceStartupMarks({ performance: { mark() {} }, rootElement: { setAttribute: (name) => attributes.push(name) } })
    .markReady();
  const [readyAttribute] = attributes;
  for (const page of ["index.html", "dev.html"]) {
    const html = fs.readFileSync(path.join(ROOT_DIR, page), "utf8").replace(/<!--[^]*?-->/gu, "");
    const screen = html.indexOf('<div class="startup-loader"');
    const firstStylesheet = html.search(/<link\b[^>]*rel="stylesheet"/u);
    const inlineStyle = html.match(/<style>([^]*?)<\/style>/u);
    assert(screen > 0 && firstStylesheet > screen, `${page}: the startup screen precedes every game stylesheet`);
    assert(inlineStyle && inlineStyle.index < screen, `${page}: the screen's inline style comes first`);
    assert(html.indexOf("<svg", screen) > screen && html.indexOf("<svg", screen) < firstStylesheet,
      `${page}: the screen's icon is inline SVG`);
    assert(inlineStyle[1].includes(`html[${readyAttribute}] .startup-loader`),
      `${page}: the screen hides on ${readyAttribute}, the attribute set at ready`);
    assert(!/<img\b|url\(/u.test(html.slice(0, firstStylesheet)), `${page}: the startup screen loads no file`);
    // TK-171 / incident I-9: a background on the root stops the body's background from moving to the canvas; the body
    // then paints it on its own box, above the WebGL scene at z-index -1, and the water disappears.
    assert(!/(?:^|[\s,}])(?:html|body|:root)\b[^{]*\{[^}]*background/u.test(inlineStyle[1]),
      `${page}: the startup screen's style sets no html/body background (it would cover the WebGL scene)`);
  }
}

// Spec 157 R6 (TK-172): UI images are lazy before their source is set, so a hidden view requests nothing before the
// game is ready; LazyImageWarmUp then loads the not yet loaded lazy images one at a time; the depth selector's icons
// wait for the deferred loads.
async function checkDeferredUiImages() {
  const { InventoryDomFactory } = await importSource("src/platform/browser/dom/inventory_dom_factory.js");
  const writes = [];
  const element = () => new Proxy({}, { set(target, key, value) { writes.push(String(key)); target[key] = value; return true; } });
  const image = new InventoryDomFactory({ createElement: element }).image("assets/items/nets/net--1.webp", "net");
  assert.equal(image.loading, "lazy");
  assert(writes.indexOf("loading") >= 0 && writes.indexOf("loading") < writes.indexOf("src"),
    "lazy is set before the source, or the browser has already requested it");

  const { LazyImageWarmUp } = await importSource("src/platform/browser/assets/lazy_image_warm_up.js");
  const created = [];
  let pending = 0;
  let peak = 0;
  const page = [{ src: "a.webp", complete: false }, { src: "b.webp", complete: true }, { src: "a.webp", complete: false },
    { src: "bad.webp", complete: false }, { src: "c.webp", complete: false }];
  const documentRef = {
    querySelectorAll: (selector) => { assert.equal(selector, 'img[loading="lazy"]'); return page; },
    createElement: (tag) => {
      assert.equal(tag, "img");
      const loader = {};
      Object.defineProperty(loader, "src", { set(value) {
        created.push(value); pending += 1; peak = Math.max(peak, pending);
        setTimeout(() => { pending -= 1; (value === "bad.webp" ? loader.onerror : loader.onload)(); }, 0);
      } });
      return loader;
    },
  };
  const warmUp = new LazyImageWarmUp({ documentRef });
  assert.deepEqual(await warmUp.warm(), ["a.webp", "c.webp"], "loaded sources, failures skipped");
  assert.deepEqual(created, ["a.webp", "bad.webp", "c.webp"], "each not yet loaded lazy source once, in page order");
  assert.equal(peak, 1, "one image at a time, so the warm-up never floods the network");
  const stopped = new LazyImageWarmUp({ documentRef });
  created.length = 0;
  const run = stopped.warm();
  stopped.dispose();
  await run;
  assert.deepEqual(created, ["a.webp"], "dispose stops the queue after the image in flight");

  const { composeDepthSelector } = await importSource("src/bootstrap/production/depth_selector_composition.js");
  const deferred = [];
  let preloads = 0;
  const host = { appendChild() {}, append() {} };
  const fakeElement = () => ({ className: "", style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {}, replaceChildren() {} });
  composeDepthSelector({ documentRef: { createElement: fakeElement, createElementNS: fakeElement, addEventListener() {},
    removeEventListener() {} }, mountNode: host, uiSurface: null,
  itemDb: { floats: { float_day: { icon: "F", iconUrl: "assets/items/floats/float-day.webp" } }, baits: {} },
  imageAssets: { preload: () => { preloads += 1; return Promise.resolve(); } }, deferLoad: (load) => deferred.push(load) });
  assert.equal(preloads, 0, "the depth selector requests no icon at composition");
  assert.equal(deferred.length, 1);
  await deferred[0]();
  assert.equal(preloads, 1, "its icons load with the deferred loads");
}

// Spec 157 R4 (spec 083 decision 3): startup loads the background phases of the current game time; the others load
// after ready; until a phase arrives the world frame draws the nearest loaded one instead of nothing.
async function checkCurrentPhaseBackground() {
  const { LocationAssetLoader } = await importSource("src/platform/browser/location/location_asset_loader.js");
  const requests = [];
  const ready = new Set();
  const imageAssets = { preload: (manifest) => { requests.push(Object.values(manifest)); return Promise.resolve(); },
    tryGet: () => null, isReady: (id) => ready.has(id) };
  const loader = new LocationAssetLoader({ imageAssets, canvasFactory: { createSurface() {} } });
  const config = { bgUrls: { day: "bg--day.webp", evening: "bg--evening.webp", night: "bg--night.webp" }, depthUrl: "depth.webp" };
  const resources = await loader.load("lake", config, { baseResolution: { width: 10, height: 10 } }, { phases: ["day"] });
  assert.deepEqual(requests, [["bg--day.webp", "depth.webp"]], "startup waits for the current phase and the depth map only");
  assert.deepEqual(Object.keys(resources.background.assetIds), ["day", "evening", "night"], "every phase keeps its id");
  await resources.loadDeferredBackground();
  assert.deepEqual(requests[1], ["bg--evening.webp", "bg--night.webp"], "the other phases load when deferred");
  requests.length = 0;
  await (await loader.load("lake", config, { baseResolution: { width: 10, height: 10 } })).loadDeferredBackground();
  assert.deepEqual(requests, [["bg--day.webp", "bg--evening.webp", "bg--night.webp", "depth.webp"]],
    "without phases everything loads at once and nothing is deferred");

  const { AssetPreloadCoordinator } = await importSource("src/platform/browser/assets/asset_preload_coordinator.js");
  const coordinated = [];
  const coordinator = new AssetPreloadCoordinator({ imageAssets: { preload: (record) => {
    coordinated.push(...Object.values(record)); return Promise.resolve(); }, isReady: () => false },
  locationsConfig: { map: { lake: config } }, resolveFishImage: () => "" });
  await coordinator.preloadLocation("lake", { phases: ["evening", "night"] });
  assert.deepEqual(coordinated, ["bg--evening.webp", "bg--night.webp", "depth.webp"], "the coordinator takes the same phases");

  const { WorldRenderFrameBuilder } = await importSource("src/game/presentation/rendering/world_render_frame_builder.js");
  const { GameRenderFrame } = await importSource("src/game/presentation/rendering/game_render_frame.js");
  const data = { loaded: true, dynamic: true, assetIds: { day: "D", evening: "E", night: "N" }, eveningOpacity: 1,
    nightOpacity: 0.5, width: 100, height: 50 };
  const builderFor = (isAssetReady) => new WorldRenderFrameBuilder({ map: { getBackgroundRenderData: () => data },
    projector: { virtualToScreen: (x, y, out) => { out.x = x; out.y = y; return out; }, getScale: () => 1 },
    config: { canvas: {} }, canvasMetrics: { width: 100 }, locationId: "lake", isAssetReady,
    boatChumBuilder: { buildInto() {} } });
  const layers = (isAssetReady) => {
    const frame = new GameRenderFrame();
    builderFor(isAssetReady).buildInto({ target: frame.world, invalidCastMarker: null, debugEnabled: false });
    const out = [];
    for (let index = 0; index < frame.world.backgroundLayers.count; index += 1) {
      const layer = frame.world.backgroundLayers.getAt(index);
      out.push(`${layer.assetId}@${layer.alpha}`);
    }
    return out;
  };
  assert.deepEqual(layers(null), ["E@1", "N@0.5"], "dusk: evening base and the night overlay (no port: all loaded)");
  assert.deepEqual(layers((id) => id !== "N"), ["E@1"], "an overlay that has not loaded is left out");
  assert.deepEqual(layers((id) => id === "D"), ["D@1"], "a missing base is drawn with the nearest loaded phase");
  assert.deepEqual(layers(() => false), [], "nothing loaded: nothing drawn (the clear colour)");
}

function checkMeasurer() {
  const { median, summarize, readOptions, BUDGET } = require(path.join(ROOT_DIR, "utils/measure-startup.js"));
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null, Number.NaN]), null);
  const run = (playMs, transferred, networkSteps) => ({ paintMs: 500, playMs, beforePlay: { transferred, count: 10 }, networkSteps });
  const cold = summarize("cold", [run(3000, 1000, 2), run(5000, 2000, 3), run(3500, 9e9, 3)]);
  assert.equal(cold.medians.playMs, 3500);
  assert.deepEqual(cold.verdicts.map((verdict) => [verdict.metric, verdict.pass]),
    [["T-paint", true], ["T-play", true], ["Bytes-play", true], ["Waterfall", true]]);
  const warm = summarize("warm", [run(2500, 0, 9)]);
  assert.deepEqual(warm.verdicts.map((verdict) => [verdict.metric, verdict.limit, verdict.pass]),
    [["T-paint", BUDGET.paintMs, true], ["T-play", BUDGET.warmPlayMs, false]], "warm start: its own T-play budget, no byte budget");
  assert.equal(summarize("cold", [{ paintMs: null, playMs: null, beforePlay: { transferred: 0, count: 0 }, networkSteps: 0 }])
    .verdicts[1].pass, false, "a start that never became ready fails");
  assert.deepEqual(readOptions([]), { ref: "HEAD", page: "index.html", network: "4g", runs: 5, browser: "chrome", cpu: 1,
    prefix: "pages", strict: false });
  assert.throws(() => readOptions(["--prefix", "cdn"]), /--prefix/u);
  assert.throws(() => readOptions(["--cpu", "0"]), /--cpu/u);
  assert.throws(() => readOptions(["--network", "5g"]), /--network/u);
}

(async () => {
  await checkMarks();
  await checkReport();
  await checkOverlay();
  await checkReleaseControl();
  await checkFileSaver();
  await checkStartupScreen();
  await checkDeferredUiImages();
  await checkCurrentPhaseBackground();
  checkMeasurer();
  console.log("Startup load report passed: stage marks once with the ready signal, report stages/paint/play, requests and "
    + "cache hits before T-play, kinds, request waves and the deepest chain, overlay report cache, copy and file save outcomes, file saver, "
    + "release-activated overlay control, startup screen before the stylesheets and hidden at ready, lazy UI images and their warm-up, current-phase background with the nearest loaded phase, measurer medians and budget verdicts.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
