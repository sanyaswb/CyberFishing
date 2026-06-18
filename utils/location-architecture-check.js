const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function sourceOf(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}
function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

const worldSource = sourceOf("src/world/world.js");
assert(
  !/document\.createElement|Canvas2DSurface|ImageAssetProvider|new\s+Image|getContext/.test(worldSource),
  "LocationMap contains no DOM, Canvas or render asset infrastructure",
);
assert(
  /LocationMap requires ready location resources/.test(worldSource),
  "LocationMap depends on ready location resources",
);
assert(
  !/LocationAssetLoader|assetLoader|preloadLocationAssets/.test(worldSource),
  "LocationMap does not know location asset loading lifecycle",
);
assert(
  exists("src/infrastructure/location/location_asset_loader.js"),
  "LocationAssetLoader exists in infrastructure layer",
);
assert(
  exists("src/infrastructure/location/depth_map_reader.js"),
  "DepthMapReader exists in infrastructure layer",
);
assert(
  exists("src/infrastructure/location/offscreen_canvas_factory.js"),
  "OffscreenCanvasFactory exists in infrastructure layer",
);
assert(
  exists("src/render/world/location_debug_map_builder.js"),
  "LocationDebugMapBuilder exists in render layer",
);
assert(
  /class DepthMapReader/.test(sourceOf("src/infrastructure/location/depth_map_reader.js")),
  "Depth-map pixel interpretation is isolated in DepthMapReader",
);
assert(
  /class LocationDebugMapBuilder/.test(sourceOf("src/render/world/location_debug_map_builder.js")),
  "Debug-map rendering is isolated from LocationMap",
);
assert(
  /debugMapBuilder/.test(sourceOf("src/app/rendering/location_debug_render_frame_builder.js")),
  "Debug frame builder receives LocationDebugMapBuilder through constructor",
);
const bootstrapSource = sourceOf("src/app/bootstrap.js");
assert(
  bootstrapSource.indexOf("await assetPreloadCoordinator.preloadLocation") <
    bootstrapSource.indexOf("await locationAssetLoader.load") &&
    bootstrapSource.indexOf("await locationAssetLoader.load") <
      bootstrapSource.indexOf("new LocationMap"),
  "initial location activation is gated by preload and loaded resources",
);
const applicationSource = sourceOf("src/app/application.js");
assert(
  applicationSource.includes("async #reloadLocationConfig") &&
    applicationSource.includes("await this.#assetPreloadCoordinator.preloadLocation") &&
    applicationSource.includes("this.#viewportFacade.refreshLocationConfig(this.#config.locations, resources)"),
  "location config refresh is gated by ready resources",
);

console.log("location-architecture-check passed:");
for (const message of checks) console.log("- " + message);
