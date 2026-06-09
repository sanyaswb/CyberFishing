const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/fishing/tackle_failure_selector.js",
  "src/core/fishing/tackle_stress_accumulator.js",
  "src/systems/tackle_stress_system.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
  window: {},
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function approx(value, expected, tolerance, message) {
  const actual = Number(value);
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    message + " (expected " + expected + ", got " + value + ")",
  );
}

const config = {
  enabled: true,
  stress: {
    capacity: 1,
    baseGainPerSecond: 0.45,
    recoveryPerSecond: 0.35,
    minStressToRoll: 0.01,
  },
  failureRoll: {
    intervalMs: 500,
    chanceScale: 1,
  },
  failureSelection: {
    tieBreakPriority: ["leader", "line", "rod"],
  },
};

const belowLimit = new TackleStressAccumulator();
belowLimit.update({
  effectiveTensionKg: 0.9,
  mainTackleLimitKg: 1,
  dtSec: 1,
  config,
});
approx(belowLimit.getStressRatio(), 0, 0.0001, "currentTension < limit does not gain stress");

const aboveLimit = new TackleStressAccumulator();
aboveLimit.update({
  effectiveTensionKg: 1.2,
  mainTackleLimitKg: 1,
  dtSec: 1,
  config,
});
assert(aboveLimit.getStressRatio() > 0, "currentTension > limit gains stress without Rod Hold");

const chance = new TackleStressAccumulator();
chance.setStressValue(0.1);
approx(
  chance.calculateFailureChance({ stressRatio: chance.getStressRatio(), chanceScale: 1 }),
  0.1,
  0.0001,
  "stressRatio 0.1 gives 10% failure chance",
);

chance.setStressValue(0.5);
const rollFrame = chance.update({
  effectiveTensionKg: 1,
  mainTackleLimitKg: 1,
  dtSec: 0.5,
  config: {
    ...config,
    stress: {
      ...config.stress,
      recoveryPerSecond: 0,
    },
  },
  rng: () => 0.49,
});
assert(rollFrame.failureTriggered, "function RNG can force deterministic roll failure");
assert(rollFrame.failureSource === "roll", "roll failure reports failureSource roll");
chance.setStressValue(0.5);
approx(
  chance.calculateFailureChance({ stressRatio: chance.getStressRatio(), chanceScale: 1 }),
  0.5,
  0.0001,
  "stressRatio 0.5 gives 50% failure chance",
);

const guaranteed = new TackleStressAccumulator();
guaranteed.setStressValue(1);
const guaranteedFrame = guaranteed.update({
  effectiveTensionKg: 1,
  mainTackleLimitKg: 1,
  dtSec: 0,
  config,
});
assert(
  guaranteedFrame.failureTriggered && guaranteedFrame.guaranteed,
  "stressRatio 1.0 guarantees failure",
);
assert(guaranteedFrame.failureSource === "guaranteed", "guaranteed failure reports failureSource guaranteed");

const safeDefaults = new TackleStressAccumulator();
const safeFrame = safeDefaults.update({
  effectiveTensionKg: 2,
  mainTackleLimitKg: 0,
  dtSec: 1,
  config: {
    ...config,
    stress: {
      ...config.stress,
      capacity: 0,
    },
    failureRoll: {
      ...config.failureRoll,
      intervalMs: 0,
    },
  },
});
assert(Number.isFinite(safeFrame.stressRatio), "zero capacity falls back to finite stress ratio");
assert(Number.isFinite(safeFrame.failureRollIntervalMs), "zero interval falls back to finite roll interval");

const selector = new TackleFailureSelector();
assert(
  selector.select({ leaderMaxLoadKg: 2, lineMaxLoadKg: 2, rodMaxLoadKg: 2 }).result === "leader_lost",
  "leader = line = rod selects leader_lost",
);
assert(
  selector.select({ leaderMaxLoadKg: Infinity, lineMaxLoadKg: 2, rodMaxLoadKg: 2 }).result === "line_break",
  "line = rod without leader selects line_break",
);
assert(
  selector.select({ leaderMaxLoadKg: 2, lineMaxLoadKg: 2, rodMaxLoadKg: 1.5 }).result === "rod_broken",
  "rod weaker than line selects rod_broken",
);
assert(
  selector.select({ leaderMaxLoadKg: Infinity, lineMaxLoadKg: 2, rodMaxLoadKg: 3 }).result === "line_break",
  "line weaker than rod selects line_break",
);

