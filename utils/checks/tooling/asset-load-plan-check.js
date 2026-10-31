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
  const facade = new GameAssetPreloadFacade({ plan: testPlan, assets: registry, imageAssets });
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
  // the page's markup requests (measure:startup assetsBeforePlay).
  const startFiles = Object.values(first).flat().map((id) => assets.pathOf(id)).sort();
  assert.deepEqual(startFiles, ["assets/items/floats-scene/float-day-glow.webp", "assets/items/floats-scene/float-day.webp",
    "assets/locations/test/bg_test--day.webp", "assets/locations/test/test-depth.webp",
    ...["bait", "battery", "boat", "chum", "float", "gas-mask", "keepnet", "line", "net", "radio", "reel", "rod", "tackle",
      "weight"].map((name) => `assets/ui/inventory/${name}.svg`)].sort(), "layer-one is today's start, nothing added");
  const second = groupIds("layer-two");
  assert.deepEqual(second["location-phases"], ["locations.test.bg_test--evening", "locations.test.bg_test--night"]);
  assert.equal(second["keepnet-stages"].length, 6);
  assert(production.layer("layer-three").groups.every((group) => group.load === false), "layer three loads on demand only");

  // Loads go through the plan (DEVELOPMENT_RULES "Loading and startup optimization"): in the composition only the
  // facade preloads images; the selector's rod art follows the equipped rod (moves to facade.request with stage D2).
  const fs = require("node:fs");
  const allowed = new Set(["src/bootstrap/production/game_asset_preload_facade.js",
    "src/bootstrap/production/inventory_selector_composition.js"]);
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
