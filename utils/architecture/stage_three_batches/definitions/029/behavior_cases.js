"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const origin = { x: 400, y: 500 };
const sectorConfig = { maxAngleFromCenterDeg: 45, shoreOpeningWidthMeters: 2 };
const staminaConfig = {
  pressure: { thresholdKg: 0.2, inputWeights: { rodHold: 1, reelHold: 0.5, control: 0.8 } },
  drain: { baseDrainPerSecond: 12 },
  regen: { baseRegenPerSecond: 8,
    beforeExhaustion: { immediateOnNoPressure: true, allowWhenPlayerFatigueFull: true },
    afterExhaustion: { allowOnlyWhenPlayerFatigueFull: true, inactivityRecovery: { enabled: true, timeoutMs: 300 } } },
};

// Batch 029: pole fight sector angle constraint (delegates to its owned sector constraint without the
// radius) and the stamina phase machine (per-frame stamina drain/regen with recovery state).
const EXECUTABLE_CASES = Object.freeze({
  PoleFightSectorAngleConstraint: Object.freeze({
    "owned-constraint-angle-clamping-without-radius-and-reset": Constraint => {
      const constraint = new Constraint();
      const move = (from, to) => snapshot(constraint.resolveMovement({ fromPosition: from, proposedPosition: to,
        velocity: { x: 3, y: -4 }, origin, config: sectorConfig, limitRadiusPx: 300, pixelsPerMeter: 50 }));
      const results = [move({ x: 400, y: 350 }, { x: 420, y: 330 }), move({ x: 400, y: 350 }, { x: 700, y: 480 }),
        move({ x: 400, y: 350 }, { x: 150, y: 470 }), move({ x: 400, y: 350 }, { x: 400, y: 50 })];
      constraint.reset();
      return { results, afterReset: move({ x: 400, y: 350 }, { x: 410, y: 340 }) };
    },
    "injected-constraint-and-missing-constraint-fallback": Constraint => {
      const calls = [];
      const injected = new Constraint({ constraint: { resolveMovement: input => { calls.push(snapshot(input)); return { ok: true }; } } });
      const result = injected.resolveMovement({ fromPosition: { x: 1, y: 2 }, proposedPosition: { x: 3, y: 4 }, origin,
        config: sectorConfig, limitRadiusPx: 9 });
      const inert = new Constraint({ constraint: {} });
      return { result, calls, fallback: [inert.resolveMovement({ proposedPosition: { x: "7", y: null } }),
        inert.resolveMovement()], resetWithoutMethod: inert.reset() === undefined };
    },
  }),
  StaminaPhaseMachine: Object.freeze({
    "fight-frames-drain-exhaustion-recovery-and-no-input-timer": Machine => {
      const machine = new Machine();
      const frames = [];
      let stamina = 100;
      let phase = "stamina";
      const step = fields => {
        const frame = machine.createFrame({ phase, currentStamina: stamina, maxStamina: 100, dtSec: 0.1,
          config: staminaConfig, fishLateralContext: { lateralOffsetPx: 60, halfWidthPx: 200 }, ...fields });
        stamina = frame.staminaAfter;
        phase = frame.nextPhase;
        frames.push(snapshot(frame));
      };
      for (let index = 0; index < 6; index++) step({ rodHoldKg: 4, reelHoldKg: 2, controlKg: 1, controlDirectionX: -1,
        rawStaminaInputActive: true, fishStaminaResistanceKg: 2.5, playerFatigueProgress: 0.2, lineAngleDeg: 30 });
      step({ rodHoldKg: 0, reelHoldKg: 0, controlKg: 0, rawStaminaInputActive: false, playerFatigueProgress: 0.5 });
      for (let index = 0; index < 5; index++) step({ phase: "exhausted", currentStamina: 0, rawStaminaInputActive: false,
        playerFatigueProgress: 1, controlExhausted: true, lineAngleDeg: 10 });
      machine.reset();
      step({ phase: "unknown", rodHoldKg: 1, rawStaminaInputActive: true });
      return frames;
    },
    "defaults-invalid-inputs-and-frozen-frames": Machine => {
      const machine = new Machine();
      const empty = machine.createFrame();
      const invalid = machine.createFrame({ currentStamina: -5, maxStamina: 0, dtSec: Number.NaN,
        playerFatigueProgress: Number.POSITIVE_INFINITY, config: null });
      return { empty: snapshot(empty), invalid: snapshot(invalid), frozen: Object.isFrozen(empty),
        distinct: empty !== machine.createFrame() };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    PoleFightSectorAngleConstraint: ["owned-constraint-angle-clamping-without-radius-and-reset",
      "injected-constraint-and-missing-constraint-fallback"],
    StaminaPhaseMachine: ["fight-frames-drain-exhaustion-recovery-and-no-input-timer",
      "defaults-invalid-inputs-and-frozen-frames"],
  },
  compatibilityCases: [
    "two-representation-only-named-esm-targets-and-two-exact-exports",
    "five-exact-imports-including-two-earlier-batch-exports-bound-to-the-cumulative-instances",
    "five-owner-created-composition-identities-preserved",
    "reviewed-guarded-window-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-their-legacy-positions",
    "two-exact-classic-consumer-relationships-and-five-retired-bridges",
    "four-consumerless-stamina-activations-retired-as-inert-classic-placeholders",
    "per-frame-stamina-state-and-allocation-sites-preserved",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
