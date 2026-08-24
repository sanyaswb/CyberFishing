"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../guards/core/guard_models");
const { DomainCandidatePolicyValidator } = require("./domain_candidate_policy");
const { DomainScopeSelector } = require("../domain_audit/domain_scope_selector");

class DomainCandidateArtifactBuilder {
  build({
    releaseVersion,
    sources,
    policy,
    modules,
    decisions,
    design,
  }) {
    const assigned = design.batches
      .flatMap((batch) => batch.modules.map((module) => module.currentPath))
      .sort();
    const deferred = design.deferred.map((module) => module.currentPath).sort();
    const statusCounts = { eligible: 0, "conditionally-eligible": 0, deferred: 0 };
    for (const decision of decisions.values()) statusCounts[decision.status] += 1;
    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-candidate-batches",
      status: "candidate-design",
      runtimeMigrationAllowed: false,
      source: {
        releaseVersion,
        plannerVersion: "3.0.5.1",
        ...sources,
      },
      policy,
      summary: {
        domainModuleCount: modules.length,
        candidateBatchCount: design.batches.length,
        assignedModuleCount: assigned.length,
        deferredModuleCount: deferred.length,
        eligibilityCounts: statusCounts,
        coverageStatus: "complete-assigned-or-deferred",
      },
      eligibilityDecisions: [...decisions.values()]
        .sort((left, right) => left.currentPath.localeCompare(right.currentPath)),
      batches: design.batches,
      deferred: design.deferred,
      coverage: {
        assigned,
        deferred,
        unassigned: [],
      },
    });
  }
}

