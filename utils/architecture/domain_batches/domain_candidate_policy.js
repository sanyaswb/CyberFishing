"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

class DomainCandidatePolicyValidator {
  validate(policy) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(policy?.schemaVersion === 1, "candidate policy schemaVersion must be 1");
    require(
      policy?.kind === "cyber-fishing-stage-3-candidate-eligibility-policy",
      "candidate policy kind is invalid",
    );
    require(
      this.#sameArray(policy?.statuses || [], [
        "conditionally-eligible",
        "deferred",
        "eligible",
      ]),
      "candidate policy statuses are invalid",
    );
    require(
      this.#sameArray(policy?.deferredBlockers || [], [
        "browser-api-coupling",
        "dev-production-coupling",
        "mixed-responsibility-requires-decomposition",
      ]),
      "candidate policy deferredBlockers are invalid",
    );
    require(
      this.#sameArray(policy?.conditionalSignals || [], [
        "boundary-extraction-prerequisite",
        "config-prerequisite",
        "high-level-self-composition",
        "hot-loop-performance-gate",
        "legacy-compatibility-surface",
        "partial-state-review",
        "side-effect-review",
        "stage-2-identity-transition",
      ]),
      "candidate policy conditionalSignals are invalid",
    );
    require(policy?.clustering?.unit === "canonical-scc", "clustering unit is invalid");
    require(
      policy?.clustering?.ordering ===
        "dependency-depth-then-reviewed-target-area",
      "clustering ordering is invalid",
    );
    require(
      policy?.clustering?.cohesion ===
        "graph-component-dependency-layer-reviewed-target-area-and-risk-tier",
      "clustering cohesion is invalid",
    );
    require(
      Number.isInteger(policy?.clustering?.maximumModulesPerBatch) &&
        policy.clustering.maximumModulesPerBatch > 0 &&
        policy.clustering.maximumModulesPerBatch <= 8,
      "maximumModulesPerBatch must be between 1 and 8",
    );
    require(policy?.clustering?.allowCrossSccSplit === false, "SCC splitting must be forbidden");
    require(
      policy?.stateInvariant?.ownerBeforeAfter === "same-authoritative-owner",
      "state owner invariant is invalid",
    );
    require(
      policy?.stateInvariant?.duplicateStateCopies === "forbidden",
      "duplicate state copies must be forbidden",
    );
    require(
      policy?.stateInvariant?.partialMeansUniversalBlocker === false,
      "partial state results must not be universal blockers",
    );
    require(
      policy?.performanceInvariant?.compatibilityLookupInHotLoop === "forbidden",
      "hot-loop compatibility lookup must be forbidden",
    );
    require(
      this.#sameArray(policy?.performanceInvariant?.requiredHotLoopEvidence || [], [
        "allocation-equivalence",
        "behavior-equivalence",
        "delta-time-equivalence",
      ]),
      "hot-loop evidence contract is invalid",
    );
    require(
      policy?.compatibilityInvariant?.topology === "single-cumulative-module-graph",
      "compatibility topology is invalid",
    );
    require(
      policy?.compatibilityInvariant?.bridgeReason ===
        "exact-unmigrated-classic-consumer",
      "bridge reason contract is invalid",
    );
    require(
      policy?.compatibilityInvariant?.removalCondition ===
        "all-listed-legacy-consumers-migrated",
      "removal condition is invalid",
    );
    require(
      policy?.compatibilityInvariant?.runtimeActivationAllowed === false,
      "candidate policy must not allow runtime activation",
    );
    require(
      policy?.coverageInvariant === "exactly-one-of-assigned-or-deferred",
      "coverage invariant is invalid",
    );
    if (errors.length > 0) {
      throw new Error(`Stage 3 candidate policy failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(policy);
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

class DomainModuleEligibilityPolicy {
  constructor(policy) {
    this.policy = new DomainCandidatePolicyValidator().validate(policy);
    this.deferredBlockers = new Set(this.policy.deferredBlockers);
  }

  classify(module) {
    const deferredReasons = [];
    const conditionalReasons = [];
    const prerequisites = [];
    const statuses = [
      module.dependencyAudit.status,
      module.stateOwnership.status,
      module.configurationInput.status,
      module.performanceRisk.status,
    ];
    if (statuses.some((status) => ["pending", "failed"].includes(status))) {
      deferredReasons.push("incomplete-audit-evidence");
      prerequisites.push(this.#prerequisite(
        "complete-audit-evidence",
        "evidence-review",
        module.currentPath,
      ));
    }
    for (const blocker of module.manifestEvidence.blockers.items) {
      if (this.deferredBlockers.has(blocker)) {
        deferredReasons.push(blocker);
        prerequisites.push(this.#prerequisite(
          this.#blockerPrerequisite(blocker),
          "architecture-prerequisite",
          module.currentPath,
        ));
      } else if (blocker === "high-level-self-composition") {
        conditionalReasons.push("high-level-self-composition");
        prerequisites.push(this.#prerequisite(
          "review-constructor-injection-boundary",
          "dependency-inversion-review",
          module.currentPath,
        ));
      } else if (blocker === "legacy-global-contract") {
        // The exact activation design handles the observed classic surface.
        // It becomes conditional only if the compatibility planner reports a
        // conflict, not merely because a legacy symbol exists.
      }
    }
    if (module.stateOwnership.status === "partial") {
      conditionalReasons.push("partial-state-review");
      prerequisites.push(this.#prerequisite(
        "prove-state-identity-invariant",
        "state-review",
        module.currentPath,
      ));
    }
    if (module.configurationInput.facts.forbiddenDirectReads.length > 0) {
      conditionalReasons.push("config-prerequisite");
      prerequisites.push(this.#prerequisite(
        "replace-direct-config-read-with-di",
        "config-di",
        module.currentPath,
      ));
    }
    const forbiddenNonConfig = module.dependencyAudit.facts.externalDependencies
      .filter((dependency) =>
        dependency.policy === "forbidden" &&
        !["game-config", "game-config-raw"].includes(dependency.targetBoundary));
    if (forbiddenNonConfig.length > 0) {
      conditionalReasons.push("boundary-extraction-prerequisite");
      for (const dependency of forbiddenNonConfig) {
        prerequisites.push({
          id: `boundary-extraction:${module.currentPath}:${dependency.target}`,
          kind: "boundary-extraction",
          action: "remove-forbidden-domain-dependency-and-regenerate-evidence",
          module: dependency.target,
        });
      }
    }
    if (module.performanceRisk.facts.hotLoopParticipation === "direct") {
      conditionalReasons.push("hot-loop-performance-gate");
      prerequisites.push(this.#prerequisite(
        "prove-hot-loop-equivalence",
        "performance-review",
        module.currentPath,
      ));
    }
    if (module.dependencyAudit.facts.topLevelEffects.length > 0) {
      conditionalReasons.push("side-effect-review");
      prerequisites.push(this.#prerequisite(
        "prove-cumulative-evaluation-safety",
        "side-effect-review",
        module.currentPath,
      ));
    }
    const hasLegacySurface = module.manifestEvidence.providers.items.length > 0 &&
      module.dependencyAudit.facts.reverseConsumers.length > 0;
    const reasonCodes = [...new Set(
      deferredReasons.length > 0 ? deferredReasons : conditionalReasons,
    )].sort();
    const status = deferredReasons.length > 0
      ? "deferred"
      : conditionalReasons.length > 0
        ? "conditionally-eligible"
        : "eligible";
    return immutableRecord({
      currentPath: module.currentPath,
      status,
      reasonCodes,
      prerequisites: this.#uniquePrerequisites(prerequisites),
      invariantImpact: {
        state: module.stateOwnership.status === "partial" ? "review-required" : "preserved",
        configuration: module.configurationInput.facts.forbiddenDirectReads.length > 0
          ? "di-prerequisite"
          : "none",
        performance: module.performanceRisk.facts.hotLoopParticipation === "direct"
          ? "enhanced-gates-required"
          : "standard",
        sideEffects: module.dependencyAudit.facts.topLevelEffects.length > 0
          ? "review-required"
          : "safe-by-observation",
        compatibility: hasLegacySurface ? "activation-required" : "none",
      },
    });
  }

  #blockerPrerequisite(blocker) {
    return {
      "browser-api-coupling": "extract-browser-capability-to-platform",
      "dev-production-coupling": "remove-development-runtime-dependency",
      "mixed-responsibility-requires-decomposition": "complete-separate-decomposition-task",
    }[blocker];
  }

  #prerequisite(action, kind, modulePath) {
    return {
      id: `${kind}:${action}:${modulePath}`,
      kind,
      action,
      module: modulePath,
    };
  }

  #uniquePrerequisites(items) {
    const values = new Map();
    for (const item of items) values.set(item.id, item);
    return [...values.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

module.exports = { DomainCandidatePolicyValidator, DomainModuleEligibilityPolicy };
