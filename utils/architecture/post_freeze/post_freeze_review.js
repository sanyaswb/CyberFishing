"use strict";

const assert = require("node:assert/strict");
const { INPUTS, HISTORICAL } = require("./post_freeze_paths");
const { sha256, serialize } = require("./post_freeze_workspace");
const { PostFreezeBaselineBuilder } = require("./post_freeze_baseline");
const { PostFreezeDomainAudit } = require("./post_freeze_domain_audit");
const { PostFreezeLogicalGraphBuilder } = require("./post_freeze_logical_graph");
const { PostFreezeEligibilityClassifier } = require("./post_freeze_eligibility");
const {
  PostFreezeEvidenceReviewer,
  PostFreezeProviderIndex,
  REVIEWED_COLLECTIONS,
} = require("./post_freeze_evidence_review");
const { PostFreezePrerequisiteBacklogBuilder } = require("./post_freeze_prerequisite_backlog");
const { PostFreezeCandidatePlanner } = require("./post_freeze_candidate_plan");
const {
  PostFreezeReviewEvidenceBuilder,
  PostFreezeApprovedPrefixBuilder,
  PostFreezeApprovedPrefixValidator,
} = require("./post_freeze_approved_prefix");
const { STAGE_3_22 } = require("./post_freeze_review_profile");
const { StageThreeApprovedPlanSource } = require("../domain_batches/stage_three_approved_plan_source");

const PRELIMINARY = STAGE_3_22.preliminary;
const DOMAIN_MODULE_COUNT = STAGE_3_22.domainModuleCount;

// Composes a post-freeze graph review (the Stage 3.22 profile by default). Every artifact is built in memory and
// references its inputs by the SHA-256 of their exact serialized bytes, so a replay either
// reproduces every artifact byte-for-byte or reports the first stale link.
// Domain modules introduced by recorded prerequisite transitions: source files they created and
// modules they reclassified into game-domain (reviewed Manifest updates).
function prerequisiteIntroducedPaths(root) {
  const { StageThreePrerequisiteLedger } = require("../stage_three_prerequisites/core/prerequisite_ledger");
  const paths = new Set();
  for (const record of new StageThreePrerequisiteLedger(root).records()) {
    for (const write of record.writes) {
      if (write.beforeSha256 === null && /^src\/.+\.js$/u.test(write.path)) paths.add(write.path);
    }
    for (const update of record.manifestUpdates || []) {
      if (update.after?.architecture?.targetBoundary === "game-domain" &&
        update.before?.architecture?.targetBoundary !== "game-domain") paths.add(update.currentPath);
    }
  }
  return paths;
}

class PostFreezeReview {
  constructor({
    profile = STAGE_3_22,
    reviewedCollections = REVIEWED_COLLECTIONS,
    domainAudit = new PostFreezeDomainAudit(),
    logicalGraph = new PostFreezeLogicalGraphBuilder(),
    eligibility = new PostFreezeEligibilityClassifier(),
    backlog = new PostFreezePrerequisiteBacklogBuilder({ profile }),
    planner = new PostFreezeCandidatePlanner({ profile }),
  } = {}) {
    this.profile = profile;
    this.reviewedCollections = reviewedCollections;
    this.domainAudit = domainAudit;
    this.logicalGraph = logicalGraph;
    this.eligibility = eligibility;
    this.backlog = backlog;
    this.planner = planner;
  }

