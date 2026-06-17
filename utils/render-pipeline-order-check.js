const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const harness = new RenderTestHarness(path.resolve(__dirname, ".."));
const context = harness.createContext({ Math, Number });
harness.load(context, [
  "src/render/core/render_pass.js",
  "src/render/core/render_order.js",
  "src/render/pipeline/game_render_pipeline.js",
]);

harness.run(context, `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const calls = [];
const names = ["world", "casting", "fishing", "hud", "outcome"];
const passes = names.map((name) => ({
  render(frame) {
    assert(frame.id === 7, name + " receives the shared frame");
    calls.push(name);
  },
}));
const pipeline = new GameRenderPipeline({
  passes: RenderOrder.createPassList({
    world: passes[0],
    casting: passes[1],
    fishing: passes[2],
    hud: passes[3],
    outcome: passes[4],
  }),
});
pipeline.render({ id: 7 });
assert(
  calls.join("|") === names.join("|"),
  "pipeline renders world, casting, fishing, HUD and outcome in order",
);
assert(pipeline.passes[0] === passes[0], "pipeline reuses pass instances");
assert(
  RenderOrder.sequence.join("|") === names.join("|"),
  "RenderOrder is the single source of pass ordering",
);
let failedFast = false;
try {
  new GameRenderPipeline({ passes: [{ render() {} }, {}] });
} catch (error) {
  failedFast = error.message.includes("pass 1");
}
assert(failedFast, "pipeline fails fast for an invalid required pass");
console.log("render-pipeline-order-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-pipeline-order-check.js#scenario");
