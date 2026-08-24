"use strict";

const assert = require("node:assert/strict");
const { DomainSemanticAuditPersistence } = require("./domain_audit/domain_semantic_audit_persistence");

class StageThreeSemanticPersistenceFixtureCheck {
  run() {
    const persistence = new DomainSemanticAuditPersistence();
    const document = this.#document("evidence-a");
    const dependencyBefore = this.#clone(document.entries[0].dependencyAudit);
    const analysis = this.#analysis();
    const applied = persistence.apply({
      dependencyAuditDocument: document,
      analyses: [{ currentPath: "src/domain/a.js", ...analysis }],
    });
    assert.deepEqual(applied.entries[0].dependencyAudit, dependencyBefore);
    assert.deepEqual(applied.entries[0].stateOwnership, analysis.stateOwnership);
    assert.deepEqual(applied.entries[0].configurationInput, analysis.configurationInput);
    assert.deepEqual(applied.entries[0].performanceRisk, analysis.performanceRisk);
    assert.equal(document.entries[0].stateOwnership.status, "pending");

    const current = persistence.reconcileStale({
      inventoryDocument: this.#document("evidence-a"),
      existingDocument: applied,
    });
    assert.deepEqual(current.entries[0].stateOwnership, analysis.stateOwnership);
    assert.deepEqual(current.entries[0].dependencyAudit, dependencyBefore);

    const stale = persistence.reconcileStale({
      inventoryDocument: this.#document("evidence-b"),
      existingDocument: applied,
    });
    assert.equal(stale.entries[0].stateOwnership.status, "pending");
    assert.equal(stale.entries[0].configurationInput.status, "pending");
    assert.equal(stale.entries[0].performanceRisk.status, "pending");
    assert.deepEqual(stale.entries[0].dependencyAudit, dependencyBefore);

    assert.throws(
      () => persistence.apply({ dependencyAuditDocument: document, analyses: [] }),
      /Missing semantic audit analysis/u,
    );
    assert.throws(
      () => persistence.apply({
        dependencyAuditDocument: document,
        analyses: [
          { currentPath: "src/domain/a.js", ...analysis },
          { currentPath: "src/domain/a.js", ...analysis },
        ],
      }),
      /Duplicate semantic audit analysis path/u,
    );
    assert.throws(
      () => persistence.apply({
        dependencyAuditDocument: document,
        analyses: [
          { currentPath: "src/domain/a.js", ...analysis },
          { currentPath: "src/domain/extra.js", ...analysis },
        ],
      }),
      /must equal exact inventory scope/u,
    );
    console.log(
      "Stage 3 semantic persistence fixtures passed: exact scope, dependency isolation, " +
        "controlled field replacement and evidence-based stale reset (10 cases).",
    );
  }

  #document(fingerprint) {
    return {
      entries: [{
        currentPath: "src/domain/a.js",
        manifestEvidence: { fingerprint },
        dependencyAudit: { status: "verified", facts: { graphFingerprint: "graph" } },
        stateOwnership: { status: "pending", facts: null },
        configurationInput: { status: "pending", facts: null },
        performanceRisk: { status: "pending", facts: null },
      }],
    };
  }

  #analysis() {
    return {
      stateOwnership: { status: "verified", facts: { kind: "state" } },
      configurationInput: { status: "verified", facts: { kind: "config" } },
      performanceRisk: { status: "verified", facts: { kind: "performance" } },
    };
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

new StageThreeSemanticPersistenceFixtureCheck().run();
