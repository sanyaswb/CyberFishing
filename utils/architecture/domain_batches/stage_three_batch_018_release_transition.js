"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_018_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_018_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_018_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "018",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.54",
  toRelease: "0.24.55",
  completedBefore: 17,
  title: "Items Bait Freshness and Metrics Domain",
  transitionPath: TRANSITION,
});

class Batch018ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch018ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
