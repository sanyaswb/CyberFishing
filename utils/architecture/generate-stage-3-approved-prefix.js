"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeApprovedPrefixBuilder,
  StageThreeApprovedPrefixValidator,
  StageThreeExecutionStateBuilder,
  StageThreeExecutionStateValidator,
  StageThreeReviewEvidenceBuilder,
} = require("./domain_batches/domain_approved_prefix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  candidate: "architecture/migration/stage_3_candidate_batches.json",
  review: "architecture/migration/stage_3_review_evidence.json",
  approved: "architecture/migration/stage_3_approved_batches.json",
  state: "architecture/migration/stage_3_execution_state.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  index: "index.html",
  output: "dist/stage-3-compat-runtime",
});

function absolute(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function bytes(relativePath) {
  return fs.readFileSync(absolute(relativePath));
}

function json(relativePath) {
  return JSON.parse(bytes(relativePath).toString("utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildArtifacts({ runtimeFacts = readRuntimeFacts() } = {}) {
  const candidateBytes = bytes(PATHS.candidate);
  const candidate = JSON.parse(candidateBytes.toString("utf8"));
  const candidateSha256 = sha256(candidateBytes);
  const reviewEvidence = new StageThreeReviewEvidenceBuilder().build({
    candidate,
    candidateSha256,
  });
  const reviewBytes = Buffer.from(serialize(reviewEvidence), "utf8");
  const reviewEvidenceSha256 = sha256(reviewBytes);
  const approvedPlan = new StageThreeApprovedPrefixBuilder().build({
    candidate,
    candidateSha256,
    reviewEvidence,
    reviewEvidenceSha256,
  });
  const approvedBytes = Buffer.from(serialize(approvedPlan), "utf8");
  const approvedPlanSha256 = sha256(approvedBytes);
  const state = new StageThreeExecutionStateBuilder().build({ approvedPlanSha256 });
  new StageThreeApprovedPrefixValidator().validate({
    candidate,
    candidateSha256,
    reviewEvidence,
    reviewEvidenceSha256,
    approvedPlan,
  });
  new StageThreeExecutionStateValidator().validate({
    approvedPlan,
    approvedPlanSha256,
    state,
    runtimeFacts,
  });
  return Object.freeze({
    reviewEvidence,
    approvedPlan,
    state,
    serialized: Object.freeze({
      review: reviewBytes,
      approved: approvedBytes,
      state: Buffer.from(serialize(state), "utf8"),
    }),
  });
}

function readRuntimeFacts() {
  const contract = json(PATHS.runtimeContract);
  const html = bytes(PATHS.index).toString("utf8");
  return Object.freeze({
    contractStatus: contract.status,
    runtimeScriptCount: (
      html.match(/<script\b[^>]*stage-3-compat-runtime[^>]*><\/script>/giu) || []
    ).length,
    outputExists: fs.existsSync(absolute(PATHS.output)),
  });
}

function writeArtifacts(artifacts) {
  fs.writeFileSync(absolute(PATHS.review), artifacts.serialized.review);
  fs.writeFileSync(absolute(PATHS.approved), artifacts.serialized.approved);
  fs.writeFileSync(absolute(PATHS.state), artifacts.serialized.state);
}

if (require.main === module) {
  const artifacts = buildArtifacts();
  writeArtifacts(artifacts);
  console.log(
    `Stage 3 approved prefix generated: ` +
      `${artifacts.approvedPlan.summary.frozenBatchCount} batches / ` +
      `${artifacts.approvedPlan.summary.frozenModuleCount} modules frozen; ` +
      `${artifacts.approvedPlan.summary.reviewQueueBatchCount} batches require replan.`,
  );
}

module.exports = { PATHS, buildArtifacts, readRuntimeFacts, writeArtifacts };
