const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const context = vm.createContext({ console, Math, Number, Object });
vm.runInContext(
  fs.readFileSync(
    path.join(ROOT, "src/core/fishing/player_force_budget_allocator.js"),
    "utf8",
  ),
  context,
  { filename: "src/core/fishing/player_force_budget_allocator.js" },
);

vm.runInContext(
  `
const checks = [];
function assert(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
function approx(value, expected, tolerance, message) { assert(Math.abs(Number(value) - expected) <= tolerance, message + " (" + value + ")"); }

const allocator = new PlayerForceBudgetAllocator();
const config = {
  enabled: true,
  allocationMode: "independent",
  control: { maxBudgetShare: 0.5, minInputRatio: 0.001 },
  tensionCeiling: {
    holdMultiplier: 1.0,
    controlMultiplier: 1.0,
    maxCombinedMultiplier: 1.0,
  },
};
const hold = Object.freeze({ active: true, ratio: 1, source: "test" });
const noHold = Object.freeze({ active: false, ratio: 0, source: "none" });
const fullControl = Object.freeze({ active: true, directionX: 1, inputRatio: 1, source: "test" });
const halfControl = Object.freeze({ active: true, directionX: 1, inputRatio: 0.5, source: "test" });
const belowThresholdControl = Object.freeze({ active: true, directionX: 1, inputRatio: 0.0005, source: "test" });
const noControl = Object.freeze({ active: false, directionX: 0, inputRatio: 0, source: "none" });

let frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 0.4, holdAction: hold, controlAction: noControl, config });
approx(frame.combinedCeilingMultiplier, 1.0, 0.0001, "hold-only ceiling uses hold multiplier");
approx(frame.totalPlayerBudgetKg, 0.6, 0.0001, "hold-only total budget uses ceiling minus fish tension");
approx(frame.holdShare, 1, 0.0001, "hold-only gets 100% hold share");
approx(frame.controlShare, 0, 0.0001, "hold-only gets 0% control share");
approx(frame.holdBudgetKg, 0.6, 0.0001, "hold-only budget goes to hold");
approx(frame.controlBudgetKg, 0, 0.0001, "hold-only gives no control budget");

frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 0.4, holdAction: hold, controlAction: fullControl, config });
approx(frame.combinedCeilingMultiplier, 1.0, 0.0001, "hold+full-control stays at base ceiling when no extras are configured");
approx(frame.totalPlayerBudgetKg, 0.6, 0.0001, "hold+full-control total budget uses combined ceiling");
approx(frame.holdShare, 1, 0.0001, "independent full control keeps the full hold share");
approx(frame.controlShare, 1, 0.0001, "independent full control receives its own full share");
approx(frame.holdBudgetKg, 0.6, 0.0001, "independent hold+full-control keeps full hold budget");
approx(frame.controlBudgetKg, 0.6, 0.0001, "independent hold+full-control gives full control budget");

frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 0.4, holdAction: hold, controlAction: halfControl, config });
approx(frame.combinedCeilingMultiplier, 1.0, 0.0001, "half control keeps the base ceiling when no control extra is configured");
approx(frame.totalPlayerBudgetKg, 0.6, 0.0001, "half control total budget uses the base ceiling");
approx(frame.controlShare, 1, 0.0001, "independent half control gets a full control budget once active");
approx(frame.holdShare, 1, 0.0001, "independent half control does not reduce hold share");
approx(frame.controlBudgetKg, 0.6, 0.0001, "independent half control gets the available control budget");
approx(frame.holdBudgetKg, 0.6, 0.0001, "independent half control leaves full budget with hold");

frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 0.4, holdAction: noHold, controlAction: fullControl, config });
approx(frame.holdShare, 0, 0.0001, "control-only has no hold share");
approx(frame.controlShare, 1, 0.0001, "control-only receives 100% available player budget");
approx(frame.combinedCeilingMultiplier, 1.0, 0.0001, "control-only contributes control ceiling only");
approx(frame.controlBudgetKg, 0.6, 0.0001, "control-only gets full available budget");

frame = allocator.resolve({
  rodLimitKg: 1,
  fishTensionKg: 0,
  holdAction: hold,
  controlAction: fullControl,
  config: {
    enabled: true,
    control: { maxBudgetShare: 0.5 },
    tensionCeiling: { holdMultiplier: 1.5, controlMultiplier: 1.5, maxCombinedMultiplier: 1.25 },
  },
});
approx(frame.rawCombinedCeilingMultiplier, 2, 0.0001, "raw ceiling can exceed safety cap");
approx(frame.combinedCeilingMultiplier, 1.25, 0.0001, "combined ceiling respects max safety cap");
approx(frame.totalPlayerBudgetKg, 1.25, 0.0001, "budget uses capped ceiling");

frame = allocator.resolve({
  rodLimitKg: 1,
  fishTensionKg: 0.4,
  holdAction: hold,
  controlAction: fullControl,
  config: {
    ...config,
    allocationMode: "split",
  },
});
approx(frame.holdShare, 0.5, 0.0001, "legacy split mode lets full control take max configured share from hold");
approx(frame.controlShare, 0.5, 0.0001, "legacy split mode gives full control the configured share");
approx(frame.holdBudgetKg, 0.3, 0.0001, "legacy split mode splits hold budget");
approx(frame.controlBudgetKg, 0.3, 0.0001, "legacy split mode splits control budget");

frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 2, holdAction: hold, controlAction: fullControl, config });
approx(frame.totalPlayerBudgetKg, 0, 0.0001, "budget cannot go negative when fish tension exceeds ceiling");
approx(frame.holdBudgetKg, 0, 0.0001, "hold budget cannot go negative");
approx(frame.controlBudgetKg, 0, 0.0001, "control budget cannot go negative");

frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 0.4, holdAction: noHold, controlAction: noControl, config });
approx(frame.holdShare, 0, 0.0001, "inactive input has no hold share");
approx(frame.controlShare, 0, 0.0001, "inactive input has no control share");
approx(frame.holdBudgetKg, 0, 0.0001, "inactive input has no hold budget");
approx(frame.controlBudgetKg, 0, 0.0001, "inactive input has no control budget");

frame = allocator.resolve({ rodLimitKg: 1, fishTensionKg: 0.4, holdAction: hold, controlAction: belowThresholdControl, config });
assert(!frame.controlActive, "control input below configured minimum is inactive");
approx(frame.controlInputRatio, 0, 0.0001, "inactive below-threshold control has zero input ratio");
approx(frame.holdShare, 1, 0.0001, "below-threshold control does not consume hold share");
approx(frame.holdBudgetKg, 0.6, 0.0001, "below-threshold control leaves full budget with hold");
approx(frame.controlBudgetKg, 0, 0.0001, "below-threshold control receives no budget");

frame = allocator.resolve({
  rodLimitKg: 1,
  fishTensionKg: 0.4,
  holdAction: hold,
  controlAction: fullControl,
  controlEligibility: {
    canRequestForce: false,
    blockedReason: "aligned",
  },
  config,
});
assert(frame.controlRequested, "aligned input remains visible as requested control");
assert(!frame.controlEligible, "aligned control is ineligible for force budget");
assert(!frame.controlActive, "aligned control is inactive for budget allocation");
assert(frame.controlBlockedReason === "aligned", "aligned budget block reason is preserved");
approx(frame.holdShare, 1, 0.0001, "aligned control returns the full share to Rod Hold");
approx(frame.controlShare, 0, 0.0001, "aligned control receives no force share");
approx(frame.holdBudgetKg, 0.6, 0.0001, "Rod Hold receives the full hold-only budget after alignment");
approx(frame.controlBudgetKg, 0, 0.0001, "aligned control receives zero budget");

console.log("player-force-budget-check passed:\\n- " + checks.join("\\n- "));
`,
  context,
);
