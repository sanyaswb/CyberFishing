"use strict";

const assert = require("node:assert/strict");
const {
  DomainDependencyAuditPersistence,
} = require("./domain_audit/domain_dependency_audit_persistence");

class StageThreeDependencyAuditPersistenceFixtureCheck {
  run() {
    const persistence = new DomainDependencyAuditPersistence();
    const inventory = this.#document("new-evidence");
    const existing = this.#document("new-evidence");
    existing.entries[0].dependencyAudit = this.#analysis("old-graph");
    existing.entries[0].stateOwnership = this.#reviewedAnalysis("state");
    existing.entries[0].configurationInput = this.#reviewedAnalysis("config");
    existing.entries[0].performanceRisk = this.#reviewedAnalysis("performance");
    const nextAnalysis = this.#analysis("new-graph");
    const applied = persistence.apply({
      inventoryDocument: inventory,
      existingDocument: existing,
      analyses: [{ currentPath: "src/domain/a.js", analysis: nextAnalysis }],
    });
    assert.deepEqual(applied.entries[0].dependencyAudit, nextAnalysis);
    assert.deepEqual(applied.entries[0].stateOwnership, existing.entries[0].stateOwnership);
    assert.deepEqual(
      applied.entries[0].configurationInput,
      existing.entries[0].configurationInput,
    );
    assert.deepEqual(
      applied.entries[0].performanceRisk,
      existing.entries[0].performanceRisk,
    );
    assert.deepEqual(inventory, this.#document("new-evidence"));

    const current = persistence.reconcileStale({
      inventoryDocument: inventory,
      existingDocument: applied,
      graphFingerprints: new Map([["src/domain/a.js", "new-graph"]]),
    });
    assert.deepEqual(current.entries[0].dependencyAudit, nextAnalysis);

    const staleGraph = persistence.reconcileStale({
      inventoryDocument: inventory,
      existingDocument: applied,
      graphFingerprints: new Map([["src/domain/a.js", "changed-graph"]]),
    });
    assert.deepEqual(staleGraph.entries[0].dependencyAudit, {
      status: "pending",
      facts: null,
    });
    assert.deepEqual(staleGraph.entries[0].stateOwnership, applied.entries[0].stateOwnership);

    const changedEvidenceInventory = this.#document("changed-evidence");
    const staleEvidence = persistence.reconcileStale({
      inventoryDocument: changedEvidenceInventory,
      existingDocument: applied,
      graphFingerprints: new Map([["src/domain/a.js", "new-graph"]]),
    });
    assert.equal(staleEvidence.entries[0].dependencyAudit.status, "pending");
    assert.deepEqual(
      staleEvidence.entries[0].configurationInput,
      applied.entries[0].configurationInput,
    );

    assert.throws(
      () => persistence.apply({
        inventoryDocument: inventory,
        existingDocument: null,
        analyses: [],
      }),
      /Missing dependency audit analysis/u,
    );
    assert.throws(
      () => persistence.apply({
        inventoryDocument: inventory,
        existingDocument: null,
        analyses: [
          { currentPath: "src/domain/a.js", analysis: nextAnalysis },
          { currentPath: "src/domain/a.js", analysis: nextAnalysis },
        ],
      }),
      /Duplicate dependency audit analysis path/u,
    );
    assert.throws(
      () => persistence.apply({
        inventoryDocument: inventory,
        existingDocument: null,
        analyses: [
          { currentPath: "src/domain/a.js", analysis: nextAnalysis },
          { currentPath: "src/domain/extra.js", analysis: nextAnalysis },
        ],
      }),
      /must equal exact inventory scope/u,
    );

    console.log(
      "Stage 3 dependency audit persistence fixtures passed: exact scope, " +
        "controlled replacement, graph/evidence staleness and isolation of state/config/performance analyses (10 cases).",
    );
  }

  #document(evidenceFingerprint) {
    return {
      entries: [{
        currentPath: "src/domain/a.js",
        manifestEvidence: { fingerprint: evidenceFingerprint },
        dependencyAudit: { status: "pending", facts: null },
        stateOwnership: { status: "pending", facts: null },
        configurationInput: { status: "pending", facts: null },
        performanceRisk: { status: "pending", facts: null },
      }],
    };
  }

  #analysis(graphFingerprint) {
    return { status: "verified", facts: { graphFingerprint } };
  }

  #reviewedAnalysis(kind) {
    return { status: "verified", facts: { kind } };
  }
}

new StageThreeDependencyAuditPersistenceFixtureCheck().run();
