"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_013_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_013_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_013_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "013",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.49",
  toRelease: "0.24.50",
  completedBefore: 12,
  title: "Fishing Domain",
  transitionPath: TRANSITION,
});

class Batch013ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch013ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
