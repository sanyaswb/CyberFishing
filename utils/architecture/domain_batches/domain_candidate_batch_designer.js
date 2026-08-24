"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../guards/core/guard_models");
const {
  CanonicalActivationIdentity,
} = require("../../build/compat_runtime/cumulative_runtime_contract");
const {
  ModuleEvaluationEffectObserver,
} = require("../../build/compat_runtime/cumulative_side_effect_gate");

class StageTwoCompatibilityExposureCatalog {
  constructor({ projectRoot }) {
    this.projectRoot = path.resolve(projectRoot);
  }

  collect({ approvedPlan, executionState, scripts }) {
    const completed = new Set(executionState?.completedBatchIds || []);
    const orderByOutput = new Map(
      scripts
        .filter((script) => script.type === "classic")
        .map((script) => [script.currentPath, script.legacyLoadOrder]),
    );
    const records = [];
    for (const batch of approvedPlan?.batches || []) {
      if (!completed.has(batch.id)) continue;
      for (const bridge of batch.bridgeStrategy?.bridges || []) {
        const legacyLoadOrder = orderByOutput.get(bridge.outputPath);
        if (!Number.isInteger(legacyLoadOrder)) {
          throw new Error(`Stage 2 output lacks a live legacy position: ${bridge.outputPath}`);
        }
        const source = fs.readFileSync(
          path.resolve(this.projectRoot, bridge.targetModule),
          "utf8",
        );
        const effect = new ModuleEvaluationEffectObserver().observe({
          modulePath: bridge.targetModule,
          source,
        });
        records.push({
          owner: batch.id,
          source: bridge.targetModule,
          previousRuntime: "stage-2-isolated-iife",
          previousOutputs: [bridge.outputPath],
          identitySensitive: true,
          legacyLoadOrder,
          providers: bridge.globalProviders.map((provider) => ({
            symbol: provider.symbol,
            exportName: provider.symbol,
          })),
          legacyConsumers: [...bridge.legacyConsumers].sort(),
          removalStage: batch.bridgeStrategy.removalStage,
          evaluationSafety: effect.classification,
          evaluationFingerprint: effect.evidenceFingerprint,
          evaluationObservations: effect.observations,
        });
      }
    }
    const paths = records.map((record) => record.source);
    if (new Set(paths).size !== paths.length) {
      throw new Error("Stage 2 compatibility exposure catalog contains duplicate modules");
    }
    return immutableRecord(records.sort((left, right) =>
      left.source.localeCompare(right.source)));
  }
}

class DomainCompatibilityActivationDesigner {
  design({ module, batchId, migratedCurrentPaths }) {
    const remainingConsumers = module.dependencyAudit.facts.reverseConsumers
      .filter((consumer) => !migratedCurrentPaths.has(consumer.source))
      .map((consumer) => ({
        source: consumer.source,
        sourceBoundary: consumer.sourceBoundary,
        symbols: [...consumer.symbols].sort(),
      }))
      .sort((left, right) => left.source.localeCompare(right.source));
    if (remainingConsumers.length === 0) return [];
    const symbols = [...new Set(
      module.manifestEvidence.providers.items.map((provider) => provider.symbol),
    )].sort();
    return symbols.map((symbol) => {
      const shimName = this.#shimName(module.manifestEvidence.legacyLoadOrder, symbol);
      const contract = {
        id: "pending",
        owner: batchId,
        sourceProvider: module.currentPath,
        targetModule: module.targetPath,
        exportName: symbol,
        legacySymbol: symbol,
        legacyScriptIndex: module.manifestEvidence.legacyLoadOrder,
        shimFile: `activations/${shimName}.js`,
        reason: "Preserve the exact observed classic surface for unmigrated consumers.",
        removalStage: this.#removalStage(remainingConsumers),
      };
      contract.id = CanonicalActivationIdentity.id(contract);
      return {
        contract,
        mechanism: "global-this-property",
        legacyConsumers: remainingConsumers
          .filter((consumer) => consumer.symbols.includes(symbol))
          .map((consumer) => consumer.source)
          .sort(),
        removalCondition: "all-listed-legacy-consumers-migrated",
      };
    }).filter((activation) => activation.legacyConsumers.length > 0);
  }

