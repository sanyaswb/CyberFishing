"use strict";

// Smart preloader foundation (spec 083): catalog, variant selection, load queue, startup progress, Spine capability.
const assert = require("node:assert/strict");

const flush = async (rounds = 6) => { for (let index = 0; index < rounds; index += 1) await Promise.resolve(); };

function catalogSnapshot(overrides = {}) {
  return {
    schemaVersion: 1, revision: "rev-1",
    assets: [
      { id: "location.test.background.day", kind: "visual-image", logicalSize: { width: 2560, height: 1440 },
        placeholderColor: "#4a6b7c", variants: [
        { tier: "legacy", format: "webp", url: "assets/locations/test/bg_test--day.webp", width: 2560, height: 1440, byteLength: 222664 },
        { tier: "l", format: "webp", url: "assets/variants/locations/test/g1/bg_test--day--l.webp", width: 1280, height: 720 },
        { tier: "l", format: "avif", url: "assets/variants/locations/test/g1/bg_test--day--l.avif", width: 1280, height: 720 },
        { tier: "h", format: "webp", url: "assets/variants/locations/test/g1/bg_test--day--h.webp", width: 2560, height: 1440 },
      ] },
      { id: "location.test.depth", kind: "data-image", variants: [
        { tier: "legacy", format: "webp", url: "assets/locations/test/test-depth.webp", width: 2560, height: 1440 }] },
      { id: "lobby.poster", kind: "visual-image", variants: [{ tier: "legacy", format: "webp", url: "assets/lobby/poster.webp" }] },
      { id: "lobby.fisher.skeleton", kind: "json", variants: [{ tier: "legacy", format: "json", url: "assets/lobby/fisher.json" }] },
      { id: "lobby.fisher.atlas", kind: "text", variants: [{ tier: "legacy", format: "atlas", url: "assets/lobby/fisher.atlas" }] },
      { id: "lobby.fisher", kind: "bundle", fallbackId: "lobby.poster", dependencies: ["lobby.fisher.skeleton", "lobby.fisher.atlas"],
        variants: [{ tier: "legacy", format: "spine", url: "assets/lobby/fisher.json" }] },
    ],
    groups: [{ id: "scene.test.minimum", members: ["location.test.background.day", "location.test.depth"] }],
    aliases: { "location:test:day:assets/locations/test/bg_test--day.webp": "location.test.background.day" },
    ...overrides,
  };
}

async function checkCatalog(AssetCatalog) {
  const catalog = new AssetCatalog(catalogSnapshot());
  assert.equal(catalog.revision, "rev-1");
  const day = catalog.getAsset("location:test:day:assets/locations/test/bg_test--day.webp");
  assert.equal(day.id, "location.test.background.day", "an exact legacy ID resolves to its stable ID");
  assert(Object.isFrozen(day) && Object.isFrozen(day.variants), "catalog records are immutable");
  assert.equal(catalog.getGroup("scene.test.minimum").atomic, true, "groups activate as one by default");
  assert.equal(catalog.getAsset("lobby.fisher").fallbackId, "lobby.poster");
  assert.equal(catalog.getAsset("unknown"), null);
  assert.equal(day.placeholderColor, "#4a6b7c", "a background carries its average colour as the placeholder");
  assert.equal(catalog.getAsset("lobby.poster").placeholderColor, null);
  const rejects = (overrides, pattern, message) => assert.throws(() => new AssetCatalog(catalogSnapshot(overrides)), pattern, message);
  rejects({ schemaVersion: 2 }, /schemaVersion/u, "an unknown schema is rejected");
  rejects({ assets: [...catalogSnapshot().assets, catalogSnapshot().assets[0]] }, /duplicate asset/u);
  for (const url of ["/assets/a.webp", "../a.webp", "assets/../a.webp", "https://cdn.example/a.webp", "data:image/webp;base64,AA"])
    rejects({ assets: [{ id: "a", kind: "visual-image", variants: [{ tier: "l", url }] }] }, /project-relative/u, `url ${url}`);
  rejects({ assets: [{ id: "a", kind: "visual-image", variants: [{ tier: "x", url: "assets/a.webp" }] }] }, /unknown tier/u);
  rejects({ assets: [{ id: "a", kind: "data-image", variants: [{ tier: "l", url: "assets/a.webp" }] }] }, /exact legacy/u,
    "depth maps cannot get resampled tiers");
  rejects({ aliases: { old: "missing" } }, /unknown asset/u);
  for (const [kind, placeholderColor] of [["visual-image", "blue"], ["visual-image", "#12345"], ["data-image", "#123456"]])
    rejects({ groups: [], aliases: {}, assets: [{ id: "a", kind, placeholderColor, variants: [{ tier: "legacy", url: "assets/a.webp" }] }] },
      /placeholderColor/u, `placeholder ${kind} ${placeholderColor}`);
  rejects({ groups: [{ id: "g", members: ["missing"] }] }, /unknown asset/u);
  rejects({ groups: [], aliases: {}, assets: [
    { id: "a", kind: "visual-image", fallbackId: "b", variants: [{ tier: "l", url: "assets/a.webp" }] },
    { id: "b", kind: "visual-image", fallbackId: "a", variants: [{ tier: "l", url: "assets/b.webp" }] }] }, /fallback cycle/u);
}

