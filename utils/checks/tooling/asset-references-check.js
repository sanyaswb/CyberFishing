"use strict";

// Spec 157 R16 / TK-178 (b-d): the AssetRegistry (a pure id -> file lookup) and the references to it. Configuration
// names an asset by id in a field called `asset`, `<name>Asset` or `<name>Assets` (an object of ids); every such id is
// in the registry with a kind its field can load. No source file, stylesheet or page holds an "assets/..." path literal
// (TK-178 step d) except the generated registry and the sync's folder constant; the asset modules' id literals are
// registered ids.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT, file)).href);

// Modules that name assets in code (TK-178 groups): every id-shaped literal in them must be a registered id. (Elsewhere
// such strings are configuration paths like "ui.inventorySelector.size".)
const MIGRATED_MODULES = Object.freeze([
  "src/game/config/raw/locations/location_database.js",
  "src/platform/browser/location/location_asset_loader.js",
  "src/platform/browser/assets/asset_preload_coordinator.js",
  "src/game/config/runtime/game_config.js",
  "src/game/config/raw/radio/radio_channels.js",
  "src/game/application/state/biting_state.js",
  "src/platform/browser/runtime/browser_audio_adapter.js",
  "src/platform/browser/audio/vinyl_rack.js",
  "src/platform/browser/audio/radio_effects_chain.js",
  "src/platform/browser/audio/radio_stream_player.js",
  "src/game/config/raw/house/house_config.js",
  "src/game/presentation/house/house_room_view.js",
  "src/game/presentation/house/house_screen_markup.js",
  "src/platform/browser/animation/spine_bundle_loader.js",
  "src/game/presentation/fishing/rod_animation_controller.js",
  "src/game/presentation/world/boat_animation_controller.js",
  "src/game/presentation/fishing/fishing_equipment_render_model_builder.js",
  "src/bootstrap/production/rod_animation_composition.js",
  "src/bootstrap/production/boat_animation_composition.js",
  "src/game/config/validation/config_schema_validator.js",
  "src/game/config/raw/items/item_database.js",
  "src/game/config/raw/live_bait/live_bait_config.js",
  "src/game/config/databases/item_catalog.js",
  "src/game/application/chum/chum_controller.js",
  "src/game/presentation/inventory/inventory_slot_icons.js",
  "src/game/presentation/inventory/inventory_sections.js",
  "src/game/presentation/inventory/inventory_selector_renderer.js",
  "src/game/presentation/inventory/inventory_item_card_renderer.js",
  "src/game/presentation/inventory/inventory_view_model_factory.js",
  "src/game/presentation/inventory/inventory_item_tree_view_factory.js",
  "src/game/presentation/keepnet/keepnet_art_config.js",
  "src/game/presentation/keepnet/keepnet_section_view.js",
  "src/game/presentation/keepnet/keepnet_overview_renderer.js",
  "src/game/presentation/house/aquarium_feed_picker.js",
  "src/game/presentation/house/house_view.js",
  "src/platform/browser/dom/inventory_dom_factory.js",
  "src/platform/browser/ui/chum_controls.js",
  "src/platform/browser/ui/game_controls.js",
  "src/platform/browser/ui/depth_selector.js",
  "src/bootstrap/production/inventory_ui_bootstrap.js",
  "src/bootstrap/production/inventory_selector_composition.js",
  "src/bootstrap/production/depth_selector_composition.js",
  "src/dev/tools/dev_tools.js",
  "src/game/config/raw/fish/peaceful_fish.js",
  "src/game/config/raw/fish/predator_fish.js",
  "src/game/presentation/fish/fish_art_variants.js",
  "src/game/presentation/fish/fish_visual_variant_resolver.js",
  "src/game/presentation/keepnet/keepnet_card_renderer.js",
  "src/game/presentation/house/aquarium_fish_view.js",
]);
// The only files allowed to hold an "assets/..." literal.
const PATH_LITERAL_EXCEPTIONS = Object.freeze([
  "src/game/config/generated/asset_registry.js",
  "src/engine/assets/asset_registry_sync.js",
]);

