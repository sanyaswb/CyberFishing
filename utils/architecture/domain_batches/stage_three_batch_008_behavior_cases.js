"use strict";

const assert = require("node:assert/strict");

const sortedKeys = (value) => Object.keys(value).sort();
const spoolSnapshot = (state) => ({
  totalLineMeters: state.totalLineMeters,
  releasedLineMeters: state.releasedLineMeters,
  remainingLineMeters: state.remainingLineMeters,
  lineHasReserve: state.lineHasReserve,
  spoolEmpty: state.spoolEmpty,
});

const readyLoadInput = Object.freeze({
  dtMs: 500,
  config: Object.freeze({ enabled: true }),
  hasReel: true,
  playerHoldActive: true,
  rawTensionKg: 25,
  dragLimitKg: 40,
  dragLocked: false,
  shouldSlipDrag: false,
  reelMaxLoadKg: 100,
  retrieveSpeedMetersPerSecond: 4,
});

const CASES = Object.freeze({
  LineSpoolState: Object.freeze({
    "constructor-clamps": (Type) => {
      const defaults = new Type();
      const upper = new Type({ totalLineMeters: 10, releasedLineMeters: 20 });
      const negative = new Type({ totalLineMeters: -5, releasedLineMeters: -3 });
      const strings = new Type({ totalLineMeters: "12", releasedLineMeters: "4.5" });
      assert.deepEqual(spoolSnapshot(defaults), {
        totalLineMeters: 0, releasedLineMeters: 0, remainingLineMeters: 0,
        lineHasReserve: false, spoolEmpty: true,
      });
      assert.equal(upper.releasedLineMeters, 10);
      assert.equal(negative.totalLineMeters, 0);
      assert.equal(strings.remainingLineMeters, 7.5);
      return [defaults, upper, negative, strings].map(spoolSnapshot);
    },
    "total-released-and-remaining-line": (Type) => {
      const state = new Type({ totalLineMeters: 20, releasedLineMeters: 7.25 });
      assert.equal(state.totalLineMeters, 20);
      assert.equal(state.releasedLineMeters, 7.25);
      assert.equal(state.remainingLineMeters, 12.75);
      return spoolSnapshot(state);
    },
    "line-reserve-threshold": (Type) => {
      const exact = new Type({ totalLineMeters: 0.0001 });
      const above = new Type({ totalLineMeters: 0.0001001 });
      assert.equal(exact.lineHasReserve, false);
      assert.equal(above.lineHasReserve, true);
      return { exact: spoolSnapshot(exact), above: spoolSnapshot(above) };
    },
    "spool-empty": (Type) => {
      const full = new Type({ totalLineMeters: 5, releasedLineMeters: 5 });
      const reserve = new Type({ totalLineMeters: 5, releasedLineMeters: 4 });
      assert.equal(full.spoolEmpty, true);
      assert.equal(reserve.spoolEmpty, false);
      return { full: spoolSnapshot(full), reserve: spoolSnapshot(reserve) };
    },
    "set-total-line": (Type) => {
      const state = new Type({ totalLineMeters: 10, releasedLineMeters: 8 });
      const identity = state;
      assert.equal(state.setTotalLineMeters(5), undefined);
      assert.equal(state, identity);
      assert.equal(state.releasedLineMeters, 5);
      state.setTotalLineMeters("12");
      assert.equal(state.releasedLineMeters, 5);
      state.setTotalLineMeters(Number.NaN);
      assert.equal(state.totalLineMeters, 0);
      return { sameIdentity: state === identity, state: spoolSnapshot(state) };
    },
    "set-released-line": (Type) => {
      const state = new Type({ totalLineMeters: 10 });
      state.setReleasedLineMeters(7);
      const normal = spoolSnapshot(state);
      state.setReleasedLineMeters(20);
      const upper = spoolSnapshot(state);
      state.setReleasedLineMeters(-1);
      const lower = spoolSnapshot(state);
      return { normal, upper, lower };
    },
    release: (Type) => {
      const state = new Type({ totalLineMeters: 10, releasedLineMeters: 3 });
      const first = state.release(4);
      const capped = state.release(20);
      const negative = state.release(-5);
      assert.deepEqual([first, capped, negative], [4, 3, 0]);
      return { first, capped, negative, state: spoolSnapshot(state) };
    },
    recover: (Type) => {
      const state = new Type({ totalLineMeters: 10, releasedLineMeters: 8 });
      const first = state.recover(3);
      const capped = state.recover(20);
      const negative = state.recover(-2);
      assert.deepEqual([first, capped, negative], [3, 5, 0]);
      return { first, capped, negative, state: spoolSnapshot(state) };
    },
    "minimum-released-line": (Type) => {
      const state = new Type({ totalLineMeters: 20, releasedLineMeters: 12 });
      const recovered = state.recover(20, 5);
      assert.equal(recovered, 7);
      assert.equal(state.releasedLineMeters, 5);
      const upperMinimum = state.recover(2, 100);
      assert.equal(upperMinimum, 0);
      return { recovered, upperMinimum, state: spoolSnapshot(state) };
    },
    "invalid-numeric-inputs": (Type) => {
      const states = [
        new Type({ totalLineMeters: Number.NaN, releasedLineMeters: Infinity }),
        new Type({ totalLineMeters: Infinity, releasedLineMeters: 2 }),
        new Type({ totalLineMeters: -Infinity, releasedLineMeters: -Infinity }),
        new Type({ totalLineMeters: "10", releasedLineMeters: "bad" }),
      ];
      const mutable = new Type({ totalLineMeters: 10, releasedLineMeters: 5 });
      const results = {
        releaseNaN: mutable.release(Number.NaN),
        releaseInfinity: mutable.release(Infinity),
        recoverNaN: mutable.recover(Number.NaN),
        recoverInfinity: mutable.recover(Infinity),
      };
      assert.deepEqual(results, {
        releaseNaN: 0, releaseInfinity: 0, recoverNaN: 0, recoverInfinity: 0,
      });
      return { states: states.map(spoolSnapshot), results, mutable: spoolSnapshot(mutable) };
    },
    "same-instance-state-mutation": (Type) => {
      const state = new Type({ totalLineMeters: 10 });
      const identity = state;
      state.release(6);
      state.recover(2);
      state.setTotalLineMeters(12);
      state.setReleasedLineMeters(3);
      assert.equal(state, identity);
      return { sameIdentity: state === identity, state: spoolSnapshot(state) };
    },
    "private-state-isolation": (Type) => {
      const first = new Type({ totalLineMeters: 10 });
      const second = new Type({ totalLineMeters: 10 });
      first.release(8);
      assert.equal(second.releasedLineMeters, 0);
      assert.equal(Object.keys(first).length, 0);
      return {
        separateInstances: first !== second,
        first: spoolSnapshot(first),
        second: spoolSnapshot(second),
        enumerableFields: Object.keys(first),
      };
    },
  }),
  RodStrokeDistanceTracker: Object.freeze({
    "gained-distance": (Type) => {
      const result = new Type().calculate({ previousDistanceMeters: 10, currentDistanceMeters: 7 });
      assert.equal(result.previousDistanceMeters, 10);
      assert.equal(result.currentDistanceMeters, 7);
      assert.equal(result.deltaMeters, 3);
      assert.equal(result.gainedMeters, 3);
      assert.equal(result.lostMeters, 0);
      assert.equal(result.reason, "line_distance_distance_gained");
      return result;
    },
    "lost-distance": (Type) => {
      const result = new Type().calculate({ previousDistanceMeters: 7, currentDistanceMeters: 10 });
      assert.equal(result.deltaMeters, -3);
      assert.equal(result.gainedMeters, 0);
      assert.equal(result.lostMeters, 3);
      assert.equal(result.reason, "line_distance_distance_lost");
      return result;
    },
    "stable-distance": (Type) => {
      const result = new Type().calculate({
        previousDistanceMeters: 5,
        currentDistanceMeters: 5.0000005,
      });
      assert.equal(result.deltaMeters, 0);
      assert.equal(result.reason, "line_distance_stable_distance");
      return result;
    },
    "exact-epsilon-boundary": (Type) => {
      const tracker = new Type();
      const gainedBoundary = tracker.calculate({
        previousDistanceMeters: 2, currentDistanceMeters: 1, epsilonMeters: 1,
      });
      const lostBoundary = tracker.calculate({
        previousDistanceMeters: 1, currentDistanceMeters: 2, epsilonMeters: 1,
      });
      const beyond = tracker.calculate({
        previousDistanceMeters: 2.0001, currentDistanceMeters: 1, epsilonMeters: 1,
      });
      assert.equal(gainedBoundary.reason, "line_distance_stable_distance");
      assert.equal(lostBoundary.reason, "line_distance_stable_distance");
      assert.equal(beyond.reason, "line_distance_distance_gained");
      return { gainedBoundary, lostBoundary, beyond };
    },
    "default-epsilon": (Type) => {
      const tracker = new Type();
      const within = tracker.calculate({ previousDistanceMeters: 2, currentDistanceMeters: 1.9999995 });
      const beyond = tracker.calculate({ previousDistanceMeters: 2, currentDistanceMeters: 1.9999 });
      assert.equal(within.reason, "line_distance_stable_distance");
      assert.equal(beyond.reason, "line_distance_distance_gained");
      return { within, beyond };
    },
    "custom-reason-prefix": (Type) => {
      const tracker = new Type();
      return {
        gained: tracker.calculate({ previousDistanceMeters: 2, currentDistanceMeters: 1, reasonPrefix: "rod" }).reason,
        lost: tracker.calculate({ previousDistanceMeters: 1, currentDistanceMeters: 2, reasonPrefix: "rod" }).reason,
        stable: tracker.calculate({ previousDistanceMeters: 1, currentDistanceMeters: 1, reasonPrefix: "rod" }).reason,
      };
    },
    "invalid-numeric-inputs": (Type) => {
      const tracker = new Type();
      const values = [Number.NaN, Infinity, -Infinity];
      const invalid = values.map((value) => tracker.calculate({
        previousDistanceMeters: value,
        currentDistanceMeters: 1,
      }));
      assert.equal(invalid.every((result) => result.reason === "line_distance_invalid_distance"), true);
      const negative = tracker.calculate({ previousDistanceMeters: -2, currentDistanceMeters: -4 });
      assert.equal(negative.reason, "line_distance_stable_distance");
      return { invalid, negative };
    },
    "position-distance-calculation": (Type) => {
      const result = new Type().calculateFromPositions({
        previousFishPosition: { x: 30, y: 40 },
        currentFishPosition: { x: 0, y: 0 },
        rodTipPosition: { x: 0, y: 0 },
        pixelsPerMeter: 10,
      });
      assert.equal(result.previousDistanceMeters, 5);
      assert.equal(result.currentDistanceMeters, 0);
      assert.equal(result.gainedMeters, 5);
      return result;
    },
    "pixels-per-meter-fallback": (Type) => {
      const tracker = new Type();
      const fallback = tracker.calculateFromPositions({
        previousFishPosition: { x: 100, y: 0 }, currentFishPosition: { x: 50, y: 0 },
        rodTipPosition: { x: 0, y: 0 }, pixelsPerMeter: Number.NaN,
      });
      const zeroFallback = tracker.calculateFromPositions({
        previousFishPosition: { x: 100, y: 0 }, currentFishPosition: { x: 50, y: 0 },
        rodTipPosition: { x: 0, y: 0 }, pixelsPerMeter: 0,
      });
      const negativeClamp = tracker.calculateFromPositions({
        previousFishPosition: { x: 10, y: 0 }, currentFishPosition: { x: 5, y: 0 },
        rodTipPosition: { x: 0, y: 0 }, pixelsPerMeter: -10,
      });
      assert.equal(fallback.gainedMeters, 1);
      assert.equal(zeroFallback.gainedMeters, 1);
      assert.equal(negativeClamp.gainedMeters, 5);
      return { fallback, zeroFallback, negativeClamp };
    },
    "exact-frozen-result-shape": (Type) => {
      const tracker = new Type();
      const results = [
        tracker.calculate({ previousDistanceMeters: 2, currentDistanceMeters: 1 }),
        tracker.calculate({ previousDistanceMeters: 1, currentDistanceMeters: 2 }),
        tracker.calculate({ previousDistanceMeters: 1, currentDistanceMeters: 1 }),
        tracker.calculate({ previousDistanceMeters: Number.NaN, currentDistanceMeters: 1 }),
      ];
      const expected = [
        "currentDistanceMeters", "deltaMeters", "gainedMeters", "lostMeters",
        "previousDistanceMeters", "reason",
      ];
      for (const result of results) {
        assert.equal(Object.isFrozen(result), true);
        assert.deepEqual(sortedKeys(result), expected);
      }
      return results.map((result) => ({ frozen: Object.isFrozen(result), keys: sortedKeys(result), result }));
    },
  }),
  ReelHoldLoadPolicy: Object.freeze({
    disabled: (Type) => {
      const result = new Type().evaluate({ config: { enabled: false } });
      assert.equal(result.blockedReason, "disabled");
      assert.equal(result.eligible, false);
      return result;
    },
    "no-reel": (Type) => {
      const result = new Type().evaluate({ ...readyLoadInput, hasReel: false });
      assert.equal(result.blockedReason, "no_reel");
      return result;
    },
    "not-holding": (Type) => {
      const result = new Type().evaluate({ ...readyLoadInput, playerHoldActive: false });
      assert.equal(result.blockedReason, "not_holding");
      return result;
    },
    "drag-slipping": (Type) => {
      const result = new Type().evaluate({ ...readyLoadInput, shouldSlipDrag: true });
      assert.equal(result.blockedReason, "drag_slipping");
      assert.equal(result.dragCanHold, false);
      return result;
    },
    "at-drag-limit": (Type) => {
      const result = new Type().evaluate({ ...readyLoadInput, rawTensionKg: 10, dragLimitKg: 10 });
      assert.equal(result.tensionBelowDragLimit, false);
      assert.equal(result.blockedReason, "at_drag_limit");
      return result;
    },
    "near-max-load": (Type) => {
      const result = new Type().evaluate({
        ...readyLoadInput, rawTensionKg: 99, reelMaxLoadKg: 100, dragLocked: true,
      });
      assert.equal(result.reelLoadReserveRatio, 0.01);
      assert.equal(result.tensionBelowMaxLoad, false);
      assert.equal(result.blockedReason, "near_max_load");
      return result;
    },
    "zero-recover-speed": (Type) => {
      const result = new Type().evaluate({ ...readyLoadInput, retrieveSpeedMetersPerSecond: 0 });
      assert.equal(result.recoverSpeedMetersPerSecond, 0);
      assert.equal(result.blockedReason, "zero_recover_speed");
      return result;
    },
    ready: (Type) => {
      const result = new Type().evaluate(readyLoadInput);
      assert.equal(result.blockedReason, "ready");
      assert.equal(result.eligible, true);
      assert.equal(result.active, true);
      return result;
    },
    "drag-locked-semantics": (Type) => {
      const result = new Type().evaluate({
        ...readyLoadInput,
        rawTensionKg: 50,
        dragLimitKg: 1,
        dragLocked: true,
      });
      assert.equal(result.tensionBelowDragLimit, true);
      assert.equal(result.dragCanHold, true);
      assert.equal(result.blockedReason, "ready");
      return result;
    },
    "drag-limit-epsilon": (Type) => {
      const policy = new Type();
      const blocked = policy.evaluate({
        ...readyLoadInput, rawTensionKg: 10, dragLimitKg: 10.001,
      });
      const allowed = policy.evaluate({
        ...readyLoadInput, rawTensionKg: 10, dragLimitKg: 10.0011,
      });
      assert.equal(blocked.tensionBelowDragLimit, false);
      assert.equal(allowed.tensionBelowDragLimit, true);
      return { blocked, allowed };
    },
    "load-reserve-ratio-and-one-percent-gate": (Type) => {
      const policy = new Type();
      const exact = policy.evaluate({
        ...readyLoadInput, rawTensionKg: 99, reelMaxLoadKg: 100, dragLocked: true,
      });
      const above = policy.evaluate({
        ...readyLoadInput, rawTensionKg: 98.99, reelMaxLoadKg: 100, dragLocked: true,
      });
      assert.equal(exact.tensionBelowMaxLoad, false);
      assert.equal(above.tensionBelowMaxLoad, true);
      return { exact, above };
    },
    "retrieve-speed-scaling-and-delta-time": (Type) => {
      const result = new Type().evaluate(readyLoadInput);
      assert.equal(result.reelLoadReserveRatio, 0.75);
      assert.equal(result.retrieveSpeedMetersPerSecond, 4);
      assert.equal(result.recoverSpeedMetersPerSecond, 3);
      assert.equal(result.maxMoveMeters, 1.5);
      return result;
    },
    "invalid-numeric-coercion": (Type) => {
      const result = new Type().evaluate({
        dtMs: Number.NaN,
        hasReel: "yes",
        playerHoldActive: 1,
        rawTensionKg: Infinity,
        dragLimitKg: -Infinity,
        dragLocked: 0,
        shouldSlipDrag: "false",
        reelMaxLoadKg: -10,
        retrieveSpeedMetersPerSecond: -5,
      });
      assert.equal(result.rawTensionKg, 0);
      assert.equal(result.dragLimitKg, 0);
      assert.equal(result.reelMaxLoadKg, 0);
      assert.equal(result.retrieveSpeedMetersPerSecond, 0);
      assert.equal(result.maxMoveMeters, 0);
      assert.equal(result.hasReel, true);
      assert.equal(result.shouldSlipDrag, false);
      return result;
    },
    "exact-blocked-reason-precedence-and-result-shape": (Type) => {
      const policy = new Type();
      const precedence = [
        policy.evaluate({ config: { enabled: false } }).blockedReason,
        policy.evaluate({ config: {}, hasReel: false }).blockedReason,
        policy.evaluate({ config: {}, hasReel: true, playerHoldActive: false }).blockedReason,
        policy.evaluate({ ...readyLoadInput, shouldSlipDrag: true, rawTensionKg: 99 }).blockedReason,
        policy.evaluate({ ...readyLoadInput, rawTensionKg: 50, dragLimitKg: 1 }).blockedReason,
        policy.evaluate({ ...readyLoadInput, rawTensionKg: 99, dragLocked: true }).blockedReason,
        policy.evaluate({ ...readyLoadInput, retrieveSpeedMetersPerSecond: 0 }).blockedReason,
        policy.evaluate(readyLoadInput).blockedReason,
      ];
      assert.deepEqual(precedence, [
        "disabled", "no_reel", "not_holding", "drag_slipping", "at_drag_limit",
        "near_max_load", "zero_recover_speed", "ready",
      ]);
      const result = policy.evaluate(readyLoadInput);
      const keys = sortedKeys(result);
      assert.deepEqual(keys, [
        "active", "blockedReason", "dragCanHold", "dragLimitKg", "dragLocked", "eligible",
        "enabled", "hasReel", "maxMoveMeters", "playerHoldActive", "rawTensionKg",
        "recoverSpeedMetersPerSecond", "reelLoadReserveRatio", "reelMaxLoadKg",
        "retrieveSpeedMetersPerSecond", "shouldSlipDrag", "tensionBelowDragLimit",
        "tensionBelowMaxLoad",
      ]);
      return { precedence, keys, result };
    },
  }),
});

module.exports = { BATCH_008_EXECUTABLE_CASES: CASES };
