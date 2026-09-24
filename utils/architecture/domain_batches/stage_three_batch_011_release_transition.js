"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_011_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_011_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "011",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.47",
  toRelease: "0.24.48",
  completedBefore: 10,
  title: "Items Progression and Rarity Domain",
  transitionPath: TRANSITION,
});

class Batch011ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch011ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
