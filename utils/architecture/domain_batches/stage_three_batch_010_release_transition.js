"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS } = require("./stage_three_patch_release_transition");
const { PROFILE } = require("./stage_three_batch_010_preflight");

const TRANSITION = "architecture/migration/stage_3_batch_010_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "010",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.46",
  toRelease: "0.24.47",
  completedBefore: 9,
  title: "Inventory Assembly Capacity Domain",
  transitionPath: TRANSITION,
});

class Batch010ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch010ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
