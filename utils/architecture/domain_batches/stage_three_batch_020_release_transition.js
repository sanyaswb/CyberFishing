"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { BATCH_020_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_020_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_020_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "020",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.56",
  toRelease: "0.24.57",
  completedBefore: 19,
  title: "Assemblies Refill Signature and State Domain",
  transitionPath: TRANSITION,
});

class Batch020ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch020ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