async function checkVariantSelector(AssetCatalog, AssetVariantSelector) {
  const selector = new AssetVariantSelector();
  const day = new AssetCatalog(catalogSnapshot()).getAsset("location.test.background.day");
  const webp = ["webp"], both = ["avif", "webp"];
  assert.equal(selector.selectMinimum(day, { formats: webp }).tier, "l", "a cold start downloads Low first");
  assert.equal(selector.selectMinimum(day, { formats: both }).format, "avif", "the preferred supported format wins");
  const ready = (tier) => (variant) => variant.tier === tier;
  assert.equal(selector.selectMinimum(day, { formats: webp, isReady: ready("h") }).tier, "h",
    "a ready better variant is used without a Low request");
  assert.equal(selector.selectMinimum(day, { mode: "low", formats: webp, isReady: ready("h") }).tier, "l",
    "Low mode never picks High for a new consumer");
  // Owner decision (spec 083): draw full quality when ready, else the reduced image, else the placeholder.
  const readySet = (...tiers) => (variant) => tiers.includes(variant.tier);
  assert.equal(selector.selectReady(day, { formats: webp, isReady: readySet() }), null, "nothing ready: the placeholder");
  assert.equal(selector.selectReady(day, { formats: webp, isReady: readySet("l") }).tier, "l");
  assert.equal(selector.selectReady(day, { formats: webp, isReady: readySet("l", "h") }).tier, "h");
  assert.equal(selector.selectReady(day, { formats: webp, isReady: readySet("l", "legacy") }).tier, "legacy",
    "the original outranks the reduced image");
  assert.equal(selector.selectTarget(day, { formats: webp }).tier, "l", "Auto without High permission stays on the minimum");
  assert.equal(selector.selectTarget(day, { formats: webp, allowHigh: true }).tier, "h");
  assert.equal(selector.selectTarget(day, { mode: "high", formats: webp }).tier, "h");
  assert.equal(selector.selectTarget(day, { mode: "low", formats: webp }).tier, "l");
  const legacyOnly = new AssetCatalog(catalogSnapshot()).getAsset("location.test.depth");
  assert.equal(selector.selectMinimum(legacyOnly, { mode: "low", formats: webp }).tier, "legacy", "legacy is the Low fallback");
  assert.equal(selector.selectMinimum(legacyOnly, { formats: ["avif"] }), null, "an unsupported format is never chosen");
  assert.throws(() => selector.selectMinimum(day, { mode: "ultra", formats: webp }), /unknown quality mode/u);
}

function controlledLoads() {
  const pending = new Map();
  const started = [];
  const load = (key) => (token) => new Promise((resolve, reject) => {
    started.push(key);
    pending.set(key, { resolve, reject, token });
  });
  return { pending, started, load };
}

function manualScheduler() {
  const timers = new Map(); let id = 0;
  return { timers, setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id; },
    clearTimeout: (timer) => timers.delete(timer),
    runAll: () => { const all = [...timers.values()]; timers.clear(); for (const timer of all) timer.callback(); } };
}

