"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const spool = (value) => ({ total: value.totalLineMeters, released: value.releasedLineMeters,
  remaining: value.remainingLineMeters });

class StageThreeBatch008StateProbe {
  run(types) {
    const first = new types.LineSpoolState({ totalLineMeters: 20, releasedLineMeters: 8 });
    const second = new types.LineSpoolState({ totalLineMeters: 20, releasedLineMeters: 8 });
    const owner = first;
    assert(first instanceof types.LineSpoolState);
    assert.equal(first.constructor, types.LineSpoolState);
    assert.equal(first.release(4), 4);
    assert.deepEqual(spool(first), { total: 20, released: 12, remaining: 8 });
    assert.equal(first.recover(3), 3);
    assert.deepEqual(spool(first), { total: 20, released: 9, remaining: 11 });
    assert.deepEqual(spool(second), { total: 20, released: 8, remaining: 12 });
    for (let frame = 0; frame < 128; frame += 1) {
      assert.equal(first.release(0.125), 0.125);
      assert.equal(first.recover(0.125), 0.125);
      assert.equal(first, owner);
    }
    assert.deepEqual(spool(first), { total: 20, released: 9, remaining: 11 });

    const distanceInput = Object.freeze({ previousDistanceMeters: 10, currentDistanceMeters: 8 });
    const tracker = new types.RodStrokeDistanceTracker();
    const distanceA = tracker.calculate(distanceInput), distanceB = tracker.calculate(distanceInput);
    assert.notEqual(distanceA, distanceB, "Historical fresh result identity must be retained");
    assert(Object.isFrozen(distanceA) && Object.isFrozen(distanceB));
    assert.equal(distanceA.gainedMeters, 2);
    assert.deepEqual(Object.keys(distanceA).sort(), ["currentDistanceMeters", "deltaMeters", "gainedMeters",
      "lostMeters", "previousDistanceMeters", "reason"]);
    assert.equal(JSON.stringify(distanceA), JSON.stringify(distanceB));
    const loadInput = Object.freeze({ dtMs: 500, config: Object.freeze({ enabled: true }), hasReel: true,
      playerHoldActive: true, rawTensionKg: 25, dragLimitKg: 40, reelMaxLoadKg: 100,
      retrieveSpeedMetersPerSecond: 4 });
    const policy = new types.ReelHoldLoadPolicy();
    const loadA = policy.evaluate(loadInput), loadB = policy.evaluate(loadInput);
    assert.notEqual(loadA, loadB);
    assert.equal(Object.isFrozen(loadA), false);
    assert.equal(loadA.maxMoveMeters, 1.5);
    assert.equal(loadA.blockedReason, "ready");
    assert.equal(JSON.stringify(loadA), JSON.stringify(loadB));
    loadA.maxMoveMeters = -1;
    assert.equal(loadB.maxMoveMeters, 1.5, "Result state must not alias");
    assert.deepEqual(Object.keys(tracker), []);
    assert.deepEqual(Object.keys(policy), []);
    return { lineSpool: { owner: "LineSystem instance -> LineSpoolState instance",
      ownerIdentityPreserved: true, separateInstancesIndependent: true, releaseRecoverSameInstance: true,
      repeatedMutationFrames: 128, final: spool(first) },
    tracker: { freshResultPerCall: true, frozenResult: true, callerInputUnchanged: true },
    policy: { freshResultPerCall: true, frozenResult: false, callerInputUnchanged: true,
      resultCopiesIndependent: true } };
  }

  // Use the actual classic consumer and the live bundled constructor. The proxy
  // observes construction only in this VM; it preserves the exact class/prototype
  // and is removed immediately after construction. No production hook is installed.
  lineSystem({ context, type, source }) {
    const instances = [];
    context.LineSpoolState = new Proxy(type, { construct(target, args) {
      const value = Reflect.construct(target, args, target);
      instances.push(value);
      return value;
    } });
    let line;
    try {
      const Type = vm.runInContext(`${source}\n;LineSystem;`, context, { timeout: 1000 });
      line = new Type({ config: {}, rod: {}, reel: { hasReel: () => true },
        lineStats: { effectiveStats: { lengthMeters: 20, maxLoadKg: 8 } },
        castDistanceCalculator: { pixelsPerMeter: 1,
          getLineReachModel: () => ({ baseReachMeters: 0, lineLengthMeters: 20, maxReachMeters: 20 }) } });
    } finally { context.LineSpoolState = type; }
    assert.equal(instances.length, 1, "One spool owner per actual LineSystem instance");
    const owner = instances[0];
    assert.equal(owner.constructor, type);
    line.updateDistance({ x: 8, y: 0 }, { x: 0, y: 0 });
    assert.equal(owner.releasedLineMeters, 8);
    line.updateDistance({ x: 12, y: 0 }, { x: 0, y: 0 });
    line.releaseForDistance(0);
    assert.equal(owner.releasedLineMeters, 12);
    assert.equal(line.recoverReleasedLine({ meters: 3, minReleasedMeters: 0 }), 3);
    const state = line.getState();
    assert.equal(owner.releasedLineMeters, 9);
    assert.equal(state.releasedMeters, owner.releasedLineMeters);
    assert.equal(state.remainingMeters, owner.remainingLineMeters);
    assert.equal(state.totalLineMeters, owner.totalLineMeters);
    assert.equal(instances.length, 1);
    return { scenario: "actual-classic-LineSystem-with-injected-distance-port", spoolConstructions: instances.length,
      exactLiveClass: true, sameOwnerAfterReleaseRecover: true, projectionEqualsOwner: true, final: spool(owner) };
  }
}

module.exports = { StageThreeBatch008StateProbe };