  designStageTwo({ exposure, batchId }) {
    return exposure.providers.map((provider) => {
      const contract = {
        id: "pending",
        owner: batchId,
        sourceProvider: exposure.previousOutputs[0],
        targetModule: exposure.source,
        exportName: provider.exportName,
        legacySymbol: provider.symbol,
        legacyScriptIndex: exposure.legacyLoadOrder,
        shimFile: `activations/${this.#shimName(
          exposure.legacyLoadOrder,
          provider.symbol,
        )}.js`,
        reason: "Replace the isolated Stage 2 IIFE exposure with the shared cumulative module instance.",
        removalStage: exposure.removalStage,
      };
      contract.id = CanonicalActivationIdentity.id(contract);
      return {
        contract,
        mechanism: "global-this-property",
        legacyConsumers: exposure.legacyConsumers,
        removalCondition: "all-listed-legacy-consumers-migrated",
      };
    });
  }

  #shimName(order, symbol) {
    const safe = symbol.replace(/[^A-Za-z0-9_$]/g, "_").toLowerCase();
    return `${String(order).padStart(3, "0")}_${safe}`;
  }

  #removalStage(consumers) {
    const boundaries = new Set(consumers.map((consumer) => consumer.sourceBoundary));
    if ([...boundaries].some((value) => ["dev", "bootstrap-development", "entrypoint-dev"].includes(value))) {
      return "stage-6";
    }
    if ([...boundaries].some((value) => [
      "game-presentation",
      "bootstrap-production",
      "entrypoint-game",
    ].includes(value))) return "stage-5";
    if ([...boundaries].some((value) => ["platform", "game-application", "game-config"].includes(value))) {
      return "stage-4";
    }
    return "stage-3";
  }
}

class DomainCandidateBatchDesigner {
  constructor({ policy }) {
    this.policy = policy;
    this.activationDesigner = new DomainCompatibilityActivationDesigner();
  }

