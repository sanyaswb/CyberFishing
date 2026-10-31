"use strict";

// Spec 157 R16 / TK-178 (b-d): the AssetRegistry (a pure id -> file lookup) and the references to it. Configuration
// names an asset by id in a field called `asset`, `<name>Asset` or `<name>Assets` (an object of ids); every such id is
// in the registry with a kind its field can load. Modules already moved to ids hold no "assets/..." path literal: the
// list grows with every group and ends as all of src/ (TK-178 step d).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT, file)).href);

// Modules whose assets are named by id (TK-178 groups). A path literal in them is a regression.
const MIGRATED_MODULES = Object.freeze([
  "src/game/config/raw/locations/location_database.js",
  "src/platform/browser/location/location_asset_loader.js",
  "src/platform/browser/assets/asset_preload_coordinator.js",
]);
const PATH_LITERAL = /["'`]assets\/[^"'`]*/gu;

// Every `asset` / `*Asset` / `*Assets` field under value, with the path to it.
function collectAssetReferences(value, where, found = []) {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    const at = `${where}.${key}`;
    if (key === "asset" || /[a-z]Asset$/u.test(key)) found.push([at, child]);
    else if (/[a-z]Assets$/u.test(key) && child && typeof child === "object") {
      for (const [name, id] of Object.entries(child)) found.push([`${at}.${name}`, id]);
    } else collectAssetReferences(child, at, found);
  }
  return found;
}

(async () => {
  const { AssetRegistry } = await importSource("src/engine/assets/asset_registry.js");
  const { ASSET_REGISTRY } = await importSource("src/game/config/generated/asset_registry.js");

  // The registry: files by id, Spine packages whole, tags, and no guessing for an unknown id.
  const image = (file, tags = []) => ({ kind: "image", path: file, bytes: 1, sha256: "0", tags, label: "" });
  const registry = new AssetRegistry({ "ui.a": image("assets/ui/a.svg", ["ui"]), "ui.b": image("assets/ui/b.svg", ["ui", "x"]),
    "anim.rod": { kind: "spine", json: "assets/anim/rod.json", atlas: "assets/anim/rod.atlas", textures: ["assets/anim/rod.webp"],
      bytes: 3, sha256: "0", tags: ["anim"], label: "" } });
  assert.equal(registry.pathOf("ui.a"), "assets/ui/a.svg");
  assert.deepEqual(registry.spineOf("anim.rod"), { skeleton: "assets/anim/rod.json", atlas: "assets/anim/rod.atlas",
    textures: ["assets/anim/rod.webp"] });
  assert.deepEqual([registry.has("ui.a"), registry.has("ui.c")], [true, false]);
  assert.deepEqual([...registry.idsByTag("ui")], ["ui.a", "ui.b"]);
  assert.deepEqual([...registry.idsByTag("none")], []);
  assert.throws(() => registry.pathOf("ui.c"), /Unknown asset id "ui\.c"/u);
  assert.throws(() => registry.pathOf("anim.rod"), /is a Spine package/u);
  assert.throws(() => registry.spineOf("ui.a"), /is not a Spine package/u);
  assert.throws(() => new AssetRegistry(null), /requires the registry entries/u);

  // Configuration names its assets by registered ids.
  const assets = new AssetRegistry(ASSET_REGISTRY);
  const { MAP_DB } = await importSource("src/game/config/raw/locations/location_database.js");
  const references = collectAssetReferences(MAP_DB, "MAP_DB");
  for (const location of Object.values(MAP_DB)) {
    assert(location.backgroundAssets || location.backgroundAsset, `${location.id} names its background by asset id`);
    assert(location.depthAsset, `${location.id} names its depth map by asset id`);
  }
  assert(references.length > 0, "the configuration has asset references");
  for (const [where, id] of references) {
    assert(typeof id === "string" && assets.has(id), `${where}: "${id}" is not an asset id of the registry`);
    assert.notEqual(assets.entryOf(id).kind, "spine", `${where}: ${id} is a Spine package, not a file`);
  }

  // Moved modules hold no path literals.
  for (const file of MIGRATED_MODULES) {
    const literals = fs.readFileSync(path.join(ROOT, file), "utf8").match(PATH_LITERAL) ?? [];
    assert.deepEqual(literals, [], `${file} names assets by id, not by path`);
  }
  console.log(`Asset references passed: registry lookups (path, Spine package, tags, unknown id), ${references.length} `
    + `configuration references to registered ids, ${MIGRATED_MODULES.length} modules without path literals.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