async function checkQueue(AssetLoadQueue) {
  assert.throws(() => new AssetLoadQueue({}), /scheduler/u);
  // Caps: 2 network slots, 1 speculative; blocking work outranks earlier background work.
  {
    const scheduler = manualScheduler(); const loads = controlledLoads();
    const queue = new AssetLoadQueue({ scheduler, networkSlots: 2, speculativeSlots: 1 });
    queue.request({ key: "up-1", priority: "upgrade", load: loads.load("up-1") });
    queue.request({ key: "up-2", priority: "upgrade", load: loads.load("up-2") });
    queue.request({ key: "pre-1", priority: "prefetch", load: loads.load("pre-1") });
    await flush();
    assert.deepEqual(loads.started, ["up-1"], "only one speculative job runs at a time");
    const blocking = queue.request({ key: "min-1", priority: "blocking", load: loads.load("min-1") });
    queue.request({ key: "act-1", priority: "interactive", load: loads.load("act-1") });
    await flush();
    assert.deepEqual(loads.started, ["up-1", "min-1"], "the free slot serves the most urgent demand");
    assert.equal(queue.getSnapshot().active, 2, "the network cap is never exceeded");
    loads.pending.get("min-1").resolve("payload-min-1");
    assert.deepEqual(await blocking.result, { status: "ready", payload: "payload-min-1", error: null, attempts: 1 });
    await flush();
    assert.deepEqual(loads.started, ["up-1", "min-1", "act-1"], "interactive outranks pending background work");
    loads.pending.get("up-1").resolve("x"); loads.pending.get("act-1").resolve("y");
    await flush();
    assert.deepEqual(loads.started.slice(3), ["up-2"], "FIFO inside a priority; one speculative slot again");
    queue.setSpeculativeAllowed(false);
    loads.pending.get("up-2").resolve("z");
    await flush();
    assert.equal(loads.started.length, 4, "hidden/offline/save-data stops new speculative dispatch");
    assert.equal(queue.getSnapshot().queuedByPriority.prefetch, 1);
    queue.setSpeculativeAllowed(true);
    await flush();
    assert.equal(loads.started.at(-1), "pre-1");
    queue.dispose();
  }
  // Sharing, promotion and per-consumer release.
  {
    const scheduler = manualScheduler(); const loads = controlledLoads();
    const queue = new AssetLoadQueue({ scheduler, networkSlots: 1, speculativeSlots: 1 });
    queue.request({ key: "busy", priority: "blocking", load: loads.load("busy") });
    const first = queue.request({ key: "fish", priority: "prefetch", load: loads.load("fish") });
    const second = queue.request({ key: "fish", priority: "prefetch", load: loads.load("fish-duplicate") });
    queue.request({ key: "other", priority: "interactive", load: loads.load("other") });
    second.promote("blocking");
    await flush();
    loads.pending.get("busy").resolve(1);
    await flush();
    assert.deepEqual(loads.started, ["busy", "fish"], "promotion moves the shared job ahead without a duplicate load");
    first.release();
    assert.equal((await first.result).status, "cancelled", "a released consumer gets a cancellation, not an error");
    assert.equal(loads.pending.get("fish").token.cancelled, false, "the other consumer keeps the shared load");
    loads.pending.get("fish").resolve("fish-image");
    assert.equal((await second.result).payload, "fish-image");
    await flush();
    const late = queue.request({ key: "late", priority: "prefetch", load: loads.load("late") });
    const lateTwin = queue.request({ key: "late", priority: "prefetch", load: loads.load("late") });
    late.release(); lateTwin.release();
    loads.pending.get("other").resolve(2);
    await flush();
    assert(!loads.started.includes("late"), "a queued job without consumers never starts");
    queue.dispose();
  }
  // A running job outliving its last consumer is taken over by a new one; failures retry once, then fail.
  {
    const scheduler = manualScheduler(); const loads = controlledLoads();
    const queue = new AssetLoadQueue({ scheduler, networkSlots: 1, maxAttempts: 2, retryDelayMs: 500 });
    const gone = queue.request({ key: "bg", priority: "blocking", load: loads.load("bg") });
    await flush();
    gone.release();
    assert.equal(loads.pending.get("bg").token.cancelled, true, "the last release marks the running attempt");
    const again = queue.request({ key: "bg", priority: "blocking", load: loads.load("bg-second") });
    assert.equal(loads.pending.get("bg").token.cancelled, false, "a new consumer revives the running job");
    loads.pending.get("bg").resolve("bg-image");
    assert.equal((await again.result).payload, "bg-image");
    assert.deepEqual(loads.started, ["bg"]);
    const broken = queue.request({ key: "broken", priority: "interactive", load: loads.load("broken") });
    await flush();
    loads.pending.get("broken").reject(new Error("network"));
    await flush();
    assert.equal(queue.getSnapshot().waitingRetry, 1, "a failed attempt waits for its retry delay");
    assert.equal([...scheduler.timers.values()][0].delay, 500);
    scheduler.runAll(); await flush();
    assert.equal(loads.started.filter((key) => key === "broken").length, 2, "one automatic retry");
    loads.pending.get("broken").reject(new Error("still broken"));
    const failed = await broken.result;
    assert.equal(failed.status, "failed"); assert.equal(failed.attempts, 2); assert.equal(failed.error.message, "still broken");
    const pendingAtDispose = queue.request({ key: "x", priority: "upgrade", load: loads.load("x") });
    queue.dispose();
    assert.equal((await pendingAtDispose.result).status, "cancelled", "dispose settles every interest");
    assert.equal((await queue.request({ key: "y", priority: "blocking", load: loads.load("y") }).result).status, "cancelled");
  }
}

