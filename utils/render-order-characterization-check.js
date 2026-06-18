const fs = require("node:fs");
const path = require("node:path");
const {
  RenderTestHarness,
} = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({ Math, Number });

harness.load(context, [
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_pass.js",
  "src/render/core/render_order.js",
  "src/render/core/render_component.js",
  "src/render/core/composite_renderer.js",
  "src/render/pipeline/world_render_pass.js",
  "src/render/pipeline/casting_render_pass.js",
  "src/render/pipeline/fishing_render_pass.js",
  "src/render/pipeline/hud_render_pass.js",
  "src/render/pipeline/outcome_render_pass.js",
  "src/render/pipeline/game_render_pipeline.js",
]);

harness.run(context, `
const checks = [];
const calls = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const renderer = (name) => ({
  render() { calls.push(name); },
});
const scene = renderer("world.scene");
const pipeline = new GameRenderPipeline({
  passes: [
    new WorldRenderPass({
      components: [
        new RenderComponent({
          id: "world-scene",
          order: 100,
          renderer: scene,
          selectModel: (frame) => frame.world,
        }),
        new RenderComponent({
          id: "world-debug",
          order: 200,
          renderer: renderer("world.debug"),
          selectModel: (frame) => frame.world,
        }),
        new RenderComponent({
          id: "world-entities",
          order: 300,
          renderer: renderer("world.entities"),
          selectModel: (frame) => frame.world,
        }),
        new RenderComponent({
          id: "world-invalid-marker",
          order: 301,
          renderer: renderer("world.invalidMarker"),
          selectModel: (frame) => frame.world.invalidCastMarker,
        }),
      ],
    }),
    new CastingRenderPass({ renderer: renderer("casting") }),
    new FishingRenderPass({ renderer: renderer("fishing") }),
    new HudRenderPass({ renderer: renderer("hud") }),
    new OutcomeRenderPass({
      gameOverRenderer: renderer("outcome.failed"),
      victoryRenderer: renderer("outcome.victory"),
    }),
  ],
});
const frame = new RenderFrameBuffer().acquire();
frame.world.visible = true;
frame.world.invalidCastMarker.visible = true;
frame.casting.visible = true;
frame.fishing.visible = true;
frame.hud.visible = true;
frame.outcome.visible = true;
frame.outcome.mode = "victory";
pipeline.render(frame);
assert(
  calls.join("|") === [
    "world.scene",
    "world.debug",
    "world.entities",
    "world.invalidMarker",
    "casting",
    "fishing",
    "hud",
    "outcome.victory",
  ].join("|"),
  "render pipeline preserves the characterized layer order",
);
assert(pipeline.getPassCount() === 5, "pipeline owns five reusable passes");
console.log("render-order-characterization-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-order-characterization-check.js#scenario");

const applicationSource = fs.readFileSync(
  path.join(ROOT, "src/app/application.js"),
  "utf8",
);
if (!applicationSource.includes("this.#renderCoordinator.render();")) {
  throw new Error("Application must delegate drawing to GameRenderCoordinator");
}
if (
  applicationSource.includes("#renderSystem") ||
  applicationSource.includes("#stateMachine.draw")
) {
  throw new Error("Application still contains a legacy rendering path");
}
console.log("- application delegates its only draw path to the coordinator");
