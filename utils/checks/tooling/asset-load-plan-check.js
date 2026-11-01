"use strict";

// Spec 157 R15 / TK-177, stage D1: the asset load plan (pure validation, entries by id / tag / source, the implicit
// "unassigned" group), the facade that runs it over one image store (priorities, layers, after:<layer>, on-demand,
// failures that settle instead of rejecting) and the production plan: its first layer is exactly what the start loaded
// before stage D (the current phase and the depth map, the float's scene art, the slot placeholders).
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT, file)).href);
const flush = async () => { for (let index = 0; index < 10; index += 1) await Promise.resolve(); };

(async () => {
  const { AssetLoadPlan, UNASSIGNED_GROUP_ID } = await importSource("src/engine/assets/asset_load_plan.js");
  const { AssetRegistry } = await importSource("src/engine/assets/asset_registry.js");
  const { GameAssetPreloadFacade } = await importSource("src/bootstrap/production/game_asset_preload_facade.js");
  const image = (file, tags) => ({ kind: "image", path: file, bytes: 1, sha256: "0", tags, label: "" });
  const registry = new AssetRegistry({ "ui.a": image("assets/ui/a.svg", ["ui"]), "ui.b": image("assets/ui/b.svg", ["ui"]),
    "loc.day": image("assets/loc/day.webp", ["loc"]), "loc.night": image("assets/loc/night.webp", ["loc"]),
    "extra.new": image("assets/extra/new.webp", ["extra"]),
    "audio.song": { kind: "audio", path: "assets/audio/song.mp3", bytes: 1, sha256: "0", tags: ["audio"], label: "" } });
  const sources = { phase: { resolve: ({ phase }) => [`loc.${phase}`], candidates: () => ["loc.day", "loc.night"] } };
  const plan = (layers) => ({ layers });
  const layer = (id, start, groups) => ({ id, start, groups });

  // Validation: every rule fails with a readable line.
  const errors = (layers) => AssetLoadPlan.validate({ plan: plan(layers), registry, sources }).join("\n");
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 0, assets: [] }])]), /priority must be an integer >= 1/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, assets: [{ id: "ui.a", tag: "ui" }] }])]), /exactly one of/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, assets: [{ id: "ui.z" }] }])]), /unknown asset id ui\.z/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, assets: [{ tag: "none" }] }])]), /matches no asset/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, assets: [{ source: "nope" }] }])]), /unknown source/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, assets: [{ id: "ui.a" }] },
    { id: "h", priority: 2, assets: [{ id: "ui.a" }] }])]), /ui\.a is also in one\/g/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, assets: [] }]),
    layer("two", "after:three", [{ id: "h", priority: 1, assets: [] }])]), /unknown or later layer three/u);
  assert.match(errors([layer("one", "soon", [])]), /start must be/u);
  assert.match(errors([layer("one", "composition", [{ id: "g", priority: 1, readyOn: "half", assets: [] }])]), /readyOn must be/u);
  assert.throws(() => new AssetLoadPlan({ plan: plan([layer("one", "soon", [])]), registry, sources }), /Invalid asset load plan/u);

  // Sources and tags resolve; whatever no group names (and no source can give) is the implicit last group.
  const testPlan = new AssetLoadPlan({ registry, sources, plan: plan([
    layer("one", "composition", [{ id: "bg", priority: 1, assets: [{ source: "phase" }] },
      { id: "ui", priority: 2, assets: [{ tag: "ui" }] }]),
    layer("two", "ready", [{ id: "later", priority: 1, assets: [{ id: "audio.song" }] }]),
    layer("three", "after:two", [{ id: "demand", priority: 1, load: false, assets: [] }]),
  ]) });
  assert.deepEqual(testPlan.unassignedIds(), ["extra.new"], "a new asset nobody placed is unassigned");
  const last = testPlan.layer("three").groups.at(-1);
  assert.deepEqual([last.id, last.priority, testPlan.resolveGroup(last)], [UNASSIGNED_GROUP_ID, 2, ["extra.new"]],
    "unassigned assets load last, in the last layer");
  assert.deepEqual(testPlan.resolveGroup(testPlan.layer("one").groups[0], { phase: "night" }), ["loc.night"]);

  // The facade: priorities in order, the next layer only when started, after:<layer> on its own, on-demand placed only.
  const requests = [];
  const pending = new Map();
  const imageAssets = { preload: (records) => new Promise((resolve, reject) => {
    for (const record of records) { requests.push(record.id); pending.set(record.id, { resolve, reject }); }
  }) };
  const scheduler = { setTimeout, clearTimeout };
  const facade = new GameAssetPreloadFacade({ plan: testPlan, assets: registry, imageAssets, scheduler, maxAttempts: 1 });
  const one = facade.start("one", { phase: "day" });
  assert.equal(facade.start("one"), one, "a layer starts once");
  await flush();
  assert.deepEqual(requests, ["loc.day"], "priority 2 waits for priority 1");
  pending.get("loc.day").reject(new Error("404"));
  await flush();
  assert.deepEqual(await facade.whenGroup("bg"), { status: "failed", ids: ["loc.day"], error: new Error("404") },
    "a failed load settles the group as failed, it never rejects");
  assert.deepEqual(requests, ["loc.day", "ui.a", "ui.b"], "the next priority follows a settled one");
  pending.get("ui.a").resolve(); pending.get("ui.b").resolve();
  await one;
  assert.equal((await facade.whenGroup("ui")).status, "ready");
  await flush();
  assert.equal(requests.length, 3, "layer two waits for its start (the first frame)");
  facade.start("two");
  await facade.whenLayer("two");
  assert.deepEqual((await facade.whenGroup("later")).ids, ["audio.song"], "the group names its audio");
  await flush();
  assert.equal((await facade.whenGroup("demand")).status, "on-demand", "after:two starts by itself");
  assert.deepEqual(requests.slice(3), ["extra.new"],
    "audio is not an image the facade loads, an on-demand group loads nothing, unassigned loads last");
  pending.get("extra.new").resolve();
  await facade.whenLayer("three");
  assert.deepEqual(facade.getStatus().map((entry) => entry.started), [true, true, true]);

  // Stage D2: background layers share capped slots and wait while paused; what the player opened goes first.
  const bgRegistry = new AssetRegistry(Object.fromEntries(["a", "b", "c", "d"].map((name) =>
    [`bg.${name}`, image(`assets/bg/${name}.webp`, ["bg"])]).concat([["open.x", image("assets/open/x.webp", ["open"])]])));
  const bgPlan = new AssetLoadPlan({ registry: bgRegistry, plan: plan([
    layer("first", "composition", [{ id: "none", priority: 1, assets: [] }]),
    layer("second", "ready", [{ id: "bg", priority: 1, assets: [{ tag: "bg" }] }]),
    layer("third", "after:second", [{ id: "open", priority: 1, load: false, assets: [{ id: "open.x" }] }]),
  ]) });
  const started = [];
  const finishers = new Map();
  const bgImages = { preload: ([record]) => new Promise((resolve) => { started.push(record.id); finishers.set(record.id, resolve); }) };
  let paused = true;
  const listeners = new Set();
  const conditions = { isPaused: () => paused, subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } };
  const bgFacade = new GameAssetPreloadFacade({ plan: bgPlan, assets: bgRegistry, imageAssets: bgImages, scheduler, conditions,
    networkSlots: 3, backgroundSlots: 2 });
  await bgFacade.start("first");
  bgFacade.start("second");
  await flush();
  assert.deepEqual(started, [], "a hidden tab, offline or save-data pauses the background layers");
  const opened = bgFacade.request(["open.x"]);
  await flush();
  assert.deepEqual(started, ["open.x"], "what the player opened loads even while the background waits");
  paused = false;
  for (const listener of listeners) listener(false);
  await flush();
  assert.deepEqual(started, ["open.x", "bg.a", "bg.b"], "the background resumes within its own cap");
  finishers.get("open.x")();
  assert.deepEqual(await opened, { status: "ready", ids: ["open.x"], error: null });
  const promoted = bgFacade.request(["bg.d"]);
  finishers.get("bg.a")();
  await flush();
  assert.deepEqual(started.slice(3), ["bg.d", "bg.c"], "a queued background job the player needs is promoted ahead of the rest");
  for (const id of ["bg.b", "bg.d"]) finishers.get(id)();
  await flush();
  finishers.get("bg.c")?.();
  assert.equal((await promoted).status, "ready");
  await bgFacade.whenLayer("second");
  assert.equal(bgFacade.getQueueSnapshot().queued, 0);
  bgFacade.dispose();
  assert.equal(listeners.size, 0, "dispose unsubscribes from the conditions");

  // Stage D4b: readyOn "low" — the copy under the image's own id first, the full file only when the next layer starts.
  const lowRegistry = new AssetRegistry({ "bg.day": { ...image("assets/bg/day.webp", ["bg"]), low: "assets/low-copies/bg/day.webp" },
    "bg.depth": image("assets/bg/depth.webp", ["bg"]) });
  const lowPlan = new AssetLoadPlan({ registry: lowRegistry, plan: plan([
    layer("first", "composition", [{ id: "map", priority: 1, readyOn: "low", assets: [{ id: "bg.day" }, { id: "bg.depth" }] }]),
    layer("second", "ready", [{ id: "rest", priority: 1, assets: [] }]),
  ]) });
  const lowLoads = [];
  const lowFacade = new GameAssetPreloadFacade({ plan: lowPlan, assets: lowRegistry, scheduler,
    imageAssets: { preload: ([record]) => { lowLoads.push([record.id, record.src]); return Promise.resolve(); } } });
  await lowFacade.start("first");
  assert.deepEqual(lowLoads, [["bg.day", "assets/low-copies/bg/day.webp"], ["bg.depth", "assets/bg/depth.webp"]],
    "the start loads the copy under the image's id; an image without a copy loads whole");
  await lowFacade.start("second");
  await flush();
  assert.deepEqual(lowLoads.slice(2), [["bg.day", "assets/bg/day.webp"]], "the full file follows when the next layer starts");

  // The image store keeps serving the copy until the full file is decoded, then swaps; a failed upgrade keeps the copy.
  const { ImageAssetProvider } = await importSource("src/platform/browser/assets/image_asset_provider.js");
  const made = [];
  const provider = new ImageAssetProvider({ imageFactory: () => { const img = { decode: () => Promise.resolve() }; made.push(img); return img; } });
  const lowReady = provider.preload([{ id: "bg.day", src: "low.webp" }]);
  made[0].onload(); await lowReady;
  const copy = provider.tryGet("bg.day");
  const upgrade = provider.preload([{ id: "bg.day", src: "full.webp" }]);
  assert.equal(provider.tryGet("bg.day"), copy, "the copy stays while the full file loads");
  made[1].onload(); await upgrade;
  assert.equal(provider.tryGet("bg.day"), made[1], "the decoded full file replaces the copy (the scene re-uploads it)");
  const failing = provider.preload([{ id: "bg.day", src: "broken.webp" }]);
  made[2].onerror(new Error("404"));
  await failing.catch(() => null);
  assert.equal(provider.tryGet("bg.day"), made[1], "a failed upgrade keeps the shown image");

  const { BrowserLoadConditions } = await importSource("src/platform/browser/assets/browser_load_conditions.js");
  const events = new Map();
  const target = () => ({ addEventListener: (type, fn) => events.set(type, fn), removeEventListener: (type) => events.delete(type) });
  const documentRef = { ...target(), visibilityState: "visible" };
  const windowRef = { ...target(), navigator: { onLine: true, connection: { saveData: false, ...target() } } };
  const browserConditions = new BrowserLoadConditions({ documentRef, windowRef });
  const changes = [];
  browserConditions.subscribe((value) => changes.push(value));
  assert.equal(browserConditions.isPaused(), false);
  documentRef.visibilityState = "hidden"; events.get("visibilitychange")();
  documentRef.visibilityState = "visible"; events.get("visibilitychange")();
  windowRef.navigator.onLine = false; events.get("offline")();
  windowRef.navigator.onLine = true; events.get("online")();
  windowRef.navigator.connection.saveData = true; events.get("change")();
  assert.deepEqual(changes, [true, false, true, false, true], "hidden tab, offline and save-data pause; each change once");
  browserConditions.dispose();
  assert.equal(events.size, 0, "dispose removes every listener");

  // The production plan: valid on the real registry, nothing unassigned, and its first layer is the pre-D start.
  const { ASSET_REGISTRY } = await importSource("src/game/config/generated/asset_registry.js");
  const { ASSET_LOAD_PLAN } = await importSource("src/game/config/raw/assets/asset_load_plan.js");
  const { createAssetLoadSources } = await importSource("src/bootstrap/production/asset_load_sources.js");
  const { CONFIG } = await importSource("src/game/config/runtime/game_config.js");
  const { ITEM_DB } = await importSource("src/game/config/databases/item_catalog.js");
  const assets = new AssetRegistry(ASSET_REGISTRY);
  const production = new AssetLoadPlan({ plan: ASSET_LOAD_PLAN, registry: assets,
    sources: createAssetLoadSources({ locations: CONFIG.locations, itemDb: ITEM_DB }) });
  assert.deepEqual(production.unassignedIds(), [], "every registered asset has its place in the plan");
  const state = { locationId: "test", phases: ["day"] };
  const groupIds = (layerId) => Object.fromEntries(production.layer(layerId).groups
    .map((group) => [group.id, production.resolveGroup(group, state)]));
  const first = groupIds("layer-one");
  assert.deepEqual(first.location, ["locations.test.bg_test--day", "locations.test.test-depth"]);
  assert.deepEqual(first.scene, ["items.floats-scene.float-day", "items.floats-scene.float-day-glow"]);
  assert.equal(first["slot-icons"].length, 14, "the fourteen slot placeholders");
  // Before stage D the start finished 20 assets: these 18 preloads, plus the sections sprite and the status icons that
  // the page's markup requests (measure:startup assetsBeforePlay). Since D4b the current phase starts from its low copy
  // (readyOn "low"); the depth map has none and loads whole.
  const lowGroups = new Set(production.layer("layer-one").groups.filter((group) => group.readyOn === "low").map((group) => group.id));
  assert.deepEqual([...lowGroups], ["location"], "the current background phase is ready on its low copy (owner, R17)");
  assert.deepEqual(first["rod-start"], ["items.rods-scene.bamboo-rod-v1"], "the rod's picture before its export (TK-181)");
  const startFiles = Object.entries(first).flatMap(([groupId, ids]) => ids.map((id) =>
    (lowGroups.has(groupId) && assets.lowPathOf(id)) || assets.pathOf(id))).sort();
  assert.deepEqual(startFiles, ["assets/items/floats-scene/float-day-glow.webp", "assets/items/floats-scene/float-day.webp",
    "assets/items/rods-scene/bamboo-rod-v1.webp",
    "assets/low-copies/locations/test/bg_test--day.webp", "assets/locations/test/test-depth.webp",
    ...["bait", "battery", "boat", "chum", "float", "gas-mask", "keepnet", "line", "net", "radio", "reel", "rod", "tackle",
      "weight"].map((name) => `assets/ui/inventory/${name}.svg`)].sort(), "layer-one is the pre-D start plus the rod's start picture (TK-181)");
  const second = groupIds("layer-two");
  assert.deepEqual(second["location-phases"], ["locations.test.bg_test--evening", "locations.test.bg_test--night"]);
  assert.equal(second["keepnet-stages"].length, 6);
  assert(production.layer("layer-three").groups.every((group) => group.load === false), "layer three loads on demand only");

  // Stage D6: group times for the overlay, the registry's duplicates, and the DEV plan edits used from the next start.
  let clock = 0;
  const timedFacade = new GameAssetPreloadFacade({ plan: lowPlan, assets: lowRegistry, scheduler, now: () => (clock += 10),
    imageAssets: { preload: () => Promise.resolve() } });
  await timedFacade.start("first");
  const timed = timedFacade.getStatus()[0].groups[0];
  assert.deepEqual([timed.status, timed.readyOn, timed.settledMs - timed.startedMs], ["ready", "low", 10], "a group's state and time");
  assert.deepEqual(new AssetRegistry({ a: image("assets/a.webp", []), b: { ...image("assets/b.webp", []), sha256: "0" },
    c: { ...image("assets/c.webp", []), sha256: "1" } }).duplicates(), [["a", "b"]], "same content under two ids");
  const { DevAssetLoadPlanStore } = await importSource("src/dev/assets/dev_asset_load_plan_store.js");
  const stored = new Map();
  const warnings = [];
  const cache = { get: (key) => stored.get(key) ?? null, set: (key, value) => stored.set(key, value), remove: (key) => stored.delete(key) };
  const store = new DevAssetLoadPlanStore({ cache, basePlan: ASSET_LOAD_PLAN, registry: assets, logger: { warn: (text) => warnings.push(text) },
    sources: createAssetLoadSources({ locations: CONFIG.locations, itemDb: ITEM_DB }) });
  assert.equal(store.plan(), ASSET_LOAD_PLAN, "without an edit the configured plan runs");
  const edited = JSON.parse(JSON.stringify(ASSET_LOAD_PLAN));
  edited.layers[1].groups[0].priority = 2;
  assert.match(store.save({ layers: [] }).join("\n"), /needs layers/u, "an invalid plan is not saved");
  assert.equal(store.isEdited(), false);
  assert.deepEqual(store.save(edited), []);
  assert.deepEqual([store.isEdited(), store.plan().layers[1].groups[0].priority], [true, 2], "the edit runs from the next start");
  assert.match(store.exportText(), /^export const ASSET_LOAD_PLAN = \{/u, "export gives the configuration module's text");
  assert.deepEqual(JSON.parse(store.exportText().replace(/^export const ASSET_LOAD_PLAN = /u, "").replace(/;\n$/u, "")), edited);
  stored.set("cyber-fishing:dev-asset-load-plan", { layers: [{ id: "x", start: "soon", groups: [] }] });
  assert.equal(store.plan(), ASSET_LOAD_PLAN, "a broken stored plan is ignored");
  assert.equal(warnings.length, 1, "and reported");
  store.reset();
  assert.equal(store.isEdited(), false);

  // Loads go through the plan (DEVELOPMENT_RULES "Loading and startup optimization"): in the composition only the
  // facade preloads images (the selector's rod art goes through facade.request, stage D2).
  const fs = require("node:fs");
  const allowed = new Set(["src/bootstrap/production/game_asset_preload_facade.js"]);
  const adHoc = [];
  for (const directory of ["src/bootstrap/production", "src/bootstrap/development"]) {
    for (const name of fs.readdirSync(path.join(ROOT, directory))) {
      const file = `${directory}/${name}`;
      if (!name.endsWith(".js") || allowed.has(file)) continue;
      if (/\.preload(?:Location|Manifest)?\(|preload(?:SlotIcons|KeepnetStages)\b/u.test(fs.readFileSync(path.join(ROOT, file), "utf8"))) {
        adHoc.push(file);
      }
    }
  }
  assert.deepEqual(adHoc, [], "the composition preloads nothing outside the asset load plan");
  console.log("Asset load plan passed: validation rules, sources/tags/unassigned, facade priorities, layer starts, "
    + `after:<layer>, on-demand and settled failures; production plan valid with nothing unassigned, layer-one = the `
    + `pre-D start (${startFiles.length} files).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
