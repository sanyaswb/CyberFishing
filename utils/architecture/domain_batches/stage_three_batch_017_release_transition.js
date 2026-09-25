"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_017_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_017_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_017_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "017",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.53",
  toRelease: "0.24.54",
  completedBefore: 16,
  title: "Inventory Item Location Domain",
  transitionPath: TRANSITION,
});

class Batch017ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch017ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
