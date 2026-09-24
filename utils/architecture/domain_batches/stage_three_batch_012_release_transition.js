"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_012_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_012_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "012",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.48",
  toRelease: "0.24.49",
  completedBefore: 11,
  title: "Assemblies Domain",
  transitionPath: TRANSITION,
});

class Batch012ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch012ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
