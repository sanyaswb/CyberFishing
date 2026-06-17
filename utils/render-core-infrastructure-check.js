const fs = require("node:fs");
const path = require("node:path");
const {
  CanvasContextSpy,
  RenderTestHarness,
} = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const ctx = new CanvasContextSpy();
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const renderScriptOrder = [
  "src/render/core/canvas_2d_surface.js",
  "src/render/core/canvas_primitives.js",
  "src/render/core/image_asset_provider.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_pass.js",
  "src/render/core/render_order.js",
  "src/render/core/render_math.js",
  "src/render/hud/hud_bar_renderer.js",
  "src/render/pipeline/game_render_pipeline.js",
];
const context = harness.createContext({
  ctx,
  indexHtml,
  Math,
  Number,
  Promise,
  renderScriptOrder,
});

harness.load(context, [
  "src/render/core/canvas_2d_surface.js",
  "src/render/core/canvas_primitives.js",
  "src/render/core/image_asset_provider.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_pass.js",
  "src/render/core/render_order.js",
]);

const scenario = harness.run(context, `(async () => {
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(actual, expected, epsilon, message) {
  if (Math.abs(Number(actual) - expected) > epsilon) {
    throw new Error(message + ": expected " + expected + ", got " + actual);
  }
  checks.push(message);
}

let contextRequests = 0;
const canvas = {
  width: 800,
  height: 600,
  getContext(type, attributes) {
    contextRequests += 1;
    if (type !== "2d" || attributes.alpha !== false) {
      throw new Error("Canvas surface requested the wrong context");
    }
    return ctx;
  },
};
const surface = new Canvas2DSurface(canvas);
assert(contextRequests === 1, "surface obtains the canvas context once");
assert(surface.width === 800 && surface.height === 600, "surface exposes canvas dimensions");
ctx.reset();
surface.clear("#123456");
const clearCall = ctx.callsNamed("fillRect")[0];
assert(
  clearCall.args.join("|") === [0, 0, 800, 600].join("|"),
  "surface clears the full canvas",
);
assert(clearCall.state.fillStyle === "#123456", "surface clear applies the requested color");

ctx.reset();
surface.setState({ strokeStyle: "#abcdef", lineWidth: 3 });
surface.beginPath();
surface.moveTo(1, 2);
surface.lineTo(3, 4);
surface.stroke();
assert(ctx.callsNamed("stroke")[0].state.strokeStyle === "#abcdef", "surface delegates drawing state");
assert(ctx.callsNamed("stroke")[0].state.lineWidth === 3, "surface delegates line width");

ctx.reset();
surface.drawText("Visible text", 12, 34);
const defaultTextCall = ctx.textCall("Visible text");
assert(defaultTextCall.args.length === 3, "surface text omits max width by default");
surface.fillText("Bounded text", 56, 78, 120);
const boundedTextCall = ctx.textCall("Bounded text");
assert(boundedTextCall.args.length === 4, "surface text forwards explicit max width");
assert(boundedTextCall.args[3] === 120, "surface text keeps explicit max width");

const primitives = new CanvasPrimitives(surface);
ctx.reset();
primitives.roundedRect(10, 20, 100, 60, 8);
assert(
  ctx.callsNamed("quadraticCurveTo").length === 4,
  "rounded rectangle contains four rounded corners",
);

ctx.reset();
const image = { naturalWidth: 200, naturalHeight: 100 };
assert(
  primitives.drawImageCover(image, 0, 0, 100, 100) === true,
  "image cover draws valid images",
);
const imageCall = ctx.callsNamed("drawImage")[0];
assert(
  imageCall.args.slice(1).join("|") ===
    [50, 0, 100, 100, 0, 0, 100, 100].join("|"),
  "image cover crops the source around its center",
);

ctx.reset();
const fittedSize = primitives.drawFittedText({
  text: "Render",
  x: 50,
  y: 60,
  maxWidth: 60,
  font: { size: 14, family: "monospace", weight: "bold" },
  color: "#ffffff",
});
assert(fittedSize === 14, "fitted text keeps a font that already fits");
assert(!!ctx.textCall("Render"), "fitted text delegates the final draw");

class FakeImage {
  static created = 0;

  constructor() {
    FakeImage.created += 1;
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }

  set src(value) {
    this.source = value;
    if (value.includes("broken")) {
      this.onerror(new Error("broken image"));
      return;
    }
    this.complete = true;
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    this.onload();
  }
}

const assetProvider = new ImageAssetProvider({
  imageFactory: () => new FakeImage(),
  fallbackAssetId: "fallback",
});
await assetProvider.preload({
  fallback: "assets/fallback.webp",
  fish: "assets/fish.webp",
});
assert(FakeImage.created === 2, "asset preload creates one image per manifest record");
assert(assetProvider.isReady("fish"), "asset provider reports ready assets");
assert(assetProvider.tryGet("fish").source === "assets/fish.webp", "asset provider returns the cached sprite");
assert(
  assetProvider.tryGet("missing").source === "assets/fallback.webp",
  "asset provider returns the configured fallback",
);
await assetProvider.preload({ fish: "assets/fish.webp" });
assert(FakeImage.created === 2, "repeated preload reuses the existing image");
assetProvider.tryGet("unknown");
assert(FakeImage.created === 2, "tryGet never starts asset loading");

const frameBuffer = new RenderFrameBuffer();
const frameA = frameBuffer.acquire({ frameNumber: 1, dt: 16, stateName: "playing" });
const worldSection = frameA.world;
frameA.world.visible = true;
frameA.world.backgroundId = "lake";
const frameB = frameBuffer.acquire({ frameNumber: 2, dt: 17, stateName: "victory" });
assert(frameA === frameB, "render frame buffer reuses the frame object");
assert(frameB.world === worldSection, "render frame buffer reuses section objects");
assert(frameB.world.visible === false, "frame reset clears section visibility");
assert(frameB.world.backgroundId === "lake", "frame payload storage is reused in place");
assert(frameB.frameNumber === 2 && frameB.stateName === "victory", "frame metadata updates in place");

let abstractPassFailed = false;
try {
  new RenderPass().render(frameB);
} catch (error) {
  abstractPassFailed = error.message === "render(frame) must be implemented";
}
assert(abstractPassFailed, "base render pass fails fast when not implemented");

assert(
  RenderOrder.values.BACKGROUND < RenderOrder.values.OUTCOME,
  "render order ranks background before outcome",
);
assert(
  RenderOrder.sequence.join("|") === [
    "world",
    "casting",
    "fishing",
    "hud",
    "outcome",
  ].join("|"),
  "render order stores the complete pass sequence",
);
assert(
  RenderOrder.compare(RenderOrder.values.HUD, RenderOrder.values.OUTCOME) < 0,
  "render order comparison keeps HUD before outcome",
);
assert(Object.isFrozen(RenderOrder.values), "render order values are immutable");
assert(Object.isFrozen(RenderOrder.sequence), "render sequence is immutable");

let previousScriptIndex = -1;
for (const scriptPath of renderScriptOrder) {
  const scriptIndex = indexHtml.indexOf('src="' + scriptPath + '"');
  assert(scriptIndex >= 0, "index includes " + scriptPath);
  assert(
    scriptIndex > previousScriptIndex,
    "index loads " + scriptPath + " after the preceding render script",
  );
  previousScriptIndex = scriptIndex;
}

console.log("render-core-infrastructure-check passed:");
for (const message of checks) console.log("- " + message);
})()`, "utils/render-core-infrastructure-check.js#scenario");

scenario.catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
