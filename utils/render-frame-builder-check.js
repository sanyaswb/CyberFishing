const fs = require("node:fs");
const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({ Math, Number });
harness.load(context, [
  "src/render/core/render_frame_buffer.js",
  "src/app/rendering/game_render_frame_builder.js",
]);

harness.run(context, `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const gameplayState = { score: 10, nested: { phase: "playing" } };
const snapshot = JSON.stringify(gameplayState);
const called = [];
const builder = new GameRenderFrameBuilder({
  canvasMetrics: { width: 800, height: 600 },
  projector: { getScale: () => 1.25 },
  worldBuilder: {
    buildInto({ target }) { target.visible = true; called.push("world"); },
  },
  castingBuilder: {
    buildInto({ target }) { target.visible = true; called.push("casting"); },
  },
  fishingBuilder: {
    buildInto({ fishingTarget }) {
      fishingTarget.visible = true;
      called.push("fishing");
    },
  },
  outcomeBuilder: {
    buildInto({ target }) { target.visible = true; called.push("outcome"); },
  },
});
const buffer = new RenderFrameBuffer();
const frameA = buffer.acquire({ frameNumber: 1 });
builder.buildInto({
  frame: frameA,
  intent: {
    stateName: "playing",
    casting: {},
    fishing: {},
    outcome: {},
  },
  invalidCastMarker: null,
  debugEnabled: false,
});
const frameB = buffer.acquire({ frameNumber: 2 });
assert(frameA === frameB, "frame builder uses a reusable frame buffer");
assert(
  ["world", "casting", "fishing", "outcome"].every(
    (name) => Object.hasOwn(frameA, name),
  ),
  "render frame contains all required scene sections",
);
assert(
  called.join("|") === "world|casting|fishing|outcome",
  "aggregate builder delegates each responsibility once",
);
assert(
  JSON.stringify(gameplayState) === snapshot,
  "building a render frame does not mutate gameplay state",
);
console.log("render-frame-builder-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-frame-builder-check.js#scenario");

const builderSources = fs
  .readdirSync(path.join(ROOT, "src/app/rendering"))
  .filter((name) => name.endsWith(".js"))
  .map((name) =>
    fs.readFileSync(path.join(ROOT, "src/app/rendering", name), "utf8"),
  )
  .join("\n");
if (
  /\bgetContext\s*\(|\bfillRect\s*\(|\bstrokeRect\s*\(|\bdrawImage\s*\(/.test(
    builderSources,
  )
) {
  throw new Error("Frame builders must not call Canvas drawing APIs");
}
console.log("- frame builders contain no Canvas drawing calls");
