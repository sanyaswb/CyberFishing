"use strict";

// Inputs of the Stage 3.22 post-freeze graph review and the artifacts it produces. Historical
// Stage 3 artifacts are read-only inputs; every Stage 3.22 output lives under stage_3_22/.
const INPUTS = Object.freeze({
  manifest: "architecture/migration/module_migration_manifest.json",
  policy: "architecture/module_architecture.json",
  candidatePolicy: "architecture/migration/stage_3_candidate_policy.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  globalBaseline: "architecture/guards/global_provider_baseline.json",
  debtRegistry: "architecture/guards/known_debt_registry.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  index: "index.html",
  packageJson: "package.json",
  packageLock: "package-lock.json",
});

const HISTORICAL = Object.freeze({
  domainAudit: "architecture/migration/stage_3_domain_audit.json",
  candidates: "architecture/migration/stage_3_candidate_batches.json",
  reviewEvidence: "architecture/migration/stage_3_review_evidence.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
});

const DIRECTORY = "architecture/migration/stage_3_22";
const ARTIFACTS = Object.freeze({
  baseline: `${DIRECTORY}/baseline.json`,
  domainAudit: `${DIRECTORY}/domain_audit.json`,
  graphReview: `${DIRECTORY}/graph_review.json`,
  prerequisiteBacklog: `${DIRECTORY}/prerequisite_backlog.json`,
  candidateBatches: `${DIRECTORY}/candidate_batches.json`,
  reviewEvidence: `${DIRECTORY}/review_evidence.json`,
  approvedPrefix: `${DIRECTORY}/approved_prefix.json`,
  acceptance: `${DIRECTORY}/acceptance.json`,
  releaseTransition: `${DIRECTORY}/release_transition.json`,
  releaseClosure: `${DIRECTORY}/release_closure.json`,
});

const RUNTIME_OUTPUT_DIRECTORY = "dist/stage-3-compat-runtime";

module.exports = { INPUTS, HISTORICAL, DIRECTORY, ARTIFACTS, RUNTIME_OUTPUT_DIRECTORY };
