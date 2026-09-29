"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const MESSAGES = Object.freeze({ inventoryCapacityExceeded: "Недостатньо місця в інвентарі." });
const TRANSITIONS = [
  undefined, {}, { incomingRootInstanceIds: ["a", "b", "a", null, ""], outgoingRootInstanceIds: ["c"] },
  { incomingConceptualCellCount: 3, outgoingConceptualCellCount: 0, incomingRootInstanceIds: ["x"] },
  { incomingConceptualCellCount: -1, outgoingConceptualCellCount: 2.5, outgoingRootInstanceIds: ["y", "y"] },
];

// A recording stand-in for the fight condition (FishCondition) and the fish the controller drives.
const fightWorld = ({ phase = "stamina", stamina = 100, exhaustion = 50, maxStamina = 100, maxEndurance = 100,
  withExhaustionRegen = true, hasActiveDebuff = false } = {}) => {
  const calls = [];
  const condition = {
    phase, currentStamina: stamina, currentExhaustion: exhaustion, maxStamina, maxEndurance,
    applyStaminaDamage(value) { calls.push(["staminaDamage", value]); this.currentStamina -= value; },
    applyStaminaRegen(value) { calls.push(["staminaRegen", value]); this.currentStamina += value; },
    applyExhaustionDamage(value) { calls.push(["exhaustionDamage", value]); this.currentExhaustion -= value; },
    applyExhaustionStaminaRegen(value) { calls.push(["exhaustionStaminaRegen", value]); },
    breakExhaustion() { calls.push(["breakExhaustion"]); this.phase = "stamina"; },
    restoreFull() { calls.push(["restoreFull"]); },
  };
  if (withExhaustionRegen) {
    condition.applyExhaustionRegen = function applyExhaustionRegen(amount, cap) {
      calls.push(["exhaustionRegen", amount, cap]); this.currentExhaustion = Math.min(cap, this.currentExhaustion + amount);
    };
  }
  const fish = {
    hasActiveDebuff,
    clearDebuff() { calls.push(["clearDebuff"]); },
    clearMasteryDebuff() { calls.push(["clearMasteryDebuff"]); },
    setMasteryMultiplier(value) { calls.push(["mastery", value]); },
    setPowerRatioByEnduranceRatio(ratio, minimum, curve) { calls.push(["powerRatio", ratio, minimum, curve]); },
    applyRandomDebuff(debuffs) { calls.push(["randomDebuff", debuffs]); this.hasActiveDebuff = true; },
  };
  return { calls, condition, fish };
};
const CONFIG = Object.freeze({ masteryTimeRatio: 0.5, masteryPowerMultiplier: 0.2, debuffs: { swimPullMult: 0.75 },
  enduranceDrain: { active: { drainPerSecond: 80 }, passive: { drainPerSecond: 15, defaultBehaviorMultiplier: 0.5 } },
  enduranceRecovery: { enabled: true, recoveryPerSecond: 30, maxRecoveryRatio: 0.8 },
  powerDebuff: { enabled: true, minBasePowerRatio: 0.2, curvePower: 1.5 } });
const frame = fields => ({ source: "stamina_balance_frame", ...fields });

