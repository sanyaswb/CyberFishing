"use strict";

// Spec 157 R12: features not needed for the first frame load after it. The plan's { module } entries (validation), the
// facade that loads a module through the same queue as the images (the plan's warm-up and the player's first use share
// one load), LazyFeature (null until the module arrives, a first use waits instead of being lost, onReady), and the
// production graph: no module of a lazy feature is statically reachable from a page entry, every feature is named by
// the plan and the release does not preload its chunk.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT, file)).href);
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };

// Modules each lazy feature owns: none of them may load with the start (static imports from a page entry).
const LAZY_FEATURE_MODULES = Object.freeze({
  radio: ["src/bootstrap/production/radio_feature_composition.js", "src/game/application/radio/radio_receiver_service.js",
    "src/platform/browser/audio/radio_stream_player.js", "src/platform/browser/audio/radio_effects_chain.js",
    "src/platform/browser/audio/radio_noise_source.js", "src/platform/browser/ui/radio_hud_indicator.js",
    "src/game/presentation/radio/radio_controls_renderer.js", "src/platform/browser/radio/radio_browser_station_source.js"],
});
// The production entry, and the DEV composition that dev.entry.js imports first thing (a start import).
const ENTRIES = Object.freeze(["src/entrypoints/game.entry.js", "src/bootstrap/development/development_game_startup.js"]);

