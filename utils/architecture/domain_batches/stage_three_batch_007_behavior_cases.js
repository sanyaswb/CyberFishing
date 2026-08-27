"use strict";

const assert = require("node:assert/strict");
const {
  ROD_PULL_FIELDS,
  ROD_STROKE_SNAPSHOT_FIELDS,
} = require("./stage_three_batch_007_dependency_state_audit");

const sortedKeys = (value) => Object.keys(value).sort();
const json = (value) => JSON.parse(JSON.stringify(value));

const CASES = Object.freeze({
  LineConstrainedFishMotionResolver: Object.freeze({
    "default-free-frame": (Type) => {
      const result = new Type().resolve();
      assert.equal(result.reason, "free");
      assert.equal(result.velocityX, 0);
      assert.equal(result.velocityY, 0);
      return json(result);
    },
    "free-velocity-aliases": (Type) => {
      const result = new Type().resolve({
        rawVelocity: { velocityX: 2.5, velocityY: -1.25 },
        lineConstraintState: { radialConstraintActive: false },
      });
      assert.equal(result.velocityX, 2.5);
      assert.equal(result.velocityY, -1.25);
      return json(result);
    },
    "zero-radius-branch": (Type) => {
      const result = new Type().resolve({
        position: { x: 2, y: 2 },
        rodTipPosition: { x: 2, y: 2 },
        rawVelocity: { x: 4, y: 3 },
        lineConstraintState: { radialConstraintActive: true },
      });
      assert.equal(result.reason, "zero_radius");
      assert.equal(result.radialY, -1);
      return json(result);
    },
    "inward-and-tangent-allowed": (Type) => {
      const resolver = new Type();
      const inward = json(resolver.resolve({
        position: { x: 10, y: 0 }, rodTipPosition: { x: 0, y: 0 },
        rawVelocity: { x: -2, y: 3 }, lineConstraintState: { radialConstraintActive: true },
      }));
      const tangent = json(resolver.resolve({
        position: { x: 10, y: 0 }, rodTipPosition: { x: 0, y: 0 },
        rawVelocity: { x: 0, y: 3 }, lineConstraintState: { radialConstraintActive: true },
      }));
      assert.equal(inward.reason, "allowed_inward_or_tangent");
      assert.equal(tangent.reason, "allowed_inward_or_tangent");
      return { inward, tangent };
    },
    "outward-radial-projection": (Type) => {
      const result = new Type().resolve({
        position: { x: 10, y: 0 }, rodTipPosition: { x: 0, y: 0 },
        rawVelocity: { x: 4, y: 3 }, lineConstraintState: { radialConstraintActive: true },
      });
      assert.equal(result.velocityX, 0);
      assert.equal(result.velocityY, 3);
      assert.equal(result.blockedRadialSpeedPxPerSec, 4);
      assert.equal(result.allowedTangentSpeedPxPerSec, 3);
      return json(result);
    },
    "delta-time-clamp": (Type) => {
      const resolver = new Type();
      return [resolver.resolve({ dtSec: -2 }).dtSec, resolver.resolve({ dtSec: Number.NaN }).dtSec];
    },
    "exact-result-shape": (Type) => {
      const keys = sortedKeys(new Type().resolve());
      assert.deepEqual(keys, [
        "active", "allowedTangentSpeedPxPerSec", "blockedRadialSpeedPxPerSec",
        "constraintActive", "dtSec", "projectionReason", "radialSpeedPxPerSec",
        "radialX", "radialY", "rawVelocityX", "rawVelocityY", "reason",
        "velocityX", "velocityY",
      ]);
      return keys;
    },
    "per-instance-reusable-frame-identity": (Type) => {
      const first = new Type();
      const a = first.resolve();
      const b = first.resolve({ rawVelocity: { x: 1 } });
      const c = new Type().resolve();
      assert.equal(a, b);
      assert.notEqual(a, c);
      return { sameInstance: a === b, separateInstance: a !== c };
    },
    "caller-input-immutability": (Type) => {
      const input = {
        position: { x: 10, y: 4 }, rodTipPosition: { x: 1, y: 2 },
        rawVelocity: { x: 3, y: 5 }, lineConstraintState: { radialConstraintActive: true }, dtSec: 0.2,
      };
      const before = JSON.stringify(input);
      new Type().resolve(input);
      assert.equal(JSON.stringify(input), before);
      return before;
    },
  }),
  LineRadialMovementSplitter: Object.freeze({
    "zero-delta-or-radius": (Type) => {
      const resolver = new Type();
      const zeroDt = json(resolver.resolveVelocity({ constrainedVelocity: { x: 2, y: 3 }, releasedMeters: 2, dtSec: 0 }));
      const zeroRadius = json(resolver.resolveVelocity({ constrainedVelocity: { x: 4, y: 5 }, releasedMeters: 0, dtSec: 1 }));
      return { zeroDt, zeroRadius };
    },
    "already-at-released-radius": (Type) => json(new Type().resolveVelocity({
      position: { x: 5, y: 0 }, rodTipPosition: { x: 0, y: 0 },
      freeVelocity: { x: 10, y: 0 }, constrainedVelocity: { x: 0, y: 2 },
      releasedMeters: 5, pixelsPerMeter: 1, dtSec: 1,
    })),
    "no-crossing-free-frame": (Type) => {
      const result = new Type().resolveVelocity({
        position: { x: 0, y: 0 }, rodTipPosition: { x: 0, y: 0 },
        freeVelocity: { x: 1, y: 2 }, constrainedVelocity: { x: 8, y: 9 },
        releasedMeters: 100, pixelsPerMeter: 1, dtSec: 1,
      });
      assert.equal(result.freeTimeSec, 1);
      assert.equal(result.constrainedTimeSec, 0);
      return json(result);
    },
    "crossing-time-weighted-velocity": (Type) => {
      const result = new Type().resolveVelocity({
        position: { x: 0, y: 0 }, rodTipPosition: { x: 0, y: 0 },
        freeVelocity: { x: 10, y: 0 }, constrainedVelocity: { x: 0, y: 4 },
        releasedMeters: 5, pixelsPerMeter: 1, dtSec: 1,
      });
      assert.equal(result.freeTimeSec, 0.5);
      assert.equal(result.constrainedTimeSec, 0.5);
      assert.equal(result.velocityX, 5);
      assert.equal(result.velocityY, 2);
      assert.equal(result.crossedReleasedRadius, true);
      return json(result);
    },
    "zero-velocity-no-crossing": (Type) => json(new Type().resolveVelocity({
      position: { x: 0, y: 0 }, freeVelocity: { x: 0, y: 0 },
      constrainedVelocity: { x: 3, y: 4 }, releasedMeters: 5, pixelsPerMeter: 1, dtSec: 1,
    })),
    "pixels-per-meter-fallback-and-clamp": (Type) => {
      const resolver = new Type();
      const fallback = json(resolver.resolveVelocity({
        position: { x: 0, y: 0 }, freeVelocity: { x: 100, y: 0 }, constrainedVelocity: {},
        releasedMeters: 1, dtSec: 1,
      }));
      const clamped = json(resolver.resolveVelocity({
        position: { x: 0, y: 0 }, freeVelocity: { x: 10, y: 0 }, constrainedVelocity: {},
        releasedMeters: 1, pixelsPerMeter: -10, dtSec: 0.2,
      }));
      return { fallback, clamped };
    },
    "velocity-aliases": (Type) => json(new Type().resolveVelocity({
      freeVelocity: { velocityX: 2, velocityY: 3 },
      constrainedVelocity: { velocityX: 4, velocityY: 5 }, releasedMeters: 100, pixelsPerMeter: 1, dtSec: 1,
    })),
    "exact-result-shape": (Type) => {
      const keys = sortedKeys(new Type().resolveVelocity());
      assert.deepEqual(keys, ["constrainedTimeSec", "crossedReleasedRadius", "freeTimeSec", "velocityX", "velocityY"]);
      return keys;
    },
    "per-instance-reusable-result-identity": (Type) => {
      const first = new Type();
      const a = first.resolveVelocity();
      const b = first.resolveVelocity({ dtSec: 1 });
      const c = new Type().resolveVelocity();
      assert.equal(a, b);
      assert.notEqual(a, c);
      return { sameInstance: a === b, separateInstance: a !== c };
    },
    "caller-input-immutability": (Type) => {
      const input = {
        position: { x: 1, y: 2 }, rodTipPosition: { x: 0, y: 0 },
        freeVelocity: { x: 3, y: 4 }, constrainedVelocity: { x: 1, y: 1 },
        releasedMeters: 5, pixelsPerMeter: 10, dtSec: 0.5,
      };
      const before = JSON.stringify(input);
      new Type().resolveVelocity(input);
      assert.equal(JSON.stringify(input), before);
      return before;
    },
  }),
  ReelRetrieveSpeedCalculator: Object.freeze({
    "default-zero": (Type) => new Type().calculate(),
    "base-plus-bearing-bonus": (Type) => new Type().calculate({ baseSpeedMetersPerSec: 2, bearingCount: 3, bearingBonusMetersPerSec: 0.5 }),
    "independent-positive-clamps": (Type) => [
      new Type().calculate({ baseSpeedMetersPerSec: -2, bearingCount: 3, bearingBonusMetersPerSec: 0.5 }),
      new Type().calculate({ baseSpeedMetersPerSec: 2, bearingCount: -3, bearingBonusMetersPerSec: 0.5 }),
    ],
    "nan-and-infinity-fallback": (Type) => new Type().calculate({ baseSpeedMetersPerSec: Number.NaN, bearingCount: Infinity, bearingBonusMetersPerSec: -Infinity }),
    "numeric-string-coercion": (Type) => new Type().calculate({ baseSpeedMetersPerSec: "2", bearingCount: "3", bearingBonusMetersPerSec: "0.5" }),
    "fractional-no-rounding": (Type) => {
      const value = new Type().calculate({ baseSpeedMetersPerSec: 0.1, bearingCount: 2, bearingBonusMetersPerSec: 0.2 });
      assert.equal(value, 0.5);
      return value;
    },
  }),
  RodPullState: Object.freeze({
    "exact-thirty-two-field-default-shape": (Type) => {
      const state = new Type();
      assert.deepEqual(sortedKeys(state), [...ROD_PULL_FIELDS]);
      return json(state);
    },
    "mutable-same-instance": (Type) => {
      const state = new Type();
      state.active = true;
      state.forceKg = 2.5;
      return { same: state.active === true, forceKg: state.forceKg, keys: sortedKeys(state) };
    },
    "reset-return-and-identity": (Type) => {
      const state = new Type();
      const identity = state;
      const returned = state.reset();
      assert.equal(state, identity);
      assert.equal(returned, undefined);
      return { sameIdentity: state === identity, returned: String(returned) };
    },
    "reset-exact-defaults": (Type) => {
      const expected = json(new Type());
      const state = new Type();
      for (const key of Object.keys(state)) state[key] = key;
      state.reset();
      assert.deepEqual(json(state), expected);
      return expected;
    },
    "repeated-reset-idempotence": (Type) => {
      const state = new Type();
      state.reset();
      const once = json(state);
      state.reset();
      return { once, twice: json(state) };
    },
    "instance-state-isolation": (Type) => {
      const a = new Type();
      const b = new Type();
      a.forceKg = 10;
      assert.equal(b.forceKg, 0);
      return { separate: a !== b, a: a.forceKg, b: b.forceKg };
    },
    "zero-reset-allocations": (Type) => {
      const state = new Type();
      const identity = state;
      for (let index = 0; index < 20; index += 1) state.reset();
      return { sameIdentity: state === identity, keys: sortedKeys(state) };
    },
  }),
  RodStrokeState: Object.freeze({
    "initial-state-and-snapshot": (Type) => {
      const state = new Type();
      return { won: state.wonMeters, capacity: state.capacityMeters, remaining: state.remainingCapacityMeters, ratio: state.getRatio(), snapshot: state.getSnapshot() };
    },
    "capacity-clamp": (Type) => {
      const state = new Type();
      state.setCapacity(-2);
      const negative = state.capacityMeters;
      state.setCapacity("10");
      state.addWonDistance(8);
      state.setCapacity(5);
      return { negative, capacity: state.capacityMeters, won: state.wonMeters };
    },
    "add-distance-cap": (Type) => {
      const state = new Type();
      state.setCapacity(10);
      return { first: state.addWonDistance(4), second: state.addWonDistance(20), won: state.wonMeters, remaining: state.remainingCapacityMeters };
    },
    "lose-and-recover-distance": (Type) => {
      const state = new Type();
      state.setCapacity(10);
      state.addWonDistance(8);
      return { negative: state.loseWonDistance(-1), lost: state.loseWonDistance(3), recovered: state.recoverWonDistance(2), won: state.wonMeters };
    },
    "compatibility-method-aliases": (Type) => {
      const state = new Type();
      state.startCycle(10);
      const added = state.addPullDistance(6);
      const recovered = state.recover(2);
      return { added, recovered, won: state.wonMeters };
    },
    "start-cycle-preserves-unrecovered-stroke": (Type) => {
      const state = new Type();
      state.setCapacity(10);
      state.addWonDistance(4);
      state.startCycle(20);
      return { capacity: state.capacityMeters, won: state.wonMeters };
    },
    "reset-semantics": (Type) => {
      const state = new Type();
      state.setCapacity(10);
      state.addWonDistance(4);
      const returned = state.reset();
      return { returned: String(returned), capacity: state.capacityMeters, won: state.wonMeters, snapshot: state.getSnapshot() };
    },
    "write-snapshot-target-identity": (Type) => {
      const state = new Type();
      state.setCapacity(10);
      state.addWonDistance(4);
      const target = { retained: true };
      const result = state.writeSnapshot(target);
      assert.equal(result, target);
      assert.equal(result.retained, true);
      return { same: result === target, result };
    },
    "exact-five-field-snapshot-aliases": (Type) => {
      const state = new Type();
      state.setCapacity(10);
      state.addWonDistance(7.5);
      const snapshot = state.writeSnapshot({});
      assert.deepEqual(sortedKeys(snapshot), [...ROD_STROKE_SNAPSHOT_FIELDS]);
      assert.equal(snapshot.rodStrokeWonMeters, snapshot.rodStrokeUsedMeters);
      assert.equal(snapshot.rodStrokeWonMeters, snapshot.rodStrokeUnrecoveredMeters);
      return snapshot;
    },
    "get-snapshot-fresh-object-and-instance-isolation": (Type) => {
      const a = new Type();
      const b = new Type();
      a.setCapacity(10);
      a.addWonDistance(3);
      const first = a.getSnapshot();
      const second = a.getSnapshot();
      assert.notEqual(first, second);
      assert.equal(b.wonMeters, 0);
      return { fresh: first !== second, isolated: a.wonMeters !== b.wonMeters, first, second };
    },
  }),
  SimpleFightForceCalculator: Object.freeze({
    "passive-active-opposition-formulas": (Type) => {
      const calculator = new Type();
      const passive = calculator.calculateFishPassiveKg({ fishWeightKg: 2.5, tautBodyResistancePerKg: 0.2, fishBasePower: 1.3 });
      const active = calculator.calculateFishActiveKg({ fishPassiveKg: passive, fishStateForceMultiplier: 2, directionMultiplier: 0.5 });
      return { passive, active, opposition: calculator.calculateFishOppositionKg({ fishPassiveKg: passive, fishActiveKg: active }) };
    },
    "slack-semantics": (Type) => {
      const calculator = new Type();
      const taut = calculator.calculate({ fishWeightKg: 2, rodLimitKg: 10, slack: false });
      const slack = calculator.calculate({ fishWeightKg: 2, rodLimitKg: 10, slack: true });
      return { tautFishTension: taut.fishTensionKg, slackFishTension: slack.fishTensionKg, opposition: slack.fishOppositionKg };
    },
    "tension-ceiling-and-rod-hold-clamp": (Type) => {
      const calculator = new Type();
      return {
        ceiling: calculator.calculateTensionCeilingKg({ rodLimitKg: 10, tensionCeilingMultiplier: 1.5 }),
        maximum: calculator.calculateRodHoldMaxKg({ rodLimitKg: 10, fishTensionKg: 4, tensionCeilingMultiplier: 1.5 }),
        effective: calculator.calculateEffectiveRodHoldKg({ rodHoldKg: 10, rodHoldMaxKg: 8, rodAngleMultiplier: 2 }),
      };
    },
    "angle-and-ratio-clamps": (Type) => {
      const calculator = new Type();
      return [
        calculator.calculateEffectiveRodHoldKg({ rodHoldKg: 10, rodHoldMaxKg: 8, rodAngleMultiplier: -1 }),
        calculator.calculateEffectiveRodHoldKg({ rodHoldKg: 10, rodHoldMaxKg: 8, rodAngleMultiplier: 2 }),
        calculator.calculateRawPlayerHoldTensionKg({ effectiveRodHoldKg: 8, holdTensionRatio: 2 }),
      ];
    },
    "raw-and-capped-player-tension": (Type) => {
      const calculator = new Type();
      const raw = calculator.calculateRawPlayerHoldTensionKg({ effectiveRodHoldKg: 8, holdTensionRatio: 0.5 });
      const capped = calculator.calculatePlayerHoldTensionKg({ effectiveRodHoldKg: 8, holdTensionRatio: 0.5, fishOppositionKg: 2, movableHoldTensionCapRatio: 0.5, fishCanMoveTowardPlayer: true });
      return { raw, capped };
    },
    "movable-cap-gate": (Type) => {
      const calculator = new Type();
      const input = { effectiveRodHoldKg: 8, holdTensionRatio: 1, fishOppositionKg: 2, movableHoldTensionCapRatio: 0.5 };
      return {
        immovable: calculator.calculatePlayerHoldTensionKg({ ...input, fishCanMoveTowardPlayer: false }),
        movable: calculator.calculatePlayerHoldTensionKg({ ...input, fishCanMoveTowardPlayer: true }),
      };
    },
    "total-and-net-force": (Type) => {
      const calculator = new Type();
      return {
        total: calculator.calculateTotalTensionKg({ fishTensionKg: 2, playerHoldTensionKg: 3 }),
        net: calculator.calculateNetForceKg({ effectiveRodHoldKg: 3, fishOppositionKg: 5 }),
      };
    },
    "toward-away-idle-speed": (Type) => {
      const calculator = new Type();
      return {
        toward: calculator.calculateSpeedMps({ netForceKg: 4, waterMotionResistance: 4, waterSpeedMultiplier: 2 }),
        away: calculator.calculateSpeedMps({ netForceKg: -4, waterMotionResistance: 4, waterSpeedMultiplier: 2, fishBaseSpeed: 3, fishStateSpeedMultiplier: 0.5 }),
        idle: calculator.calculateSpeedMps({ netForceKg: 0 }),
      };
    },
    "resistance-epsilon-and-defaults": (Type) => {
      const calculator = new Type();
      const epsilon = calculator.calculateSpeedMps({ netForceKg: 1, waterMotionResistance: 0, waterSpeedMultiplier: 1 });
      return { epsilon, defaults: calculator.calculateSpeedMps() };
    },
    "nan-infinity-and-negative-inputs": (Type) => {
      const calculator = new Type();
      return {
        passive: calculator.calculateFishPassiveKg({ fishWeightKg: -2, tautBodyResistancePerKg: Infinity }),
        speed: calculator.calculateSpeedMps({ netForceKg: Number.NaN, waterMotionResistance: Infinity }),
        ceiling: calculator.calculateTensionCeilingKg({ rodLimitKg: -10, tensionCeilingMultiplier: Infinity }),
      };
    },
    "fractional-no-rounding": (Type) => {
      const value = new Type().calculateFishPassiveKg({ fishWeightKg: 2.5, tautBodyResistancePerKg: 0.2, fishBasePower: 1.3 });
      assert.equal(value, 0.65);
      assert.equal(Number.isInteger(value), false);
      return value;
    },
    "exact-frozen-result-shape-and-input-immutability": (Type) => {
      const calculator = new Type();
      const input = { fishWeightKg: 2, rodLimitKg: 10, rodHoldKg: 3 };
      const before = JSON.stringify(input);
      const result = calculator.calculate(input);
      assert.equal(Object.isFrozen(result), true);
      assert.equal(JSON.stringify(input), before);
      const keys = sortedKeys(result);
      assert.deepEqual(keys, [
        "awaySpeedMps", "direction", "effectiveRodHoldKg", "fishActiveKg",
        "fishOppositionKg", "fishPassiveKg", "fishTensionKg", "movableHoldTensionCapApplied",
        "movableHoldTensionCapKg", "netForceKg", "playerHoldTensionKg", "rawPlayerHoldTensionKg",
        "rodHoldMaxKg", "rodHoldTensionCeilingKg", "rodHoldTensionCeilingMultiplier",
        "speedMps", "totalTensionKg", "towardPlayerSpeedMps",
      ]);
      return { frozen: Object.isFrozen(result), keys, result };
    },
  }),
});

module.exports = { BATCH_007_EXECUTABLE_CASES: CASES };
