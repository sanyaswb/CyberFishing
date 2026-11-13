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
  // TK-214: T-full waits for every layer; a failed load (loc.day above) and an on-demand group do not hold it back.
  let fullyLoaded = false;
  void facade.whenFullyLoaded().then(() => { fullyLoaded = true; });
  await flush();
  assert.equal(fullyLoaded, false, "T-full waits for the last load of the last layer");
  pending.get("extra.new").resolve();
  await facade.whenLayer("three");
  await flush();
  assert.equal(fullyLoaded, true, "T-full follows the last layer");
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
  const lowRegistry = new AssetRegistry({ "bg.day": { ...image("assets/bg/day.webp", ["bg"]), low: "assets/bg/day--low.webp" },
    "bg.depth": image("assets/bg/depth.webp", ["bg"]) });
  const lowPlan = new AssetLoadPlan({ registry: lowRegistry, plan: plan([
    layer("first", "composition", [{ id: "map", priority: 1, readyOn: "low", assets: [{ id: "bg.day" }, { id: "bg.depth" }] }]),
    layer("second", "ready", [{ id: "rest", priority: 1, assets: [] }]),
  ]) });
  const lowLoads = [];
  const lowFacade = new GameAssetPreloadFacade({ plan: lowPlan, assets: lowRegistry, scheduler,
    imageAssets: { preload: ([record]) => { lowLoads.push([record.id, record.src]); return Promise.resolve(); } } });
  await lowFacade.start("first");
  assert.deepEqual(lowLoads, [["bg.day", "assets/bg/day--low.webp"], ["bg.depth", "assets/bg/depth.webp"]],
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
  // Spec 171 stage 4: under the release's service worker the offline cache answers, so offline loads go on.
  windowRef.navigator.connection.saveData = false; events.get("change")();
  windowRef.navigator.serviceWorker = { ...target(), controller: null };
  const workerConditions = new BrowserLoadConditions({ documentRef, windowRef });
  const workerChanges = [];
  workerConditions.subscribe((value) => workerChanges.push(value));
  windowRef.navigator.onLine = false; events.get("offline")();
  windowRef.navigator.serviceWorker.controller = {}; events.get("controllerchange")();
  assert.deepEqual([workerChanges, workerConditions.isPaused()], [[true, false], false],
    "offline pauses only until a service worker controls the page");
  workerConditions.dispose();
  windowRef.navigator.onLine = true;
  delete windowRef.navigator.serviceWorker;
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
  assert.deepEqual(first.scene, ["items.floats.float-day--scene", "items.floats.float-day-glow--scene"]);
  assert.equal(first["slot-icons"].length, 13, "the thirteen slot placeholders (the hook is the sprite symbol, TK-238)");
  // Before stage D the start finished 20 assets: these 18 preloads, plus the sections sprite and the status icons that
  // the page's markup requests (measure:startup assetsBeforePlay). Since D4b the current phase starts from its low copy
  // (readyOn "low"); the depth map has none and loads whole.
  const lowGroups = new Set(production.layer("layer-one").groups.filter((group) => group.readyOn === "low").map((group) => group.id));
  assert.deepEqual([...lowGroups], ["location", "rod-start"],
    "the current background phase (owner, R17) and the 3840 px rod picture (TK-250) are ready on their low copies");
  assert.deepEqual(first["rod-start"], ["items.rods.bamboo-rod-v1--scene"], "the rod's picture before its export (TK-181)");
  const startFiles = Object.entries(first).flatMap(([groupId, ids]) => ids.map((id) =>
    (lowGroups.has(groupId) && assets.lowPathOf(id)) || assets.pathOf(id))).sort();
  assert.deepEqual(startFiles, ["assets/items/floats/float-day-glow--scene.webp", "assets/items/floats/float-day--scene.webp",
    "assets/items/rods/bamboo-rod-v1--scene--low.webp",
    "assets/locations/test/bg_test--day--low.webp", "assets/locations/test/test-depth.webp",
    ...["bait", "battery", "boat", "chum", "float", "gas-mask", "keepnet", "line", "net", "radio", "reel", "rod",
      "weight"].map((name) => `assets/ui/inventory/${name}.svg`)].sort(), "layer-one is the pre-D start plus the rod's start picture (TK-181), without tackle.svg (TK-238)");
  // Spec 160: a later priority of the first layer waits for the earlier one and is one more request wave of the start.
  assert.deepEqual([...new Set(production.layer("layer-one").groups.map((group) => group.priority))], [1],
    "the first layer's groups load together: no extra request wave");
  const second = groupIds("layer-two");
  assert.deepEqual(second["location-phases"], ["locations.test.bg_test--evening", "locations.test.bg_test--night"]);
  assert.deepEqual(second["keepnet-stage"], ["items.keepnet.keepnet--0"], "only the keepnet stage the player sees (TK-219)");
  // Spec 159: the owner's lazy order; every asset has a place that loads it, or the locked queue.
  const lazyLayer = production.layer("layer-three");
  assert.equal(lazyLayer.lazy, true, "the third layer is the lazy one");
  assert.deepEqual(lazyLayer.groups.slice(3).map((group) => group.id),
    ["lazy-backgrounds", "lazy-items", "lazy-spine", "lazy-room", "lazy-rest", "audio", "spine-fallback", "locked"], "the owner's order");
  assert.deepEqual(lazyLayer.groups.filter((group) => !group.load).map((group) => group.id), ["audio", "spine-fallback", "locked"],
    "only audio (TK-201: when the radio starts), the pictures for a page without Spine (spec 166) and the locked queue stay out of the background");
  // Spec 166: the rod's full start picture and the boat's picture load only for a page without Spine (on request).
  assert.equal(production.layer("layer-one").groups.find((group) => group.id === "rod-start").upgrade, "on-demand",
    "the rod's full start picture is not loaded after the first frame");
  assert.deepEqual(production.resolveGroup(lazyLayer.groups.find((group) => group.id === "spine-fallback"), {}),
    ["items.boats.boat-lvl--3"], "the boat's picture waits for a boat without Spine");
  const lazyGroup = (id) => lazyLayer.groups.find((group) => group.id === id);
  const lazyKinds = (id) => [...new Set(production.resolveGroup(lazyGroup(id), {}).map((asset) => assets.entryOf(asset).kind))];
  assert.deepEqual(lazyKinds("lazy-items"), ["image"], "the items group holds images only");
  assert.deepEqual(lazyKinds("lazy-spine"), ["spine"]);
  assert.deepEqual(lazyKinds("audio"), ["audio"]);
  // TK-203: the Fisherman's House is open: every level's art loads lazily and nothing is closed today.
  // TK-216: only the opened room level loads; the art of the others waits for the player's upgrade.
  const closedRoomArt = production.lockedIds({});
  assert.equal(closedRoomArt.length, 12, "levels 2-5 are closed at the first level (3 phases each)");
  assert(closedRoomArt.includes("house.room-1.lvl-5.room--1-day-lvl--5"), "the highest level is closed");
  assert(closedRoomArt.includes("house.room-1.lvl-2.room--1-day-lvl--2"), "the next level waits for the upgrade too");
  assert(!closedRoomArt.some((id) => id.includes(".lvl-1.")), "the first level is open");
  assert(!closedRoomArt.some((id) => /_aqua|under-renovation/u.test(id)), "the aquarium and the renovation pictures are open");
  assert.equal(production.lockedIds({ openedRoomLevel: 2 }).length, 9, "pressing upgrade opens one level");
  assert(!production.lockedIds({ openedRoomLevel: 2 }).some((id) => id.includes(".lvl-2.")), "the opened level leaves the closed list");
  assert.deepEqual(production.lockedIds({ openedRoomLevel: 5 }), [], "nothing is closed at the last level");
  const roomIds = production.resolveGroup(lazyGroup("lazy-room"), {});
  assert.equal(roomIds.length, assets.idsByTag("house").length, "the room group names all the House art; the facade leaves the closed ones out");

  // Spec 159: the lazy layer runs the low pass, then the full pass in the same order; closed assets stay out until they
  // open; Spine and audio reach the cache; a later layer's full file follows its copy; a copy is not "ready" for a view.
  {
    const entry = (file, tags) => ({ kind: "image", path: file, low: `low/${file}`, bytes: 1, sha256: "0", tags, label: "" });
    const lazyRegistry = new AssetRegistry({ "bg.a": entry("bg/a.webp", ["bg"]), "item.a": entry("item/a.webp", ["item"]),
      "room.open": entry("room/open.webp", ["room"]), "room.closed": entry("room/closed.webp", ["room"]),
      "ui.vector": image("ui/v.svg", ["rest"]),
      "anim.a": { kind: "spine", json: "anim/a.json", atlas: "anim/a.atlas", textures: ["anim/a.webp"], low: ["anim/a--low.webp"],
        bytes: 1, sha256: "0", tags: ["anim"], label: "" },
      "song.a": { kind: "audio", path: "song/a.m4a", bytes: 1, sha256: "0", tags: ["song"], label: "" },
      "two.a": entry("two/a.webp", ["two"]) });
    const lazySources = { closed: { resolve: ({ level = 1 }) => (level < 2 ? ["room.closed"] : []), candidates: () => ["room.closed"] } };
    const lazyPlan = new AssetLoadPlan({ registry: lazyRegistry, sources: lazySources, plan: plan([
      layer("one", "composition", [{ id: "none", priority: 1, assets: [] }]),
      layer("two", "ready", [{ id: "two", priority: 1, readyOn: "low", assets: [{ tag: "two" }] }]),
      { id: "three", start: "after:two", lazy: true, groups: [
        { id: "bg", priority: 1, assets: [{ tag: "bg" }] }, { id: "items", priority: 2, assets: [{ tag: "item" }] },
        { id: "anim", priority: 3, assets: [{ tag: "anim" }] }, { id: "room", priority: 4, assets: [{ tag: "room" }] },
        { id: "rest", priority: 5, assets: [{ tag: "rest" }] }, { id: "song", priority: 6, load: false, assets: [{ tag: "song" }] },
        { id: "closed", priority: 7, locked: true, assets: [{ source: "closed" }] }] },
    ]) });
    const order = [];
    const ready = new Set();
    const lazyFacade = new GameAssetPreloadFacade({ plan: lazyPlan, assets: lazyRegistry, scheduler,
      imageAssets: { preload: async ([record]) => { order.push(record.src); ready.add(record.id); }, isReady: (id) => ready.has(id) },
      warmFile: async (file) => { order.push(`warm ${file}`); } });
    await lazyFacade.start("one", { level: 1 });
    assert.equal(lazyFacade.isReady("two.a"), false);
    await lazyFacade.startOn("ready");
    assert.deepEqual(order.splice(0, 2), ["low/two/a.webp", "two/a.webp"], "layer two: the full file follows its copy at once");
    assert.equal(lazyFacade.isReady("two.a"), true);
    await lazyFacade.whenLayer("three");
    assert.deepEqual(order, ["low/bg/a.webp", "low/item/a.webp", "warm anim/a.json", "warm anim/a.atlas", "warm anim/a--low.webp",
      "low/room/open.webp", "ui/v.svg", "bg/a.webp", "item/a.webp", "warm anim/a.webp", "room/open.webp"],
    "low copies in the owner's order (a Spine export with its half-size page, spec 166), then the full files in the same order, no audio, nothing closed");
    assert.equal((await lazyFacade.whenGroup("song")).status, "on-demand", "audio waits for its use");
    assert.equal((await lazyFacade.whenGroup("closed")).status, "locked");
    assert.deepEqual((await lazyFacade.whenGroup("room")).ids, ["room.open"], "a closed asset stays out of its group");
    order.length = 0;
    await lazyFacade.setProgress({ level: 2 });
    assert.deepEqual(order, ["low/room/closed.webp", "room/closed.webp"], "progress opens the art: low copy, then the full file");
    assert.deepEqual((await lazyFacade.whenGroup("closed")).ids, [], "the closed group no longer lists what opened");
    order.length = 0;
    await lazyFacade.setProgress({ level: 2 });
    assert.deepEqual(order, [], "unchanged progress loads nothing");
    // Spec 166: a page without Spine warms no Spine export.
    const noSpineOrder = [];
    const noSpine = new GameAssetPreloadFacade({ plan: lazyPlan, assets: lazyRegistry, scheduler, spineAvailable: async () => false,
      imageAssets: { preload: async ([record]) => { noSpineOrder.push(record.src); }, isReady: () => true },
      warmFile: async (file) => { noSpineOrder.push(`warm ${file}`); } });
    await noSpine.start("one", { level: 1 });
    await noSpine.startOn("ready");
    await noSpine.whenLayer("three");
    assert.deepEqual(noSpineOrder.filter((file) => file.startsWith("warm")), [], "without Spine nothing of the export is warmed");
    noSpine.dispose();
    // Spec 166: a first-layer group with upgrade "on-demand" keeps its copy after the first frame; request() brings the full file.
    const onDemandPlan = new AssetLoadPlan({ registry: lazyRegistry, plan: plan([
      layer("one", "composition", [{ id: "start", priority: 1, readyOn: "low", upgrade: "on-demand", assets: [{ id: "item.a" }] }]),
      layer("two", "ready", [{ id: "none", priority: 1, assets: [] }]),
    ]) });
    const onDemandOrder = [];
    const onDemand = new GameAssetPreloadFacade({ plan: onDemandPlan, assets: lazyRegistry, scheduler,
      imageAssets: { preload: async ([record]) => { onDemandOrder.push(record.src); } } });
    await onDemand.start("one");
    await onDemand.startOn("ready");
    await onDemand.whenFullyLoaded();
    const itemFiles = () => onDemandOrder.filter((file) => file.includes("item/a"));
    assert.deepEqual(itemFiles(), ["low/item/a.webp"], "the full file is not loaded after the first frame");
    await onDemand.request(["item.a"]);
    assert.deepEqual(itemFiles(), ["low/item/a.webp", "item/a.webp"], "whoever needs it asks for the full file");
    onDemand.dispose();
    assert.throws(() => new AssetLoadPlan({ registry: lazyRegistry, plan: plan([
      layer("one", "composition", [{ id: "bad", priority: 1, upgrade: "on-demand", assets: [] }])]) }), /upgrade must be/u,
    "upgrade needs readyOn low");
    ready.clear();
    let finishLow;
    const lowOnly = new GameAssetPreloadFacade({ plan: lazyPlan, assets: lazyRegistry, scheduler,
      imageAssets: { preload: ([record]) => { ready.add(record.id); return record.src.startsWith("low/") ? Promise.resolve() : new Promise((done) => { finishLow = done; }); },
        isReady: (id) => ready.has(id) } });
    await lowOnly.start("one", { level: 1 });
    void lowOnly.startOn("ready");
    await flush();
    assert.equal(lowOnly.isReady("two.a"), false, "a store entry that is only the copy does not count as ready for a view");
    finishLow();
    lowOnly.dispose(); lazyFacade.dispose();
  }

  // Stage D6: group times for the overlay, the registry's duplicates, and the DEV plan edits used from the next start.
  let clock = 0;
  const timedFacade = new GameAssetPreloadFacade({ plan: lowPlan, assets: lowRegistry, scheduler, now: () => (clock += 10),
    imageAssets: { preload: () => Promise.resolve() } });
  await timedFacade.start("first");
  const timed = timedFacade.getStatus()[0].groups[0];
  {
    // TK-214: the first layer's full files count toward T-full, although no layer run waits for them.
    const finishers = [];
    const upgrading = new GameAssetPreloadFacade({ plan: lowPlan, assets: lowRegistry, scheduler,
      imageAssets: { preload: ([record]) => (record.src === "assets/bg/day.webp" ? new Promise((done) => { finishers.push(done); }) : Promise.resolve()) } });
    let upgraded = false;
    void upgrading.whenFullyLoaded().then(() => { upgraded = true; });
    await upgrading.start("first");
    await upgrading.startOn("ready");
    await flush();
    assert.ok(finishers.length > 0, "the next layer starts the first layer's full files");
    assert.equal(upgraded, false, "T-full waits for the full files that replace the first layer's copies");
    for (const finish of finishers) finish();
    await upgrading.whenFullyLoaded();
    upgrading.dispose();
  }
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

  // Spec 167 (TK-251): the DEV step-by-step loading. Steps follow the facade's order; with a gate no file of a step is
  // asked for before the step is released; without a gate nothing waits.
  {
    const { AssetLoadStepPlan } = await importSource("src/engine/assets/asset_load_step_plan.js");
    const { AssetLoadGate } = await importSource("src/dev/assets/asset_load_gate.js");
    const productionSteps = new AssetLoadStepPlan(new AssetLoadPlan({ plan: ASSET_LOAD_PLAN, registry: assets,
      sources: createAssetLoadSources({ locations: CONFIG.locations, itemDb: ITEM_DB }) })).steps;
    const lazyPriorities = [...new Set(ASSET_LOAD_PLAN.layers[3].groups.filter((group) => group.load !== false && !group.locked)
      .map((group) => group.priority))];
    assert.deepEqual(productionSteps.map((step) => step.id), ["layer-one:load:1", "upgrade", "layer-two:load:1",
      "features:load:1", "features:load:2", ...lazyPriorities.map((priority) => `layer-three:low:${priority}`),
      ...lazyPriorities.map((priority) => `layer-three:full:${priority}`)], "production steps in the facade's order");
    assert.deepEqual(productionSteps.filter((step) => step.auto).map((step) => step.id), ["layer-one:load:1"],
      "only the first frame starts on its own");
    assert.deepEqual(productionSteps[1].groupIds, ["location"], "the upgrade step names the first layer's groups with copies");

    const stepRegistry = new AssetRegistry({ "bg.day": { ...image("assets/bg/day.webp", ["bg"]), low: "assets/bg/day--low.webp" },
      "ui.a": image("assets/ui/a.svg", ["ui"]), "ui.b": image("assets/ui/b.svg", ["ui"]),
      "it.a": { ...image("assets/it/a.webp", ["it"]), low: "assets/it/a--low.webp" } });
    const stepPlan = new AssetLoadPlan({ registry: stepRegistry, plan: plan([
      layer("first", "composition", [{ id: "map", priority: 1, readyOn: "low", assets: [{ id: "bg.day" }] }]),
      layer("second", "ready", [{ id: "ui-a", priority: 1, assets: [{ id: "ui.a" }] }, { id: "ui-b", priority: 2, assets: [{ id: "ui.b" }] }]),
      { ...layer("third", "after:second", [{ id: "items", priority: 1, assets: [{ id: "it.a" }] }]), lazy: true },
    ]) });
    const steps = new AssetLoadStepPlan(stepPlan).steps;
    assert.deepEqual(steps.map((step) => step.id), ["first:load:1", "upgrade", "second:load:1", "second:load:2",
      "third:low:1", "third:full:1"]);
    let stepClock = 0;
    const gate = new AssetLoadGate({ steps, now: () => (stepClock += 1) });
    // TK-251.2: the current step is the last release; the first frame's step counts from the page start.
    assert.deepEqual(gate.getSnapshot().current, { fromIndex: 0, toIndex: 1, sinceMs: 0 }, "the first frame is the current step");
    let changes = 0;
    gate.subscribe(() => { changes += 1; });
    const loads = [];
    const gated = new GameAssetPreloadFacade({ plan: stepPlan, assets: stepRegistry, scheduler, gate,
      imageAssets: { preload: ([record]) => { loads.push(record.src); return Promise.resolve(); } } });
    await gated.start("first");
    assert.deepEqual(loads, ["assets/bg/day--low.webp"], "the first frame loads on its own");
    void gated.startOn("ready");
    await flush();
    assert.deepEqual(loads.length, 1, "after the first frame nothing loads until a step is released");
    assert.equal(gated.getImageState("bg.day"), "low");
    gate.next();
    await flush();
    assert.deepEqual(loads.slice(1), ["assets/bg/day.webp"], "Далі: the first layer's full files");
    assert.equal(gated.getImageState("bg.day"), "full");
    const afterNext = gate.getSnapshot().current;
    assert.deepEqual([afterNext.fromIndex, afterNext.toIndex, afterNext.sinceMs > 0], [1, 2, true], "Далі makes one step current");
    gate.jumpToLayer("third");
    assert.deepEqual([gate.getSnapshot().current.fromIndex, gate.getSnapshot().current.toIndex], [2, 4],
      "a jump makes every step it released current");
    await flush();
    assert.deepEqual(loads.slice(2), ["assets/ui/a.svg", "assets/ui/b.svg"], "a jump to a layer loads everything before it");
    assert.ok(changes > 0, "the gate tells the DEV section about changes");
    const listed = gated.getStatus()[2].groups[0];
    assert.deepEqual([listed.status, listed.ids], ["waiting", ["it.a"]], "a step's files are listed before it loads");
    await flush();
    assert.equal(loads.length, 4, "the next layer waits at its first step");
    gate.releaseLayer();
    await flush();
    assert.deepEqual(loads.slice(4), ["assets/it/a--low.webp", "assets/it/a.webp"], "the whole layer: low pass, then full");
    await gated.whenFullyLoaded();
    const snapshot = gate.getSnapshot();
    assert.deepEqual([snapshot.nextIndex, snapshot.total, snapshot.steps.every((step) => step.state === "done")], [6, 6, true]);
    gated.dispose();

    // TK-251.1: a full file a view asks for (request(), the DOM pictures after their low copy) waits for the first step
    // that loads it in full: a first-layer copy for the upgrade, a lazy layer's file for its full pass.
    const viewGate = new AssetLoadGate({ steps, now: () => 0 });
    const viewLoads = [];
    const viewFacade = new GameAssetPreloadFacade({ plan: stepPlan, assets: stepRegistry, scheduler, gate: viewGate,
      imageAssets: { preload: ([record]) => { viewLoads.push(record.src); return Promise.resolve(); } } });
    await viewFacade.start("first");
    const asked = { bg: false, item: false };
    void viewFacade.request(["bg.day"]).then(() => { asked.bg = true; });
    void viewFacade.request(["it.a"]).then(() => { asked.item = true; });
    await flush();
    assert.deepEqual([asked, viewLoads.length], [{ bg: false, item: false }, 1], "a view's full files wait for their steps");
    viewGate.next();
    await flush();
    assert.deepEqual([asked.bg, asked.item], [true, false], "the upgrade step releases the first layer's full file");
    viewGate.jumpToLayer("third");
    viewGate.next();
    await flush();
    assert.equal(asked.item, false, "the lazy layer's low pass does not release its full file");
    viewGate.next();
    await flush();
    assert.equal(asked.item, true, "the full pass releases it");
    assert.ok(viewLoads.includes("assets/it/a.webp"));
    viewFacade.dispose();

    // The DevTools section: the mode switch for the next start, the restart, and the step buttons over the gate.
    const { LoadStepperDevSection } = await importSource("src/dev/tools/load_stepper_dev_section.js");
    const { DevLoadStepperSettings } = await importSource("src/dev/assets/dev_load_stepper_settings.js");
    const kept = new Map();
    const settings = new DevLoadStepperSettings({ cache: { get: (key, fallback) => kept.get(key) ?? fallback,
      set: (key, value) => kept.set(key, value), remove: (key) => kept.delete(key) } });
    const node = () => ({ isConnected: true, rows: [], replaceChildren() { this.rows = []; } });
    const ui = { createSwitcherRow: (label, value, parent, change) => parent.rows.push({ label, value, change }),
      createButtonRow: (label, parent, click) => parent.rows.push({ label, click }),
      createTextRow: (label, value, parent) => parent.rows.push({ label, value }) };
    const sections = new Map();
    const createSection = (label, parent) => { const content = sections.get(label) ?? node(); sections.set(label, content);
      content.replaceChildren(); parent.rows.push({ label, content }); return content; };
    let restarts = 0;
    let sectionGate = null;
    const section = new LoadStepperDevSection({ settings, getGate: () => sectionGate, restart: () => { restarts += 1; },
      readStatus: () => ({ layers: stepPlan.layers.map((entry) => ({ groups: entry.groups.map((group) => ({ id: group.id,
        label: group.label, files: stepPlan.resolveGroup(group).map((id) => ({ id, kind: "image", path: stepRegistry.pathOf(id),
          bytes: 2048, state: "none" })) })) })) }), createSection });
    const body = node();
    section.render(body, ui);
    const root = sections.get("ПОКРОКОВЕ ЗАВАНТАЖЕННЯ");
    const row = (label) => root.rows.find((entry) => entry.label.startsWith(label));
    assert.equal(row("стан").value, "вимкнено", "mode off: no steps");
    row("Покроковий режим").change(true);
    assert.equal(settings.isEnabled(), true, "the switch keeps the mode for the next start");
    row("↻ Почати спочатку").click();
    assert.equal(restarts, 1, "the restart reloads the page");
    sectionGate = new AssetLoadGate({ steps, now: () => 0 });
    section.render(body, ui);
    assert.equal(row("кроків завантажено").value, "1 / 6");
    row("Далі").click();
    assert.equal(row("кроків завантажено").value, "2 / 6", "Далі releases one step and the section re-renders");
    sections.get("Шари (перейти до початку)").rows.find((entry) => entry.label.includes("third")).click();
    assert.equal(row("кроків завантажено").value, "4 / 6", "a layer button jumps to the layer's start");
    const nextFiles = sections.get("Наступний крок (ще не вантажиться)").rows.map((entry) => `${entry.label}=${entry.value}`);
    assert.ok(nextFiles.includes("  a.webp=не завантажено · 2 КБ"), "the next step lists its files with their state");
    row("Завантажити все").click();
    assert.equal(row("наступний").value, "усе завантажено");
    settings.setEnabled(false);
    assert.equal(settings.isEnabled(), false);
  }

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