// Static imports and re-exports only: an import() call is a lazy edge.
function staticGraph(entry) {
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const match of text.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gmu)) {
      const spec = match[1] || match[2];
      if (!spec.startsWith(".")) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (!seen.has(target) && fs.existsSync(path.join(ROOT, target))) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

(async () => {
  const { AssetLoadPlan } = await importSource("src/engine/assets/asset_load_plan.js");
  const { AssetRegistry } = await importSource("src/engine/assets/asset_registry.js");
  const { GameAssetPreloadFacade } = await importSource("src/bootstrap/production/game_asset_preload_facade.js");
  const { LazyFeature } = await importSource("src/bootstrap/production/lazy_feature.js");
  const image = (file) => ({ kind: "image", path: file, bytes: 1, sha256: "0", tags: ["ui"], label: "" });
  const registry = new AssetRegistry({ "ui.a": image("assets/ui/a.svg") });
  const layers = (groups) => ({ layers: [{ id: "one", start: "composition", groups: [{ id: "g", priority: 1, assets: [{ id: "ui.a" }] }] },
    { id: "features", start: "ready", groups }] });

  // Validation: a module entry names a module the composition can load, once.
  const errors = (groups, modules) => AssetLoadPlan.validate({ plan: layers(groups), registry, modules }).join("\n");
  assert.equal(errors([{ id: "f", priority: 1, assets: [{ module: "radio" }] }], ["radio"]), "");
  assert.match(errors([{ id: "f", priority: 1, assets: [{ module: "boat" }] }], ["radio"]), /unknown module boat/u);
  assert.match(errors([{ id: "f", priority: 1, assets: [{ module: "" }] }], ["radio"]), /needs a name/u);
  assert.match(errors([{ id: "f", priority: 1, assets: [{ module: "radio" }] },
    { id: "h", priority: 2, assets: [{ module: "radio" }] }], ["radio"]), /module radio is also in features\/f/u);
  assert.equal(errors([{ id: "f", priority: 1, assets: [{ module: "boat" }] }], null), "", "a tool without modules reads the assets only");

  // The facade: the warm-up (prefetch) and a first use share one load; groups run one at a time by priority.
  const plan = new AssetLoadPlan({ registry, modules: ["radio", "boat"], plan: layers([
    { id: "feature-radio", priority: 1, assets: [{ module: "radio" }] },
    { id: "feature-boat", priority: 2, assets: [{ module: "boat" }] }]) });
  assert.deepEqual(plan.modulesOf(plan.layer("features").groups[0]), ["radio"]);
  assert.deepEqual(plan.resolveGroup(plan.layer("features").groups[0]), [], "a module entry adds no asset id");
  const calls = [];
  const pending = {};
  const loader = (name) => () => { calls.push(name); return new Promise((resolve) => { pending[name] = resolve; }); };
  const scheduler = { setTimeout: (callback) => setTimeout(callback, 0), clearTimeout: (id) => clearTimeout(id) };
  const facade = new GameAssetPreloadFacade({ plan, assets: registry, scheduler,
    imageAssets: { preload: () => Promise.resolve(), isReady: () => false },
    modules: { radio: loader("radio"), boat: loader("boat") } });
  await facade.startOn("composition");
  assert.deepEqual(calls, [], "nothing of the features loads with the first layer");
  const warm = facade.startOn("ready");
  await flush();
  assert.deepEqual(calls, ["radio"], "the warm-up starts with the first feature group only");
  const firstUse = facade.loadModule("radio");
  await flush();
  assert.deepEqual(calls, ["radio"], "a first use while the warm-up loads joins its load");
  const radioModule = { name: "radio-module" };
  pending.radio(radioModule);
  assert.deepEqual(await firstUse, { status: "ready", module: radioModule, error: null });
  assert.equal(await facade.whenModule("radio"), radioModule);
  await flush();
  assert.deepEqual(calls, ["radio", "boat"], "the next feature group follows");
  pending.boat({});
  await warm;
  assert.equal((await facade.loadModule("radio")).module, radioModule, "a loaded module is not loaded again");
  assert.deepEqual(calls, ["radio", "boat"]);
  assert.equal((await facade.loadModule("nope")).status, "failed", "an unknown module settles as failed");
  assert.deepEqual(facade.getStatus()[1].groups.map((group) => [group.id, group.modules, group.status]),
    [["feature-radio", ["radio"], "ready"], ["feature-boat", ["boat"], "ready"]]);
  facade.dispose();

  // LazyFeature: null before the module, a first use waits and gets the one composed feature, onReady once.
  let resolveModule;
  const moduleArrives = new Promise((resolve) => { resolveModule = resolve; });
  const asked = [];
  const preload = { whenModule: () => moduleArrives,
    loadModule: (name) => { asked.push(name); return moduleArrives.then((module) => ({ status: "ready", module, error: null })); } };
  const composed = [];
  const feature = new LazyFeature({ name: "radio", preload, compose: (module) => { composed.push(module); return { module, dispose() {} }; } });
  const ready = [];
  feature.onReady((value) => ready.push(value));
  assert.equal(feature.get(), null, "no feature before its module arrives (a consumer shows loading, no error)");
  const used = feature.request();
  assert.deepEqual(asked, ["radio"], "a first use asks for the module at once");
  resolveModule("module");
  const value = await used;
  assert.equal(value.module, "module", "the first use gets the feature");
  assert.equal(feature.get(), value);
  assert.deepEqual(composed, ["module"], "composed once though both the warm-up and the first use delivered it");
  assert.deepEqual(ready, [value]);
  const late = [];
  feature.onReady((item) => late.push(item));
  assert.deepEqual(late, [value], "a listener after arrival runs at once");
  const failing = new LazyFeature({ name: "radio", compose: () => ({}),
    preload: { whenModule: () => new Promise(() => {}), loadModule: async () => ({ status: "failed", module: null, error: new Error("x") }) } });
  assert.equal(await failing.request(), null, "a module that cannot load resolves null, without an exception");
  assert.throws(() => new LazyFeature({ name: "x", compose: () => ({}) }), /requires the preload facade/u);

  // Production: every lazy feature is a plan module and none of its modules loads with the start.
  const { GAME_FEATURE_MODULES } = await importSource("src/bootstrap/production/game_feature_modules.js");
  const { ASSET_LOAD_PLAN } = await importSource("src/game/config/raw/assets/asset_load_plan.js");
  const { ASSET_REGISTRY } = await importSource("src/game/config/generated/asset_registry.js");
  const productionPlan = new AssetLoadPlan({ plan: ASSET_LOAD_PLAN, registry: new AssetRegistry(ASSET_REGISTRY),
    modules: Object.keys(GAME_FEATURE_MODULES), sources: new Proxy({}, { get: () => ({ resolve: () => [], candidates: () => [] }) }) });
  const planned = productionPlan.layers.flatMap((layer) => layer.groups.flatMap((group) => productionPlan.modulesOf(group)));
  assert.deepEqual(planned.sort(), Object.keys(GAME_FEATURE_MODULES).sort(), "the plan warms up every lazy feature");
  assert.deepEqual(Object.keys(LAZY_FEATURE_MODULES).sort(), Object.keys(GAME_FEATURE_MODULES).sort(),
    "each lazy feature lists its modules here");
  const featureLayer = productionPlan.layers.find((layer) => productionPlan.layer(layer.id).groups
    .some((group) => productionPlan.modulesOf(group).length > 0));
  assert.equal(featureLayer.start, "ready", "lazy features warm up after the first frame");
  for (const entry of ENTRIES) {
    const graph = staticGraph(entry);
    assert(graph.size > 300, `${entry}: the static graph was followed`);
    for (const [name, modules] of Object.entries(LAZY_FEATURE_MODULES)) {
      for (const module of modules) {
        assert(fs.existsSync(path.join(ROOT, module)), `${module} exists`);
        assert(!graph.has(module), `${entry}: ${module} (feature ${name}) loads with the start`);
      }
    }
  }
  const { START_IMPORTS } = require("../../build-release.js");
  for (const modules of Object.values(LAZY_FEATURE_MODULES)) {
    assert(!START_IMPORTS.includes(modules[0]), `${modules[0]} is not a start import (the page does not preload it)`);
  }

  console.log(`Lazy features passed: { module } plan entries, one queued load for the warm-up and the first use, `
    + `LazyFeature (null before arrival, first use waits, composed once, onReady), ${Object.keys(GAME_FEATURE_MODULES).length} `
    + `feature(s) warmed up after ready and absent from the start's static graph (${ENTRIES.length} entries).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
