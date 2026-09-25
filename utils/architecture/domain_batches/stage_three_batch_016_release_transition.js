"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_016_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_016_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_016_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "016",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.52",
  toRelease: "0.24.53",
  completedBefore: 15,
  title: "Fishing Pressure Fatigue Source Domain",
  transitionPath: TRANSITION,
});

class Batch016ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch016ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
