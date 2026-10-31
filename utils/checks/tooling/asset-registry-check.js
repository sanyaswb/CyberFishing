"use strict";

// Spec 157 R16 / TK-178: the asset registry keeps every asset under a stable id. The pure matching (moves by content,
// by git rename or by an explicit hint; an ambiguous match, a vanished referenced asset or a vanished unreferenced one
// without --prune stop the sync) and the repository's registry being up to date (npm run assets:sync -- --check).
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "../../..");

(async () => {
  const { assetIdForPath, collectAssets, syncAssetRegistry, atlasTextureNames } =
    await import(pathToFileURL(path.join(ROOT, "src/engine/assets/asset_registry_sync.js")).href);
  const file = (filePath, sha256, bytes = 10) => ({ path: filePath, sha256, bytes });

  assert.equal(assetIdForPath("assets/items/rods/bamboo-rod-ecip-v1.webp"), "items.rods.bamboo-rod-ecip-v1");
  assert.equal(assetIdForPath("assets/ui/icon.svg", new Set(["ui.icon"])), "ui.icon.svg", "a shared id keeps the extension");
  assert.deepEqual(atlasTextureNames("\nrod.webp\nsize:256,256\nfilter:Linear,Linear\nbone\n  bounds:1,2,3,4\n"), ["rod.webp"]);

  // A Spine export is one asset; readme files are not assets; a texture the atlas names must be tracked.
  const assets = collectAssets([file("assets/anim/rod.json", "j"), file("assets/anim/rod.atlas", "a"), file("assets/anim/rod.webp", "t"),
    file("assets/audio/readme.txt", "r"), file("assets/ui/a.svg", "s")], { "assets/anim/rod.atlas": ["rod.webp"] });
  assert.deepEqual([...assets.keys()].sort(), ["assets/anim/rod.json", "assets/ui/a.svg"]);
  assert.deepEqual(assets.get("assets/anim/rod.json"), { kind: "spine", json: "assets/anim/rod.json", atlas: "assets/anim/rod.atlas",
    textures: ["assets/anim/rod.webp"], bytes: 30, sha256: "j+a+t" });
  assert.throws(() => collectAssets([file("assets/a/x.json", "j"), file("assets/a/x.atlas", "a")], { "assets/a/x.atlas": ["x.webp"] }),
    /names assets\/a\/x\.webp, which is not a tracked asset/u);

  const first = syncAssetRegistry({ assets: collectAssets([file("assets/items/rod.webp", "r1"), file("assets/ui/a.svg", "s1")]) });
  assert.deepEqual(first.errors, []);
  assert.deepEqual(first.report.added, ["items.rod", "ui.a"]);
  const previous = JSON.parse(JSON.stringify(first.registry));
  previous["items.rod"].label = "Вудка";
  previous["items.rod"].tags = ["items", "rod"];
  const sync = (files, options = {}) => syncAssetRegistry({ previous, assets: collectAssets(files), ...options });

  // A file moved with the same content keeps its id, its tags and its label.
  let result = sync([file("assets/gear/rod-v2.webp", "r1"), file("assets/ui/a.svg", "s1")]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.report.moved, [{ id: "items.rod", from: "assets/items/rod.webp", to: "assets/gear/rod-v2.webp" }]);
  assert.deepEqual(result.registry["items.rod"], { kind: "image", path: "assets/gear/rod-v2.webp", bytes: 10, sha256: "r1",
    tags: ["items", "rod"], label: "Вудка" });
  // Moved and changed: git's rename names it; without it the sync stops instead of guessing.
  result = sync([file("assets/gear/rod-v2.webp", "r2"), file("assets/ui/a.svg", "s1")],
    { renames: [["assets/items/rod.webp", "assets/gear/rod-v2.webp"]] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.registry["items.rod"].path, "assets/gear/rod-v2.webp");
  result = sync([file("assets/gear/rod-v2.webp", "r2"), file("assets/ui/a.svg", "s1")]);
  assert.match(result.errors.join("\n"), /assets\/items\/rod\.webp \(items\.rod\) is gone; name its move with --moved/u);
  result = sync([file("assets/gear/rod-v2.webp", "r2"), file("assets/ui/a.svg", "s1")],
    { moved: [["assets/items/rod.webp", "assets/gear/rod-v2.webp"]] });
  assert.deepEqual(result.errors, [], "an explicit --moved hint names the move");
  assert.equal(result.registry["items.rod"].path, "assets/gear/rod-v2.webp");
  // Two vanished assets with the new file's content: ambiguous, the sync stops.
  const twins = JSON.parse(JSON.stringify(previous));
  twins["ui.a"].sha256 = "r1";
  result = syncAssetRegistry({ previous: twins, assets: collectAssets([file("assets/new/x.webp", "r1")]) });
  assert.match(result.errors.join("\n"), /has the content of items\.rod, ui\.a; name the move with --moved/u);
  // A vanished asset that src/ references is an error even with --prune; an unreferenced one goes with --prune.
  result = sync([file("assets/ui/a.svg", "s1")], { referencedIds: new Set(["items.rod"]), prune: true });
  assert.match(result.errors.join("\n"), /is gone but still referenced/u);
  result = sync([file("assets/ui/a.svg", "s1")], { prune: true });
  assert.deepEqual([result.errors, result.report.removed, Object.keys(result.registry)], [[], ["items.rod"], ["ui.a"]]);
  // A new file gets a new id with tags from its folder; equal content under two ids is reported.
  result = sync([file("assets/items/rod.webp", "r1"), file("assets/ui/a.svg", "s1"), file("assets/fish/perch/perch--1.webp", "r1")]);
  assert.deepEqual(result.report.added, ["fish.perch.perch--1"]);
  assert.deepEqual(result.registry["fish.perch.perch--1"].tags, ["fish", "perch"]);
  assert.deepEqual(result.report.duplicates, [["fish.perch.perch--1", "items.rod"]]);
  // An unchanged file keeps everything; a changed one in place is an update.
  result = sync([file("assets/items/rod.webp", "r9", 12), file("assets/ui/a.svg", "s1")]);
  assert.deepEqual([result.report.updated, result.registry["items.rod"].label], [["items.rod"], "Вудка"]);

  // The repository's registry matches its tracked assets.
  const check = spawnSync(process.execPath, [path.join(ROOT, "utils/assets-sync.js"), "--check"], { cwd: ROOT });
  assert.equal(check.status, 0, `npm run assets:sync -- --check: ${check.stderr.toString("utf8").trim()}`);
  const { ASSET_REGISTRY } = await import(pathToFileURL(path.join(ROOT, "src/game/config/generated/asset_registry.js")).href);
  assert(Object.keys(ASSET_REGISTRY).length >= 150 && Object.isFrozen(ASSET_REGISTRY));
  assert.equal(ASSET_REGISTRY["animations.rods.bamboo-rod-v1.rod"].kind, "spine", "the rod's Spine export is one asset");
  console.log(`Asset registry passed: ids from paths, Spine packages, moves by content, git rename and hint, ambiguity and `
    + `vanished assets stop the sync, prune, new ids with folder tags, duplicates; repository registry up to date `
    + `(${Object.keys(ASSET_REGISTRY).length} assets).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
