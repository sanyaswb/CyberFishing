"use strict";

const { StageThreePatchReleaseTransition, STATE, RELEASE_PATHS: SHARED_RELEASE_PATHS } =
  require("./stage_three_patch_release_transition");
const { INFORMATIONAL_DOCUMENTS } = require("../informational_documents");
const { BATCH_025_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_025_preflight_profile");

const TRANSITION = "architecture/migration/stage_3_batch_025_release_transition.json";
const RELEASE_PROFILE = Object.freeze({
  batchNumber: "025",
  batchId: PROFILE.batchId,
  fromRelease: "0.24.62",
  toRelease: "0.24.63",
  completedBefore: 24,
  title: "Fishing Sector Pressure and Retrieve Domain",
  transitionPath: TRANSITION,
  informationalDocumentsExcluded: true,
});

// From batch 025 on, informational documents are not release metadata.
const RELEASE_PATHS = Object.freeze(SHARED_RELEASE_PATHS.filter(file => !INFORMATIONAL_DOCUMENTS.includes(file)));

class Batch025ReleaseTransition extends StageThreePatchReleaseTransition {
  constructor(root) { super(root, RELEASE_PROFILE); }
}

module.exports = { Batch025ReleaseTransition, RELEASE_PROFILE, TRANSITION, STATE, RELEASE_PATHS };