  design({ modules, decisions, clusters, stageTwoExposures }) {
    const moduleByPath = new Map(modules.map((module) => [module.currentPath, module]));
    const batchByModule = new Map();
    for (const cluster of clusters.batches) {
      for (const modulePath of cluster.modulePaths) batchByModule.set(modulePath, cluster);
    }
    const batches = [];
    const cumulativeCurrentPaths = new Set();
    const cumulativeTargetPaths = new Set();
    const cumulativeActivations = [];
    for (const cluster of clusters.batches) {
      const batchModules = cluster.modulePaths.map((modulePath) => moduleByPath.get(modulePath));
      for (const module of batchModules) {
        cumulativeCurrentPaths.add(module.currentPath);
        cumulativeTargetPaths.add(module.targetPath);
      }
      const stageTwoActivations = cluster.order === 1
        ? stageTwoExposures.flatMap((exposure) =>
          this.activationDesigner.designStageTwo({ exposure, batchId: cluster.id }))
        : [];
      const domainActivations = batchModules.flatMap((module) =>
        this.activationDesigner.design({
          module,
          batchId: cluster.id,
          migratedCurrentPaths: cumulativeCurrentPaths,
        }));
      const newActivations = [...stageTwoActivations, ...domainActivations]
        .sort((left, right) => left.contract.id.localeCompare(right.contract.id));
      cumulativeActivations.push(...newActivations);
      const transitions = cluster.order === 1
        ? this.#stageTwoTransitions(stageTwoExposures, stageTwoActivations, cluster.id)
        : [];
      const prerequisites = this.#prerequisites({
        cluster,
        batchModules,
        decisions,
        batchByModule,
        stageTwoExposures,
      });
      const dependencyClosure = this.#dependencyClosure({
        batchModules,
        batchByModule,
        cluster,
      });
      const topology = this.#topology({
        cluster,
        modules,
        cumulativeCurrentPaths,
        cumulativeTargetPaths,
        stageTwoExposures,
        transitions,
        cumulativeActivations,
        completedBatchIds: batches.map((batch) => batch.id),
      });
      const topologyTriggers = prerequisites
        .filter((item) => ["boundary-extraction", "config-di"].includes(item.kind))
        .map((item) => item.id)
        .sort();
      topology.topologyRevalidation = {
        requiredBeforeApprovedFreeze: topologyTriggers.length > 0,
        triggerPrerequisiteIds: topologyTriggers,
      };
      const gates = this.#gates(batchModules, newActivations);
      const sideEffectReviews = this.#sideEffectReviews(
        batchModules,
        cluster.order === 1 ? stageTwoExposures : [],
      );
      batches.push(immutableRecord({
        id: cluster.id,
        order: cluster.order,
        status: "candidate",
        purpose: this.#purpose(cluster),
        targetBoundary: "game-domain",
        dependencyDepth: cluster.depth,
        graphComponentId: cluster.graphComponentId,
        targetArea: cluster.targetArea,
        riskTier: cluster.riskTier,
        eligibilityStatus: cluster.eligibilityStatus,
        modules: batchModules.map((module) => this.#moduleRecord(
          module,
          decisions.get(module.currentPath),
        )),
        prerequisites,
        internalDependencyClosure: dependencyClosure,
        externalLegacyConsumers: this.#legacyConsumers(
          batchModules,
          cumulativeCurrentPaths,
        ),
        cumulativeRuntimeTopology: topology,
        compatibility: {
          newActivations,
          cumulativeActivationIds: cumulativeActivations
            .map((activation) => activation.contract.id)
            .sort(),
          requiredTransitions: transitions,
          bridgeBudget: {
            transportGlobals: 1,
            activationShims: newActivations.length,
            permanentGlobals: 0,
            rationale: "Only exact unmigrated classic consumers receive activation shims.",
          },
          removalCondition: "all-listed-legacy-consumers-migrated",
        },
        sideEffectReviews,
        gates,
        tests: this.#tests(gates, sideEffectReviews),
        architectureGates: [
          "architecture-guard-corpus",
          "migration-manifest-integrity",
          "stage-3-cumulative-runtime-contract",
          "stage-3-candidate-batch-contract",
        ],
        rollback: this.#rollback(cluster, batchModules, newActivations, transitions),
        acceptanceCriteria: this.#acceptance(gates),
      }));
    }
    const deferred = clusters.deferredModules.map((currentPath) => {
      const module = moduleByPath.get(currentPath);
      const decision = decisions.get(currentPath);
      return immutableRecord({
        currentPath,
        targetPath: module.targetPath,
        status: "deferred",
        reasonCodes: decision.reasonCodes,
        prerequisites: decision.prerequisites,
        dependencyDepth: module.dependencyAudit.facts.dependencyDepth,
        sccId: module.dependencyAudit.facts.scc.id,
      });
    }).sort((left, right) => left.currentPath.localeCompare(right.currentPath));
    return immutableRecord({ batches, deferred });
  }

  #moduleRecord(module, decision) {
    const owners = [...module.stateOwnership.facts.authoritativeOwners].sort();
    return {
      currentPath: module.currentPath,
      targetPath: module.targetPath,
      roles: [...module.roles].sort(),
      providers: module.manifestEvidence.providers.items.map((provider) => ({
        symbol: provider.symbol,
        mechanism: provider.mechanism,
      })).sort((left, right) =>
        `${left.symbol}\u0000${left.mechanism}`.localeCompare(
          `${right.symbol}\u0000${right.mechanism}`,
        )),
      eligibility: decision,
      stateRole: module.stateOwnership.facts.classification,
      stateOwnershipInvariant: {
        before: { module: module.currentPath, authoritativeOwners: owners },
        after: { module: module.targetPath, authoritativeOwners: owners },
        ownerIdentity: "preserved",
        duplicateStateCopies: "forbidden",
      },
      sccId: module.dependencyAudit.facts.scc.id,
      dependencyDepth: module.dependencyAudit.facts.dependencyDepth,
    };
  }

  #prerequisites({
    cluster,
    batchModules,
    decisions,
    batchByModule,
    stageTwoExposures,
  }) {
    const values = new Map();
    for (const module of batchModules) {
      for (const prerequisite of decisions.get(module.currentPath).prerequisites) {
        values.set(prerequisite.id, prerequisite);
      }
      for (const dependency of module.dependencyAudit.facts.internalDependencies) {
        const dependencyBatch = batchByModule.get(dependency.target);
        if (dependencyBatch && dependencyBatch.order < cluster.order) {
          const record = {
            id: `batch-completion:${dependencyBatch.id}`,
            kind: "batch-completion",
            action: "complete-prerequisite-candidate-batch",
            module: dependency.target,
          };
          values.set(record.id, record);
        }
      }
    }
    if (cluster.order === 1) {
      values.set("stage-2-identity-transition", {
        id: "stage-2-identity-transition",
        kind: "compatibility-transition",
        action: "replace-isolated-stage-2-iifes-atomically",
        module: "architecture/migration/stage_2_approved_batches.json",
      });
      for (const exposure of stageTwoExposures) {
        if (exposure.evaluationSafety === "safe") continue;
        const record = {
          id: `side-effect-review:${exposure.source}`,
          kind: "side-effect-review",
          action: "approve-stage-2-cumulative-evaluation-safety",
          module: exposure.source,
        };
        values.set(record.id, record);
      }
    }
    return [...values.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  #dependencyClosure({ batchModules, batchByModule, cluster }) {
    const edges = [];
    for (const module of batchModules) {
      for (const dependency of module.dependencyAudit.facts.internalDependencies) {
        const dependencyBatch = batchByModule.get(dependency.target);
        edges.push({
          source: module.currentPath,
          target: dependency.target,
          symbols: [...dependency.symbols].sort(),
          resolution: dependencyBatch.order === cluster.order
            ? "same-atomic-scc"
            : "completed-prerequisite-batch",
          prerequisiteBatchId: dependencyBatch.order < cluster.order
            ? dependencyBatch.id
            : null,
        });
      }
    }
    return edges.sort((left, right) =>
      `${left.source}\u0000${left.target}`.localeCompare(`${right.source}\u0000${right.target}`));
  }

  #legacyConsumers(batchModules, migratedCurrentPaths) {
    return batchModules.flatMap((module) =>
      module.dependencyAudit.facts.reverseConsumers
        .filter((consumer) => !migratedCurrentPaths.has(consumer.source))
        .map((consumer) => ({
          provider: module.currentPath,
          source: consumer.source,
          sourceBoundary: consumer.sourceBoundary,
          symbols: [...consumer.symbols].sort(),
        })))
      .sort((left, right) =>
        `${left.provider}\u0000${left.source}`.localeCompare(
          `${right.provider}\u0000${right.source}`,
        ));
  }

  #topology({
    cluster,
    modules,
    cumulativeCurrentPaths,
    cumulativeTargetPaths,
    stageTwoExposures,
    transitions,
    cumulativeActivations,
    completedBatchIds,
  }) {
    const moduleByPath = new Map(modules.map((module) => [module.currentPath, module]));
    const stageThreeRecords = [...cumulativeCurrentPaths].map((currentPath) => {
      const module = moduleByPath.get(currentPath);
      return {
        source: module.targetPath,
        dependencies: module.dependencyAudit.facts.internalDependencies
          .filter((dependency) => cumulativeCurrentPaths.has(dependency.target))
          .map((dependency) => moduleByPath.get(dependency.target).targetPath)
          .sort(),
        originatingStage: "stage-3",
        identitySensitive: true,
        evaluationSafety: module.dependencyAudit.facts.topLevelEffects.length > 0
          ? "needs-review"
          : "safe",
      };
    });
    const stageTwoRecords = stageTwoExposures.map((exposure) => ({
      source: exposure.source,
      dependencies: [],
      originatingStage: "stage-2",
      identitySensitive: true,
      evaluationSafety: exposure.evaluationSafety,
    }));
    return {
      topology: "single-cumulative-module-graph",
      stage3Targets: [...cumulativeTargetPaths].sort(),
      stage2Targets: stageTwoExposures.map((exposure) => exposure.source).sort(),
      moduleRecordCount: stageTwoRecords.length + stageThreeRecords.length,
      inheritedStage3BatchIds: [...completedBatchIds],
      moduleRecords: {
        stage2Foundation: cluster.order === 1 ? stageTwoRecords : [],
        stage3New: stageThreeRecords
          .filter((record) => {
            const current = modules.find((module) => module.targetPath === record.source);
            return current && cluster.modulePaths.includes(current.currentPath);
          })
          .sort((left, right) => left.source.localeCompare(right.source)),
      },
      activationIds: cumulativeActivations
        .map((activation) => activation.contract.id)
        .sort(),
      existingCompatibilityConflicts: transitions.map((transition) => ({
        previousRuntime: transition.previousRuntime,
        module: transition.module,
        requiredTransition: transition.requiredTransition,
        status: "resolved-by-candidate-design",
      })),
      issues: [],
      candidateBatchId: cluster.id,
    };
  }

  #stageTwoTransitions(exposures, activations, batchId) {
    const idsByModule = new Map();
    for (const activation of activations) {
      const module = activation.contract.targetModule;
      if (!idsByModule.has(module)) idsByModule.set(module, []);
      idsByModule.get(module).push(activation.contract.id);
    }
    return exposures.map((exposure) => ({
      module: exposure.source,
      previousRuntime: exposure.previousRuntime,
      previousOutputs: exposure.previousOutputs,
      requiredTransition: "replace-isolated-output-with-cumulative-activation",
      activationIds: (idsByModule.get(exposure.source) || []).sort(),
      owner: batchId,
      reason: "Prevent a duplicate Stage 2 module instance when Stage 3 cumulative runtime starts.",
    })).sort((left, right) => left.module.localeCompare(right.module));
  }

  #gates(modules, activations) {
    const state = modules.map((module) => ({
      module: module.currentPath,
      classification: module.stateOwnership.facts.classification,
      status: module.stateOwnership.status,
      requiredProof: "same-authoritative-owner-before-and-after",
      reviewIssues: [...module.stateOwnership.facts.issues].sort(),
    }));
    const config = modules
      .filter((module) => module.configurationInput.facts.forbiddenDirectReads.length > 0)
      .map((module) => ({
        module: module.currentPath,
        directReads: [...module.configurationInput.facts.forbiddenDirectReads].sort(),
        requiredProof: "constructor-injection-factory-or-composition-root-delivery",
      }));
    const performance = modules
      .filter((module) => module.performanceRisk.facts.hotLoopParticipation === "direct")
      .map((module) => ({
        module: module.currentPath,
        allocationBehavior: module.performanceRisk.facts.perFrameAllocations,
        deltaTimeSemantics: module.performanceRisk.facts.deltaTimeSemantics,
        requiredProofs: [
          "allocation-equivalence",
          "behavior-equivalence",
          "delta-time-equivalence",
          "no-compatibility-lookup-in-hot-loop",
        ],
      }));
    const sideEffects = modules
      .filter((module) => module.dependencyAudit.facts.topLevelEffects.length > 0)
      .map((module) => ({
        module: module.currentPath,
        effects: module.dependencyAudit.facts.topLevelEffects,
        requiredProof: "full-cumulative-closure-evaluation-safe",
      }));
    return {
      behavior: [{ requiredProof: "focused-domain-behavior-equivalence" }],
      stateIdentity: state,
      configuration: config,
      performance,
      sideEffects,
      compatibility: activations.map((activation) => ({
        activationId: activation.contract.id,
        requiredProof: "exact-export-and-legacy-position",
      })),
      architecture: [{ requiredProof: "zero-new-architecture-guard-failures" }],
    };
  }

  #sideEffectReviews(modules, stageTwoExposures) {
    const stageThree = modules
      .filter((module) => module.dependencyAudit.facts.topLevelEffects.length > 0)
      .map((module) => ({
        module: module.targetPath,
        originatingStage: "stage-3",
        status: "required-before-approved-freeze",
        evidenceFingerprint: module.dependencyAudit.facts.graphFingerprint,
        observations: module.dependencyAudit.facts.topLevelEffects,
        requiredDecision: "approved-compatible-or-batch-deferred",
      }));
    const stageTwo = stageTwoExposures
      .filter((exposure) => exposure.evaluationSafety !== "safe")
      .map((exposure) => ({
        module: exposure.source,
        originatingStage: "stage-2",
        status: "required-before-approved-freeze",
        evidenceFingerprint: exposure.evaluationFingerprint,
        observations: exposure.evaluationObservations,
        requiredDecision: "approved-compatible-or-batch-deferred",
      }));
    return [...stageTwo, ...stageThree].sort((left, right) =>
      left.module.localeCompare(right.module));
  }

  #tests(gates, sideEffectReviews) {
    const tests = new Set([
      "focused-domain-behavior-equivalence",
      "stage-3-candidate-batch-contract",
      "stage-3-cumulative-runtime-identity",
      "check:quick",
      "check:architecture",
      "check:full",
    ]);
    if (gates.stateIdentity.some((gate) => gate.status === "partial")) {
      tests.add("focused-state-identity");
    }
    if (gates.configuration.length > 0) tests.add("focused-config-di");
    if (gates.performance.length > 0) tests.add("focused-hot-loop-performance-equivalence");
    if (gates.sideEffects.length > 0 || sideEffectReviews.length > 0) {
      tests.add("focused-evaluation-safety");
    }
    if (gates.compatibility.length > 0) tests.add("focused-activation-timing");
    return [...tests].sort();
  }

  #rollback(cluster, modules, activations, transitions) {
    return {
      atomic: true,
      rule: "all-or-nothing-candidate-batch",
      boundary: {
        batchId: cluster.id,
        currentPaths: modules.map((module) => module.currentPath).sort(),
        targetPaths: modules.map((module) => module.targetPath).sort(),
        activationIds: activations.map((activation) => activation.contract.id).sort(),
        transitionModules: transitions.map((transition) => transition.module).sort(),
      },
      restores: [
        "classic-provider-files",
        "legacy-script-order",
        "previous-validated-cumulative-output",
        "manifest-and-bridge-metadata",
      ],
      partialRollbackAllowed: false,
    };
  }

  #acceptance(gates) {
    const criteria = [
      "All batch modules migrate atomically or none migrate.",
      "Authoritative state owners and state identity remain unchanged.",
      "Every dependency is in the same SCC or a completed prerequisite batch.",
      "Legacy symbols expose exact ESM exports only at approved positions.",
      "Architecture, Quick and Full suites pass with zero gameplay changes.",
    ];
    if (gates.configuration.length > 0) {
      criteria.push("Direct game/config reads are replaced by reviewed dependency injection.");
    }
    if (gates.performance.length > 0) {
      criteria.push("Allocation and deltaTime behavior remain equivalent with no hot-loop registry lookup.");
    }
    return criteria;
  }

  #purpose(cluster) {
    return (
      `Migrate a dependency-safe ${cluster.targetArea} domain cluster at depth ` +
      `${cluster.depth} with ${cluster.riskTier} gates.`
    );
  }
}

module.exports = {
  DomainCandidateBatchDesigner,
  DomainCompatibilityActivationDesigner,
  StageTwoCompatibilityExposureCatalog,
};
