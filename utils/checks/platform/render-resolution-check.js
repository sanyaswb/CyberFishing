"use strict";

// Spec 100: logical (CSS) pixels for the game and a backing store at the device pixel ratio, the surface's frame start
// (base transform and smoothing), depth order of the rod and the line, and display-sized fish art from one source.
// The canvas metrics owner itself is covered by platform-runtime; the Spine surface by spine-rod.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);

function recordingCanvas(width, height) {
  const calls = [];
  const context = {
    calls,
    setTransform: (...args) => calls.push(["setTransform", ...args]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    drawImage: (...args) => calls.push(["drawImage", args.length]),
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    set imageSmoothingEnabled(value) { calls.push(["imageSmoothingEnabled", value]); },
    set imageSmoothingQuality(value) { calls.push(["imageSmoothingQuality", value]); },
  };
  return { width, height, context, getContext: () => context };
}

// Spec 102: the filter for each draw follows its scale; "high" is never used.
async function checkFilterPolicy() {
  const { Canvas2DSurface } = await importSource("src/platform/browser/canvas/canvas_2d_surface.js");
  const canvas = recordingCanvas(768, 1632);
  const surface = new Canvas2DSurface(canvas, { resolution: { width: 384, height: 816, pixelRatio: 2 } });
  const qualityOf = (draw) => {
    canvas.context.calls.length = 0;
    draw();
    const set = canvas.context.calls.filter((call) => call[0] === "imageSmoothingQuality");
    assert.equal(set.length, 1, "exactly one filter per draw");
    return set[0][1];
  };
  const background = { naturalWidth: 2560, naturalHeight: 1440 };
  assert.equal(qualityOf(() => surface.drawImage(background, 0, 0, 1451, 816)), "low",
    "the portrait background is enlarged (1440 px over 1632 device px): bilinear, never bicubic");
  assert.equal(qualityOf(() => surface.drawImage(background, 0, 0, 683, 384)), "medium",
    "the landscape background (1440 px over 768 device px, 1.9x) is shrunk: mipmaps");
  const fish = { naturalWidth: 768, naturalHeight: 768 };
  assert.equal(qualityOf(() => surface.drawImage(fish, 0, 0, 768, 768, 10, 10, 200, 200)), "medium",
    "victory fish 768 px into a 200 px box at 2x (1.9x): mipmaps");
  assert.equal(qualityOf(() => surface.drawImage(fish, 0, 0, 768, 768, 10, 10, 300, 300)), "low",
    "768 px into 600 device px (1.28x) is near 1:1: bilinear");
  assert.equal(qualityOf(() => surface.drawImage({ width: 500, height: 300 }, 0, 0, 250, 150)), "low",
    "the Spine GL copy is 1:1 in device pixels");
  assert.equal(qualityOf(() => surface.drawImage(fish, 1, 2)), "low", "a 3-argument draw is 1:1");
  assert.equal(qualityOf(() => surface.drawImage({ naturalWidth: 85, naturalHeight: 2735 }, 2, 2, 2735, 85, 0, 0, 234, 8)),
    "medium", "the static rod region (rotated footprint) shrinks 5.8x: mipmaps");
  canvas.context.calls.length = 0;
  surface.beginFrame();
  assert(!canvas.context.calls.some((call) => call[0] === "imageSmoothingQuality"), "beginFrame sets no filter");

  const offenders = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(ROOT_DIR, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (relative.endsWith(".js")) {
        const source = fs.readFileSync(path.join(ROOT_DIR, relative), "utf8");
        if (/imageSmoothingQuality\s*=/u.test(source) && relative !== "src/platform/browser/canvas/canvas_2d_surface.js") {
          offenders.push(`${relative} sets imageSmoothingQuality`);
        }
        if (/imageSmoothingQuality\s*=\s*["']high["']/u.test(source)) offenders.push(`${relative} uses "high"`);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, [], "only the surface sets the filter, and never \"high\" (docs/rendering.md rules 3-4)");
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
    ["fillStyle", "#123"], ["fillRect", 0, 0, 390, 844]],
    "frame start: base transform and smoothing on; clear fills the logical size");
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
  const { FISH_ART_VARIANTS, FishArtVariants } = await importSource("src/game/presentation/fish/fish_art_variants.js");
  const { AssetRegistry } = await importSource("src/engine/assets/asset_registry.js");
  const { ASSET_REGISTRY } = await importSource("src/game/config/generated/asset_registry.js");
  const fishArt = new FishArtVariants({ assets: new AssetRegistry(ASSET_REGISTRY) });
  const master = "assets/fish/crucian_stalker/standart/crucian_stalker--3.webp";
  assert.equal(fishArt.thumbnailPath(master), "assets/fish-thumbnails/crucian_stalker/standart/crucian_stalker--3.webp",
    "thumbnails keep their paths");
  assert.equal(fishArt.variantPath(master, "display"), "assets/fish-display/crucian_stalker/standart/crucian_stalker--3.webp");
  assert.equal(fishArt.variantPath("assets/items/x.svg", "display"), "assets/items/x.svg", "non-master art is untouched");
  assert.equal(fishArt.variantPath(null, "thumbnail"), "");
  assert.throws(() => fishArt.variantPath(master, "poster"), /Unknown fish art variant/u);
  assert.equal(fishArt.masterImagePath({ id: "perch_radioactive", level: 4 }),
    "assets/fish/perch_radioactive/standart/perch_radioactive--4.webp", "the species' standard master for a level");
  assert.equal(fishArt.masterImagePath({ id: "unknown_fish", level: 1 }), "", "no registered master, no guessed path");
  assert.equal(fishArt.displayImagePath({ imagePath: master }), fishArt.variantPath(master, "display"));

  const sharp = require(require.resolve("sharp", { paths: [ROOT_DIR] }));
  const tracked = new Set(spawnSync("git", ["ls-files", "assets/fish", "assets/fish-thumbnails", "assets/fish-display"],
    { cwd: ROOT_DIR, encoding: "utf8" }).stdout.split(/\r?\n/u).filter(Boolean));
  const masters = [...tracked].filter((file) => file.startsWith("assets/fish/"));
  assert(masters.length > 0, "fish masters are tracked");
  for (const file of masters) {
    for (const [variant, { maxSize }] of Object.entries(FISH_ART_VARIANTS)) {
      const target = fishArt.variantPath(file, variant);
      assert.notEqual(target, file, `${file} has a registered ${variant} variant`);
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
  assert.equal((composition.match(/resolveFishImage: \(fish\) => [\w.#]*fishArt\.displayImagePath\(fish\)/gu) || []).length, 2,
    "bootstrap gives both consumers the same display source");
  assert.equal((composition.match(/new FishArtVariants\(/gu) || []).length, 1, "one fish art instance serves both");
}

async function main() {
  await checkSurface();
  await checkFilterPolicy();
  checkDrawOrder();
  const masters = await checkFishArt();
  await checkOneSource();
  console.log(`Render resolution passed: logical surface with the base transform at frame start, offscreen `
    + `data at ratio 1, rod depth order, ${masters} fish masters with tracked thumbnail/display variants within size, `
    + "one victory image source for the frame and the preloader, per-draw image filter (medium for downscales, low "
    + "otherwise, never high, set only by the surface).");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
