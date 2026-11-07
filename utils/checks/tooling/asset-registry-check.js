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

  // Low-quality copies (spec 157 R17): derived files beside their image (name--low.webp, TK-221) are never assets; raster
  // images except depth maps get one; the collected entry keeps the image size.
  const { lowCopyPath, needsLowCopy, tagsOf } = await import(pathToFileURL(path.join(ROOT, "src/engine/assets/asset_registry_sync.js")).href);
  assert.equal(lowCopyPath("assets/items/rods/rod.png"), "assets/items/rods/rod--low.webp", "the low copy lies beside its image");
  assert.equal(lowCopyPath("assets/items/floats/float-day--scene.webp"), "assets/items/floats/float-day--scene--low.webp");
  assert.deepEqual(["assets/a/x.webp", "assets/a/x.png", "assets/a/x.svg", "assets/loc/test-depth.webp", "assets/a/x--low.webp",
    "assets/audio/x.mp3"].map(needsLowCopy), [true, true, false, false, false, false]);
  const withLow = collectAssets([{ path: "assets/a/x.webp", sha256: "s", bytes: 5, width: 800, height: 400 },
    { path: "assets/a/x--low.webp", sha256: "l", bytes: 1 }]);
  assert.deepEqual([...withLow.keys()], ["assets/a/x.webp"], "a low copy is not an asset");
  assert.deepEqual([withLow.get("assets/a/x.webp").width, withLow.get("assets/a/x.webp").height], [800, 400]);

  // TK-221: one folder per item type; a variant is a name suffix that adds its own tags. A moved file's tags follow its
  // folder unless the owner edited them. TK-250: Spine exports lie in assets/animations/<type>/, tagged by those folders.
  assert.deepEqual(tagsOf("assets/items/floats/float-day--scene.webp"), ["items", "floats", "scene", "floats-scene"]);
  assert.deepEqual(tagsOf("assets/animations/rods/bamboo-rod-v1.json"), ["animations", "rods"]);
  assert.deepEqual(tagsOf("assets/items/rods/bamboo-rod-v1--spine.json"), ["items", "rods"], "--spine is no variant (TK-250)");
  assert.deepEqual(tagsOf("assets/items/keepnet/keepnet--20.webp"), ["items", "keepnet"], "a stage number is no variant");
  const placed = syncAssetRegistry({ assets: collectAssets([file("assets/items/floats-scene/float.webp", "f1"),
    file("assets/items/rods-scene/rod.webp", "r1")]) }).registry;
  placed["items.rods-scene.rod"] = { ...placed["items.rods-scene.rod"], tags: ["owner-tag"] };
  const regrouped = syncAssetRegistry({ previous: placed, assets: collectAssets([file("assets/items/floats/float--scene.webp", "f1"),
    file("assets/items/rods/rod--scene.webp", "r1")]) }).registry;
  assert.deepEqual(regrouped["items.floats-scene.float"].tags, ["items", "floats", "scene", "floats-scene"], "folder tags follow the move");
  assert.deepEqual(regrouped["items.rods-scene.rod"].tags, ["owner-tag"], "the owner's tags stay");
  const folders = spawnSync("git", ["ls-files", "assets"], { cwd: ROOT }).stdout.toString("utf8").split("\n");
  assert.deepEqual(folders.filter((tracked) => /^assets\/low-copies\/|-scene\//u.test(tracked)), [],
    "no clone folders: low copies and scene art lie beside the item (TK-221)");

  // The repository's registry matches its tracked assets.
  const check = spawnSync(process.execPath, [path.join(ROOT, "utils/assets-sync.js"), "--check"], { cwd: ROOT });
  assert.equal(check.status, 0, `npm run assets:sync -- --check: ${check.stderr.toString("utf8").trim()}`);
  const { ASSET_REGISTRY } = await import(pathToFileURL(path.join(ROOT, "src/game/config/generated/asset_registry.js")).href);
  assert(Object.keys(ASSET_REGISTRY).length >= 100 && Object.isFrozen(ASSET_REGISTRY));
  assert.equal(ASSET_REGISTRY["animations.rods.bamboo-rod-v1"].kind, "spine", "the rod's Spine export is one asset");
  assert.equal(ASSET_REGISTRY["animations.boats.boat-lvl--3"].kind, "spine", "the boat's Spine export is one asset");
  // TK-250: every Spine export lies in assets/animations/<type>/, and that folder holds Spine exports only.
  const spineFiles = new Set(Object.values(ASSET_REGISTRY).filter((entry) => entry.kind === "spine")
    .flatMap((entry) => [entry.json, entry.atlas, ...entry.textures]));
  assert.deepEqual([...spineFiles].filter((tracked) => !/^assets\/animations\/[^/]+\/[^/]+$/u.test(tracked)), [],
    "Spine exports lie in assets/animations/<type>/ (TK-250)");
  assert.deepEqual(folders.filter((tracked) => tracked.startsWith("assets/animations/") && !spineFiles.has(tracked)), [],
    "assets/animations/ holds Spine exports only (TK-250)");
  const lows = Object.values(ASSET_REGISTRY).filter((entry) => entry.low);
  assert(lows.length >= 70 && lows.every((entry) => entry.lowSource === entry.sha256 && entry.width > 0 && entry.height > 0),
    "every raster image has a current low copy and its size");
  assert.equal(ASSET_REGISTRY["locations.test.test-depth"].low, undefined, "the depth map has no low copy");
  assert(lows.every((entry) => !entry.low.split("/").some((segment) => /^[_.]/u.test(segment))),
    "no low copy sits in a folder GitHub Pages hides (a name starting with _ or .)");
  console.log(`Asset registry passed: ids from paths, Spine packages, moves by content, git rename and hint, ambiguity and `
    + `vanished assets stop the sync, prune, new ids with folder tags, duplicates; repository registry up to date `
    + `(${Object.keys(ASSET_REGISTRY).length} assets).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
