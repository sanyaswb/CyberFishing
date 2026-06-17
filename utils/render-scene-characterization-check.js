const path = require("node:path");
const {
  CanvasContextSpy,
  RenderTestHarness,
} = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const ctx = new CanvasContextSpy();
const context = harness.createContext({ ctx, Math, Number });

harness.load(context, [
  "src/render/core/canvas_2d_surface.js",
  "src/render/core/canvas_primitives.js",
  "src/render/core/render_frame_buffer.js",
  "src/render/core/render_math.js",
  "src/render/fishing/fight_area_renderer.js",
  "src/render/fishing/rod_line_renderer.js",
  "src/render/fishing/float_renderer.js",
  "src/render/casting/cast_scene_renderer.js",
]);

harness.run(context, `
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
const canvas = { width: 800, height: 600, getContext: () => ctx };
const surface = new Canvas2DSurface(canvas);
const primitives = new CanvasPrimitives(surface);

const area = new GameRenderFrame().fishing.fightAreas;
area.visible = true;
Object.assign(area.clipRegions.acquire(), {
  x: 0, y: 0, width: 800, height: 600,
});
Object.assign(area.catchZone, {
  visible: true,
  kind: "ellipse",
  x: 400,
  y: 550,
  radiusX: 50,
  radiusY: 50,
});
Object.assign(area.lastDashZone, {
  visible: true,
  y: 450,
  width: 800,
  height: 95,
});
Object.assign(area.netZone, {
  visible: true,
  y: 500,
  width: 800,
  height: 45,
});
const fightRenderer = new FightAreaRenderer({
  surface,
  primitives,
  styleResolver: {
    resolve() {
      return {
        catchFill: "#1", catchStroke: "#2",
        lastDashFill: "#3", lastDashStroke: "#4", lastDashDash: [9, 7],
        netFill: "#5", netStroke: "#6",
        sectorFill: "#7", sectorClampedFill: "#8",
        sectorStroke: "#9", sectorClampedStroke: "#a",
        sectorAxis: "#b", lineRadiusStroke: "#c",
      };
    },
  },
});
ctx.reset();
fightRenderer.render(area);
const clipIndex = ctx.calls.findIndex((call) => call.name === "clip");
const drawIndex = ctx.calls.findIndex(
  (call) => call.name === "fillRect" || call.name === "ellipse",
);
assert(clipIndex >= 0 && clipIndex < drawIndex, "fight areas clip before drawing");
assert(
  !!ctx.callsNamed("ellipse").find((call) =>
    call.args.slice(0, 4).join("|") === [400, 550, 50, 50].join("|")),
  "catch ellipse geometry remains stable",
);

const hudBarRenderer = { drawFramedRatioBar() {} };
const castRenderer = new CastSceneRenderer({
  surface,
  primitives,
  hudBarRenderer,
  hudStyleResolver: { resolveBarStyle: () => ({ width: 300, height: 12 }) },
});
ctx.reset();
castRenderer.render({
  visible: true,
  aimingZone: {
    visible: true,
    lineY: 500,
    fillHeight: 100,
    viewportWidth: 800,
    mode: "rod",
    clipRegions: area.clipRegions,
  },
  accuracyArea: { visible: false },
  powerAim: {
    visible: true,
    screenX: 250,
    originY: 550,
    targetY: 150,
    lineColor: "#0cf",
    lineWidth: 2,
    dash: [12, 10],
    dashOffset: 0,
    glowBlur: 0,
    powerRatio: 0.25,
    viewportWidth: 800,
    mode: "rod",
    powerColor: "#0cf",
  },
});
assert(
  !!ctx.callsNamed("lineTo").find((call) =>
    call.args.join("|") === [250, 150].join("|")),
  "cast aim uses the prebuilt full-distance endpoint",
);

ctx.reset();
new FloatRenderer({ surface }).render({
  visible: true,
  kind: "float",
  x: 320,
  y: 240,
  color: "#00ccff",
  glow: true,
  glowBlur: 4,
  width: 2,
  height: 8,
  rotationRad: Math.PI / 6,
});
assert(
  ctx.callsNamed("translate")[0].args.join("|") === [320, 240].join("|"),
  "float renderer uses projected DTO coordinates",
);
approx(
  ctx.callsNamed("rotate")[0].args[0],
  Math.PI / 6,
  0.000001,
  "float rotation remains stable",
);
assert(
  ctx.callsNamed("fillRect")[0].args.join("|") === [-1, -8, 2, 8].join("|"),
  "float dimensions remain stable",
);

ctx.reset();
new RodLineRenderer({ surface }).render({
  visible: true,
  rodBaseX: 400,
  rodTopY: 400,
  rodWidth: 3,
  rodHeight: 200,
  lineVisible: true,
  targetX: 500,
  targetY: 320,
  controlX: 450,
  controlY: 435,
  lineColor: "#fff",
  lineWidth: 1,
});
const curve = ctx.callsNamed("quadraticCurveTo")[0];
assert(
  curve.args.join("|") === [450, 435, 500, 320].join("|"),
  "rod-line curve consumes the characterized DTO geometry",
);

console.log("render-scene-characterization-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-scene-characterization-check.js#scenario");
