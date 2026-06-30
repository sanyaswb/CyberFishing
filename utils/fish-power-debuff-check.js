const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function powerRatioFromEndurance({ currentExhaustion, maxEndurance, minBasePowerRatio = 0.2, curvePower = 1 }) {
  const enduranceRatio = maxEndurance > 0
    ? clamp01(currentExhaustion / maxEndurance)
    : 0;
  const minRatio = clamp01(minBasePowerRatio);
  const curve = Math.max(0.001, Number(curvePower) || 1);
  const exhaustionProgress = 1 - enduranceRatio;
  const debuffProgress = Math.pow(exhaustionProgress, curve);
  return 1 - (1 - minRatio) * debuffProgress;
}

function approx(actual, expected, epsilon, label) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: expected source to include ${expected}`);
  }
}

function assertOrder(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
    throw new Error(`${label}: expected ${first} before ${second}`);
  }
}

approx(powerRatioFromEndurance({ currentExhaustion: 3400, maxEndurance: 3400 }), 1, 0.000001, "100% endurance keeps full power");
approx(powerRatioFromEndurance({ currentExhaustion: 1700, maxEndurance: 3400 }), 0.6, 0.000001, "50% endurance keeps 60% power with min 20%");
approx(powerRatioFromEndurance({ currentExhaustion: 0, maxEndurance: 3400 }), 0.2, 0.000001, "0% endurance reaches minimum power");

const baseForce = 0.160;
const at2840 = baseForce * powerRatioFromEndurance({ currentExhaustion: 2840, maxEndurance: 3400 });
approx(at2840, 0.13891764705882353, 0.000001, "2840/3400 endurance is not clamped to minimum force");
approx(baseForce * powerRatioFromEndurance({ currentExhaustion: 0, maxEndurance: 3400 }), 0.032, 0.000001, "minimum base force is reached only at zero endurance");

const earlyCurve = powerRatioFromEndurance({ currentExhaustion: 1700, maxEndurance: 3400, curvePower: 0.75 });
const lateCurve = powerRatioFromEndurance({ currentExhaustion: 1700, maxEndurance: 3400, curvePower: 1.5 });
if (!(earlyCurve < 0.6)) throw new Error("curvePower < 1 should weaken fish earlier");
if (!(lateCurve > 0.6)) throw new Error("curvePower > 1 should preserve fish power longer");

const fishSource = fs.readFileSync(path.join(root, "src/entities/fish.js"), "utf8");
assertIncludes(fishSource, "setPowerRatioByEnduranceRatio", "Fish has endurance-ratio power sync method");
assertIncludes(fishSource, "targetForceMultiplier", "Fish behavior exposes target force multiplier");
assertIncludes(fishSource, "runtimeForceMultiplier", "Fish behavior exposes runtime force multiplier");

const staminaSource = fs.readFileSync(path.join(root, "src/systems/stamina_system.js"), "utf8");
assertIncludes(staminaSource, "setPowerRatioByEnduranceRatio", "StaminaController uses new frame-based power sync");
const syncStart = staminaSource.indexOf("  #syncFramePowerDebuffWithEndurance() {");
const syncEnd = staminaSource.indexOf("  #applyFinalDebuffIfExhausted", syncStart);
const syncSource = staminaSource.slice(syncStart, syncEnd);
assertOrder(
  syncSource,
  "setPowerRatioByEnduranceRatio",
  "basePowerDropPerSec",
  "Frame-based power sync uses endurance ratio before legacy basePowerDropPerSec fallback",
);

const forceSource = fs.readFileSync(path.join(root, "src/systems/fish_force_system.js"), "utf8");
assertIncludes(forceSource, "fishRuntimeForceMultiplier", "FishForceSystem exports runtime force multiplier");
assertIncludes(forceSource, "fishStateTargetForceMultiplier", "FishForceSystem exports target state force multiplier");
assertIncludes(forceSource, "fishCurrentStateMaxForceKg", "FishForceSystem exports current state max force");
assertIncludes(forceSource, "fishStateMaxForceWithoutPowerDebuffKg", "FishForceSystem exports state max without power debuff");

const overlaySource = fs.readFileSync(path.join(root, "src/debug/overlay/modules/fish_balance/fish_live_force_summary_section.js"), "utf8");
assertIncludes(overlaySource, "fishCurrentStateMaxForceKg", "Overlay current force uses state max force");
assertIncludes(overlaySource, "fishStateTargetForceMultiplier", "Overlay current force displays target state multiplier");
assertIncludes(overlaySource, "#lossText", "Overlay current force renders inline loss text");
if (overlaySource.includes('"Виснаження"')) {
  throw new Error("Overlay current force should not render separate exhaustion force row");
}

console.log("Fish power debuff checks passed.");
