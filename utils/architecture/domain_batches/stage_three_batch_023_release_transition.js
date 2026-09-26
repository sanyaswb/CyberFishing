"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_023_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_023_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_023_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "023",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.60",
  toRelease: "0.24.61",
  completedBefore: 22,
  title: "Items Metric Strategies Domain",
  transitionPath: TRANSITION,
});

class Batch023ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch023ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
