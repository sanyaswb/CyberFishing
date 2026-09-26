"use strict";

const assert = require("node:assert/strict");
const { ArchitecturePolicy } = require("../core/architecture_policy");
const { LiveObservationSnapshot } = require("../observation/persistence/live_observation_snapshot");
const { ArchitectureGuardSnapshotBuilder } = require("../guards/corpus/architecture_guard_snapshot_builder");
const { DomainAuditContract } = require("../domain_audit/domain_audit_contract");
const { DomainAuditValidator } = require("../domain_audit/domain_audit_validator");
const { ConservativeDomainInventoryBuilder } = require("../domain_audit/conservative_domain_inventory_builder");
const { InducedDomainGraphBuilder } = require("../domain_audit/induced_domain_graph_builder");
const { DomainDependencyTopologyAnalyzer } = require("../domain_audit/domain_dependency_topology_analyzer");
const { DomainDependencyAuditPipeline } = require("../domain_audit/domain_dependency_audit_pipeline");
const { DomainDependencyAuditPersistence } = require("../domain_audit/domain_dependency_audit_persistence");
const { DomainSemanticAuditPipeline } = require("../domain_audit/domain_semantic_audit_pipeline");
const { DomainSemanticAuditPersistence } = require("../domain_audit/domain_semantic_audit_persistence");
const { INPUTS, HISTORICAL } = require("./post_freeze_paths");
const { sha256 } = require("./post_freeze_workspace");

const OBSERVED_FIELDS = Object.freeze(["observed", "analysis"]);

// Refreshes observations in memory, reports drift against the persisted Manifest without writing
// it, and re-runs the historical Domain audit pipeline over the current Domain scope: verified ESM
// targets of the completed prefix plus the classic Domain modules that remain.
class PostFreezeDomainAudit {
  build({ workspace }) {
    const manifest = workspace.json(INPUTS.manifest);
    const policyData = workspace.json(INPUTS.policy);
    const observed = new LiveObservationSnapshot().build({
      projectRoot: workspace.root, policy: new ArchitecturePolicy(policyData), manifest,
    });
    const drift = this.#drift(manifest, observed);
    const approved = workspace.json(HISTORICAL.approvedPlan);
    const completedTargets = new Set(approved.batches.flatMap(batch =>
      batch.modules.map(module => module.targetPath)));
    const contract = new DomainAuditContract();
    const releaseVersion = workspace.json(INPUTS.executionState).releaseVersion;
    const inventory = new ConservativeDomainInventoryBuilder(contract)
      .build({ manifest: observed, releaseVersion });
    const snapshot = new ArchitectureGuardSnapshotBuilder({
      projectRoot: workspace.root, policy: policyData, manifest: observed,
      bridgeRegistry: workspace.json(INPUTS.bridgeRegistry),
      globalBaseline: workspace.json(INPUTS.globalBaseline),
      debtRegistry: workspace.json(INPUTS.debtRegistry),
    }).build();
    const graph = new InducedDomainGraphBuilder().build({ manifest: observed, unifiedGraph: snapshot.graph });
    const topology = new DomainDependencyTopologyAnalyzer().analyze(graph);
    const analyses = new DomainDependencyAuditPipeline({ projectRoot: workspace.root, policy: policyData })
      .observe({ manifest: observed, graph, topology });
    const dependencyDocument = new DomainDependencyAuditPersistence()
      .apply({ inventoryDocument: inventory, existingDocument: null, analyses });
    const semantic = new DomainSemanticAuditPipeline({ projectRoot: workspace.root })
      .observe({ manifest: observed, dependencyAnalyses: analyses });
    const document = new DomainSemanticAuditPersistence()
      .apply({ dependencyAuditDocument: dependencyDocument, analyses: semantic });
    const esmEntries = document.entries.filter(entry => entry.manifestEvidence.legacyLoadOrder === null)
      .map(entry => entry.currentPath).sort();
    assert.deepEqual(esmEntries, [...completedTargets].sort(),
      "ESM Domain entries must be exactly the completed prefix targets");
    const activationShimsByTarget = new Map();
    for (const activation of workspace.json(INPUTS.runtimeContract).activationPositions) {
      if (!activationShimsByTarget.has(activation.targetModule)) {
        activationShimsByTarget.set(activation.targetModule, new Set());
      }
      activationShimsByTarget.get(activation.targetModule).add(activation.sourceProvider);
    }
    new DomainAuditValidator(contract).validate(document, { expectedInventory: inventory,
      completedPrefix: { targets: completedTargets, activationShimsByTarget } });
    return {
      observed, unifiedGraph: snapshot.graph, completedTargets,
      audit: {
        schemaVersion: 1,
        kind: "cyber-fishing-stage-3-22-domain-audit",
        stage: "3.22",
        releaseVersion,
        observation: {
          scope: "all-src-modules",
          modules: observed.modules.length,
          persistedManifestSha256: sha256(workspace.bytes(INPUTS.manifest)),
          refreshedInMemory: true,
          persistedManifestWritten: false,
          driftCount: drift.length,
          drift,
        },
        domainScope: {
          entries: document.entries.length,
          completedEsmTargets: esmEntries.length,
          remainingClassicModules: document.entries.length - esmEntries.length,
          shimsExcluded: observed.modules.filter(item =>
            (item.architecture?.roles || []).includes("compatibility-bridge")).length,
        },
        document,
      },
    };
  }

  #drift(manifest, observed) {
    const persisted = new Map(manifest.modules.map(item => [item.currentPath, item]));
    const live = new Map(observed.modules.map(item => [item.currentPath, item]));
    const drift = [];
    for (const [currentPath, item] of live) {
      const before = persisted.get(currentPath);
      if (!before) {
        drift.push({ currentPath, kind: "unpersisted-module" });
        continue;
      }
      for (const field of OBSERVED_FIELDS) {
        if (JSON.stringify(before[field]) !== JSON.stringify(item[field])) {
          drift.push({ currentPath, kind: `${field}-differs` });
        }
      }
    }
    for (const currentPath of persisted.keys()) {
      if (!live.has(currentPath)) drift.push({ currentPath, kind: "missing-source" });
    }
    return drift.sort((left, right) => `${left.currentPath}\0${left.kind}`
      .localeCompare(`${right.currentPath}\0${right.kind}`));
  }
}

module.exports = { PostFreezeDomainAudit };
