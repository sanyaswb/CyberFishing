"use strict";

const assert = require("node:assert/strict");

const snapshot = value => JSON.parse(JSON.stringify(value));
const sectorConfig = { maxAngleFromCenterDeg: 45, shoreOpeningWidthMeters: 2 };
const origin = { x: 400, y: 500 };

const BATCH_025_EXECUTABLE_CASES = Object.freeze({
  PoleFightSectorConstraint: Object.freeze({
    "default-geometry-clamping-recovery-and-frame-reuse": Constraint => {
      const constraint = new Constraint();
      const move = (from, to, extra = {}) => snapshot(constraint.resolveMovement({ fromPosition: from,
        proposedPosition: to, velocity: { x: 3, y: -4 }, origin, config: sectorConfig,
        limitRadiusPx: 300, pixelsPerMeter: 50, ...extra }));
      const first = constraint.resolveMovement({ fromPosition: { x: 400, y: 350 }, proposedPosition: { x: 410, y: 340 },
        origin, config: sectorConfig, limitRadiusPx: 300, pixelsPerMeter: 50 });
      const second = constraint.resolveMovement({ fromPosition: { x: 400, y: 350 }, proposedPosition: { x: 400, y: 300 },
        origin, config: sectorConfig, limitRadiusPx: 300, pixelsPerMeter: 50 });
      assert.strictEqual(first, second, "the frame is reused between calls");
      const results = [
        move({ x: 400, y: 350 }, { x: 420, y: 330 }),
        move({ x: 400, y: 350 }, { x: 700, y: 480 }),
        move({ x: 400, y: 350 }, { x: 150, y: 470 }),
        move({ x: 400, y: 350 }, { x: 400, y: 100 }),
        move({ x: 400, y: 350 }, { x: 400, y: 100 }, { enforceRadius: false }),
        move({ x: 690, y: 470 }, { x: 680, y: 460 }),
        move({ x: 400, y: 350 }, { x: 420, y: 330 }, { config: { ...sectorConfig, enabled: false } }),
        move({ x: Number.NaN, y: 1 }, { x: 420, y: 330 }),
        snapshot(constraint.inspect({ position: { x: 650, y: 480 }, origin, config: sectorConfig,
          limitRadiusPx: 300, pixelsPerMeter: 50 })),
      ];
      constraint.reset();
      const afterReset = constraint.resolveMovement({ fromPosition: { x: 400, y: 350 },
        proposedPosition: { x: 400, y: 340 }, origin, config: sectorConfig, limitRadiusPx: 300 });
      return { results, frameReplacedByReset: afterReset !== first };
    },
    "injected-geometry-frame": Constraint => {
      const calls = [];
      const geometry = { resolve: input => { calls.push(snapshot(input)); return null; } };
      const constraint = new Constraint({ geometry });
      const none = snapshot(constraint.resolveMovement({ fromPosition: { x: 1, y: 2 }, proposedPosition: { x: 3, y: 4 },
        origin, config: sectorConfig, limitRadiusPx: 100 }));
      return { none, calls };
    },
  }),
  StaminaPressureResolver: Object.freeze({
    "pressure-inputs-lateral-position-and-control-direction": Resolver => {
      const resolver = new Resolver();
      const config = { inputWeights: { rodHold: 1, reelHold: 0.5, control: 0.8 },
        lateralPositionWeights: { center: 0.6, edge: 1.4 }, controlDirection: { correctMultiplier: 1.3, wrongMultiplier: 0.6 } };
      const scenarios = [
        { rodHoldKg: 4, reelHoldKg: 2, controlKg: 3, fishLateralContext: { fishLateralOffsetPx: 120, maxAllowedLateralOffsetPx: 200 },
          controlDirectionX: -1, config },
        { rodHoldKg: 4, reelHoldKg: 2, controlKg: 3, fishLateralContext: { fishOffsetX: -150, maxOffsetPx: 200, angleRatio: 0.4 },
          controlDirectionX: -1, config },
        { rodHoldKg: 0, reelHoldKg: 0, controlKg: 5, controlExhausted: true, fishLateralContext: {}, config },
        { rodHoldKg: 2, config: null },
        {},
      ];
      const results = scenarios.map(input => resolver.resolve(input));
      return snapshot(results);
    },
  }),
  FishRetrieveSystem: Object.freeze({
    "retrieve-forces-caller-mutation-and-config-sources": System => {
      const run = (configSource, rodPullResult, extra = {}) => {
        const system = new System(configSource);
        const result = system.calculate({ dtSec: 0.016, rodPullResult, forceData: { fishWeightKg: 3.5,
          fishBasePower: 1.2, fishBaseSpeed: 0.9, fishStateForceMultiplier: 1.1, fishStateSpeedMultiplier: 0.8 },
        fishCondition: { staminaRatio: 0.6 }, lineDistanceMeters: 18, landingDistanceMeters: 2,
        dragRatio: 0.4, dragLimitKg: 6, ...extra });
        system.reset();
        return { result: snapshot(result), mutatedCallerInput: snapshot(rodPullResult) };
      };
      return [
        run({ water: { motionResistance: 900 }, tension: { movableHoldTensionCapRatio: 0.8 }, pixelsPerMeter: 40 },
          { rodLimitKg: 8, holdTensionRatio: 0.7, playerPullPressureKg: 3, isHolding: true }),
        run({ getWaterConfig: () => ({ speedMultiplier: 50 }), getPixelsPerMeter: () => 60 },
          { rodLimitKg: 5, holdTensionRatio: 1 }, { movementBlocked: true, lineTaut: false, actualSlackMeters: 0.5 }),
        run(null, {}, { dragLocked: true, dragSupported: false, lineHasReserve: false }),
      ];
    },
  }),
});

module.exports = { BATCH_025_EXECUTABLE_CASES };
