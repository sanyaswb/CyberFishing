const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const context = vm.createContext({ console, Math, Number, Object });
for (const file of [
  "src/render/core/render_frame_buffer.js",
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/app/rendering/fight_area_render_frame_builder.js",
]) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    context,
    { filename: file },
  );
}
vm.runInContext(`
class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const buffer = new RenderFrameBuffer();
const frameA = buffer.acquire();
const pointA = frameA.fishing.fightAreas.sectorPoints.acquire();
pointA.x = 1;
const frameB = buffer.acquire();
const pointB = frameB.fishing.fightAreas.sectorPoints.acquire();
assert(frameA === frameB, "frame object is reused");
assert(pointA === pointB, "sector point records are reused");
assert(
  frameA.fishing.fightAreas.sectorPoints.items ===
    frameB.fishing.fightAreas.sectorPoints.items,
  "sector point array is reused",
);
const passes = [{ render() {} }];
class PipelineProbe {
  constructor(source) { this.passes = source.slice(); }
}
const probe = new PipelineProbe(passes);
assert(probe.passes[0] === passes[0], "render pass instances are reused");
console.log("render-allocation-check passed:");
for (const message of checks) console.log("- " + message);
`, context);

const hotSources = fs
  .readdirSync(path.join(ROOT, "src/app/rendering"))
  .filter((name) => name.endsWith(".js"))
  .map((name) =>
    fs.readFileSync(path.join(ROOT, "src/app/rendering", name), "utf8"),
  )
  .join("\n");
if (/\.map\s*\(|\.concat\s*\(|new\s+Array\s*\(/.test(hotSources)) {
  throw new Error("Mass array creation found in render builder hot paths");
}
console.log("- render builder hot paths contain no map/concat/new Array");
