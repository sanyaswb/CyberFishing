"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_015_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_015_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_015_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "015",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.51",
  toRelease: "0.24.52",
  completedBefore: 14,
  title: "Fishing Endurance and Pressure Domain",
  transitionPath: TRANSITION,
});

class Batch015ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch015ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
