"use strict";

const assert = require("node:assert/strict");
const { INPUTS, HISTORICAL, ARTIFACTS } = require("./post_freeze_paths");
const { sha256, serialize } = require("./post_freeze_workspace");
const { PostFreezeBaselineBuilder, EXPECTED_TOPOLOGY } = require("./post_freeze_baseline");
const { PostFreezeDomainAudit } = require("./post_freeze_domain_audit");
const { PostFreezeLogicalGraphBuilder } = require("./post_freeze_logical_graph");
const { PostFreezeEligibilityClassifier } = require("./post_freeze_eligibility");
const {
  PostFreezeEvidenceReviewer,
  PostFreezeProviderIndex,
  REVIEWED_COLLECTIONS,
} = require("./post_freeze_evidence_review");
const { PostFreezePrerequisiteBacklogBuilder } = require("./post_freeze_prerequisite_backlog");
const { PostFreezeCandidatePlanner, FIRST_ORDER, ID_PREFIX } = require("./post_freeze_candidate_plan");
const {
  PostFreezeReviewEvidenceBuilder,
  PostFreezeApprovedPrefixBuilder,
  PostFreezeApprovedPrefixValidator,
} = require("./post_freeze_approved_prefix");

const PRELIMINARY = Object.freeze({ candidate: 28, prerequisiteBlocked: 9, deferred: 29 });
const DOMAIN_MODULE_COUNT = 135;

// Composes the Stage 3.22 post-freeze graph review. Every artifact is built in memory and
// references its inputs by the SHA-256 of their exact serialized bytes, so a replay either
// reproduces every artifact byte-for-byte or reports the first stale link.
class PostFreezeReview {
  constructor({
    domainAudit = new PostFreezeDomainAudit(),
    logicalGraph = new PostFreezeLogicalGraphBuilder(),
    eligibility = new PostFreezeEligibilityClassifier(),
    backlog = new PostFreezePrerequisiteBacklogBuilder(),
    planner = new PostFreezeCandidatePlanner(),
  } = {}) {
    this.domainAudit = domainAudit;
    this.logicalGraph = logicalGraph;
    this.eligibility = eligibility;
    this.backlog = backlog;
    this.planner = planner;
  }

