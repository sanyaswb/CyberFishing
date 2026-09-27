"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const staminaConfig = {
  pressure: { thresholdKg: 0.2, inputWeights: { rodHold: 1, reelHold: 0.5, control: 0.8 } },
  drain: { baseDrainPerSecond: 12 },
  regen: { baseRegenPerSecond: 8,
    beforeExhaustion: { immediateOnNoPressure: true, allowWhenPlayerFatigueFull: true },
    afterExhaustion: { allowOnlyWhenPlayerFatigueFull: true, inactivityRecovery: { enabled: true, timeoutMs: 300 } } },
  endurance: { activeDrainPerSecond: 3, passiveDrainPerSecond: 1 },
};

// Batch 031: the stamina balance frame combines the phase machine and the endurance drains per frame.
const EXECUTABLE_CASES = Object.freeze({
  StaminaBalanceFrame: Object.freeze({
    "fight-frames-with-pressure-exhaustion-endurance-and-clock": Frame => {
      const balance = new Frame();
      const frames = [];
      let stamina = 100;
      let exhaustion = 0;
      let phase = "stamina";
      const step = fields => {
        const frame = balance.create({ phase, currentStamina: stamina, maxStamina: 100, currentExhaustion: exhaustion,
          maxEndurance: 50, dtSec: 0.1, config: staminaConfig, fishLateralContext: { lateralOffsetPx: 50, halfWidthPx: 200 },
          weakestTackleLimitKg: 8, fishTensionKg: 3, lineTaut: true, lineTautRatio: 0.7, ...fields });
        stamina = Number.isFinite(frame.staminaAfter) ? frame.staminaAfter : stamina;
        exhaustion = Number.isFinite(frame.currentExhaustion) ? frame.currentExhaustion : exhaustion;
        phase = frame.nextPhase || phase;
        frames.push(snapshot(frame));
      };
      for (let index = 0; index < 5; index++) step({ playerIsPulling: true, appliedRodHoldKg: 4, appliedReelHoldKg: 2,
        appliedControlKg: 1, controlDirectionX: -1, rawStaminaInputActive: true, fishStaminaResistanceKg: 2.5,
        playerFatigueProgress: 0.3, lineAngleDeg: 25, fishBehaviorName: "run" });
      step({ rawStaminaInputActive: false, playerFatigueProgress: 0.6, shouldSlipDrag: true, dragBlockedForceKg: 1.5 });
      for (let index = 0; index < 4; index++) step({ phase: "exhausted", playerPressureControlExhausted: true,
        playerFatigueProgress: 1, isLineFullyExtended: index === 2, fishWonRadialForceKg: 2, hardLineLimit: index === 3 });
      step({ nowMs: 5000, phase: "stamina" });
      return frames;
    },
    "defaults-and-invalid-inputs": Frame => {
      const balance = new Frame();
      const empty = balance.create();
      return { empty: snapshot(empty), frozen: Object.isFrozen(empty),
        invalid: snapshot(balance.create({ currentStamina: -3, maxStamina: 0, dtSec: -1, config: null, phase: 7 })) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    StaminaBalanceFrame: ["fight-frames-with-pressure-exhaustion-endurance-and-clock", "defaults-and-invalid-inputs"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "three-exact-imports-including-one-earlier-batch-export-bound-to-the-cumulative-instances",
    "three-owner-created-composition-identities-preserved",
    "reviewed-guarded-window-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "one-exact-classic-consumer-relationship-and-three-retired-bridges",
    "three-consumerless-activations-retired-as-inert-classic-placeholders",
    "per-frame-balance-state-clock-and-allocation-sites-preserved",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
