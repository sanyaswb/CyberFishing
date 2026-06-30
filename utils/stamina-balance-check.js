const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/casting_distance.js",
  "src/core/line/line_spool_state.js",
  "src/core/fishing/stamina/active_stamina_drain_calculator.js",
  "src/core/fishing/stamina/angle_stamina_recovery_calculator.js",
  "src/core/fishing/stamina/stamina_angle_regen_multiplier_calculator.js",
  "src/core/fishing/stamina/passive_stamina_regen_calculator.js",
  "src/core/fishing/stamina/active_endurance_drain_calculator.js",
  "src/core/fishing/stamina/passive_endurance_drain_calculator.js",
  "src/core/fishing/stamina/passive_stamina_drain_calculator.js",
  "src/core/fishing/stamina/stamina_balance_frame.js",
  "src/services/weakest_tackle_limit_resolver.js",
  "src/systems/line_system.js",
  "src/systems/stamina_system.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(
  `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(value, expected, tolerance, message) {
  assert(Math.abs(Number(value) - expected) <= tolerance, message + " (" + value + ")");
}

const mechanicsConfig = {
  activeDrain: {
    enabled: true,
    drainPerSecond: 100,
    curvePower: 1,
    lateralStaminaWeight: 0.5,
  },
  passiveRegen: {
    enabled: true,
    regenPerSecond: 20,
    pressureThresholdKg: 0.01,
    allowWhilePressuring: false,
    delay: {
      enabled: false,
      delayAfterPressureMs: 500,
    },
    angleMultiplier: {
      enabled: true,
      centerAngleDeg: 15,
      minCenterMultiplier: 0.3,
      badAngleDeg: 75,
      badAngleMultiplier: 1.5,
      extremeAngleDeg: 90,
      extremeAngleMultiplier: 2,
    },
  },
  enduranceDrain: {
    active: {
      enabled: true,
      drainPerSecond: 80,
      curvePower: 1,
    },
    passive: {
      enabled: true,
      drainPerSecond: 15,
      curvePower: 1,
      defaultBehaviorMultiplier: 0.5,
      behaviorMultipliers: {
        dash: 1,
        swim: 0.5,
        idle: 0.1,
        rest: 0,
      },
    },
  },
  basePowerDropPerSec: 0.1,
  minBasePowerRatio: 0.2,
  powerDebuff: {
    enabled: true,
    minBasePowerRatio: 0.2,
    curvePower: 1,
  },
  phaseRecovery: {
    enabled: true,
    pressureThresholdKg: 0.01,
    pressureThresholdRatioOfMax: 0.08,
    exhaustionToStamina: {
      enabled: true,
      noPressureTimeoutMs: 5000,
      slackLineRecovery: {
        enabled: true,
        lineTautThresholdRatio: 0.1,
      },
    },
    enduranceRecovery: {
      enabled: true,
      requiresFullStamina: true,
      recoveryPerSecond: 30,
      maxRecoveryRatio: 0.8,
    },
  },
  baseDepletionRate: 100,
  exhaustionDepletionMultiplier: 1,
  masteryTimeRatio: 0.5,
  masteryPowerMultiplier: 0.2,
  punishmentCap: 0.8,
  debuffs: { dashPullMult: 0.75 },
};

class FakeCondition {
  constructor({ phase = "stamina", stamina = 100, endurance = 100 } = {}) {
    this.phase = phase;
    this.maxStamina = 100;
    this.maxEndurance = 100;
    this.maxPoints = 100;
    this.currentStamina = stamina;
    this.currentExhaustion = endurance;
    this.punishmentCalls = 0;
  }

  restoreFull() {
    this.currentStamina = this.maxStamina;
    this.currentExhaustion = this.maxEndurance;
    this.phase = "stamina";
  }

  breakExhaustion() {
    if (this.phase === "exhaustion") this.phase = "stamina";
  }

  applyStaminaDamage(amount) {
    if (this.phase !== "stamina") return;
    this.currentStamina = Math.max(0, this.currentStamina - amount);
    if (this.currentStamina === 0) this.phase = "exhaustion";
  }

  applyStaminaRegen(amount) {
    if (this.phase !== "stamina") return;
    this.currentStamina = Math.min(this.maxStamina, this.currentStamina + amount);
  }

  applyExhaustionDamage(amount) {
    if (this.phase !== "exhaustion") return;
    this.currentExhaustion = Math.max(0, this.currentExhaustion - amount);
  }

  applyExhaustionRegen(amount, cap = this.maxEndurance) {
    this.currentExhaustion = Math.min(
      Math.max(0, Math.min(this.maxEndurance, Number(cap) || this.maxEndurance)),
      this.currentExhaustion + Math.max(0, Number(amount) || 0),
    );
  }

  applyPunishment(capPercent) {
    this.punishmentCalls += 1;
    this.currentExhaustion = Math.max(this.currentExhaustion, this.maxEndurance * capPercent);
  }
}

class FakeFish {
  constructor() {
    this.randomDebuffApplied = false;
    this.powerDebuff = 0;
    this.masteryMultiplier = 1;
    this.applyPowerDebuffCalls = 0;
    this.powerDebuffByRatioCalls = 0;
    this.powerRatioByEnduranceCalls = 0;
    this.lastPowerDebuffExhaustionRatio = null;
    this.lastPowerRatioEnduranceRatio = null;
  }

  get hasActiveDebuff() {
    return this.randomDebuffApplied;
  }

  getInitialPower() {
    return 1;
  }

  applyPowerDebuff(amount) {
    this.applyPowerDebuffCalls += 1;
    this.powerDebuff += Math.max(0, Number(amount) || 0);
  }

  applyRandomDebuff() {
    this.randomDebuffApplied = true;
  }

  clearDebuff() {
    this.randomDebuffApplied = false;
  }

  clearMasteryDebuff() {}

  setMasteryMultiplier(value) {
    this.masteryMultiplier = value;
  }

  setPowerDebuffByExhaustionRatio(
    exhaustionRatio,
    maxPowerDropPerSec,
    maxDurationSec,
  ) {
    this.powerDebuffByRatioCalls += 1;
    this.lastPowerDebuffExhaustionRatio = Number(exhaustionRatio);
    this.powerDebuff =
      Math.max(0, Number(maxPowerDropPerSec) || 0) *
      Math.max(0, Number(maxDurationSec) || 0) *
      Math.max(0, 1 - this.lastPowerDebuffExhaustionRatio);
  }

  setPowerRatioByEnduranceRatio(
    enduranceRatio,
    minBasePowerRatio = 0.2,
    curvePower = 1,
  ) {
    this.powerRatioByEnduranceCalls += 1;
    this.lastPowerRatioEnduranceRatio = Number(enduranceRatio);
    const ratio = Math.max(0, Math.min(1, Number(enduranceRatio) || 0));
    const minRatio = Math.max(0, Math.min(1, Number(minBasePowerRatio) || 0));
    const curve = Math.max(0.001, Number(curvePower) || 1);
    const progress = 1 - ratio;
    const debuffProgress = Math.pow(progress, curve);
    const targetPowerRatio = 1 - (1 - minRatio) * debuffProgress;
    this.powerDebuff = 1 - targetPowerRatio;
  }
}

function createController({ phase = "stamina", stamina = 100, endurance = 100 } = {}) {
  const condition = new FakeCondition({ phase, stamina, endurance });
  const fish = new FakeFish();
  const controller = new StaminaController(condition, fish, 1, mechanicsConfig);
  return { condition, fish, controller };
}

let durationRuntime = createController();
approx(
  durationRuntime.controller.getExhaustionDurationMs(),
  (100 / 87.5) * 1000,
  0.0001,
  "exhaustion duration uses configured expected endurance drain per second",
);

const activeDrain = new ActiveStaminaDrainCalculator();
let frame = activeDrain.calculate({
  appliedRodHoldKg: 0,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.activeDrain,
  requestedRodHoldKg: 100,
  rawInputPower: 100,
});
approx(frame.activeStaminaDrain, 0, 0.0001, "active stamina formulas ignore raw/requested input");

frame = activeDrain.calculate({
  appliedRodHoldKg: 0.5,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.activeDrain,
});
approx(frame.activeDrainRatio, 0.5, 0.0001, "active stamina pressure ratio comes from applied rodHold");
approx(frame.activeStaminaDrain, 50, 0.0001, "phase stamina active pressure drains stamina");

frame = activeDrain.calculate({
  appliedRodHoldKg: 0,
  appliedControlKg: 0.5,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.activeDrain,
});
approx(frame.usedPlayerPressureKg, 0.25, 0.0001, "applied control uses lateral stamina weight");

const angleMultiplier = new StaminaAngleRegenMultiplierCalculator();
approx(angleMultiplier.calculate({ lineAngleDeg: 0, config: mechanicsConfig.passiveRegen.angleMultiplier }).angleRegenMultiplier, 0.3, 0.0001, "0deg angle gives x0.3 regen multiplier");
approx(angleMultiplier.calculate({ lineAngleDeg: 15, config: mechanicsConfig.passiveRegen.angleMultiplier }).angleRegenMultiplier, 1.0, 0.0001, "15deg angle gives x1.0 regen multiplier");
approx(angleMultiplier.calculate({ lineAngleDeg: 75, config: mechanicsConfig.passiveRegen.angleMultiplier }).angleRegenMultiplier, 1.5, 0.0001, "75deg angle gives x1.5 regen multiplier");
approx(angleMultiplier.calculate({ lineAngleDeg: 90, config: mechanicsConfig.passiveRegen.angleMultiplier }).angleRegenMultiplier, 2.0, 0.0001, "90deg angle gives x2.0 regen multiplier");

const regen = new PassiveStaminaRegenCalculator();
frame = regen.calculate({
  usedPlayerPressureKg: 0,
  lineAngleDeg: 15,
  dtSec: 1,
  nowMs: 1000,
  config: mechanicsConfig.passiveRegen,
});
approx(frame.passiveStaminaRegen, 20, 0.0001, "phase stamina active pressure 0 regens stamina");

frame = regen.calculate({
  usedPlayerPressureKg: 0.5,
  lineAngleDeg: 15,
  dtSec: 1,
  nowMs: 1100,
  config: mechanicsConfig.passiveRegen,
});
approx(frame.passiveStaminaRegen, 0, 0.0001, "phase stamina active pressure blocks passive regen");

const delayedRegen = new PassiveStaminaRegenCalculator();
const delayConfig = {
  ...mechanicsConfig.passiveRegen,
  delay: { enabled: true, delayAfterPressureMs: 500 },
};
delayedRegen.calculate({
  usedPlayerPressureKg: 1,
  lineAngleDeg: 15,
  dtSec: 1,
  nowMs: 1000,
  config: delayConfig,
});
frame = delayedRegen.calculate({
  usedPlayerPressureKg: 0,
  lineAngleDeg: 15,
  dtSec: 1,
  nowMs: 1200,
  config: delayConfig,
});
approx(frame.passiveStaminaRegen, 0, 0.0001, "regen delay enabled blocks regen before delayAfterPressureMs");
frame = delayedRegen.calculate({
  usedPlayerPressureKg: 0,
  lineAngleDeg: 15,
  dtSec: 1,
  nowMs: 1600,
  config: delayConfig,
});
approx(frame.passiveStaminaRegen, 20, 0.0001, "regen delay disabled window expires and regen resumes");

const endurancePassive = new PassiveEnduranceDrainCalculator();
const dashPassive = endurancePassive.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTautRatio: 1,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.enduranceDrain.passive,
});
approx(dashPassive.passiveEnduranceDrain, 15, 0.0001, "phase exhaustion resisted fish effort drains endurance");

const slackPassive = endurancePassive.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: false,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.enduranceDrain.passive,
});
approx(slackPassive.passiveEnduranceDrain, 0, 0.0001, "lineTaut false gives zero passive endurance drain");

const restPassive = endurancePassive.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTautRatio: 1,
  fishBehaviorName: "rest",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.enduranceDrain.passive,
});
approx(restPassive.passiveEnduranceDrain, 0, 0.0001, "rest behavior gives zero passive endurance drain");

const swimPassive = endurancePassive.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTautRatio: 1,
  fishBehaviorName: "swim",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: mechanicsConfig.enduranceDrain.passive,
});
assert(dashPassive.passiveEnduranceDrain > swimPassive.passiveEnduranceDrain, "dash behavior drains endurance more than swim");

const balanceFactory = new StaminaBalanceFrame();
frame = balanceFactory.create({
  phase: "stamina",
  appliedRodHoldKg: 0.5,
  weakestTackleLimitKg: 1,
  lineAngleDeg: 15,
  currentExhaustion: 75,
  maxEndurance: 100,
  dtSec: 1,
  config: mechanicsConfig,
});
approx(frame.passiveStaminaDrain, 0, 0.0001, "phase stamina passive stamina drain is always zero");
approx(frame.netStaminaChange, -50, 0.0001, "phase stamina net change uses active drain without passive drain");
approx(frame.frameCurrentExhaustion, 75, 0.0001, "stamina frame records frame-start exhaustion");
approx(frame.frameMaxEndurance, 100, 0.0001, "stamina frame records frame max endurance");
approx(frame.frameEnduranceProgress, 0.25, 0.0001, "stamina frame records frame endurance progress");
assert(frame.framePhase === "stamina", "stamina frame records frame phase");

let runtime = createController({ phase: "stamina", stamina: 100 });
runtime.controller.evaluate({
  staminaFrame: frame,
  dt: 1000,
});
approx(runtime.condition.currentStamina, 50, 0.0001, "StaminaController applies active stamina frame damage");

runtime = createController({ phase: "stamina", stamina: 50 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "stamina",
    appliedRodHoldKg: 0,
    weakestTackleLimitKg: 1,
    lineAngleDeg: 15,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
approx(runtime.condition.currentStamina, 70, 0.0001, "StaminaController applies passive stamina regen");

runtime = createController({ phase: "stamina", stamina: 100, endurance: 20 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "stamina",
    appliedRodHoldKg: 0.2,
    weakestTackleLimitKg: 1,
    lineAngleDeg: 15,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "stamina",
    appliedRodHoldKg: 0,
    weakestTackleLimitKg: 1,
    lineAngleDeg: 90,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
approx(runtime.condition.currentStamina, 100, 0.0001, "frame stamina can fully recover in phase 1");
approx(runtime.condition.currentExhaustion, 50, 0.0001, "full stamina smoothly recovers endurance in phase 1");
approx(runtime.condition.punishmentCalls, 0, 0.0001, "frame stamina path does not call legacy recovery punishment");
approx(runtime.fish.powerRatioByEnduranceCalls, 1, 0.0001, "frame stamina endurance recovery synchronizes power ratio");
approx(runtime.fish.lastPowerRatioEnduranceRatio, 0.5, 0.0001, "recovered endurance ratio feeds power sync");

runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "stamina",
    appliedRodHoldKg: 0,
    weakestTackleLimitKg: 1,
    lineAngleDeg: 90,
    dtSec: 2,
    config: mechanicsConfig,
  }),
  dt: 2000,
});
approx(runtime.condition.currentExhaustion, 80, 0.0001, "endurance recovery is capped by maxRecoveryRatio");

runtime = createController({ phase: "stamina", stamina: 10 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "stamina",
    appliedRodHoldKg: 1,
    weakestTackleLimitKg: 1,
    lineAngleDeg: 15,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
assert(runtime.condition.phase === "exhaustion", "stamina = 0 transitions to exhaustion phase");

runtime = createController({ phase: "exhaustion", endurance: 100 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0.5,
    lineTaut: true,
    lineTautRatio: 1,
    weakestTackleLimitKg: 1,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
approx(runtime.condition.currentExhaustion, 60, 0.0001, "phase exhaustion active pressure reduces endurance");
approx(runtime.fish.powerRatioByEnduranceCalls, 1, 0.0001, "frame endurance path synchronizes power ratio from endurance ratio");
approx(runtime.fish.powerDebuffByRatioCalls, 0, 0.0001, "frame endurance path does not use legacy duration-based power sync");
approx(runtime.fish.lastPowerRatioEnduranceRatio, 0.6, 0.0001, "power ratio sync uses currentExhaustion / maxEndurance");
approx(runtime.fish.powerDebuff, 0.32, 0.0001, "power debuff scales linearly from endurance ratio and min power ratio");
approx(runtime.fish.applyPowerDebuffCalls, 0, 0.0001, "frame endurance path does not use incremental legacy power debuff");

runtime = createController({ phase: "exhaustion", endurance: 100 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0.5,
    lineTaut: false,
    lineTautRatio: 0,
    weakestTackleLimitKg: 1,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
assert(runtime.condition.phase === "stamina", "slack line returns exhaustion phase back to stamina");
approx(runtime.condition.currentExhaustion, 100, 0.0001, "slack phase rollback freezes endurance on rollback frame");

runtime = createController({ phase: "exhaustion", endurance: 100 });
for (let i = 0; i < 4; i += 1) {
  runtime.controller.evaluate({
    staminaFrame: balanceFactory.create({
      phase: "exhaustion",
      appliedRodHoldKg: 0,
      lineTaut: true,
      lineTautRatio: 1,
      weakestTackleLimitKg: 1,
      dtSec: 1,
      config: mechanicsConfig,
    }),
    dt: 1000,
  });
}
assert(runtime.condition.phase === "exhaustion", "no-pressure phase rollback waits for configured timeout");
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0,
    lineTaut: true,
    lineTautRatio: 1,
    weakestTackleLimitKg: 1,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
assert(runtime.condition.phase === "stamina", "no-pressure timeout returns exhaustion phase back to stamina");
approx(runtime.condition.currentExhaustion, 100, 0.0001, "no-pressure rollback preserves current endurance");

runtime = createController({ phase: "exhaustion", endurance: 100 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0.05,
    lineTaut: true,
    lineTautRatio: 1,
    weakestTackleLimitKg: 1,
    dtSec: 5,
    config: mechanicsConfig,
  }),
  dt: 5000,
});
assert(runtime.condition.phase === "stamina", "pressure threshold also uses weakest tackle ratio");

runtime = createController({ phase: "exhaustion", endurance: 100 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0,
    lineTaut: true,
    lineTautRatio: 1,
    weakestTackleLimitKg: 1,
    dtSec: 4000,
    config: mechanicsConfig,
  }),
  dt: 4000,
});
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0.2,
    lineTaut: true,
    lineTautRatio: 1,
    weakestTackleLimitKg: 1,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0,
    lineTaut: true,
    lineTautRatio: 1,
    weakestTackleLimitKg: 1,
    dtSec: 4000,
    config: mechanicsConfig,
  }),
  dt: 4000,
});
assert(runtime.condition.phase === "exhaustion", "effective pressure resets no-pressure rollback timer");

runtime = createController({ phase: "exhaustion", endurance: 100 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 0.5,
    fishWonRadialForceKg: 1,
    dragBlockedForceKg: 1,
    lineTautRatio: 1,
    fishBehaviorName: "dash",
    weakestTackleLimitKg: 1,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
approx(runtime.condition.currentExhaustion, 45, 0.0001, "active and passive endurance drain are summed");

runtime = createController({ phase: "exhaustion", endurance: 10 });
runtime.controller.evaluate({
  staminaFrame: balanceFactory.create({
    phase: "exhaustion",
    appliedRodHoldKg: 1,
    fishWonRadialForceKg: 1,
    dragBlockedForceKg: 1,
    lineTautRatio: 1,
    fishBehaviorName: "dash",
    weakestTackleLimitKg: 1,
    dtSec: 1,
    config: mechanicsConfig,
  }),
  dt: 1000,
});
approx(runtime.condition.currentExhaustion, 0, 0.0001, "endurance can drain to zero");
assert(runtime.fish.randomDebuffApplied, "endurance = 0 triggers final debuff");

const source = StaminaController.toString();
assert(!source.includes("fishWonRadialForceKg / weakestTackleLimitKg"), "StaminaController does not contain resisted-effort physics formula");
assert(!source.includes("dragBlockedForceKg /"), "StaminaController does not calculate resistance physics formula");

const weakest = new WeakestTackleLimitResolver().resolve({
  rod: { maxLoadKg: 1.5 },
  line: { maxLoadKg: 1.2 },
  leader: { maxLoadKg: 0.8 },
  hook: { maxLoadKg: 1.1 },
  reel: null,
});
approx(weakest.weakestTackleLimitKg, 0.8, 0.0001, "float rod weakest limit ignores missing reel and uses active components");

const lineSystem = new LineSystem({ lineLengthMeters: 6 });
lineSystem.resetAfterCast?.({ castDistanceMeters: 3 });
let lineState = lineSystem.getState?.() || {};
assert(!lineState.isFullyExtended, "line is not fully extended at cast distance 3m with 6m available and no pull/control");

console.log("stamina-balance-check passed:\\n- " + checks.join("\\n- "));
`,
  context,
);
