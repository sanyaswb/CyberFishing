"use strict";

// Every stage-specific constant of a post-freeze graph review. The Stage 3.22 profile is the
// default of every review component, so its recorded artifacts replay byte-for-byte; a repeated
// review supplies its own profile (stage label, artifact directory, expected topology, candidate
// numbering) and reads the completed prefix through the approved plan source.
class PostFreezeReviewProfile {
  constructor(fields) {
    Object.assign(this, fields);
    this.kind = name => `cyber-fishing-stage-${this.kindStage}-${name}`;
    this.artifacts = Object.freeze({
      baseline: `${this.directory}/baseline.json`,
      domainAudit: `${this.directory}/domain_audit.json`,
      graphReview: `${this.directory}/graph_review.json`,
      prerequisiteBacklog: `${this.directory}/prerequisite_backlog.json`,
      candidateBatches: `${this.directory}/candidate_batches.json`,
      reviewEvidence: `${this.directory}/review_evidence.json`,
      approvedPrefix: `${this.directory}/approved_prefix.json`,
    });
    this.idPattern = new RegExp(`^${this.idPrefix.replaceAll(".", "\\.")}(\\d{3})-[a-z0-9-]+-[0-9a-f]{8}$`, "u");
    Object.freeze(this);
  }
}

const STAGE_3_22 = new PostFreezeReviewProfile({
  stage: "3.22",
  kindStage: "3-22",
  directory: "architecture/migration/stage_3_22",
  expectedTopology: Object.freeze({ modules: 78, activations: 87, bridges: 139 }),
  firstOrder: 22,
  idPrefix: "stage-3.replan-322.batch-",
  taskPrefix: "stage-3.22.prerequisite.",
  preliminary: Object.freeze({ candidate: 28, prerequisiteBlocked: 9, deferred: 29 }),
  domainModuleCount: 135,
  // The completed prefix is the fully completed historical approved plan.
  completedFromPlanSource: false,
  // ESM-to-ESM import edges did not exist before the continuation batches.
  esmImportFacts: false,
  reviewOwner: "stage-3.22-post-freeze-graph-review",
  adoptionReason: "The Stage 3 execution state keeps the completed 001–021 prefix and its approved-plan fingerprint; executing batch 022 requires a separate reviewed adoption transition.",
  historicalCandidatesNote: "Historical candidates 022–040 remain reference material and are not replaced.",
});

// Repeated review after the Stage 3.22 prefix (022–032), the Stage 3.34.0 freeze extension
// (033–034) and the prerequisite transitions 001–005. Recorded as Stage 3.36.0: the next batch
// (035) is Stage 3.36, so the review is its opening sub-step, like the review-queue freeze.
const STAGE_3_36 = new PostFreezeReviewProfile({
  stage: "3.36",
  kindStage: "3-36",
  directory: "architecture/migration/stage_3_36_graph_review",
  // Active runtime at v0.24.72: distinct active activation targets / activations / bridges.
  expectedTopology: Object.freeze({ modules: 89, activations: 98, bridges: 143 }),
  firstOrder: 35,
  idPrefix: "stage-3.replan-336.batch-",
  taskPrefix: "stage-3.36.prerequisite.",
  preliminary: Object.freeze({ candidate: 7, prerequisiteBlocked: 2, deferred: 29 }),
  domainModuleCount: 135,
  completedFromPlanSource: true,
  esmImportFacts: true,
  reviewOwner: "stage-3.36-post-freeze-graph-review",
  adoptionReason: "The execution state keeps the completed 001–034 prefix and the adopted Stage 3.34.0 freeze extension; the first frozen batch adopts this approved prefix in its own prebuild state transition.",
  historicalCandidatesNote: "Historical candidates and the Stage 3.22 review remain reference material and are not replaced.",
});

// Repeated review after the Stage 3.36.0 prefix (035–038) and the prerequisite transitions 006–027 (the
// six responsibility decompositions and Vector2 Engine ownership). Recorded as Stage 3.40.0: the next
// batch (039) is Stage 3.40. Modules introduced by prerequisite transitions (created files, reviewed
// reclassifications into game-domain) are covered explicitly; the Domain scope is 139 modules.
const STAGE_3_40 = new PostFreezeReviewProfile({
  stage: "3.40",
  kindStage: "3-40",
  directory: "architecture/migration/stage_3_40_graph_review",
  // Active runtime after prerequisite 027: distinct active activation targets / activations / bridges.
  expectedTopology: Object.freeze({ modules: 94, activations: 103, bridges: 163 }),
  firstOrder: 39,
  idPrefix: "stage-3.replan-340.batch-",
  taskPrefix: "stage-3.40.prerequisite.",
  preliminary: Object.freeze({ candidate: 35, prerequisiteBlocked: 0, deferred: 0 }),
  domainModuleCount: 139,
  completedFromPlanSource: true,
  esmImportFacts: true,
  prerequisiteIntroducedCoverage: true,
  frozenConstantReview: true,
  reviewOwner: "stage-3.40-post-freeze-graph-review",
  adoptionReason: "The execution state keeps the completed 001–038 prefix and the adopted Stage 3.36.0 approved prefix; the first frozen batch adopts this approved prefix in its own prebuild state transition.",
  historicalCandidatesNote: "Historical candidates and the Stage 3.22 and 3.36 reviews remain reference material and are not replaced.",
});

module.exports = { PostFreezeReviewProfile, STAGE_3_22, STAGE_3_36, STAGE_3_40 };