async function checkProgress(StartupLoadProgress) {
  const progress = new StartupLoadProgress(["day", "evening", "night", "depth"]);
  const seen = [];
  const unsubscribe = progress.subscribe((snapshot) => seen.push(snapshot.fraction));
  progress.markReady("day"); progress.markReady("day"); progress.markReady("optional-upgrade");
  progress.markFailed("depth");
  assert.equal(progress.getSnapshot().blocked, true);
  progress.markReady("depth"); progress.markFailed("depth");
  progress.markReady("evening"); progress.markReady("night");
  assert.deepEqual(seen, [0.25, 0.25, 0.5, 0.75, 1], "fixed denominator; optional work and repeats never move it");
  assert.deepEqual(progress.getSnapshot(), { total: 4, ready: 4, failed: 0, fraction: 1, complete: true, blocked: false });
  unsubscribe();
  assert.equal(new StartupLoadProgress([]).getSnapshot().complete, true);
}

async function checkSpineProvider(SpineRuntimeProvider, runtimeModule) {
  // The runtime module is the pinned 4.3 bundle (spec 099); a module without a runtime still reports not-installed.
  const notInstalled = { createSpineRuntime: () => null };
  let imports = 0;
  const provider = new SpineRuntimeProvider({ importModule: async () => { imports += 1; return notInstalled; } });
  const [first, second] = await Promise.all([provider.load("4.2.43"), provider.load("4.2.43")]);
  assert.deepEqual({ ...first }, { available: false, runtime: null, reason: "not-installed" });
  assert.equal(second, first, "one shared capability result");
  assert.equal(imports, 1, "the runtime module is imported once, on first need");
  const real = await new SpineRuntimeProvider({ importModule: async () => runtimeModule }).load("4.3.26");
  assert.equal(real.available, true, "the checked-in runtime module serves a 4.3 export");
  assert.equal(real.runtime.version, "4.3.13");
  assert.equal((await new SpineRuntimeProvider({ importModule: async () => runtimeModule }).load("4.2.43")).reason,
    "version-mismatch", "a 4.2 export does not run on the 4.3 runtime");
  // The required line comes from the export's skeleton.spine (owner decision: atlases + JSON).
  const outcome = async (importModule, exportVersion = "4.2.43") =>
    (await new SpineRuntimeProvider({ importModule }).load(exportVersion)).reason;
  assert.equal(await outcome(async () => ({ createSpineRuntime: () => ({ version: "4.2.0" }) }), "4.1.24"), "version-mismatch",
    "a 4.1 export needs a 4.1 runtime");
  assert.equal(await outcome(async () => ({ createSpineRuntime: () => ({ version: "4.2.0" }) }), ""), "version-mismatch",
    "an export without a version is not trusted");
  assert.equal(await outcome(async () => { throw new Error("404"); }), "import-failed");
  assert.equal(await outcome(async () => ({ createSpineRuntime: () => { throw new Error("no WebGL"); } })), "factory-failed");
  assert.equal(await outcome(async () => ({ createSpineRuntime: () => ({ version: "4.1.24" }) })), "version-mismatch");
  assert.equal(await outcome(async () => ({ createSpineRuntime: () => ({ version: "4.2.43" }) })), null);
  assert.equal(await outcome(async () => ({ createSpineRuntime: () => ({ version: "4.20.1" }) })), "version-mismatch",
    "4.20 is not the 4.2 line");
}

async function main() {
  const { AssetCatalog } = await import("../../../src/engine/assets/asset_catalog.js");
  const { AssetVariantSelector } = await import("../../../src/engine/assets/asset_variant_selector.js");
  const { AssetLoadQueue } = await import("../../../src/engine/assets/asset_load_queue.js");
  const { StartupLoadProgress } = await import("../../../src/engine/assets/startup_load_progress.js");
  const { SpineRuntimeProvider } = await import("../../../src/platform/browser/animation/spine_runtime_provider.js");
  const runtimeModule = await import("../../../src/platform/browser/animation/spine_runtime_module.js");
  await checkCatalog(AssetCatalog);
  await checkVariantSelector(AssetCatalog, AssetVariantSelector);
  await checkQueue(AssetLoadQueue);
  await checkProgress(StartupLoadProgress);
  await checkSpineProvider(SpineRuntimeProvider, runtimeModule);
  console.log("Asset preloader passed: immutable catalog and aliases, protected data images, tier/format choice, "
    + "priority caps, shared jobs, promotion, release/revival, retry, fixed-denominator progress and optional Spine runtime.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
