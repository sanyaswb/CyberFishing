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
const espree = require("espree");
const { STAGE_3_22 } = require("./post_freeze_review_profile");
const { StageThreeApprovedPlanSource } = require("../domain_batches/stage_three_approved_plan_source");

const OBSERVED_FIELDS = Object.freeze(["observed", "analysis"]);

// Refreshes observations in memory, reports drift against the persisted Manifest without writing
// it, and re-runs the historical Domain audit pipeline over the current Domain scope: verified ESM
// targets of the completed prefix plus the classic Domain modules that remain.
class PostFreezeDomainAudit {
  build({ workspace, profile = STAGE_3_22 }) {
    const manifest = workspace.json(INPUTS.manifest);
    const policyData = workspace.json(INPUTS.policy);
    const observed = new LiveObservationSnapshot().build({
      projectRoot: workspace.root, policy: new ArchitecturePolicy(policyData), manifest,
    });
    const drift = this.#drift(manifest, observed);
    const state = workspace.json(INPUTS.executionState);
    const approved = profile.completedFromPlanSource
      ? new StageThreeApprovedPlanSource({ read: file => workspace.bytes(file) }).load(workspace.json(INPUTS.executionState)).document
      : workspace.json(HISTORICAL.approvedPlan);
    const completedBatches = profile.replacesIncompleteSuffix
      ? approved.batches.slice(0, state.completedBatchIds.length)
      : approved.batches;
    assert.deepEqual(completedBatches.map(batch => batch.id), state.completedBatchIds,
      "Domain audit completed batches differ from execution state");
    const completedTargets = new Set(completedBatches.flatMap(batch =>
      batch.modules.map(module => module.targetPath)));
    const contract = new DomainAuditContract();
    const releaseVersion = state.releaseVersion;
    const inventory = new ConservativeDomainInventoryBuilder(contract)
      .build({ manifest: observed, releaseVersion });
    const snapshot = new ArchitectureGuardSnapshotBuilder({
      projectRoot: workspace.root, policy: policyData, manifest: observed,
      bridgeRegistry: workspace.json(INPUTS.bridgeRegistry),
      globalBaseline: workspace.json(INPUTS.globalBaseline),
      debtRegistry: workspace.json(INPUTS.debtRegistry),
    }).build();
    const graph = new InducedDomainGraphBuilder(profile.esmImportFacts
      ? { esmImportNames: item => this.#importedNames(workspace, item) } : {})
      .build({ manifest: observed, unifiedGraph: snapshot.graph });
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
    const runtimeContract = workspace.json(INPUTS.runtimeContract);
    // A repeated review also counts retired placeholders and completed ESM importers as the
    // symbol-less consumers of a completed target.
    const shimActivations = profile.completedFromPlanSource
      ? [...runtimeContract.activationPositions, ...(runtimeContract.retiredActivations || []).map(record => record.activation)]
      : runtimeContract.activationPositions;
    for (const activation of shimActivations) {
      if (!activationShimsByTarget.has(activation.targetModule)) {
        activationShimsByTarget.set(activation.targetModule, new Set());
      }
      activationShimsByTarget.get(activation.targetModule).add(activation.sourceProvider);
    }
    if (profile.esmImportFacts) {
      for (const target of completedTargets) {
        const sources = activationShimsByTarget.get(target) || new Set();
        for (const importer of completedTargets) if (importer !== target) sources.add(importer);
        activationShimsByTarget.set(target, sources);
      }
    }
    new DomainAuditValidator(contract).validate(document, { expectedInventory: inventory,
      completedPrefix: { targets: completedTargets, activationShimsByTarget } });
    return {
      observed, unifiedGraph: snapshot.graph, completedTargets,
      audit: {
        schemaVersion: 1,
        kind: profile.kind("domain-audit"),
        stage: profile.stage,
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

  // Bindings of one static import declaration of a completed ESM target.
  #importedNames(workspace, item) {
    const tree = espree.parse(workspace.text(item.source), { ecmaVersion: "latest", sourceType: "module", loc: true });
    const declaration = tree.body.find(node => node.type === "ImportDeclaration" &&
      node.source.value === item.specifier && node.loc.start.line === item.location.line);
    assert(declaration, `import declaration not found: ${item.source}:${item.location.line}`);
    return declaration.specifiers.map(specifier => specifier.imported?.name || specifier.local.name);
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
