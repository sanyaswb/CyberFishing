const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DomainAuditContract } = require("./domain_audit/domain_audit_contract");
const {
  DomainAuditSchemaMigrator,
} = require("./domain_audit/domain_audit_schema_migrator");
const { DomainAuditValidator } = require("./domain_audit/domain_audit_validator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const AUDIT_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "stage_3_domain_audit.json",
);

class StageThreeDomainAuditSchemaMigrationCheck {
  constructor({ contract, migrator, validator }) {
    this.contract = contract;
    this.migrator = migrator;
    this.validator = validator;
  }

  run() {
    const bytesBefore = fs.readFileSync(AUDIT_PATH, "utf8");
    const current = JSON.parse(bytesBefore);
    this.validator.validate(current);
    assert.equal(current.schemaVersion, 2);

    const versionOne = this.#toVersionOne(current);
    const versionOneBefore = this.#clone(versionOne);
    const migrated = this.migrator.migrate(versionOne);
    const repeated = this.migrator.migrate(versionOne);
    assert.deepEqual(repeated, migrated, "Domain audit migration must be deterministic");
    assert.deepEqual(versionOne, versionOneBefore, "Domain audit migration must be read-only");
    this.validator.validate(migrated, { expectedInventory: current });
    this.#assertSemanticPreservation(versionOne, migrated);
    assert(
      migrated.entries.every((entry) =>
        entry.dependencyAudit.status === "pending" &&
        entry.dependencyAudit.facts === null
      ),
      "v1 → v2 must not invent dependency observations",
    );

    const currentClone = this.migrator.migrate(current);
    assert.deepEqual(currentClone, current);
    assert.notEqual(currentClone, current);
    currentClone.entries.pop();
    assert.equal(current.entries.length, versionOne.entries.length);

    assert.throws(
      () => this.migrator.migrate({ ...this.#clone(current), schemaVersion: 3 }),
      /Unsupported domain audit schema migration/u,
    );
    const invalidV1 = this.#clone(versionOne);
    invalidV1.entries[0].unexpected = true;
    assert.throws(
      () => this.migrator.migrate(invalidV1),
      /not valid v1/u,
    );
    assert.equal(
      fs.readFileSync(AUDIT_PATH, "utf8"),
      bytesBefore,
      "Domain audit schema migration check must not mutate the artifact",
    );
    console.log(
      "Stage 3 domain audit schema migration passed: v1 → v2 is explicit, " +
        `preserves ${migrated.entries.length} conservative entries and adds ` +
        "only pending dependencyAudit contracts (6 cases).",
    );
  }

  #toVersionOne(current) {
    const versionOne = this.#clone(current);
    versionOne.schemaVersion = 1;
    versionOne.entries = versionOne.entries.map((entry) => {
      const result = this.#clone(entry);
      delete result.dependencyAudit;
      return result;
    });
    return versionOne;
  }

  #assertSemanticPreservation(versionOne, migrated) {
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.source, versionOne.source);
    assert.equal(migrated.entries.length, versionOne.entries.length);
    for (let index = 0; index < versionOne.entries.length; index += 1) {
      const before = versionOne.entries[index];
      const after = this.#clone(migrated.entries[index]);
      delete after.dependencyAudit;
      assert.deepEqual(
        after,
        before,
        `${before.currentPath} v1 facts must remain semantically unchanged`,
      );
    }
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

const contract = new DomainAuditContract();
new StageThreeDomainAuditSchemaMigrationCheck({
  contract,
  migrator: new DomainAuditSchemaMigrator(contract),
  validator: new DomainAuditValidator(contract),
}).run();