// Every shipped text source: src/**/*.{js,css,html} and the pages (not only tracked files, so a new file counts too).
function shippedSources() {
  const files = ["index.html", "dev.html", "ui-catalog.html"];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (/\.(?:js|css|html)$/u.test(entry.name)) files.push(relative);
    }
  };
  walk("src");
  return files;
}
const PATH_LITERAL = /["'`]assets\/[^"'`]*/gu;
// A string literal shaped like a registry id (its first part is a top folder of assets/).
const ID_LITERAL = /["'`]((?:animations|audio|fish|fish-display|fish-thumbnails|house|items|lobby|locations|ui)\.[A-Za-z0-9_.-]+)["'`]/gu;

// Every `asset` / `*Asset` field and every id inside a `*Assets` object (nested by level, phase...) under value.
function collectAssetReferences(value, where, found = []) {
  if (!value || typeof value !== "object") return found;
  const ids = (child, at) => {
    if (child && typeof child === "object") for (const [name, id] of Object.entries(child)) ids(id, `${at}.${name}`);
    else found.push([at, child]);
  };
  for (const [key, child] of Object.entries(value)) {
    const at = `${where}.${key}`;
    if (key === "asset" || /[a-z]Asset$/u.test(key)) found.push([at, child]);
    else if (/[a-z]Assets$/u.test(key) && child && typeof child === "object") ids(child, at);
    else collectAssetReferences(child, at, found);
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
  const { CONFIG } = await importSource("src/game/config/runtime/game_config.js");
  const { RADIO_CHANNELS } = await importSource("src/game/config/raw/radio/radio_channels.js");
  const { HOUSE_CONFIG } = await importSource("src/game/config/raw/house/house_config.js");
  const { ITEM_DB } = await importSource("src/game/config/raw/items/item_database.js");
  const references = [...collectAssetReferences(MAP_DB, "MAP_DB"), ...collectAssetReferences(CONFIG.ui, "CONFIG.ui"),
    ...collectAssetReferences(RADIO_CHANNELS, "RADIO_CHANNELS"), ...collectAssetReferences(HOUSE_CONFIG, "HOUSE_CONFIG"),
    ...collectAssetReferences(ITEM_DB, "ITEM_DB")];
  // Skins: a Spine export is one registered package; the float's scene art and tip glow are files.
  let spineSkins = 0;
  for (const group of Object.values(ITEM_DB)) {
    for (const item of Object.values(group ?? {})) {
      const animation = item?.skin?.animation;
      if (animation) {
        assert(typeof animation.asset === "string" && !("skeleton" in animation) && !("atlas" in animation),
          `${item.id} names its Spine export by asset id`);
        spineSkins += 1;
      }
      const scene = item?.skin?.scene;
      if (scene) assert(scene.asset && !("src" in scene) && (!scene.glow || (scene.glow.asset && !("src" in scene.glow))),
        `${item.id} names its scene art by asset id`);
    }
  }
  assert(spineSkins >= 2, "the rod and the boat have Spine skins");
  // Item art (inventory, switchers, toolbar) by asset id: no path field is left on any catalog item.
  const pathFields = /^(?:iconUrl|switcherIconUrl|imageUrl|imagePath|src|withLine|withoutLine|noBait|bait)$/u;
  const findPathFields = (value, where) => {
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, child]) => (typeof child === "string" && pathFields.test(key) && /\.[a-z0-9]{2,5}$/iu.test(child) ? [`${where}.${key}`]
      : findPathFields(child, `${where}.${key}`)));
  };
  assert.deepEqual(findPathFields(ITEM_DB, "ITEM_DB"), [], "catalog items name their art by asset id");
  const iconItems = Object.values(ITEM_DB).flatMap((group) => Object.values(group ?? {})).filter((item) => item?.iconAsset);
  assert(iconItems.length >= 15,`catalog items carry iconAsset (${iconItems.length})`);
  // Inventory interface art, keepnet stages and aquarium feed boxes.
  const { INVENTORY_SECTIONS } = await importSource("src/game/presentation/inventory/inventory_sections.js");
  const { inventorySlotIconAssets } = await importSource("src/game/presentation/inventory/inventory_slot_icons.js");
  const { KEEPNET_ART_STAGES } = await importSource("src/game/presentation/keepnet/keepnet_art_config.js");
  const { LIVE_BAIT_CONFIG } = await importSource("src/game/config/raw/live_bait/live_bait_config.js");
  references.push(...collectAssetReferences(INVENTORY_SECTIONS, "INVENTORY_SECTIONS"),
    ...KEEPNET_ART_STAGES.map((stage) => [`KEEPNET_ART_STAGES.${stage.maxPercent}`, stage.imageAsset]),
    ...inventorySlotIconAssets().map((id) => ["inventory slot icon", id]),
    ...collectAssetReferences(LIVE_BAIT_CONFIG.aquariumFeeds, "LIVE_BAIT_CONFIG.aquariumFeeds"));
  assert.equal(KEEPNET_ART_STAGES.length, 6, "six keepnet stages");
  assert(Object.values(LIVE_BAIT_CONFIG.aquariumFeeds).every((feed) => feed.imageAsset && !("imagePath" in feed)),
    "aquarium feeds name their box art by asset id");
  const room = HOUSE_CONFIG.room;
  assert(room.aquariumAsset && room.renovationAsset, "the House names its aquarium and renovation art by asset id");
  for (let level = 1; level <= room.maxLevel; level++) {
    for (const phase of ["day", "evening", "night"]) assert(room.backgroundAssets?.[level]?.[phase], `room level ${level} ${phase} by id`);
  }
  assert(CONFIG.ui.audio.feederBiteAsset, "the feeder bell is named by asset id");
  for (const channel of Object.values(RADIO_CHANNELS)) {
    for (const track of channel.tracks ?? []) assert(track.asset && !("url" in track), `${channel.id} track ${track.id} by asset id`);
  }
  for (const location of Object.values(MAP_DB)) {
    assert(location.backgroundAssets || location.backgroundAsset, `${location.id} names its background by asset id`);
    assert(location.depthAsset, `${location.id} names its depth map by asset id`);
  }
  assert(references.length > 0, "the configuration has asset references");
  for (const [where, id] of references) {
    assert(typeof id === "string" && assets.has(id), `${where}: "${id}" is not an asset id of the registry`);
    const spine = where.endsWith(".animation.asset");
    assert.equal(assets.entryOf(id).kind === "spine", spine, `${where}: ${id} must be ${spine ? "a Spine package" : "a file"}`);
  }

  // Fish: every level's art of every species is registered (standard, and unique where an anomaly variant exists).
  const { FISH_DB } = await importSource("src/game/config/databases/fish_database.js");
  let fishArt = 0;
  for (const fish of FISH_DB) {
    const maxLevel = Math.max(1, Math.round(Number(fish.weightConfig?.maxLevel) || 1));
    assert(fish.visual?.imageAssetPattern && !("imagePattern" in fish.visual), `${fish.id} names its art by asset-id pattern`);
    for (let level = 1; level <= maxLevel; level += 1) {
      const patterns = [fish.visual.imageAssetPattern, ...(fish.anomalyVariant ? [fish.visual.uniqueImageAssetPattern] : [])];
      for (const pattern of patterns) {
        const id = pattern.replace("{level}", level);
        assert(assets.has(id), `${fish.id} level ${level}: "${id}" is not an asset id of the registry`);
        fishArt += 1;
      }
    }
  }

  // No path literal anywhere in the shipped sources (TK-178 step d).
  const sources = shippedSources();
  for (const file of sources) {
    if (PATH_LITERAL_EXCEPTIONS.includes(file)) continue;
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.deepEqual(text.match(PATH_LITERAL) ?? [], [], `${file} names assets by id, not by path`);
  }
  // The asset modules' id literals are registered.
  let codeIds = 0;
  for (const file of MIGRATED_MODULES) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const [, id] of text.matchAll(ID_LITERAL)) {
      assert(assets.has(id), `${file}: "${id}" is not an asset id of the registry`);
      codeIds += 1;
    }
  }
  console.log(`Asset references passed: registry lookups (path, Spine package, tags, unknown id), ${references.length} `
    + `configuration references, ${fishArt} fish art ids and ${codeIds} ids in code registered; ${sources.length} sources `
    + "without asset path literals.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