const meter = new TackleStressSystem({
  rod: { getEffectiveMaxLoadKg: () => 2 },
  reel: { hasReel: () => true, getEffectiveMaxLoadKg: () => 5 },
  lineSystem: {
    getEffectiveLineMaxLoadKg: () => 2,
    calculateBreakLossMeters: () => 1.25,
  },
  leader: { maxLoadKg: 2, durability: 100 },
  config: {
    kgSmoothPerSecond: 100,
    tackleStress: {
      ...config,
      stress: {
        ...config.stress,
        baseGainPerSecond: 2,
      },
    },
  },
  rng: { next: () => 0.99 },
});
const frameResult = meter.updateTensionFrame({
  visibleTensionKg: 3,
  totalTensionKg: 3,
  fishTensionKg: 3,
  dtSec: 1,
  tensionConfig: {
    kgSmoothPerSecond: 100,
    tackleStress: {
      ...config,
      stress: {
        ...config.stress,
        baseGainPerSecond: 2,
      },
    },
  },
});
assert(meter.isBroken(), "facade triggers failure through stress");
assert(frameResult.failed, "facade update returns failed result");
assert(frameResult.component === "leader", "facade update returns failed component");
assert(frameResult.result === "leader_lost", "facade update returns failed outcome");
assert(meter.getBreakInfo().result === "leader_lost", "facade records outcome event");
assert(meter.getBreakResult() === "leader_lost", "facade exposes break result compatibility getter");
assert(meter.getBreakInfo().failureSource === "guaranteed", "facade records failure source");
approx(meter.getDebugData().stressRatio, 0, 0.0001, "stress resets after failure");
approx(meter.getDebugData().failureRollTimerMs, 0, 0.0001, "roll timer resets after failure");

const rawOverloadMeter = new TackleStressSystem({
  rod: { getEffectiveMaxLoadKg: () => 2 },
  reel: { hasReel: () => true, getEffectiveMaxLoadKg: () => 5 },
  lineSystem: { getEffectiveLineMaxLoadKg: () => 2 },
  config: {
    kgSmoothPerSecond: 100,
    tackleStress: config,
  },
  rng: { next: () => 0.99 },
});
rawOverloadMeter.updateTensionFrame({
  visibleTensionKg: 2,
  totalTensionKg: 2,
  rawTotalTensionKg: 3,
  fishTensionKg: 0.5,
  dtSec: 1,
  tensionConfig: {
    kgSmoothPerSecond: 100,
    tackleStress: config,
  },
});
assert(
  rawOverloadMeter.getDebugData().stressRatio > 0,
  "raw overload gains stress even when visible tension is capped at main limit",
);

const dragSlipMeter = new TackleStressSystem({
  rod: { getEffectiveMaxLoadKg: () => 1 },
  reel: { hasReel: () => true, getEffectiveMaxLoadKg: () => 1 },
  lineSystem: { getEffectiveLineMaxLoadKg: () => 1 },
  config: {
    kgSmoothPerSecond: 100,
    tackleStress: config,
  },
  rng: { next: () => 0.99 },
});
dragSlipMeter.updateTensionFrame({
  visibleTensionKg: 0.6,
  totalTensionKg: 0.6,
  rawTotalTensionKg: 1.1,
  rawTensionKg: 1.1,
  fishTensionKg: 0.8,
  tensionStressSource: "visible",
  dtSec: 1,
  tensionConfig: {
    kgSmoothPerSecond: 100,
    tackleStress: config,
  },
});
approx(
  dragSlipMeter.getDebugData().effectiveTensionKg,
  0.6,
  0.0001,
  "successful drag slip uses visible tension for stress",
);
assert(
  dragSlipMeter.getDebugData().stressRatio === 0,
  "drag-clamped raw overload does not accumulate tackle stress",
);
assert(
  !dragSlipMeter.isBroken(),
  "drag-clamped raw overload does not break tackle",
);
assert(
  dragSlipMeter.getDebugData().tensionStressSource === "visible",
  "stress debug reports visible tension source",
);

console.log("Tackle stress failure checks passed: " + checks.length);
`, context);
