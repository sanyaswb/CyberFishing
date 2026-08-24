"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DomainAuditContract } = require("./domain_audit_contract");
const { DomainAuditValidator } = require("./domain_audit_validator");

class StageThreeHistoricalAuditGuard {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  isActive() {
    return this.#readJson(
      "architecture/migration/stage_3_execution_state.json",
    ).compatibilityRuntimeActivated === true;
  }

  validate() {
    const approved = this.#readJson(
      "architecture/migration/stage_3_approved_batches.json",
    );
    const candidatePath = approved.sourceCandidate.path;
    const candidate = this.#readJson(candidatePath);
    const auditPath = candidate.source.domainAuditPath;
    const audit = this.#readJson(auditPath);
    this.#require(
      this.#sha256(candidatePath) === approved.sourceCandidate.sha256,
      "Frozen Stage 3 candidate SHA-256 changed after runtime activation",
    );
    this.#require(
      this.#sha256(auditPath) === candidate.source.domainAuditSha256,
      "Frozen Stage 3 domain-audit SHA-256 changed after runtime activation",
    );
    const summary = new DomainAuditValidator(
      new DomainAuditContract(),
    ).validate(audit);
    this.#require(summary.entries === 135, "Frozen domain audit must cover 135 modules");
    this.#require(summary.pendingAnalyses === 0, "Frozen domain audit cannot contain pending analyses");
    return Object.freeze({
      entries: summary.entries,
      pendingAnalyses: summary.pendingAnalyses,
      auditSha256: candidate.source.domainAuditSha256,
      candidateSha256: approved.sourceCandidate.sha256,
    });
  }

  #readJson(relativePath) {
    return JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8"),
    );
  }

  #sha256(relativePath) {
    return crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(this.projectRoot, relativePath)))
      .digest("hex");
  }

  #require(condition, message) {
    if (!condition) throw new Error(message);
  }
}

module.exports = { StageThreeHistoricalAuditGuard };
