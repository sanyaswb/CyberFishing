"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_022_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_022_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_022_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "022",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.59",
  toRelease: "0.24.60",
  completedBefore: 21,
  title: "Assemblies Item Reader Domain",
  transitionPath: TRANSITION,
});

class Batch022ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch022ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
