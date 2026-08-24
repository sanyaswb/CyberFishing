const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DomainAuditContract } = require("./domain_audit/domain_audit_contract");
const { DomainAuditRepository } = require("./domain_audit/domain_audit_repository");
const { DomainAuditValidator } = require("./domain_audit/domain_audit_validator");
const {
  ConservativeDomainInventoryBuilder,
} = require("./domain_audit/conservative_domain_inventory_builder");
const {
  RepositoryContentSnapshot,
} = require("./esm_infrastructure/repository_content_snapshot");
const { StageThreeHistoricalAuditGuard } = require("./domain_audit/stage_three_historical_audit_guard");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);
const AUDIT_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "stage_3_domain_audit.json",
);
const PACKAGE_PATH = path.join(PROJECT_ROOT, "package.json");

class StageThreeDomainAuditCorpusCheck {
  constructor({ contract, builder, validator, repository, contentSnapshot }) {
    this.contract = contract;
    this.builder = builder;
    this.validator = validator;
    this.repository = repository;
    this.contentSnapshot = contentSnapshot;
  }

  run() {
    const historicalGuard = new StageThreeHistoricalAuditGuard(PROJECT_ROOT);
    if (historicalGuard.isActive()) {
      const historical = historicalGuard.validate();
      console.log(
        `Stage 3 domain audit passed as frozen planning evidence: ${historical.entries} entries, 0 pending analyses, exact candidate/audit SHA-256.`,
      );
      return;
    }
    const repositoryBefore = this.contentSnapshot.capture();
    const manifestBytes = fs.readFileSync(MANIFEST_PATH, "utf8");
    const auditBytes = this.repository.readBytes();
    const manifest = JSON.parse(manifestBytes);
    const releaseVersion = JSON.parse(
      fs.readFileSync(PACKAGE_PATH, "utf8"),
    ).version;
    const model = this.repository.read();
    const document = model.snapshot();
    const expected = this.builder.build({ manifest, releaseVersion });
    const repeated = this.builder.build({ manifest, releaseVersion });
    assert.deepEqual(repeated, expected, "Domain corpus inventory must be deterministic");
    const summary = this.validator.validate(document, {
      expectedInventory: expected,
    });
    assert.equal(
      auditBytes.replaceAll("\r\n", "\n"),
      `${JSON.stringify(document, null, 2)}\n`,
      "Stage 3 domain audit JSON must be byte-stable canonical output",
    );
    assert.equal(
      summary.pendingAnalyses,
      0,
      "Stage 3.0.3 must complete every audit analysis field",
    );
    for (const entry of document.entries) {
      assert(["verified", "partial"].includes(entry.dependencyAudit.status));
      assert.notEqual(entry.dependencyAudit.facts, null);
      assert.notEqual(entry.stateOwnership.facts, null);
      assert.notEqual(entry.configurationInput.facts, null);
      assert.notEqual(entry.performanceRisk.facts, null);
    }
    assert.equal(fs.readFileSync(MANIFEST_PATH, "utf8"), manifestBytes);
    assert.equal(this.repository.readBytes(), auditBytes);
    assert.deepEqual(
      this.contentSnapshot.capture(),
      repositoryBefore,
      "Stage 3 domain audit corpus check must not mutate repository content",
    );

    const areas = new Set(document.entries.map((entry) =>
      entry.targetPath.split("/")[3]
    ));
    const entriesWithBlockers = document.entries.filter((entry) =>
      entry.manifestEvidence.blockers.items.length > 0
    ).length;
    const reverseLinks = document.entries.reduce(
      (total, entry) => total + entry.manifestEvidence.reverseConsumers.length,
      0,
    );
    console.log(
      "Stage 3 domain audit corpus passed: " +
        `${summary.entries} exact ${this.contract.scopeRule.value} entries, ` +
        `${areas.size} target areas, ${reverseLinks} derived reverse links, ` +
        `${entriesWithBlockers} entries with reviewed blockers and ` +
        `${summary.pendingAnalyses} pending analyses; ` +
        "Manifest and repository bytes unchanged.",
    );
  }
}

const contract = new DomainAuditContract();
new StageThreeDomainAuditCorpusCheck({
  contract,
  builder: new ConservativeDomainInventoryBuilder(contract),
  validator: new DomainAuditValidator(contract),
  repository: new DomainAuditRepository(AUDIT_PATH),
  contentSnapshot: new RepositoryContentSnapshot(PROJECT_ROOT),
}).run();