// Batch 039: the inventory capacity policies and the fight StaminaController.
const EXECUTABLE_CASES = Object.freeze({
  InventoryCapacityPolicy: Object.freeze({
    "abstract-contract": Policy => ({
      error: attempt(() => new Policy().evaluateTransition({ incomingRootInstanceIds: ["a"] })),
      errorWithoutContext: attempt(() => new Policy().evaluateTransition()),
      methods: Object.getOwnPropertyNames(Policy.prototype).sort(),
    }),
  }),
  UnlimitedInventoryCapacityPolicy: Object.freeze({
    "transition-cell-counts": Policy => {
      const policy = new Policy();
      const inputs = TRANSITIONS.map(item => (item ? snapshot(item) : item));
      const results = inputs.map(item => policy.evaluateTransition(item));
      return {
        results: results.map(snapshot),
        frozen: results.every(result => Object.isFrozen(result)),
        inputsUnchanged: inputs.every((item, index) => JSON.stringify(item) === JSON.stringify(TRANSITIONS[index])),
        repeated: snapshot(policy.evaluateTransition(TRANSITIONS[2])),
        distinctResults: policy.evaluateTransition() !== policy.evaluateTransition(),
      };
    },
    "inheritance-and-bad-input": Policy => ({
      methods: Object.getOwnPropertyNames(Policy.prototype).sort(),
      baseMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(Policy.prototype)).sort(),
      nullIds: attempt(() => new Policy().evaluateTransition({ incomingRootInstanceIds: null })),
      stringIds: attempt(() => new Policy().evaluateTransition({ incomingRootInstanceIds: "ab" })),
    }),
  }),
  DelegatingInventoryCapacityPolicy: Object.freeze({
    "delegated-results-and-warning": Policy => {
      const seen = [];
      const answers = [true, false, { allowed: false, warning: "custom", extra: 1 }, { allowed: true }, null, undefined,
        { warning: "only" }, 0];
      let index = 0;
      const policy = new Policy(context => { seen.push(snapshot(context)); return answers[index++]; }, { messages: MESSAGES });
      const results = answers.map((_, position) => policy.evaluateTransition(position === 5 ? undefined : { step: position }));
      return { results: results.map(snapshot), frozen: results.every(result => Object.isFrozen(result)), seen };
    },
    "constructor-contract": Policy => ({
      missing: attempt(() => new Policy()),
      notFunction: attempt(() => new Policy({})),
      noMessagesAllowed: attempt(() => new Policy(() => true).evaluateTransition({})),
      noMessagesDenied: attempt(() => new Policy(() => false).evaluateTransition({})),
      methods: Object.getOwnPropertyNames(Policy.prototype).sort(),
    }),
  }),
  StaminaController: Object.freeze({
    "stamina-phase-frames": Controller => {
      const world = fightWorld({ phase: "stamina", stamina: 60, exhaustion: 40 });
      const controller = new Controller(world.condition, world.fish, CONFIG);
      const frames = [frame({ staminaMode: "drain", activeStaminaDrain: 12, framePhase: "stamina", dtSec: 0.5 }),
        frame({ staminaMode: "drain", totalStaminaDrain: "7" }), frame({ staminaMode: "regen", passiveStaminaRegen: 50 }),
        frame({ staminaMode: "regen", staminaRegen: 5, framePhase: "stamina", dtSec: 1 }),
        frame({ staminaMode: "idle", phase: "stamina", dtSec: 2 }), { source: "other" }, null];
      for (const item of frames) controller.evaluate(item ? { staminaFrame: item, dt: 16 } : {});
      controller.evaluate(frame({ staminaMode: "drain", activeStaminaDrain: 3 }));
      return { calls: world.calls, stamina: world.condition.currentStamina, exhaustion: world.condition.currentExhaustion,
        last: snapshot(controller.getLastStaminaBalanceFrame()), timer: controller.getMasteryTimer(),
        mastery: controller.isMasteryActive() };
    },
    "exhaustion-phase-mastery-and-debuff": Controller => {
      const world = fightWorld({ phase: "exhaustion", stamina: 0, exhaustion: 30 });
      const controller = new Controller(world.condition, world.fish, CONFIG);
      const trace = [];
      for (const dt of [16, 500, 1000, 33, 250]) {
        controller.evaluate({ staminaFrame: frame({ staminaMode: "drain", totalEnduranceDrain: 8 }), dt });
        trace.push([controller.getMasteryTimer(), controller.isMasteryActive(), world.condition.currentExhaustion]);
      }
      world.condition.currentExhaustion = 0;
      for (const dt of [1000, 400, 800, 2000]) {
        controller.evaluate({ staminaFrame: frame({ staminaMode: "idle", enduranceTotalDrain: 0 }), dt });
        trace.push([controller.getMasteryTimer(), controller.isMasteryActive()]);
      }
      controller.evaluate({ staminaFrame: frame({ staminaMode: "regen", staminaRegen: 4, nextPhase: "stamina" }), dt: 16 });
      return { trace, calls: world.calls, duration: controller.getExhaustionDurationMs(), phase: world.condition.phase };
    },
    "recovery-duration-and-restore": Controller => {
      const results = [];
      for (const config of [CONFIG, {}, { enduranceDrain: { active: { enabled: false }, passive: { enabled: false } } },
        { enduranceRecovery: { enabled: true, requiresFullStamina: false, recoveryPerSecond: -5, maxRecoveryRatio: 2 } },
        { enduranceDrain: { active: { drainPerSecond: "x" }, passive: { drainPerSecond: 10, defaultBehaviorMultiplier: 2 } } }]) {
        const world = fightWorld({ stamina: 100, exhaustion: 10, maxEndurance: "50", withExhaustionRegen: config !== CONFIG });
        const controller = new Controller(world.condition, world.fish, config);
        controller.evaluate({ staminaFrame: frame({ staminaMode: "idle", framePhase: "stamina", dtSec: 0.25 }), dt: 250 });
        results.push({ duration: controller.getExhaustionDurationMs(), calls: world.calls });
      }
      const world = fightWorld({ phase: "exhaustion", exhaustion: 5 });
      const controller = new Controller(world.condition, world.fish, CONFIG);
      controller.evaluate({ staminaFrame: frame({ staminaMode: "drain", totalEnduranceDrain: 20 }), dt: 16 });
      controller.restoreFullStamina();
      results.push({ afterRestore: [controller.getMasteryTimer(), controller.isMasteryActive()], calls: world.calls });
      return results;
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    InventoryCapacityPolicy: ["abstract-contract"],
    UnlimitedInventoryCapacityPolicy: ["transition-cell-counts", "inheritance-and-bad-input"],
    DelegatingInventoryCapacityPolicy: ["delegated-results-and-warning", "constructor-contract"],
    StaminaController: ["stamina-phase-frames", "exhaustion-phase-mastery-and-debuff", "recovery-duration-and-restore"],
  },
  compatibilityCases: [
    "two-representation-only-named-esm-targets-and-four-exact-exports",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-their-legacy-positions",
    "five-exact-classic-consumer-relationships",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
