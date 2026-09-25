"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_014_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_014_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_014_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "014",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.50",
  toRelease: "0.24.51",
  completedBefore: 13,
  title: "Fishing Stamina and Tackle Domain",
  transitionPath: TRANSITION,
});

class Batch014ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch014ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
