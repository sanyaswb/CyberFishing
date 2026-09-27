"use strict";

// Inputs of the Stage 3.34.0 review-queue freeze and the artifacts it produces. The Stage 3.22
// review artifacts are read-only inputs; every new fact lives under stage_3_34_review_queue/.
const BASE = Object.freeze({
  approvedPrefix: "architecture/migration/stage_3_22/approved_prefix.json",
  candidateBatches: "architecture/migration/stage_3_22/candidate_batches.json",
  reviewEvidence: "architecture/migration/stage_3_22/review_evidence.json",
  prerequisiteBacklog: "architecture/migration/stage_3_22/prerequisite_backlog.json",
});

const INPUTS = Object.freeze({
  executionState: "architecture/migration/stage_3_execution_state.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
});

const DIRECTORY = "architecture/migration/stage_3_34_review_queue";
const ARTIFACTS = Object.freeze({
  collectionIdentityEvidence: `${DIRECTORY}/collection_identity_evidence.json`,
  hotLoopEvidence: `${DIRECTORY}/hot_loop_evidence.json`,
  freezeExtension: `${DIRECTORY}/freeze_extension.json`,
});

const EVIDENCE_TASKS = Object.freeze({
  collectionIdentity: "stage-3.22.prerequisite.collection-identity-evidence",
  hotLoop: "stage-3.22.prerequisite.hot-loop-equivalence-evidence",
});

module.exports = { BASE, INPUTS, DIRECTORY, ARTIFACTS, EVIDENCE_TASKS };