  build({ workspace, commit }) {
    const profile = this.profile;
    const ARTIFACTS = profile.artifacts;
    const artifacts = new Map();
    const emit = (path, document) => {
      const bytes = serialize(document);
      artifacts.set(path, bytes);
      return { path, sha256: sha256(bytes) };
    };
    const input = file => workspace.fingerprint(file);
    const baseline = new PostFreezeBaselineBuilder().build({ workspace, commit, profile });
    const baselineRef = emit(ARTIFACTS.baseline, baseline);
    const audit = this.domainAudit.build({ workspace, profile });
    const auditRef = emit(ARTIFACTS.domainAudit, { ...audit.audit, baseline: baselineRef });
    const runtimeContract = workspace.json(INPUTS.runtimeContract);
    const bridgeRegistry = workspace.json(INPUTS.bridgeRegistry);
    const historicalPlan = workspace.json(HISTORICAL.approvedPlan);
    const readSource = file => workspace.text(file);
    const graph = this.logicalGraph.build({ document: audit.audit.document, completedTargets: audit.completedTargets,
      runtimeContract, bridgeRegistry, unifiedGraph: audit.unifiedGraph, readSource });
    const eligibility = this.eligibility.classify({ document: audit.audit.document,
      completedTargets: audit.completedTargets, observed: audit.observed,
      candidatePolicy: workspace.json(INPUTS.candidatePolicy), historicalPlan,
      ...(profile.prerequisiteIntroducedCoverage ? { introducedPaths: prerequisiteIntroducedPaths(workspace.root) } : {}) });
    const providers = new PostFreezeProviderIndex().build({ modules: eligibility.modules, runtimeContract,
      completedTargets: audit.completedTargets });
    const graphRef = emit(ARTIFACTS.graphReview, {
      schemaVersion: 1,
      kind: profile.kind("graph-review"),
      stage: profile.stage,
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
        preliminary: { ...profile.preliminary, status: "observation-not-limit",
          matchesObservation: eligibility.summary.candidate === profile.preliminary.candidate &&
            eligibility.summary.prerequisiteBlocked === profile.preliminary.prerequisiteBlocked &&
            eligibility.summary.deferred === profile.preliminary.deferred },
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
      reviewedCollections: this.reviewedCollections,
      requiredHotLoopEvidence: eligibility.policy.performanceInvariant.requiredHotLoopEvidence,
      frozenConstants: profile.frozenConstantReview === true,
    }).review({ modules: eligibility.modules, categories: eligibility.categories,
      providerIndex: providers.index, readSource });
    const backlog = this.backlog.build({ eligibility, evidence, unifiedGraph: audit.unifiedGraph,
      providerAmbiguities: providers.ambiguous, readSource, sourceExists: file => workspace.exists(file) });
    const backlogDocument = {
      schemaVersion: 1,
      kind: profile.kind("prerequisite-backlog"),
      stage: profile.stage,
      status: "open",
      sources: { graphReview: graphRef },
      refactoringPerformed: false,
      summary: backlog.summary,
      tasks: backlog.tasks,
      coverage: backlog.coverage,
      ...(backlog.resolvedTaskIds ? { resolvedTaskIds: backlog.resolvedTaskIds } : {}),
    };
    const backlogRef = emit(ARTIFACTS.prerequisiteBacklog, backlogDocument);
    const state = workspace.json(INPUTS.executionState);
    // Activations approved by recorded prerequisites (the Engine Vector2) belong to the runtime topology
    // but not to any batch's cumulative activation set; a retired one (normalizeDistance, retired by
    // batch 040) stays outside it too, although a repeated review reads the retired activations.
    const approvals = profile.prerequisiteIntroducedCoverage
      ? require("../stage_three_prerequisites/core/prerequisite_runtime_approvals")
        .PrerequisiteRuntimeApprovals.of(workspace.root, runtimeContract) : null;
    const prerequisiteActivationIds = approvals
      ? new Set([...approvals.activationIds, ...approvals.retiredActivationIds]) : new Set();
    const plan = this.planner.plan({ eligibility, evidence, logicalGraph: graph, runtimeContract,
      bridgeRegistry, completedBatchIds: state.completedBatchIds, prerequisiteActivationIds });
    const completedPrefix = {
      status: "completed-unchanged",
      approvedPlan: input(HISTORICAL.approvedPlan),
      executionState: input(INPUTS.executionState),
      completedBatchIds: [...state.completedBatchIds],
      targets: [...audit.completedTargets].sort(),
      ...(profile.completedFromPlanSource ? { plan: new StageThreeApprovedPlanSource({ read: file => workspace.bytes(file) })
        .load(state).references } : {}),
    };
    const candidates = {
      schemaVersion: 1,
      kind: profile.kind("candidate-batches"),
      stage: profile.stage,
      status: "candidate",
      runtimeMigrationAllowed: false,
      sources: { graphReview: graphRef, prerequisiteBacklog: backlogRef,
        candidatePolicy: input(INPUTS.candidatePolicy) },
      idScheme: { prefix: profile.idPrefix, firstOrder: profile.firstOrder,
        format: `${profile.idPrefix}<order>-<target-area>-<sha8 of sorted module paths>` },
      policy: eligibility.policy.clustering,
      ordering: "evidence-ready-clusters-first-then-dependency-depth-eligibility-risk-component-area",
      completedPrefix: { approvedPlan: completedPrefix.approvedPlan, completedBatchIds: completedPrefix.completedBatchIds },
      historicalCandidates: { ...input(HISTORICAL.candidates), status: "reference-only",
        note: profile.historicalCandidatesNote },
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
      backlog: backlogDocument, reviewedCollections: this.reviewedCollections, profile });
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
      baselineTopology: { ...profile.expectedTopology }, profile,
      base: profile.completedFromPlanSource ? state.continuationPlan : null });
    new PostFreezeApprovedPrefixValidator().validate({ approved, candidates, reviewEvidence,
      expectedDomainModuleCount: profile.domainModuleCount, profile });
    emit(ARTIFACTS.approvedPrefix, approved);
    assert.equal(audit.audit.domainScope.entries, profile.domainModuleCount,
      `Domain scope must contain ${profile.domainModuleCount} modules`);
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
