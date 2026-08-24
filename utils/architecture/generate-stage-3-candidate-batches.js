"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const {
  DomainCandidatePolicyValidator,
  DomainModuleEligibilityPolicy,
} = require("./domain_batches/domain_candidate_policy");
const {
  DomainCandidateEvidenceJoiner,
} = require("./domain_batches/domain_candidate_evidence");
const {
  DomainCandidateClusterSelector,
  DomainEligibilityDecisionResolver,
} = require("./domain_batches/domain_candidate_cluster_selector");
const {
  DomainCandidateBatchDesigner,
  StageTwoCompatibilityExposureCatalog,
} = require("./domain_batches/domain_candidate_batch_designer");
const {
  ArtifactFingerprint,
  DomainCandidateArtifactBuilder,
  DomainCandidateArtifactValidator,
  DomainCandidateArtifactWriter,
} = require("./domain_batches/domain_candidate_artifact");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: "architecture/migration/stage_3_domain_audit.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  policy: "architecture/migration/stage_3_candidate_policy.json",
  compatibility: "architecture/migration/stage_3_compatibility_runtime.json",
  stageTwoPlan: "architecture/migration/stage_2_approved_batches.json",
  stageTwoState: "architecture/migration/stage_2_execution_state.json",
  index: "index.html",
  output: "architecture/migration/stage_3_candidate_batches.json",
});

function absolute(relativePath) {
  return path.resolve(PROJECT_ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function sourceFingerprints() {
  return {
    domainAuditPath: PATHS.audit,
    domainAuditSha256: ArtifactFingerprint.file(absolute(PATHS.audit)),
    manifestPath: PATHS.manifest,
    manifestSha256: ArtifactFingerprint.file(absolute(PATHS.manifest)),
    policyPath: PATHS.policy,
    policySha256: ArtifactFingerprint.file(absolute(PATHS.policy)),
    compatibilityContractPath: PATHS.compatibility,
    compatibilityContractSha256: ArtifactFingerprint.file(absolute(PATHS.compatibility)),
    stageTwoPlanPath: PATHS.stageTwoPlan,
    stageTwoPlanSha256: ArtifactFingerprint.file(absolute(PATHS.stageTwoPlan)),
    stageTwoStatePath: PATHS.stageTwoState,
    stageTwoStateSha256: ArtifactFingerprint.file(absolute(PATHS.stageTwoState)),
    indexPath: PATHS.index,
    indexSha256: ArtifactFingerprint.file(absolute(PATHS.index)),
  };
}

function buildArtifact() {
  const audit = readJson(PATHS.audit);
  const manifest = readJson(PATHS.manifest);
  const policyValue = new DomainCandidatePolicyValidator().validate(readJson(PATHS.policy));
  const modules = new DomainCandidateEvidenceJoiner().join({ audit, manifest });
  const eligibilityPolicy = new DomainModuleEligibilityPolicy(policyValue);
  const decisions = new DomainEligibilityDecisionResolver().resolve({
    modules,
    policy: eligibilityPolicy,
  });
  const clusters = new DomainCandidateClusterSelector(policyValue).select({
    modules,
    decisions,
  });
  const stageTwoPlan = readJson(PATHS.stageTwoPlan);
  const stageTwoState = readJson(PATHS.stageTwoState);
  const scripts = new LegacyScriptOrderReader(absolute(PATHS.index)).read();
  const stageTwoExposures = new StageTwoCompatibilityExposureCatalog({
    projectRoot: PROJECT_ROOT,
  }).collect({ approvedPlan: stageTwoPlan, executionState: stageTwoState, scripts });
  const design = new DomainCandidateBatchDesigner({ policy: policyValue }).design({
    modules,
    decisions,
    clusters,
    stageTwoExposures,
  });
  const sources = sourceFingerprints();
  const artifact = new DomainCandidateArtifactBuilder().build({
    releaseVersion: audit.source.releaseVersion,
    sources,
    policy: policyValue,
    modules,
    decisions,
    design,
  });
  new DomainCandidateArtifactValidator().validate({
    artifact,
    audit,
    manifest,
    expectedSourceFingerprints: sources,
  });
  return artifact;
}

function run() {
  const artifact = buildArtifact();
  new DomainCandidateArtifactWriter(absolute(PATHS.output)).write(artifact);
  console.log(
    `Stage 3 candidate plan generated: ${artifact.summary.candidateBatchCount} batches, ` +
      `${artifact.summary.assignedModuleCount} assigned, ` +
      `${artifact.summary.deferredModuleCount} deferred, 0 unassigned.`,
  );
}

if (require.main === module) run();

module.exports = { PATHS, buildArtifact, sourceFingerprints };
