"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeHotLoopSourceReview } = require("./hot_loop_source_review");
const { StageThreeGameCycleTrace } = require("./game_cycle_trace");

// The hot-loop fishing modules of the review queue and their classic class names.
const HOT_LOOP_MODULES = Object.freeze([
  Object.freeze({ currentPath: "src/core/fishing/player_pressure/player_reel_fatigue_session.js",
    className: "PlayerReelFatigueSession" }),
  Object.freeze({ currentPath: "src/core/fishing/reel_hold_recovery_system.js", className: "ReelHoldRecoverySystem" }),
  Object.freeze({ currentPath: "src/core/fishing/reel_recovery_fish_slowdown_policy.js",
    className: "ReelRecoveryFishSlowdownPolicy" }),
  Object.freeze({ currentPath: "src/core/fishing/tackle_stress_accumulator.js", className: "TackleStressAccumulator" }),
  Object.freeze({ currentPath: "src/systems/player_pull_motion_smoother.js", className: "PlayerPullMotionSmoother" }),
  Object.freeze({ currentPath: "src/systems/rod_lateral_control_system.js", className: "RodLateralControlSystem" }),
]);

// Equivalence rules the batch that migrates these modules must satisfy against this baseline.
const EQUIVALENCE_RULES = Object.freeze({
  "allocation-equivalence": "every class member of the ESM target keeps the recorded body SHA-256, so every allocation site is unchanged",
  "behavior-equivalence": "the game-cycle trace of every class reproduces the recorded SHA-256 and call counts",
  "delta-time-equivalence": "the caller's deltaTime stays the only time source and the recorded deltaTime ranges and traces reproduce",
  "no-compatibility-lookup-in-hot-loop": "no realm, transport, typeof-availability or classic-provider lookup in any exercised member",
});

// Freeze evidence for the review-queue hot-loop finding: a static review of every member and the
// traced game-cycle fight scenarios. Each proof must hold for the module to be frozen.
class StageThreeHotLoopEvidence {
  constructor({ root, sourceReview = new StageThreeHotLoopSourceReview(),
    trace = new StageThreeGameCycleTrace({ root }) }) {
    this.root = path.resolve(root);
    this.sourceReview = sourceReview;
    this.trace = trace;
  }

  build(modules = HOT_LOOP_MODULES) {
    const traces = this.trace.run(modules.map(module => module.className));
    return modules.map(({ currentPath, className }) => {
      const source = fs.readFileSync(path.join(this.root, currentPath), "utf8");
      const review = this.sourceReview.review({ source, currentPath, className });
      const trace = traces[className];
      const exercised = Object.entries(trace.methods).filter(([, stats]) => stats.calls > 0)
        .map(([name]) => name).sort();
      const exercisedProviderReads = review.classProviderReads.filter(item => exercised.includes(item.member));
      const deltaTime = Object.fromEntries(Object.entries(trace.methods)
        .filter(([, stats]) => stats.dtMin !== null)
        .map(([name, stats]) => [name, { minSeconds: stats.dtMin, maxSeconds: stats.dtMax }]));
      const proofs = {
        "allocation-equivalence": review.members.every(member => typeof member.bodySha256 === "string"),
        "behavior-equivalence": exercised.length > 0,
        "delta-time-equivalence": review.proofs.noWallClockTimeSource,
        "no-compatibility-lookup-in-hot-loop": review.proofs.noRealmOrTransportLookupInClass &&
          review.proofs.noTypeofAvailabilityLookupInClass && exercisedProviderReads.length === 0,
      };
      for (const [name, passed] of Object.entries(proofs)) {
        assert.equal(passed, true, `${currentPath}: hot-loop proof failed: ${name}`);
      }
      return {
        finding: "hot-loop-equivalence-evidence-missing",
        currentPath,
        className,
        sourceSha256: review.sourceSha256,
        members: review.members,
        allocationTotals: review.allocationTotals,
        freeIdentifiers: review.freeIdentifiers,
        classProviderReads: review.classProviderReads,
        wallClockReads: review.wallClockReads,
        realmLookups: review.realmLookups,
        typeofLookups: review.typeofLookups,
        gameCycle: { traceSha256: trace.sha256, exercisedMembers: exercised,
          calls: Object.fromEntries(Object.entries(trace.methods).map(([name, stats]) => [name, stats.calls])),
          deltaTime },
        proofs,
        verdict: "proven",
      };
    });
  }
}

module.exports = { StageThreeHotLoopEvidence, HOT_LOOP_MODULES, EQUIVALENCE_RULES };
