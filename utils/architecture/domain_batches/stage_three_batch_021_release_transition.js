"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_021_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_021_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_021_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "021",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.57",
  toRelease: "0.24.58",
  completedBefore: 20,
  title: "Equipment Auto Refill Policy Domain",
  transitionPath: TRANSITION,
});

class Batch021ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch021ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
