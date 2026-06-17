const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const context = vm.createContext({ console, Promise, Map, Error, Object });
vm.runInContext(
  fs.readFileSync(
    path.join(ROOT, "src/render/core/image_asset_provider.js"),
    "utf8",
  ),
  context,
);
const scenario = vm.runInContext(`(async () => {
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
let created = 0;
class FakeImage {
  constructor() {
    created += 1;
    this.complete = false;
    this.naturalWidth = 0;
  }
  set src(value) {
    this.source = value;
    this.complete = true;
    this.naturalWidth = 32;
    this.onload();
  }
}
const assets = new ImageAssetProvider({
  imageFactory: () => new FakeImage(),
  fallbackAssetId: "fallback",
});
await assets.preload({
  fallback: "fallback.webp",
  fish: "fish.webp",
});
assert(created === 2, "preload creates one image per asset");
await assets.preload({ fish: "fish.webp" });
assert(created === 2, "repeated preload reuses the cached image");
assert(assets.tryGet("fish").source === "fish.webp", "tryGet returns cached sprite");
assert(
  assets.tryGet("missing").source === "fallback.webp",
  "missing sprite resolves to fallback",
);
assets.tryGet("another-missing");
assert(created === 2, "render-time lookup never creates an image");
console.log("render-assets-check passed:");
for (const message of checks) console.log("- " + message);
})()`, context);

scenario.catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const renderSource = fs
  .readdirSync(path.join(ROOT, "src/render"), { recursive: true })
  .filter((name) => name.endsWith(".js"))
  .map((name) =>
    fs.readFileSync(path.join(ROOT, "src/render", name), "utf8"),
  )
  .join("\n");
if (
  /\bfetch\s*\(|decode\(|new\s+Image\s*\(/.test(
    renderSource.replace(
      fs.readFileSync(
        path.join(ROOT, "src/render/core/image_asset_provider.js"),
        "utf8",
      ),
      "",
    ),
  )
) {
  throw new Error("Asset loading leaked into the render loop");
}
console.log("- renderers contain no fetch, decode or Image construction");
