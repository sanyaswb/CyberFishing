"use strict";

const {
  DomainCandidatePolicyValidator,
  DomainModuleEligibilityPolicy,
} = require("../domain_batches/domain_candidate_policy");
const { DomainCandidateEvidenceJoiner } = require("../domain_batches/domain_candidate_evidence");
const { DomainEligibilityDecisionResolver } = require("../domain_batches/domain_candidate_cluster_selector");

const GRAPH_CHANGING_KINDS = Object.freeze(["boundary-extraction", "config-di"]);
const CATEGORIES = Object.freeze(["candidate", "prerequisite-blocked", "deferred"]);
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// Re-applies the historical eligibility policy to the remaining classic Domain modules and splits
// them into review candidates, modules blocked by an outstanding graph-changing prerequisite
// (directly or through a Domain dependency) and deferred modules. The counts are observations.
class PostFreezeEligibilityClassifier {
  // `introducedPaths`: Domain modules that entered the scope through recorded prerequisite transitions
  // (created files, reviewed reclassifications); a repeated review covers them explicitly.
  classify({ document, completedTargets, observed, candidatePolicy, historicalPlan, introducedPaths = new Set() }) {
    const policy = new DomainCandidatePolicyValidator().validate(candidatePolicy);
    const remaining = document.entries.filter(entry => !completedTargets.has(entry.currentPath));
    const scope = new Set(remaining.map(entry => entry.currentPath));
    // Logical Manifest view: the completed prefix and its activation shims are outside the scope.
    const manifestView = { modules: observed.modules.filter(item => scope.has(item.currentPath)) };
    const modules = new DomainCandidateEvidenceJoiner().join({ audit: { entries: remaining }, manifest: manifestView });
    const eligibility = new DomainModuleEligibilityPolicy(policy);
    const decisions = new DomainEligibilityDecisionResolver().resolve({ modules, policy: eligibility });
    const graphChanging = new Set(GRAPH_CHANGING_KINDS);
    const blockedBy = new Map();
    for (const module of modules) {
      const decision = decisions.get(module.currentPath);
      if (decision.status === "deferred") continue;
      const own = decision.prerequisites.filter(item => graphChanging.has(item.kind)).map(item => item.id);
      if (own.length > 0) blockedBy.set(module.currentPath, { prerequisiteIds: own.sort(compare), modules: [] });
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const module of modules) {
        const currentPath = module.currentPath;
        if (decisions.get(currentPath).status === "deferred") continue;
        const facts = module.dependencyAudit.facts;
        const blockers = [...facts.internalDependencies.map(item => item.target), ...facts.scc.members]
          .filter(item => item !== currentPath && blockedBy.has(item));
        const record = blockedBy.get(currentPath) || { prerequisiteIds: [], modules: [] };
        const next = [...new Set([...record.modules, ...blockers])].sort(compare);
        if (next.length === record.modules.length && blockedBy.has(currentPath)) continue;
        if (next.length === 0) continue;
        blockedBy.set(currentPath, { ...record, modules: next });
        changed = true;
      }
    }
    const categories = new Map(modules.map(module => {
      const decision = decisions.get(module.currentPath);
      const category = decision.status === "deferred" ? "deferred"
        : blockedBy.has(module.currentPath) ? "prerequisite-blocked" : "candidate";
      return [module.currentPath, category];
    }));
    const historicalDeferred = new Set(historicalPlan.coverage.deferred);
    const historicalReplan = new Set(historicalPlan.coverage.requiresReplan);
    const records = modules.map(module => {
      const decision = decisions.get(module.currentPath);
      return {
        currentPath: module.currentPath,
        targetPath: module.targetPath,
        targetArea: module.targetArea,
        category: categories.get(module.currentPath),
        historicalCoverage: historicalDeferred.has(module.currentPath) ? "deferred"
          : historicalReplan.has(module.currentPath) ? "requires-replan"
            : introducedPaths.has(module.currentPath) ? "prerequisite-introduced" : "absent",
        eligibility: decision,
        blockedBy: blockedBy.get(module.currentPath) || null,
      };
    });
    for (const record of records) {
      if (record.historicalCoverage === "absent") {
        throw new Error(`Remaining module is absent from historical coverage: ${record.currentPath}`);
      }
    }
    const count = category => records.filter(record => record.category === category).length;
    return {
      policy,
      modules,
      decisions,
      categories,
      records,
      summary: {
        remainingModuleCount: records.length,
        candidate: count("candidate"),
        prerequisiteBlocked: count("prerequisite-blocked"),
        deferred: count("deferred"),
        deferredMatchesHistorical: records.every(record =>
          (record.category === "deferred") === (record.historicalCoverage === "deferred")),
      },
    };
  }
}

module.exports = { PostFreezeEligibilityClassifier, GRAPH_CHANGING_KINDS, CATEGORIES };
