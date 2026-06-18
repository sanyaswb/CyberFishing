const fs = require("node:fs");
const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({ console, Object, Set, String, Number, TypeError, Error });

harness.load(context, [
  "src/render/core/render_allocation_diagnostics.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_order.js",
  "src/render/pipeline/game_render_pipeline.js",
]);

harness.run(context, `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const frame = new RenderFrameBuffer().acquire();
const list = frame.world.backgroundLayers;
const record = list.acquire();
record.assetId = "asset:a";
assert(list.count === 1, "ReusableRenderList exposes read-only active count");
try { list.count = 0; } catch (error) {}
assert(list.count === 1, "external count mutation cannot change active count");
assert(list.getAt(0) === record, "getAt returns active records");
assert(list.getAt(1) === null, "getAt does not expose inactive records");
assert(typeof list.items === "undefined", "ReusableRenderList does not expose mutable storage");
let visited = 0;
list.forEachActive(() => { visited += 1; });
assert(visited === 1, "forEachActive visits only active records");
list.reset();
assert(list.count === 0, "reset clears active count");
const reusedRecord = list.acquire();
assert(reusedRecord === record, "acquire reuses existing record after reset");
const pipeline = new GameRenderPipeline({
  passes: [{ render() {} }, { render() {} }],
});
assert(typeof pipeline.passes === "undefined", "GameRenderPipeline does not expose mutable passes");
assert(pipeline.getPassCount() === 2, "GameRenderPipeline exposes pass count safely");
const ids = ["stale"];
pipeline.copyPassIdsInto(ids);
assert(ids.length === 2 && ids[0] === "world" && ids[1] === "casting", "copyPassIdsInto writes into caller-owned buffer");
ids.push("external");
assert(pipeline.getPassCount() === 2, "external pass id mutations do not affect pipeline");
const idsAgain = [];
pipeline.copyPassIdsInto(idsAgain);
assert(idsAgain.length === 2, "external pass id mutations cannot change internal pass ids");
console.log("render-collection-encapsulation-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-collection-encapsulation-check.js#scenario");

const frameSource = fs.readFileSync(path.join(ROOT, "src/render/core/render_frame_buffer.js"), "utf8");
if (/get\s+items\s*\(/.test(frameSource) || /\bforEach\s*\(/.test(frameSource)) {
  throw new Error("ReusableRenderList must not expose items or ambiguous forEach");
}
const pipelineSource = fs.readFileSync(path.join(ROOT, "src/render/pipeline/game_render_pipeline.js"), "utf8");
if (/get\s+passes\s*\(/.test(pipelineSource)) {
  throw new Error("GameRenderPipeline must not expose passes getter");
}
console.log("- collection source keeps mutable storage private");
