"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_024_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_024_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_024_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "024",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.61",
  toRelease: "0.24.62",
  completedBefore: 23,
  title: "Inventory Reservation Policy Domain",
  transitionPath: TRANSITION,
});

class Batch024ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch024ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
