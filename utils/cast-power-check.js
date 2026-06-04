const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/app/cast_power.js",
  "src/ui/styles/hud_style_resolver.js",
  "src/render/hud_bar_renderer.js",
  "src/render/renderer.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Date,
  setTimeout: () => 1,
  clearTimeout: () => {},
  requestAnimationFrame: (fn) => fn(),
  window: {},
  document: { body: { classList: { toggle() {}, add() {}, remove() {} } } },
});

for (const file of FILES) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(value, expected, tolerance, message) {
  assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")");
}

const projector = {
  screenToVirtual(x, y, out = {}) {
    out.x = x;
    out.y = y;
    return out;
  },
  virtualToScreen(x, y, out = {}) {
    out.x = x;
    out.y = y;
    return out;
  },
  getScale() {
    return 1;
  },
  getPerspective() {
    return { scale: 1, squashY: 1 };
  },
};
const testConfig = {
  ...CONFIG,
  casting: {
    ...CONFIG.casting,
    keyboardInitialPower: 0,
    keyboardPowerChangePerSecond: 1,
    keyboardAimSpeedPxPerSecond: 100,
  },
};
const aim = new CastPowerAim({
  config: testConfig,
  projector,
  getViewportSize: () => ({ width: 800, height: 600 }),
  panViewport: () => {},
  rng: { next: () => 0.5 },
});
const bounds = { top: 0, bottom: 1000 };

let release = aim.update({ isPulling: true }, bounds, 0, { mode: "rod" });
assert(!release, "keyboard Space starts aiming without releasing");
let visual = aim.getVisualState();
assert(visual?.active, "keyboard aiming exposes visual state");
approx(visual.screenX, 400, 0.001, "keyboard aiming starts from viewport center");
approx(visual.power, 0, 0.001, "keyboard aiming starts from configured power");

for (let i = 0; i < 5; i++) {
  aim.update({ isPulling: true, castPowerIncrease: true }, bounds, 100, { mode: "rod" });
}
visual = aim.getVisualState();
approx(visual.power, 0.5, 0.001, "W increases cast power over time");

for (let i = 0; i < 10; i++) {
  aim.update({ isPulling: true, aimRight: true }, bounds, 100, { mode: "rod" });
}
visual = aim.getVisualState();
approx(visual.screenX, 500, 0.001, "D aims right over time");

for (let i = 0; i < 5; i++) {
  aim.update(
    { isPulling: true, aimLeft: true, castPowerDecrease: true },
    bounds,
    100,
    { mode: "rod" },
  );
}
visual = aim.getVisualState();
approx(visual.screenX, 450, 0.001, "A aims left over time");
approx(visual.power, 0, 0.001, "S decreases cast power over time");

release = aim.update({ isPulling: false }, bounds, 0, { mode: "rod" });
assert(release?.active, "releasing Space commits cast release");
approx(release.screenX, 450, 0.001, "keyboard release keeps aimed X");
approx(release.power, 0, 0.001, "keyboard release keeps current power");

const lineToCalls = [];
const ctx = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  shadowColor: "",
  shadowBlur: 0,
  lineDashOffset: 0,
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo(x, y) {
    lineToCalls.push({ x, y });
  },
  stroke() {},
  fillRect() {},
  strokeRect() {},
  fillText() {},
  setLineDash() {},
  measureText() {
    return { width: 0 };
  },
};
const renderer = new Renderer({
  width: 800,
  height: 600,
  getContext: () => ctx,
});
renderer.drawCastPowerAim(
  projector,
  bounds,
  { active: true, screenX: 400, power: 0.25, mode: "rod" },
  testConfig.casting,
  CONFIG.tension,
  0,
  500,
);
assert(lineToCalls.length > 0, "cast aim line is drawn");
approx(lineToCalls[0].y, 500, 0.001, "cast aim line uses full allowed distance, not current power");

console.log("Cast power check passed:");
for (const message of checks) console.log("- " + message);
`, context);
