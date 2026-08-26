"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchDependencyStateAuditBuilder,
  StageThreeBatchDependencyStateAuditValidator,
} = require("./domain_batches/stage_three_batch_dependency_state_audit");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  domainAudit: "architecture/migration/stage_3_domain_audit.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  output: "architecture/migration/stage_3_batch_006_audit.json",
});

function absolute(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function bytes(relativePath) {
  return fs.readFileSync(absolute(relativePath));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJsonWithFingerprint(relativePath) {
  const value = bytes(relativePath);
  return Object.freeze({
    document: JSON.parse(value.toString("utf8")),
    sha256: sha256(value),
  });
}

function buildArtifact() {
  const approvedPlan = readJsonWithFingerprint(PATHS.approvedPlan);
  const manifest = readJsonWithFingerprint(PATHS.manifest);
  const domainAudit = readJsonWithFingerprint(PATHS.domainAudit);
  const executionState = readJsonWithFingerprint(PATHS.executionState);
  const artifact = new StageThreeBatchDependencyStateAuditBuilder().build({
    approvedPlan: approvedPlan.document,
    approvedPlanSha256: approvedPlan.sha256,
    manifest: manifest.document,
    manifestSha256: manifest.sha256,
    domainAudit: domainAudit.document,
    domainAuditSha256: domainAudit.sha256,
    executionState: executionState.document,
    executionStateSha256: executionState.sha256,
    sourceReader: (relativePath) => fs.readFileSync(absolute(relativePath), "utf8"),
  });
  new StageThreeBatchDependencyStateAuditValidator().validate(artifact);
  return artifact;
}

function serialize(artifact) {
  return Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

function writeArtifact(artifact) {
  fs.writeFileSync(absolute(PATHS.output), serialize(artifact));
}

if (require.main === module) {
  const artifact = buildArtifact();
  writeArtifact(artifact);
  console.log(
    `Stage 3.6.1 audit generated: ${artifact.scope.targetCount} targets, ` +
      `${artifact.closure.newProjectModuleCount} closure additions, ` +
      `${artifact.compatibility.activations.length} activations; ${artifact.verdict}.`,
  );
}

module.exports = { PATHS, buildArtifact, serialize, writeArtifact };
