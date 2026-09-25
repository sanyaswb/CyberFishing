"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_019_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_019_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_019_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "019",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.55",
  toRelease: "0.24.56",
  completedBefore: 18,
  title: "Items Bait Grade Decay and Quality Domain",
  transitionPath: TRANSITION,
});

class Batch019ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch019ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
