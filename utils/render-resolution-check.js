"use strict";

// Spec 100: logical (CSS) pixels for the game and a backing store at the device pixel ratio, the surface's frame start
// (base transform and smoothing), depth order of the rod and the line, and display-sized fish art from one source.
// The canvas metrics owner itself is covered by platform-runtime; the Spine surface by spine-rod.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);

function recordingCanvas(width, height) {
  const calls = [];
  const context = {
    calls,
    setTransform: (...args) => calls.push(["setTransform", ...args]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    set imageSmoothingEnabled(value) { calls.push(["imageSmoothingEnabled", value]); },
    set imageSmoothingQuality(value) { calls.push(["imageSmoothingQuality", value]); },
  };
  return { width, height, context, getContext: () => context };
}

async function checkSurface() {
  const { Canvas2DSurface } = await importSource("src/platform/browser/canvas/canvas_2d_surface.js");
  const canvas = recordingCanvas(780, 1688);
  const resolution = { width: 390, height: 844, pixelRatio: 2 };
  const surface = new Canvas2DSurface(canvas, { resolution });
  assert.deepEqual([surface.width, surface.height, surface.pixelRatio], [390, 844, 2],
    "the game surface reports logical pixels, not the backing store");
  surface.beginFrame();
  surface.clear("#123");
  assert.deepEqual(canvas.context.calls, [["setTransform", 2, 0, 0, 2, 0, 0], ["imageSmoothingEnabled", true],
    ["imageSmoothingQuality", "high"], ["fillStyle", "#123"], ["fillRect", 0, 0, 390, 844]],
    "frame start: base transform and high-quality smoothing; clear fills the logical size");
  resolution.width = 400;
  resolution.pixelRatio = 1.5;
  canvas.context.calls.length = 0;
  surface.beginFrame();
  assert.deepEqual(canvas.context.calls[0], ["setTransform", 1.5, 0, 0, 1.5, 0, 0], "a new ratio applies on the next frame");
  assert.equal(surface.width, 400);
  const data = new Canvas2DSurface(recordingCanvas(64, 32));
  assert.deepEqual([data.width, data.height, data.pixelRatio], [64, 32, 1], "offscreen data surfaces keep ratio 1");
}

function checkDrawOrder() {
  const source = fs.readFileSync(path.join(ROOT_DIR, "src/bootstrap/production/game_render_composition.js"), "utf8");
  const orderOf = (id) => {
    const match = source.match(new RegExp(`id: "${id}",\\s*order: GameRenderOrder\\.values\\.FISHING_EQUIPMENT\\s*([+-]\\s*\\d+)?`, "u"));
    assert(match, `${id} has a FISHING_EQUIPMENT order`);
    return Number((match[1] || "0").replace(/\s+/gu, ""));
  };
  const [line, staticRod, spineRod, float] = ["rod-line", "rod-static", "rod-spine", "float"].map(orderOf);
  assert(line < staticRod && staticRod < spineRod && spineRod < float,
    `depth order: line ${line} < static rod ${staticRod} < Spine rod ${spineRod} < float ${float}`);
}

async function checkFishArt() {
  const { FISH_ART_VARIANTS, fishArtVariantPath, fishMasterImagePath, fishDisplayImagePath } =
    await importSource("src/game/presentation/fish/fish_art_variants.js");
  const { fishThumbnailPath } = await importSource("src/game/presentation/house/fish_thumbnail_path.js");
  const master = "assets/fish/crucian_stalker/standart/crucian_stalker--3.webp";
  assert.equal(fishThumbnailPath(master), "assets/fish-thumbnails/crucian_stalker/standart/crucian_stalker--3.webp",
    "thumbnails keep their paths");
  assert.equal(fishArtVariantPath(master, "display"), "assets/fish-display/crucian_stalker/standart/crucian_stalker--3.webp");
  assert.equal(fishArtVariantPath("assets/items/x.svg", "display"), "assets/items/x.svg", "non-master art is untouched");
  assert.equal(fishArtVariantPath(null, "thumbnail"), "");
  assert.throws(() => fishArtVariantPath(master, "poster"), /Unknown fish art variant/u);
  assert.equal(fishMasterImagePath({ id: "perch_radioactive", level: 4 }),
    "assets/fish/perch_radioactive/perch_radioactive--4.webp", "the species default master for a level");
  assert.equal(fishDisplayImagePath({ imagePath: master }), fishArtVariantPath(master, "display"));

  const sharp = require(require.resolve("sharp", { paths: [ROOT_DIR] }));
  const tracked = new Set(spawnSync("git", ["ls-files", "assets/fish", "assets/fish-thumbnails", "assets/fish-display"],
    { cwd: ROOT_DIR, encoding: "utf8" }).stdout.split(/\r?\n/u).filter(Boolean));
  const masters = [...tracked].filter((file) => file.startsWith("assets/fish/"));
  assert(masters.length > 0, "fish masters are tracked");
  for (const file of masters) {
    for (const [variant, { maxSize }] of Object.entries(FISH_ART_VARIANTS)) {
      const target = fishArtVariantPath(file, variant);
      assert(tracked.has(target), `${target} is tracked (Pages serves tracked files only)`);
      const meta = await sharp(path.join(ROOT_DIR, target)).metadata();
      assert(Math.max(meta.width, meta.height) <= maxSize, `${target} is at most ${maxSize} px`);
    }
  }
  return masters.length;
}

async function checkOneSource() {
  const { OutcomeRenderFrameBuilder } = await importSource("src/game/presentation/screens/outcome_render_frame_builder.js");
  const { AssetPreloadCoordinator } = await importSource("src/platform/browser/assets/asset_preload_coordinator.js");
  const base = { canvasMetrics: { width: 1, height: 1 }, clock: {}, styleResolver: { resolveVictory: () => ({}) },
    layoutResolver: { resolve: () => ({}) } };
  assert.throws(() => new OutcomeRenderFrameBuilder(base), /requires resolveFishImage/u,
    "the outcome frame has no default image path of its own");
  assert.throws(() => new AssetPreloadCoordinator({ imageAssets: { preload() {} }, locationsConfig: {} }),
    /requires resolveFishImage/u, "the preloader has no default image path of its own");
  const composition = fs.readFileSync(path.join(ROOT_DIR, "src/bootstrap/production/game_render_composition.js"), "utf8")
    + fs.readFileSync(path.join(ROOT_DIR, "src/bootstrap/production/game_composition_root.js"), "utf8");
  assert.equal((composition.match(/resolveFishImage: fishDisplayImagePath/gu) || []).length, 2,
    "bootstrap gives both consumers the same display source");
}

async function main() {
  await checkSurface();
  checkDrawOrder();
  const masters = await checkFishArt();
  await checkOneSource();
  console.log(`Render resolution passed: logical surface with base transform and high smoothing at frame start, offscreen `
    + `data at ratio 1, rod depth order, ${masters} fish masters with tracked thumbnail/display variants within size, `
    + "one victory image source for the frame and the preloader.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
