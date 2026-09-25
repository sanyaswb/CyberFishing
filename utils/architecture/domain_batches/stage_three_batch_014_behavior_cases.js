"use strict";

const assert = require("node:assert/strict");

const liftFrame = (overrides = {}) => ({ inLandingZone: true, playerHoldActive: true,
  active: true, liftMaxKg: 2, liftHoldKg: 2, ...overrides });
const tensionFrame = (overrides = {}) => ({ supportedTensionKg: 2.5, rawTensionKg: 3,
  visibleTensionKg: 2.75, ...overrides });

const BATCH_014_EXECUTABLE_CASES = Object.freeze({
  LandingLiftReadinessPolicy: Object.freeze({
    "readiness-reason-ladder": Policy => {
      const policy = new Policy();
      const results = [
        policy.evaluate({ landingLiftFrame: liftFrame(), tensionFrame: tensionFrame() }),
        policy.evaluate({ landingLiftFrame: liftFrame({ inLandingZone: false }), tensionFrame: tensionFrame() }),
        policy.evaluate({ landingLiftFrame: liftFrame({ playerHoldActive: false }), tensionFrame: tensionFrame() }),
        policy.evaluate({ landingLiftFrame: liftFrame({ active: false }), tensionFrame: tensionFrame() }),
        policy.evaluate({ landingLiftFrame: liftFrame({ liftHoldKg: 1 }), tensionFrame: tensionFrame() }),
        policy.evaluate({ landingLiftFrame: liftFrame(),
          tensionFrame: tensionFrame({ supportedTensionKg: 1, shouldSlipDrag: true }) }),
        policy.evaluate({ landingLiftFrame: liftFrame(),
          tensionFrame: { totalTensionKg: 1, rawTotalTensionKg: 4, tensionKg: 1.5 } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "disabled-invalid-and-epsilon-edges": Policy => {
      const policy = new Policy();
      const results = [
        policy.evaluate({ config: { enabled: false } }),
        policy.evaluate(),
        policy.evaluate({ landingLiftFrame: liftFrame({ liftHoldKg: 1.9995 }),
          tensionFrame: tensionFrame({ supportedTensionKg: 1.9995 }) }),
        policy.evaluate({ landingLiftFrame: liftFrame({ liftMaxKg: "bad", liftHoldKg: -3 }),
          tensionFrame: tensionFrame({ dragSlipping: true }), epsilonKg: "bad", config: null }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  PlayerPressureFatigueState: Object.freeze({
    "defaults-apply-frame-and-reset": State => {
      const state = new State();
      const defaults = state.toFrame();
      state.applyFrame({ enabled: true, efficiency: 0.4, pressureHoldMs: 1200, recoveryIdleMs: 50,
        recoveryState: "recovering", stateName: "fatigue", pressureActive: true, pressureKg: 3.5,
        fatigueRatio: 0.3, fatigueProgress: 0.6, sourceMode: "reel_hold_session", sourceActive: true,
        sourceReason: "reel_hold_active", graceElapsedMs: 3000, graceDurationMs: 2500,
        fatigueElapsedMs: 900, fatigueDurationMs: 5000, recoveryDelayMs: 250,
        recoveryProgress: 0.1, controlBreakEnabled: true, isControlExhausted: true,
        controlBreakFatigueProgressThreshold: 0.8, controlBreakMinContinuousPressureMs: 6000,
        delayAfterPressureMs: 100, recoveryPerSecond: 0.2 });
      const applied = state.toFrame();
      const ownFields = Object.keys(state).sort();
      state.reset();
      const reset = state.toFrame();
      assert(Object.isFrozen(defaults) && Object.isFrozen(applied) && Object.isFrozen(reset));
      assert.deepEqual(reset, defaults);
      return { defaults, applied, reset, ownFields };
    },
    "fallbacks-clamps-and-alias-fields": State => {
      const state = new State();
      state.applyFrame({ efficiency: 5, pressureHoldMs: -1, fatigueRatio: -2, fatigueProgress: "bad",
        holdElapsedMs: undefined, graceDurationMs: "bad", fatigueDurationMs: -5,
        delayAfterPressureMs: 700, controlBreakFatigueRatioThreshold: 2,
        controlBreakMinContinuousPressureMs: NaN, recoveryState: "", stateName: null });
      const aliased = state.toFrame();
      state.applyFrame();
      return [aliased, state.toFrame(), state.enabled, state.recoveryDelayMs];
    },
  }),
  PlayerTensionBuildRateResolver: Object.freeze({
    "mode-multipliers-and-thresholds": Resolver => {
      const config = { enabled: true, multipliers: { holdAndControl: 2, holdOnly: 1.25,
        controlOnly: 0.75, none: 0.5 }, inputThresholds: { holdForceKg: 0.5, controlForceKg: 0.5,
        holdInputRatio: 0.1, controlInputRatio: 0.1 }, rodControlBuildPerSecond: 6,
        applyTo: { rodHoldCharge: false } };
      const resolver = new Resolver(config);
      const input = { holdActive: true, controlActive: true, holdForceKg: 1, controlForceKg: 1,
        holdInputRatio: 0.5, controlInputRatio: 0.5 };
      const results = [resolver.resolve(input),
        resolver.resolve({ ...input, controlActive: false }),
        resolver.resolve({ ...input, holdActive: false }),
        resolver.resolve({ ...input, holdForceKg: 0.1, controlInputRatio: 0.01 }),
        resolver.resolve()];
      assert(results.every(result => Object.isFrozen(result) && Object.isFrozen(result.applyTo)));
      return results;
    },
    "constructor-and-call-config-precedence": Resolver => {
      const constructed = new Resolver({ enabled: true, multipliers: { holdOnly: 3 } });
      const input = { holdActive: true, holdForceKg: 2, holdInputRatio: 1 };
      const results = [constructed.resolve(input),
        constructed.resolve({ ...input, config: { enabled: false } }),
        new Resolver(null).resolve(input),
        new Resolver().resolve({ ...input, config: { enabled: true,
          multipliers: { holdOnly: -1 }, rodControlBuildPerSecond: "bad" } })];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  StaminaDrainCalculator: Object.freeze({
    "advantage-curve-drain": Calculator => {
      const calculator = new Calculator();
      const results = [
        calculator.calculate({ playerStaminaPressureKg: 3, fishStaminaResistanceKg: 1, dtSec: 0.016 }),
        calculator.calculate({ playerStaminaPressureKg: 1, fishStaminaResistanceKg: 3, dtSec: 0.5,
          baseDrainPerSecond: 40, config: { advantageDrain: { minAdvantageRatio: 0.2,
            maxAdvantageRatio: 0.8, minDrainMultiplier: 0.1, maxDrainMultiplier: 2, curvePower: 2 } } }),
        calculator.calculate({ playerStaminaPressureKg: 5, fishStaminaResistanceKg: 0, dtSec: 1,
          config: { advantageDrain: { enabled: false } } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "threshold-disabled-and-invalid-inputs": Calculator => {
      const calculator = new Calculator();
      const results = [calculator.calculate(),
        calculator.calculate({ playerStaminaPressureKg: 0.005, dtSec: 1 }),
        calculator.calculate({ playerStaminaPressureKg: 2, dtSec: 1, config: { enabled: false } }),
        calculator.calculate({ playerStaminaPressureKg: "bad", fishStaminaResistanceKg: -1,
          pressureThresholdKg: -1, baseDrainPerSecond: "bad", dtSec: -1 }),
        calculator.calculate({ playerStaminaPressureKg: 2, fishStaminaResistanceKg: 2, dtSec: 1,
          config: { advantageDrain: { minAdvantageRatio: 2, maxAdvantageRatio: -1,
            minDrainMultiplier: -1, maxDrainMultiplier: "bad", curvePower: 0 } } })];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  StaminaTransitionResolver: Object.freeze({
    "stamina-to-exhaustion-and-recovery": Resolver => {
      const resolver = new Resolver();
      const config = { regen: { afterExhaustion: { phaseReturnThresholdRatio: 0.25 } } };
      const results = [
        resolver.resolve({ phase: "stamina", currentStamina: 0, maxStamina: 100, config }),
        resolver.resolve({ phase: "exhaustion", currentStamina: 30, maxStamina: 100,
          playerFatigueProgress: 1, config }),
        resolver.resolve({ phase: "EXHAUSTION ", currentStamina: 10, maxStamina: 100,
          controlExhausted: true, recoveryTrigger: "control", config }),
        resolver.resolve({ phase: "exhaustion", currentStamina: 10, maxStamina: 100,
          staminaNoInputRecoveryReady: true, recoveryTrigger: "", config }),
        resolver.resolve({ phase: "stamina", currentStamina: 50, maxStamina: 100, config }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "locked-phase-and-invalid-inputs": Resolver => {
      const resolver = new Resolver();
      const results = [resolver.resolve(),
        resolver.resolve({ phase: "exhaustion", currentStamina: 50, maxStamina: 100 }),
        resolver.resolve({ phase: "exhaustion", currentStamina: 1, maxStamina: 100,
          staminaRecoveryFromExhaustionActive: true }),
        resolver.resolve({ phase: "exhaustion", currentStamina: 5, maxStamina: 100,
          playerFatigueProgress: 1, config: { regen: { afterExhaustion: { phaseReturnThresholdRatio: 0 } } } }),
        resolver.resolve({ phase: null, currentStamina: "bad", maxStamina: -5,
          playerFatigueProgress: "bad", config: { regen: null } })];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  TackleFailureSelector: Object.freeze({
    "weakest-component-and-tie-break": Selector => {
      const selector = new Selector();
      return [
        selector.select({ leaderMaxLoadKg: 8, lineMaxLoadKg: 5, hookMaxLoadKg: 12,
          rodMaxLoadKg: 9, reelMaxLoadKg: 7 }),
        selector.select({ lineMaxLoadKg: 5, rodMaxLoadKg: 5, reelMaxLoadKg: 5 }),
        selector.select({ lineMaxLoadKg: 5, rodMaxLoadKg: 5, reelMaxLoadKg: 5,
          tieBreakPriority: ["reel", "unknown", "rod"] }),
        selector.select({ leaderMaxLoadKg: "4", lineMaxLoadKg: -1, hookMaxLoadKg: NaN,
          rodMaxLoadKg: 6, reelMaxLoadKg: Infinity }),
      ];
    },
    "static-frozen-tables-and-fallback": Selector => {
      assert(Object.isFrozen(Selector.DEFAULT_TIE_BREAK_PRIORITY));
      assert(Object.isFrozen(Selector.RESULT_BY_COMPONENT));
      const selector = new Selector();
      const fallback = selector.select({ lineMaxLoadKg: 0, rodMaxLoadKg: 0,
        tieBreakPriority: "invalid" });
      const defaultResult = selector.select();
      assert.notEqual(fallback.tieBreakPriority, Selector.DEFAULT_TIE_BREAK_PRIORITY);
      return { priority: Array.from(Selector.DEFAULT_TIE_BREAK_PRIORITY),
        results: { ...Selector.RESULT_BY_COMPONENT },
        staticKeys: Object.getOwnPropertyNames(Selector).filter(name =>
          !["length", "name", "prototype"].includes(name)).sort(),
        fallback, defaultResult };
    },
  }),
});

module.exports = { BATCH_014_EXECUTABLE_CASES };
