const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function filesUnder(relativeDirectory) {
  const directory = path.join(ROOT, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDirectory, entry.name);
    return entry.isDirectory()
      ? filesUnder(relative)
      : entry.name.endsWith(".js")
        ? [relative]
        : [];
  });
}
function sourceOf(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}
function lineCount(file) {
  return sourceOf(file).split(/\r?\n/).length;
}

assert(
  !fs.existsSync(path.join(ROOT, "src/render/renderer.js")),
  "legacy renderer.js is deleted",
);
assert(
  !fs.existsSync(path.join(ROOT, "src/app/render.js")),
  "legacy app/render.js is deleted",
);

const renderFiles = filesUnder("src/render");
const rendererFiles = renderFiles.filter((file) => file.endsWith("_renderer.js"));
for (const file of rendererFiles) {
  assert(lineCount(file) <= 300, `${file} stays within the leaf renderer limit`);
}
for (const file of [
  "src/render/fishing/fishing_scene_renderer.js",
  "src/render/hud/fight_hud_renderer.js",
]) {
  assert(lineCount(file) <= 200, `${file} stays within the composite limit`);
}
for (const file of filesUnder("src/app/rendering").filter((name) =>
  name.includes("builder"),
)) {
  assert(lineCount(file) <= 250, `${file} stays within the builder limit`);
}
assert(
  lineCount("src/app/rendering/game_render_coordinator.js") <= 150,
  "render coordinator stays within its size limit",
);

const allSourceFiles = filesUnder("src");
const contextOwners = allSourceFiles.filter((file) =>
  /\bgetContext\s*\(/.test(sourceOf(file)),
);
assert(
  contextOwners.join("|") === "src\\render\\core\\canvas_2d_surface.js",
  "getContext is owned only by Canvas2DSurface",
);
const imageOwners = allSourceFiles.filter((file) =>
  /\bnew\s+Image\s*\(/.test(sourceOf(file)),
);
assert(
  imageOwners.join("|") === "src\\render\\core\\image_asset_provider.js",
  "new Image is owned only by ImageAssetProvider",
);

const renderSource = renderFiles.map(sourceOf).join("\n");
assert(
  !/\bdocument\.|\bwindow\.|querySelector|getElementById|classList/.test(
    renderSource,
  ),
  "render layer contains no DOM access",
);
assert(
  !/\b(InventoryManager|TensionMeter|FloatEntity|ChumManager|NetSystem|GameState)\b/.test(
    renderSource,
  ),
  "renderers do not depend on domain entities",
);
assert(
  !/\.render\?\.\(|\.draw[A-Z]\w*\?\.\(/.test(renderSource),
  "required renderer methods are not optional",
);

const stateSource = sourceOf("src/app/states.js");
assert(
  !/\brenderer\b|drawGameOver|drawVictory|drawAimingZone|drawCastPowerAim/.test(
    stateSource,
  ),
  "game states contain no concrete renderer or draw calls",
);
const indexSource = sourceOf("index.html");
assert(
  !indexSource.includes("src/render/renderer.js") &&
    !indexSource.includes("src/app/render.js"),
  "index contains no legacy render scripts",
);
assert(
  indexSource.indexOf("src/render/core/canvas_2d_surface.js") <
    indexSource.indexOf("src/render/world/world_scene_renderer.js") &&
    indexSource.indexOf("src/render/world/world_scene_renderer.js") <
      indexSource.indexOf("src/render/pipeline/world_render_pass.js") &&
    indexSource.indexOf("src/render/pipeline/world_render_pass.js") <
      indexSource.indexOf("src/app/rendering/game_render_frame_builder.js"),
  "script order follows core, renderers, passes, builders",
);

console.log("renderer-architecture-check passed:");
for (const message of checks) console.log("- " + message);
