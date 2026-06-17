const path = require("node:path");
const {
  CanvasContextSpy,
  RenderTestHarness,
} = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const ctx = new CanvasContextSpy({ textWidth: 7 });
const context = harness.createContext({ ctx, Math, Number });

harness.load(context, [
  "src/render/core/canvas_2d_surface.js",
  "src/render/core/canvas_primitives.js",
  "src/render/core/render_math.js",
  "src/render/hud/hud_bar_renderer.js",
  "src/render/hud/hold_charges_renderer.js",
  "src/render/hud/fight_status_bars_renderer.js",
  "src/render/hud/fight_hud_renderer.js",
  "src/render/screens/game_over_renderer.js",
  "src/render/screens/victory_layout_resolver.js",
  "src/render/screens/victory_theme_resolver.js",
  "src/render/screens/victory_renderer.js",
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
const surface = new Canvas2DSurface({
  width: 800,
  height: 700,
  getContext: () => ctx,
});
const styleResolver = {
  resolveBarStyle(path) {
    const styles = {
      layout: { x: "center", y: 40, spacing: 90, tensionGapFromStroke: 34 },
      tension: {
        width: 300, height: 20, valuePlacement: "center",
        gradient: {
          low: { start: [0, 0, 255], end: [255, 255, 0] },
          mid: { start: [255, 255, 0], end: [255, 128, 0] },
          high: { start: [255, 128, 0], end: [255, 0, 0] },
          breakpoints: { low: 33, mid: 66 },
        },
      },
      fishCondition: { width: 220, height: 10, gap: 22 },
      "fishCondition.stamina": { fillColor: "#4aa3ff" },
      "fishCondition.exhaustion": { fillColor: "#ff5c7a" },
      rodStroke: { height: 3 },
      rodControl: { height: 3, yOffset: -28 },
      tackleStress: { height: 8, yOffset: -25 },
      drag: {},
    };
    return styles[path] || {};
  },
};
const hud = new FightHudRenderer({
  statusBarsRenderer: new FightStatusBarsRenderer({
    surface,
    hudBarRenderer: new HudBarRenderer(surface),
    styleResolver,
  }),
  holdChargesRenderer: new HoldChargesRenderer({ surface }),
});
const model = {
  visible: true,
  viewportWidth: 800,
  viewportHeight: 700,
  fishCondition: {
    visible: true,
    staminaRatio: 0.75,
    exhaustionRatio: 0.25,
    staminaValue: "75/100",
    exhaustionValue: "20/80",
    phase: "stamina",
  },
  rodStroke: { visible: true, ratio: 0.4, value: "1.2m / 3.0m" },
  rodControl: { visible: true, ratio: 0.4, active: true, value: "R 40%" },
  tension: {
    visible: true,
    ratio: 0.72,
    pulse: 0.5,
    value: "1.23/2.50kg",
    dragMarkerVisible: true,
    dragMarkerRatio: 0.5,
  },
  tackleStress: {
    visible: true,
    ratio: 0.3,
    label: "STRESS: LEADER",
    value: "30%",
  },
  drag: { visible: false },
  holdCharges: { visible: false },
};
ctx.reset();
hud.render(model);
assert(!!ctx.textCall("STAMINA"), "HUD keeps the stamina label");
assert(!!ctx.textCall("75/100"), "HUD keeps the stamina value");
assert(!!ctx.textCall("ENDURANCE"), "HUD keeps the endurance label");
assert(!!ctx.textCall("20/80"), "HUD keeps the endurance value");
assert(!!ctx.textCall("R 40%"), "HUD keeps rod-control direction and ratio");
assert(!!ctx.textCall("1.23/2.50kg"), "HUD keeps tension value precision");
assert(!!ctx.textCall("STRESS: LEADER"), "HUD keeps tackle stress target");
assert(!!ctx.textCall("30%"), "HUD keeps tackle stress percentage");
assert(
  ctx.textCall("STAMINA").args.length === 3,
  "HUD stamina label is drawn without implicit zero max width",
);
assert(
  ctx.textCall("1.23/2.50kg").args.length === 3,
  "HUD tension value is drawn without implicit zero max width",
);

const gameOver = new GameOverRenderer({ surface });
const gameOverCases = [
  ["LINE SNAPPED", "Tension exceeded line capacity."],
  ["ROD BROKEN", "Your rod could not handle the stress."],
  ["LEADER SNAPPED", "The leader was the weakest part of the rig."],
  ["FISH ESCAPED", "The hook bent and the fish got away."],
  ["FISH ESCAPED", "The fish was too heavy and broke out of the net!"],
];
for (const [title, description] of gameOverCases) {
  ctx.reset();
  gameOver.render({
    visible: true,
    width: 800,
    height: 700,
    title,
    titleColor: "#f44",
    description,
  });
  assert(!!ctx.textCall(title), "Game Over title remains stable: " + title);
  assert(
    !!ctx.textCall(description),
    "Game Over description remains stable: " + description,
  );
  assert(
    !!ctx.textCall("Refresh page to try again"),
    "Game Over keeps retry instruction",
  );
}

const config = {
  panelWidth: 540, panelMinHeight: 560, viewportMargin: 24,
  panelPadding: 24, panelRadius: 8, imageBoxSize: 260,
  imageBorderWidth: 3, statPillHeight: 42, buttonWidth: 150,
  buttonHeight: 42, buttonGap: 14, blurPx: 0,
  uniqueGlowPulseMs: 1200,
  levelColors: { 1: [145, 150, 160], 2: [0, 210, 120] },
};
const layout = new VictoryLayoutResolver().resolve({
  width: 800, height: 700, config, statCount: 3,
});
const stats = {
  count: 3,
  items: [
    { label: "1.234 kg", color: null },
    { label: "Trophy", color: null },
    { label: "Anomaly: none", color: null },
  ],
  forEach(callback) {
    for (let index = 0; index < this.count; index += 1) {
      callback(this.items[index], index);
    }
  },
};
ctx.reset();
new VictoryRenderer({
  surface,
  primitives: new CanvasPrimitives(surface),
  assets: { tryGet: () => null },
  themeResolver: new VictoryThemeResolver(),
}).render({
  visible: true,
  width: 800,
  height: 700,
  nowMs: 0,
  config,
  layout,
  spriteId: "fish:test",
  fish: {
    name: "Test Fish",
    level: 2,
    maxLevel: 5,
    isUnique: false,
  },
  stats,
});
const claim = ctx.textCall("Claim");
const release = ctx.textCall("Release");
assert(!!claim && !!release, "Victory keeps both action buttons");
assert(claim.args.length === 3, "Victory Claim text is drawn without implicit zero max width");
assert(
  release.args.length === 3,
  "Victory Release text is drawn without implicit zero max width",
);
approx(claim.args[1], 318, 0.000001, "Victory Claim center X is stable");
approx(claim.args[2], 511, 0.000001, "Victory Claim center Y is stable");
approx(release.args[1], 482, 0.000001, "Victory Release center X is stable");
approx(release.args[2], 511, 0.000001, "Victory Release center Y is stable");

console.log("render-ui-characterization-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-ui-characterization-check.js#scenario");