  build({ workspace, commit }) {
    const artifacts = new Map();
    const emit = (path, document) => {
      const bytes = serialize(document);
      artifacts.set(path, bytes);
      return { path, sha256: sha256(bytes) };
    };
    const input = file => workspace.fingerprint(file);
    const baseline = new PostFreezeBaselineBuilder().build({ workspace, commit });
    const baselineRef = emit(ARTIFACTS.baseline, baseline);
    const audit = this.domainAudit.build({ workspace });
    const auditRef = emit(ARTIFACTS.domainAudit, { ...audit.audit, baseline: baselineRef });
    const runtimeContract = workspace.json(INPUTS.runtimeContract);
    const bridgeRegistry = workspace.json(INPUTS.bridgeRegistry);
    const historicalPlan = workspace.json(HISTORICAL.approvedPlan);
    const readSource = file => workspace.text(file);
    const graph = this.logicalGraph.build({ document: audit.audit.document, completedTargets: audit.completedTargets,
      runtimeContract, bridgeRegistry, unifiedGraph: audit.unifiedGraph, readSource });
    const eligibility = this.eligibility.classify({ document: audit.audit.document,
      completedTargets: audit.completedTargets, observed: audit.observed,
      candidatePolicy: workspace.json(INPUTS.candidatePolicy), historicalPlan });
    const providers = new PostFreezeProviderIndex().build({ modules: eligibility.modules, runtimeContract,
      completedTargets: audit.completedTargets });
    const graphRef = emit(ARTIFACTS.graphReview, {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-22-graph-review",
      stage: "3.22",
      releaseVersion: baseline.releaseVersion,
      sources: { baseline: baselineRef, domainAudit: auditRef,
        runtimeContract: input(INPUTS.runtimeContract), bridgeRegistry: input(INPUTS.bridgeRegistry) },
      physicalGraph: graph.physical,
      activationResolution: graph.activationResolution,
      logicalGraph: graph.logical,
      sccs: graph.sccs,
      dependencyOrder: graph.dependencyOrder,
      nodes: graph.nodes,
      providerAmbiguities: providers.ambiguous,
      reassessment: {
        summary: eligibility.summary,
        preliminary: { ...PRELIMINARY, status: "observation-not-limit",
          matchesObservation: eligibility.summary.candidate === PRELIMINARY.candidate &&
            eligibility.summary.prerequisiteBlocked === PRELIMINARY.prerequisiteBlocked &&
            eligibility.summary.deferred === PRELIMINARY.deferred },
        records: eligibility.records.map(record => ({
          currentPath: record.currentPath,
          targetPath: record.targetPath,
          targetArea: record.targetArea,
          category: record.category,
          historicalCoverage: record.historicalCoverage,
          eligibilityStatus: record.eligibility.status,
          reasonCodes: record.eligibility.reasonCodes,
          prerequisites: record.eligibility.prerequisites,
          invariantImpact: record.eligibility.invariantImpact,
          blockedBy: record.blockedBy,
        })),
      },
    });
    const evidence = new PostFreezeEvidenceReviewer({
      requiredHotLoopEvidence: eligibility.policy.performanceInvariant.requiredHotLoopEvidence,
    }).review({ modules: eligibility.modules, categories: eligibility.categories,
      providerIndex: providers.index, readSource });
    const backlog = this.backlog.build({ eligibility, evidence, unifiedGraph: audit.unifiedGraph,
      providerAmbiguities: providers.ambiguous, readSource, sourceExists: file => workspace.exists(file) });
    const backlogDocument = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-22-prerequisite-backlog",
      stage: "3.22",
      status: "open",
      sources: { graphReview: graphRef },
      refactoringPerformed: false,
      summary: backlog.summary,
      tasks: backlog.tasks,
      coverage: backlog.coverage,
    };
    const backlogRef = emit(ARTIFACTS.prerequisiteBacklog, backlogDocument);
    const state = workspace.json(INPUTS.executionState);
    const plan = this.planner.plan({ eligibility, evidence, logicalGraph: graph, runtimeContract,
      bridgeRegistry, completedBatchIds: state.completedBatchIds });
    const completedPrefix = {
      status: "completed-unchanged",
      approvedPlan: input(HISTORICAL.approvedPlan),
      executionState: input(INPUTS.executionState),
      completedBatchIds: [...state.completedBatchIds],
      targets: [...audit.completedTargets].sort(),
    };
    const candidates = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-22-candidate-batches",
      stage: "3.22",
      status: "candidate",
      runtimeMigrationAllowed: false,
      sources: { graphReview: graphRef, prerequisiteBacklog: backlogRef,
        candidatePolicy: input(INPUTS.candidatePolicy) },
      idScheme: { prefix: ID_PREFIX, firstOrder: FIRST_ORDER,
        format: `${ID_PREFIX}<order>-<target-area>-<sha8 of sorted module paths>` },
      policy: eligibility.policy.clustering,
      ordering: "evidence-ready-clusters-first-then-dependency-depth-eligibility-risk-component-area",
      completedPrefix: { approvedPlan: completedPrefix.approvedPlan, completedBatchIds: completedPrefix.completedBatchIds },
      historicalCandidates: { ...input(HISTORICAL.candidates), status: "reference-only",
        note: "Historical candidates 022–040 remain reference material and are not replaced." },
      summary: {
        remainingModuleCount: eligibility.summary.remainingModuleCount,
        candidateBatchCount: plan.batches.length,
        assignedModuleCount: plan.coverage.assigned.length,
        prerequisiteBlockedModuleCount: plan.coverage.prerequisiteBlocked.length,
        deferredModuleCount: plan.coverage.deferred.length,
        unassignedModuleCount: 0,
        coverageStatus: "complete-assigned-blocked-or-deferred",
      },
      batches: plan.batches,
      prerequisiteBlocked: plan.prerequisiteBlocked,
      deferred: plan.deferred,
      coverage: plan.coverage,
    };
    const candidateRef = emit(ARTIFACTS.candidateBatches, candidates);
    const reviewEvidence = new PostFreezeReviewEvidenceBuilder().build({ candidates, candidateRef, evidence,
      backlog: backlogDocument, reviewedCollections: REVIEWED_COLLECTIONS });
    const reviewRef = emit(ARTIFACTS.reviewEvidence, reviewEvidence);
    const approved = new PostFreezeApprovedPrefixBuilder().build({ candidates, candidateRef, reviewEvidence,
      reviewEvidenceRef: reviewRef, backlog: backlogDocument, backlogRef, completedPrefix,
      historical: {
        status: "reference-only",
        domainAudit: input(HISTORICAL.domainAudit),
        candidates: input(HISTORICAL.candidates),
        reviewEvidence: input(HISTORICAL.reviewEvidence),
        approvedPlan: input(HISTORICAL.approvedPlan),
      },
      baselineTopology: { ...EXPECTED_TOPOLOGY } });
    new PostFreezeApprovedPrefixValidator().validate({ approved, candidates, reviewEvidence,
      expectedDomainModuleCount: DOMAIN_MODULE_COUNT });
    emit(ARTIFACTS.approvedPrefix, approved);
    assert.equal(audit.audit.domainScope.entries, DOMAIN_MODULE_COUNT, "Domain scope must contain 135 modules");
    return {
      artifacts,
      summary: this.#summary({ audit, graph, eligibility, backlog, candidates, approved }),
      context: { audit, graph, eligibility, evidence, backlog, plan, candidates, reviewEvidence, approved,
        runtimeContract, bridgeRegistry },
    };
  }

  #summary({ audit, graph, eligibility, backlog, candidates, approved }) {
    return {
      observationDrift: audit.audit.observation.driftCount,
      domainScope: audit.audit.domainScope,
      logicalGraph: { nodes: graph.logical.nodeCount, edges: graph.logical.edgeCount,
        edgesByKind: graph.logical.edgesByKind, cyclicSccs: graph.sccs.logical.cyclic.length },
      reassessment: eligibility.summary,
      backlog: backlog.summary,
      candidates: candidates.summary,
      approvedPrefix: approved.summary,
      freezeBoundary: approved.freezeBoundary,
    };
  }
}

module.exports = { PostFreezeReview, PRELIMINARY, DOMAIN_MODULE_COUNT };
