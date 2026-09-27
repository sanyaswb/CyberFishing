"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
const frames = (count, dt) => Array.from({ length: count }, () => dt);
// Mixed frame rates: the same scenario at 60 fps, 30 fps and an uneven sequence with a zero frame.
const DT_SEQUENCES = Object.freeze([frames(6, 1 / 60), frames(3, 1 / 30), [0.016, 0.05, 0, 0.033, 0.1]]);

// Batch 034: the hot-loop fishing cluster. Every case drives per-frame updates with explicit
// deltaTime sequences, so classic, temporary ESM and post-cutover ESM must agree frame by frame.
const EXECUTABLE_CASES = Object.freeze({
  PlayerReelFatigueSession: Object.freeze({
    "latch-start-end-and-frozen-state": Session => {
      const session = new Session();
      const inputs = [{}, { playerHoldActive: true }, { playerHoldActive: true, reelHoldEngagedThisFrame: true },
        { playerHoldActive: true }, { playerHoldActive: true, fightActive: false }, { playerHoldActive: false },
        { playerHoldActive: true, reelHoldEngagedThisFrame: true }, { playerHoldActive: "yes", reelHoldEngagedThisFrame: true }];
      const states = inputs.map(input => session.update(input));
      const frozen = states.every(state => Object.isFrozen(state));
      session.reset();
      return { states: snapshot(states), frozen, afterReset: snapshot(session.getState()), fresh: session.getState() !== session.getState() };
    },
  }),
  ReelHoldRecoverySystem: Object.freeze({
    "hold-recovery-timer-over-frame-rates": System => DT_SEQUENCES.map(sequence => {
      const system = new System();
      const config = { delayMs: 40, strokeRatio: 1, strokeRatioTolerance: 0.01, requireRodStrokeFull: true };
      return sequence.map((dtSec, index) => snapshot(system.update({ dtMs: dtSec * 1000, config, hasReel: true,
        playerHoldActive: index !== 2, rodPullActive: true, strokeRatio: index % 2 ? 1 : 0.995, rawTensionKg: 2,
        dragLimitKg: 5, dragLocked: true, shouldSlipDrag: false, reelMaxLoadKg: 8,
        retrieveSpeedMetersPerSecond: 0.6, lineRecoverableMeters: 3 })));
    }),
    "blocked-reasons-and-defaults": System => {
      const system = new System();
      return [system.update(), system.update({ dtMs: 16, hasReel: false, playerHoldActive: true }),
        system.update({ dtMs: 16, hasReel: true, playerHoldActive: true, rodPullActive: false, strokeRatio: 1 }),
        system.update({ dtMs: 16, hasReel: true, playerHoldActive: true, rodPullActive: true, strokeRatio: 0.2,
          rawTensionKg: 9, dragLimitKg: 5, reelMaxLoadKg: 8, lineRecoverableMeters: 0 })].map(snapshot);
    },
  }),
  ReelRecoveryFishSlowdownPolicy: Object.freeze({
    "slowdown-state-in-place-and-multipliers": Policy => {
      const policy = new Policy();
      const target = policy.createState();
      const results = [
        policy.update({ target, autoRecoveredMeters: 0.2, config: { fishSpeedMultiplier: 0.4 } }),
        policy.update({ target, holdRecoveredMeters: 0.1 }), policy.update({ target, autoRecoveredMeters: 0.1, holdRecoveredMeters: 0.1 }),
        policy.update({ target, autoRecoveredMeters: 0.0000001 }), policy.update({ autoRecoveredMeters: -1, holdRecoveredMeters: "x" }),
      ].map(snapshot);
      return { results, sameTarget: policy.update({ target, autoRecoveredMeters: 1 }) === target,
        multipliers: [policy.getMotionMultiplier(target), policy.getMotionMultiplier(null),
          policy.getMotionMultiplier({ active: true, multiplier: -2 }), policy.getMotionMultiplier({ active: true, multiplier: "x" })],
        reset: snapshot(policy.reset(target)), resetFresh: snapshot(policy.reset()) };
    },
  }),
  TackleStressAccumulator: Object.freeze({
    "stress-accumulation-roll-timer-over-frame-rates": Accumulator => DT_SEQUENCES.map(sequence => {
      const accumulator = new Accumulator();
      let seed = 0.37;
      const rng = () => { seed = (seed * 9301 + 49297) % 233280 / 233280; return seed; };
      const config = { stress: { capacity: 1, baseGainPerSecond: 0.9, recoveryPerSecond: 0.3, minStressToRoll: 0.01 },
        failureRoll: { intervalMs: 30, chanceScale: 1 } };
      return sequence.map((dtSec, index) => snapshot(accumulator.update({ effectiveTensionKg: index === 3 ? 1 : 6,
        mainTackleLimitKg: 4, dtSec, config, rng })));
    }),
    "guaranteed-failure-defaults-and-reset": Accumulator => {
      const accumulator = new Accumulator();
      accumulator.setStressValue(5);
      const guaranteed = accumulator.update({ effectiveTensionKg: 5, mainTackleLimitKg: 1, dtSec: 0.1,
        config: { stress: { capacity: 1 } }, rng: { next: () => 0.99 } });
      const ratio = accumulator.getStressRatio(2);
      accumulator.reset();
      return { guaranteed: snapshot(guaranteed), ratio, empty: snapshot(accumulator.update()),
        chance: [accumulator.calculateFailureChance({ stressRatio: 0.4, chanceScale: 2 }), accumulator.calculateFailureChance()],
        debug: snapshot(accumulator.getDebugData({ capacity: 2 })), value: accumulator.getStressValue() };
    },
  }),
  PlayerPullMotionSmoother: Object.freeze({
    "inertia-smoothing-over-frame-rates": Smoother => DT_SEQUENCES.map(sequence => {
      const smoother = new Smoother();
      const moves = sequence.map((deltaTime, index) => snapshot(smoother.update({ desiredMoveX: index % 2 ? 0.02 : -0.01,
        desiredMoveY: 0.005, deltaTime, config: { inertiaSeconds: 0.08 } })));
      smoother.reconcileAxis({ axis: "x", appliedMove: 0.001, deltaTime: sequence[0], blocked: true });
      smoother.reconcileAxis({ axis: "y", appliedMove: 0.5, deltaTime: 0, blocked: false });
      return { moves, debug: snapshot(smoother.getDebugData()) };
    }),
    "debug-identity-reset-and-axis-reset": Smoother => {
      const smoother = new Smoother();
      const debug = smoother.getDebugData();
      const axis = smoother.updateAxis({ axis: "y", desiredMove: 0.3, deltaTime: 0.02, config: {} });
      smoother.resetAxis("y");
      const sameDebug = smoother.getDebugData() === debug;
      smoother.reset();
      return { axis: snapshot(axis), sameDebugUntilReset: sameDebug, newDebugAfterReset: smoother.getDebugData() !== debug,
        empty: snapshot(smoother.update({ desiredMoveX: "x" })), debug: snapshot(smoother.getDebugData()) };
    },
  }),
  RodLateralControlSystem: Object.freeze({
    "rod-control-frames-over-frame-rates": System => DT_SEQUENCES.map(sequence => {
      const system = new System();
      const config = { enabled: true, maxAngleDeg: 60, controlBuildPerSecond: 3, forceRatio: 0.5 };
      const frames = sequence.map((dtSec, index) => {
        const inputState = { rodControlActive: index !== 1, rodControlDirectionX: index % 3 === 2 ? 1 : -1,
          rodControlInputRatio: 0.8 };
        const frame = { dtSec, inputState, fishPosition: { x: 40 + index * 5, y: 120 }, rodTipPosition: { x: 0, y: 0 },
          baseRodTipPosition: { x: 0, y: 0 }, actualRodTipPosition: { x: index, y: 0 }, rodLimitKg: 6, maxTackleLoadKg: 5,
          currentTensionKg: 2.5, fishTensionKg: 2, fishVelocity: { x: -1, y: 0.5 }, fishVelocityX: -1,
          playerForceBudget: 4, dragLimitKg: 4, dragLocked: index !== 3, lineHasReserve: true, config };
        const result = snapshot(system.update(frame));
        system.recordAppliedMovement({ movedMeters: 0.01 * index, movedPx: index });
        return { result, state: snapshot(system.getState()) };
      });
      return frames;
    }),
    "intent-disabled-and-reset": System => {
      const system = new System();
      const intent = system.resolveIntent({ inputState: { rodControlActive: true, rodControlDirectionX: 2, rodControlInputRatio: 3 },
        fishPosition: { x: -30, y: 50 }, rodTipPosition: { x: 0, y: 0 }, config: {} });
      const disabled = system.update({ dtSec: 0.016, config: { enabled: false } });
      system.reset();
      return { intent: snapshot(intent), frozenIntent: Object.isFrozen(intent), disabled: snapshot(disabled),
        reset: snapshot(system.getState()), empty: snapshot(system.update({ dtSec: 0.02 })) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    PlayerReelFatigueSession: ["latch-start-end-and-frozen-state"],
    ReelHoldRecoverySystem: ["hold-recovery-timer-over-frame-rates", "blocked-reasons-and-defaults"],
    ReelRecoveryFishSlowdownPolicy: ["slowdown-state-in-place-and-multipliers"],
    TackleStressAccumulator: ["stress-accumulation-roll-timer-over-frame-rates", "guaranteed-failure-defaults-and-reset"],
    PlayerPullMotionSmoother: ["inertia-smoothing-over-frame-rates", "debug-identity-reset-and-axis-reset"],
    RodLateralControlSystem: ["rod-control-frames-over-frame-rates", "intent-disabled-and-reset"],
  },
  compatibilityCases: [
    "six-representation-only-named-esm-targets-and-six-exact-exports",
    "three-exact-completed-prefix-imports-bound-to-the-cumulative-instances",
    "three-owner-created-composition-identities-preserved",
    "reviewed-guarded-window-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "six-exact-classic-activations-at-their-legacy-positions",
    "six-exact-classic-consumer-relationships-and-three-retired-bridges",
    "three-consumerless-activations-retired-as-inert-classic-placeholders",
    "recorded-hot-loop-evidence-resolves-every-performance-prerequisite",
    "post-cutover-member-fingerprints-allocation-sites-and-game-cycle-traces-equal",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
