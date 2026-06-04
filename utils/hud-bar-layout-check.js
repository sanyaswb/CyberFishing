const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = ["src/render/hud_bar_renderer.js"];

const textCalls = [];
const context = vm.createContext({
  console,
  Math,
  Number,
  textCalls,
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

const ctx = {
  fillStyle: "",
  strokeStyle: "",
  font: "",
  textAlign: "",
  textBaseline: "",
  lineWidth: 1,
  shadowColor: "",
  shadowBlur: 0,
  save() {},
  restore() {},
  fillRect() {},
  strokeRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
  fillText(text, x, y) {
    textCalls.push({
      text,
      x,
      y,
      align: this.textAlign,
      baseline: this.textBaseline,
    });
  },
};

const renderer = new HudBarRenderer(ctx);
renderer.drawFramedRatioBar({
  x: 10,
  y: 30,
  width: 100,
  height: 20,
  ratio: 0.5,
  style: {
    labelGap: 6,
    valueGap: 6,
    valuePlacement: "center",
    labelFont: "bold 12px monospace",
    valueFont: "bold 12px monospace",
  },
  topLabel: "POWER",
  rightValue: "50%",
});

renderer.drawThinProgressBar({
  x: 20,
  y: 80,
  width: 120,
  height: 8,
  ratio: 0.25,
  style: {
    labelGap: 6,
    valueGap: 6,
    valuePlacement: "center",
    labelFont: "bold 10px monospace",
    valueFont: "bold 10px monospace",
  },
  label: "STRESS",
  value: "25%",
});

const powerLabel = textCalls.find((call) => call.text === "POWER");
const powerValue = textCalls.find((call) => call.text === "50%");
const stressLabel = textCalls.find((call) => call.text === "STRESS");
const stressValue = textCalls.find((call) => call.text === "25%");

assert(powerLabel.x === 60 && powerLabel.y === 24, "framed label is centered above the bar");
assert(powerLabel.align === "center" && powerLabel.baseline === "bottom", "framed label uses centered top alignment");
assert(powerValue.x === 60 && powerValue.y === 40, "framed value is centered at bar center height");
assert(powerValue.align === "center" && powerValue.baseline === "middle", "framed value uses center middle alignment");
assert(stressLabel.x === 80 && stressLabel.y === 74, "thin label is centered above the bar");
assert(stressValue.x === 80 && stressValue.y === 84, "thin value is centered at bar center height");

console.log("HUD bar layout check passed:");
for (const message of checks) console.log("- " + message);
`, context);