class DomainCandidateArtifactValidator {
  validate({ artifact, audit, manifest, expectedSourceFingerprints = null }) {
    new DomainCandidatePolicyValidator().validate(artifact?.policy);
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(artifact?.schemaVersion === 1, "candidate artifact schemaVersion must be 1");
    require(
      artifact?.kind === "cyber-fishing-stage-3-candidate-batches",
      "candidate artifact kind is invalid",
    );
    require(artifact?.status === "candidate-design", "candidate status must be candidate-design");
    require(
      artifact?.runtimeMigrationAllowed === false,
      "candidate artifact must not allow runtime migration",
    );
    require(
      artifact?.source?.plannerVersion === "3.0.5.1",
      "candidate plannerVersion is invalid",
    );
    if (expectedSourceFingerprints) {
      for (const [field, value] of Object.entries(expectedSourceFingerprints)) {
        require(artifact?.source?.[field] === value, `candidate source is stale: ${field}`);
      }
    }
    const scope = (audit?.entries || []).map((entry) => entry.currentPath).sort();
    const scopeSelector = new DomainScopeSelector();
    const manifestScope = (manifest?.modules || [])
      .filter((entry) => scopeSelector.includes(entry))
      .map((entry) => entry.currentPath)
      .sort();
    require(this.#sameArray(scope, manifestScope), "audit and Manifest domain scopes differ");
    const assigned = artifact?.coverage?.assigned || [];
    const deferred = artifact?.coverage?.deferred || [];
    const unassigned = artifact?.coverage?.unassigned || [];
    require(unassigned.length === 0, "candidate coverage must not contain unassigned modules");
    require(this.#sortedUnique(assigned), "assigned coverage must be sorted and unique");
    require(this.#sortedUnique(deferred), "deferred coverage must be sorted and unique");
    require(
      assigned.every((module) => !deferred.includes(module)),
      "assigned and deferred coverage must not overlap",
    );
    require(
      this.#sameArray([...assigned, ...deferred].sort(), scope),
      "every domain module must be exactly assigned or deferred",
    );
    const decisions = artifact?.eligibilityDecisions || [];
    require(decisions.length === scope.length, "every domain module requires one eligibility decision");
    require(
      this.#sameArray(decisions.map((decision) => decision.currentPath).sort(), scope),
      "eligibility decision scope is incomplete",
    );
    const decisionByPath = new Map(decisions.map((decision) => [decision.currentPath, decision]));
    const auditByPath = new Map(audit.entries.map((entry) => [entry.currentPath, entry]));
    const assignedBatchByPath = new Map();
    const activationBySymbol = new Map();
    let cumulativeAssigned = 0;
    const stageTwoTargetBaseline = artifact?.batches?.[0]
      ?.cumulativeRuntimeTopology?.stage2Targets || [];
    for (let index = 0; index < (artifact?.batches || []).length; index += 1) {
      const batch = artifact.batches[index];
      require(batch.order === index + 1, `candidate batch order is invalid: ${batch.id}`);
      require(batch.status === "candidate", `${batch.id} must remain candidate-only`);
      require(
        batch.modules.length > 0 &&
          batch.modules.length <= artifact.policy.clustering.maximumModulesPerBatch,
        `${batch.id} module count violates policy`,
      );
      require(
        typeof batch.graphComponentId === "string" &&
          batch.graphComponentId.startsWith("component-"),
        `${batch.id} lacks graph-derived cohesion identity`,
      );
      for (const module of batch.modules) {
        require(!assignedBatchByPath.has(module.currentPath), `module assigned twice: ${module.currentPath}`);
        assignedBatchByPath.set(module.currentPath, batch);
        const auditEntry = auditByPath.get(module.currentPath);
        require(Boolean(auditEntry), `${batch.id} contains unknown module: ${module.currentPath}`);
        require(module.targetPath === auditEntry?.targetPath, `${module.currentPath} targetPath is stale`);
        require(
          decisionByPath.get(module.currentPath)?.status !== "deferred",
          `${module.currentPath} is assigned despite deferred eligibility`,
        );
        require(
          this.#sameArray(
            module.stateOwnershipInvariant.before.authoritativeOwners,
            module.stateOwnershipInvariant.after.authoritativeOwners,
          ),
          `${module.currentPath} changes authoritative state owners`,
        );
        require(
          module.stateOwnershipInvariant.before.module === module.currentPath &&
            module.stateOwnershipInvariant.after.module === module.targetPath &&
            module.stateOwnershipInvariant.ownerIdentity === "preserved" &&
            module.stateOwnershipInvariant.duplicateStateCopies === "forbidden",
          `${module.currentPath} state identity invariant is invalid`,
        );
        const sccMembers = auditEntry?.dependencyAudit?.facts?.scc?.members || [];
        for (const member of sccMembers) {
          const sameBatch = batch.modules.some((candidate) => candidate.currentPath === member);
          require(sameBatch, `${batch.id} splits SCC member ${member}`);
        }
      }
      cumulativeAssigned += batch.modules.length;
      require(
        batch.cumulativeRuntimeTopology.stage3Targets.length === cumulativeAssigned,
        `${batch.id} cumulative Stage 3 target count is invalid`,
      );
      require(
        this.#sameArray(batch.cumulativeRuntimeTopology.stage2Targets, stageTwoTargetBaseline),
        `${batch.id} changes the Stage 2 cumulative identity baseline`,
      );
      require(
        batch.cumulativeRuntimeTopology.issues.length === 0,
        `${batch.id} cumulative topology contains unresolved issues`,
      );
      const graphChangingPrerequisites = batch.prerequisites
        .filter((item) => ["boundary-extraction", "config-di"].includes(item.kind))
        .map((item) => item.id)
        .sort();
      require(
        batch.cumulativeRuntimeTopology.topologyRevalidation
          .requiredBeforeApprovedFreeze === (graphChangingPrerequisites.length > 0) &&
          this.#sameArray(
            batch.cumulativeRuntimeTopology.topologyRevalidation.triggerPrerequisiteIds,
            graphChangingPrerequisites,
          ),
        `${batch.id} topology revalidation contract is invalid`,
      );
      require(batch.rollback.atomic === true, `${batch.id} rollback must be atomic`);
      require(batch.rollback.partialRollbackAllowed === false, `${batch.id} partial rollback is forbidden`);
      for (const activation of batch.compatibility.newActivations) {
        const contract = activation.contract;
        require(activation.legacyConsumers.length > 0, `${contract.id} lacks exact legacy consumers`);
        require(
          activation.removalCondition === "all-listed-legacy-consumers-migrated",
          `${contract.id} removalCondition is invalid`,
        );
        const previous = activationBySymbol.get(contract.legacySymbol);
        const identity = `${contract.targetModule}\u0000${contract.exportName}\u0000${contract.legacyScriptIndex}`;
        require(!previous || previous === identity, `legacy symbol has conflicting activation: ${contract.legacySymbol}`);
        activationBySymbol.set(contract.legacySymbol, identity);
      }
      require(
        batch.compatibility.bridgeBudget.transportGlobals === 1 &&
          batch.compatibility.bridgeBudget.permanentGlobals === 0,
        `${batch.id} bridge budget is invalid`,
      );
      for (const gate of batch.gates.performance) {
        require(
          gate.requiredProofs.includes("no-compatibility-lookup-in-hot-loop") &&
            gate.requiredProofs.includes("allocation-equivalence") &&
            gate.requiredProofs.includes("delta-time-equivalence"),
          `${gate.module} hot-loop acceptance is incomplete`,
        );
      }
      const reviewModules = new Set(batch.sideEffectReviews.map((review) => review.module));
      for (const record of [
        ...batch.cumulativeRuntimeTopology.moduleRecords.stage2Foundation,
        ...batch.cumulativeRuntimeTopology.moduleRecords.stage3New,
      ]) {
        if (record.evaluationSafety === "safe") continue;
        require(
          reviewModules.has(record.source),
          `${batch.id} lacks side-effect review contract for ${record.source}`,
        );
      }
      for (const review of batch.sideEffectReviews) {
        require(
          review.status === "required-before-approved-freeze" &&
            review.requiredDecision === "approved-compatible-or-batch-deferred" &&
            /^[a-f0-9]{64}$/.test(review.evidenceFingerprint),
          `${batch.id} side-effect review contract is invalid: ${review.module}`,
        );
      }
    }
    for (const [modulePath, batch] of assignedBatchByPath) {
      const auditEntry = auditByPath.get(modulePath);
      for (const dependency of auditEntry.dependencyAudit.facts.internalDependencies) {
        const dependencyBatch = assignedBatchByPath.get(dependency.target);
        require(Boolean(dependencyBatch), `${modulePath} depends on deferred/unassigned ${dependency.target}`);
        const sameScc = auditEntry.dependencyAudit.facts.scc.members.includes(dependency.target);
        require(
          dependencyBatch?.order < batch.order ||
            (dependencyBatch?.order === batch.order && sameScc),
          `${modulePath} dependency ordering is unsafe: ${dependency.target}`,
        );
      }
    }
    const deferredRecords = artifact?.deferred || [];
    require(deferredRecords.length === deferred.length, "deferred detail count is invalid");
    for (const record of deferredRecords) {
      require(record.status === "deferred", `${record.currentPath} deferred status is invalid`);
      require(record.reasonCodes.length > 0, `${record.currentPath} deferred reason is missing`);
      require(record.prerequisites.length > 0, `${record.currentPath} deferred prerequisite is missing`);
      require(
        decisionByPath.get(record.currentPath)?.status === "deferred",
        `${record.currentPath} deferred detail differs from eligibility`,
      );
    }
    const firstBatch = artifact?.batches?.[0];
    if (firstBatch) {
      require(
        firstBatch.compatibility.requiredTransitions.length === stageTwoTargetBaseline.length,
        "first candidate batch must transition every identity-sensitive Stage 2 exposure",
      );
      require(
        firstBatch.cumulativeRuntimeTopology.existingCompatibilityConflicts.every(
          (conflict) => conflict.status === "resolved-by-candidate-design",
        ),
        "Stage 2 compatibility conflicts must be resolved in candidate design",
      );
    }
    require(
      artifact?.summary?.domainModuleCount === scope.length &&
        artifact.summary.assignedModuleCount === assigned.length &&
        artifact.summary.deferredModuleCount === deferred.length &&
        artifact.summary.candidateBatchCount === artifact.batches.length &&
        artifact.summary.coverageStatus === "complete-assigned-or-deferred",
      "candidate summary is inconsistent",
    );
    if (errors.length > 0) {
      throw new Error(`Stage 3 candidate artifact failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(artifact);
  }

  #sortedUnique(values) {
    return this.#sameArray(values, [...values].sort()) &&
      new Set(values).size === values.length;
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

class DomainCandidateArtifactWriter {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
  }

  write(artifact) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }
}

class ArtifactFingerprint {
  static file(filePath) {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  }
}

module.exports = {
  ArtifactFingerprint,
  DomainCandidateArtifactBuilder,
  DomainCandidateArtifactValidator,
  DomainCandidateArtifactWriter,
};
