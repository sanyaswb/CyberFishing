"use strict";

const {
  CanonicalBridgeIdentity,
} = require("../../build/legacy_bridge_build_config");
const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_006_EXECUTION_PROFILE,
} = require("./stage_three_batch_execution_profile");

const SOURCE_RELEASE_VERSION = BATCH_006_EXECUTION_PROFILE.sourceReleaseVersion;
const TARGET_RELEASE_VERSION = BATCH_006_EXECUTION_PROFILE.targetReleaseVersion;
const BRIDGE_REASON = BATCH_006_EXECUTION_PROFILE.bridgeReason;
const OPERATION_IDS = BATCH_006_EXECUTION_PROFILE.operationIds;

const NUMBER_WORDS = Object.freeze({
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
});

function numberWord(value) {
  return NUMBER_WORDS[value] || String(value);
}

class StageThreeBatchExecutionPlanBuilder {
  #profile;

  constructor(profile = BATCH_006_EXECUTION_PROFILE) {
    this.#profile = profile;
  }

  build({
    audit,
    auditSha256,
    approvedPlan,
    approvedPlanSha256,
    executionState,
    executionStateSha256,
    runtimeContract,
    runtimeContractSha256,
    manifestSha256,
    bridgeRegistry,
    bridgeRegistrySha256,
    scmCheckpoint = null,
    runtimeFacts,
    rollbackEvidence,
  }) {
    const profile = this.#profile;
    const batch = approvedPlan.batches.find((record) => record.id === profile.batchId);
    this.#require(batch, `Approved batch is missing: ${profile.batchId}`);
    this.#require(batch.status === "approved-frozen", `Batch ${profile.batchNumber} is not approved-frozen`);
    this.#require(audit.status === "verified", `${profile.auditStageLabel} audit is not verified`);
    this.#require(
      audit.verdict === "eligible-for-execution-plan",
      `${profile.auditStageLabel} audit does not allow execution planning`,
    );
    this.#require(audit.batchId === profile.batchId, "Audit batch identity differs");
    this.#require(audit.sourceReleaseVersion === profile.sourceReleaseVersion, "Audit source release differs");
    this.#require(
      audit.sourceEvidence.approvedPlan.sha256 === approvedPlanSha256,
      "Audit approved-plan evidence is stale",
    );
    this.#require(
      audit.sourceEvidence.manifest.sha256 === manifestSha256,
      "Audit Manifest evidence is stale",
    );
    this.#require(
      audit.sourceEvidence.executionState.sha256 === executionStateSha256,
      "Audit execution-state evidence is stale",
    );
    this.#require(audit.scope.targetCount === profile.expectedTargetCount, "Audit target scope differs from profile");
    this.#require(audit.closure.unexpectedDependencies.length === 0, "Audit contains unexpected dependencies");
    this.#require(audit.prerequisites.newlyDiscovered.length === 0, "Audit discovered new prerequisites");

    const completedPrefix = approvedPlan.batches
      .slice(0, batch.order - 1)
      .map((record) => record.id);
    this.#require(
      this.#same(executionState.completedBatchIds, completedPrefix),
      `Execution state is not the exact completed prefix before batch ${profile.batchNumber}`,
    );
    this.#require(executionState.activeBatchId === null, "Execution plan requires no active batch");
    this.#require(executionState.compatibilityRuntimeActivated === true, "Cumulative runtime must already be active");
    this.#require(executionState.releaseVersion === profile.sourceReleaseVersion, "Execution-state release differs");
    this.#require(
      runtimeContract.activationPositions.every((activation) => activation.owner !== profile.batchId),
      `Runtime contract already contains batch ${profile.batchNumber} activation`,
    );
    this.#require(
      bridgeRegistry.bridges.every((record) => record.owner !== profile.batchId),
      `Bridge registry already contains batch ${profile.batchNumber} record`,
    );
    this.#require(runtimeFacts.projectModuleCount === audit.closure.existingCumulativeModuleCount, "Current cumulative module count differs from audit");
    this.#require(runtimeFacts.activationCount === runtimeContract.activationPositions.length, "Current activation count differs from runtime contract");
    if (profile.scmCheckpointRequired) {
      this.#require(scmCheckpoint?.tag === profile.sourceReleaseTag, "SCM source-release tag differs");
      this.#require(/^[a-f0-9]{40}$/u.test(scmCheckpoint?.commitSha), "SCM checkpoint commit is invalid");
      this.#require(scmCheckpoint?.tagType === "tag", "SCM checkpoint must use an annotated tag");
    } else {
      this.#require(scmCheckpoint === null, "Historical profile must not gain SCM checkpoint evidence");
    }

    const modules = audit.scope.modules.map((module) => ({
      currentPath: module.currentPath,
      targetPath: module.targetPath,
      exports: [...module.exports],
      sourceSha256: module.sourceSha256,
      stateClassification: module.state.classification,
      representationChange: "classic-class-declaration-to-named-esm-export-only",
      importsAllowed: [],
      behaviorChangeAllowed: false,
      directTransportReadAllowed: false,
    })).sort((left, right) => left.currentPath.localeCompare(right.currentPath));
    this.#require(this.#same(
      modules.map(({ currentPath, targetPath, exports }) => ({ currentPath, targetPath, exports })),
      profile.expectedTargets,
    ), "Exact target/export scope differs from profile");

    const activations = batch.compatibility.newActivations
      .map((activation) => ({
        ...activation.contract,
        mechanism: activation.mechanism,
        consumers: [...activation.legacyConsumers].sort(),
        removalCondition: activation.removalCondition,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    this.#require(activations.length === profile.expectedActivationCount, "Batch activation count differs from profile");
    this.#require(this.#same(
      activations.map((activation) => activation.id),
      profile.expectedActivationIds,
    ), "Activation identity set differs from profile");
    this.#require(this.#same(
      activations.map((activation) => activation.legacyScriptIndex).sort((left, right) => left - right),
      profile.expectedActivationPositions,
    ), "Activation position set differs from profile");

    const activationByProvider = new Map(activations.map((activation) => [
      activation.sourceProvider,
      activation,
    ]));
    const plannedBridges = batch.externalLegacyConsumers.map((consumer) => {
      const activation = activationByProvider.get(consumer.provider);
      this.#require(activation, `Activation missing for provider: ${consumer.provider}`);
      this.#require(
        consumer.symbols.every((symbol) => symbol === activation.legacySymbol),
        `Consumer symbols differ from activation: ${consumer.provider}`,
      );
      const record = {
        bridge: consumer.provider,
        source: consumer.source,
        target: activation.targetModule,
        reason: profile.bridgeReason,
        owner: profile.batchId,
        introducedStage: "stage-3",
        removalStage: activation.removalStage,
        globalProviders: consumer.symbols.map((symbol) => ({
          symbol,
          mechanism: "global-this-property",
        })).sort((left, right) => left.symbol.localeCompare(right.symbol)),
      };
      return {
        id: CanonicalBridgeIdentity.id(record),
        ...record,
      };
    }).sort((left, right) => left.id.localeCompare(right.id));
    this.#require(plannedBridges.length === profile.expectedConsumerCount, "Batch consumer bridge count differs from profile");
    this.#require(new Set(plannedBridges.map((record) => record.id)).size === profile.expectedConsumerCount, "Planned bridge IDs must be unique");
    this.#require(this.#same(
      plannedBridges.map((record) => record.id),
      profile.expectedBridgeIds,
    ), "Canonical bridge identity set differs from profile");

    const completedState = {
      releaseVersion: profile.targetReleaseVersion,
      status: "migration-active",
      completedBatchIds: [...completedPrefix, profile.batchId],
      activeBatchId: null,
      compatibilityRuntimeActivated: true,
    };
    const openState = {
      releaseVersion: profile.sourceReleaseVersion,
      status: "migration-active",
      completedBatchIds: [...completedPrefix],
      activeBatchId: profile.batchId,
      compatibilityRuntimeActivated: true,
    };
    const afterModuleCount = new Set([
      ...audit.closure.existingCumulativeModules,
      ...audit.closure.newProjectModules,
    ]).size;
    const afterActivationCount = runtimeFacts.activationCount + activations.length;
    const afterBridgeCount = bridgeRegistry.bridges.length + plannedBridges.length;

    const operations = [
      this.#operation(1, profile.operationIds[0], "read-only", "Verify audit fingerprints, frozen scope, current topology and completed prefix."),
      this.#operation(2, profile.operationIds[1], "metadata", `Set activeBatchId to batch ${profile.batchNumber} without changing completedBatchIds.`),
      this.#operation(3, profile.operationIds[2], "source", `Create all ${numberWord(profile.expectedTargetCount)} named ESM targets as representation-only copies.`),
      this.#operation(4, profile.operationIds[3], "source", `Replace all ${numberWord(profile.expectedActivationCount)} classic providers with exact generated activation shims.`),
      this.#operation(5, profile.operationIds[4], "metadata", `Add the ${numberWord(profile.expectedConsumerCount)} canonical consumer-specific bridge records as one set.`),
      this.#operation(6, profile.operationIds[5], "metadata", "Project target and compatibility-bridge metadata before build validation."),
      this.#operation(7, profile.operationIds[6], "generated-output", `Build and atomically validate one cumulative ${afterModuleCount}-module runtime.`),
      this.#operation(8, profile.operationIds[7], "read-only", "Prove exact export identity, activation timing, one evaluation and behavior equivalence."),
      this.#operation(9, profile.operationIds[8], "metadata", "Persist mechanical observations and reconcile Manifest facts after source/shim creation."),
      this.#operation(10, profile.operationIds[9], "read-only", "Run focused, Architecture, Quick, Full, fresh-install and browser acceptance."),
      this.#operation(11, profile.operationIds[10], "metadata", `Mark batch ${profile.batchNumber} completed, clear activeBatchId and publish v${profile.targetReleaseVersion} metadata.`),
    ];

    const lifecycle = {
      preState: {
        releaseVersion: executionState.releaseVersion,
        status: executionState.status,
        completedBatchIds: [...executionState.completedBatchIds],
        activeBatchId: executionState.activeBatchId,
        compatibilityRuntimeActivated: executionState.compatibilityRuntimeActivated,
      },
      openState,
    };
    if (profile.includeRuntimeActiveState) {
      lifecycle.runtimeActiveState = {
        releaseVersion: profile.sourceReleaseVersion,
        status: "migration-active",
        completedBatchIds: [...completedPrefix],
        activeBatchId: profile.batchId,
        compatibilityRuntimeActivated: true,
        projectModuleCount: afterModuleCount,
        activationCount: afterActivationCount,
        bridgeRecordCount: afterBridgeCount,
        persistence: "execution-plan-phase-not-stage-3-execution-state-status",
      };
    }
    lifecycle.completedState = completedState;
    lifecycle.runtimeTargetSelection = "completed-batches-plus-active-batch-plus-promoted-stage-2-closure";

    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-atomic-execution-plan",
      status: "execution-plan-verified",
      batchId: profile.batchId,
      sourceReleaseVersion: profile.sourceReleaseVersion,
      targetReleaseVersion: profile.targetReleaseVersion,
      runtimeMigrationAllowed: false,
      runtimeMigrationUnlockCondition: `${profile.focusedStageId}-focused-test-matrix-verified`,
      sourceEvidence: {
        audit: {
          path: profile.auditPath,
          sha256: auditSha256,
        },
        approvedPlan: {
          path: "architecture/migration/stage_3_approved_batches.json",
          sha256: approvedPlanSha256,
        },
        executionState: {
          path: "architecture/migration/stage_3_execution_state.json",
          sha256: executionStateSha256,
        },
        runtimeContract: {
          path: "architecture/migration/stage_3_compatibility_runtime.json",
          sha256: runtimeContractSha256,
        },
        manifest: {
          path: "architecture/migration/module_migration_manifest.json",
          sha256: manifestSha256,
        },
        bridgeRegistry: {
          path: "architecture/guards/migration_bridge_registry.json",
          sha256: bridgeRegistrySha256,
        },
        ...(profile.scmCheckpointRequired ? { scmCheckpoint } : {}),
      },
      scope: {
        atomic: true,
        partialCutoverAllowed: false,
        modules,
        targetCount: modules.length,
        exportCount: modules.reduce((count, module) => count + module.exports.length, 0),
        activationCount: activations.length,
        consumerRelationshipCount: plannedBridges.length,
      },
      lifecycle,
      compatibility: {
        activations,
        plannedBridgeRecords: plannedBridges,
        registryTransition: {
          beforeCount: bridgeRegistry.bridges.length,
          addCount: plannedBridges.length,
          afterCount: afterBridgeCount,
          operation: "exact-set-union-by-canonical-id",
        },
        transportGlobal: runtimeContract.transport.symbol,
        transportOwnsGameState: false,
        domainTransportReadsAllowed: false,
      },
      cumulativeRuntime: {
        topology: "single-cumulative-module-graph",
        isolatedIifeAllowed: false,
        beforeProjectModuleCount: runtimeFacts.projectModuleCount,
        addedProjectModuleCount: audit.closure.newProjectModuleCount,
        afterProjectModuleCount: afterModuleCount,
        beforeActivationCount: runtimeFacts.activationCount,
        addedActivationCount: activations.length,
        afterActivationCount,
        projectModulesAfter: [
          ...audit.closure.existingCumulativeModules,
          ...audit.closure.newProjectModules,
        ].sort(),
        expectedDependencyEdges: [],
        evaluationCountPerModule: 1,
        outputReplacement: "validated-staging-then-atomic-replacement",
        preservePreviousValidatedOutputOnFailure: true,
      },
      scriptTopology: {
        before: runtimeFacts.scriptTopology,
        after: {
          ...runtimeFacts.scriptTopology,
          providerScriptsRemoved: modules.length,
          activationScriptsAdded: activations.length,
        },
        policy: "one-for-one-provider-to-activation-replacement-preserves-logical-order",
      },
      stateAndBehaviorInvariants: modules.map((module) => {
        const invariant = {
          module: module.currentPath,
          stateClassification: module.stateClassification,
          authoritativeOwnerPreserved: true,
          duplicateStateCopies: "forbidden",
          formulasApiDefaultsAndResultShapes: "unchanged",
        };
        if (profile.includeDetailedStatePerformanceGates) {
          const audited = audit.scope.modules.find((record) => record.currentPath === module.currentPath);
          return {
            ...invariant,
            authoritativeOwnerBefore: audited.state.authoritativeOwnerBefore,
            authoritativeOwnerAfter: audited.state.authoritativeOwnerAfter,
            publicStateShape: audited.state.publicStateShape,
            snapshotShape: audited.state.snapshotShape,
            stableResultIdentity: audited.state.stableResultIdentity,
            mutatesCallerInputs: audited.state.mutatesCallerInputs,
            behaviorFingerprint: audited.behavior.formulaDefaultsClampsRoundingFingerprint,
            allocationBaseline: audited.performance.allocationBaseline,
            additionalMigrationAllocationsAllowed: audited.performance.additionalMigrationAllocationsAllowed,
            transportLookupsAllowed: audited.performance.transportLookupsAllowed,
            representationComparison: audited.performance.comparisonMode,
          };
        }
        return invariant;
      }),
      operations,
      mutationBoundary: {
        sourceProvidersReplaced: modules.map((module) => module.currentPath).sort(),
        esmTargetsCreated: modules.map((module) => module.targetPath).sort(),
        architectureMetadata: [
          "architecture/guards/migration_bridge_registry.json",
          "architecture/migration/module_migration_manifest.json",
          "architecture/migration/stage_3_compatibility_runtime.json",
          "architecture/migration/stage_3_execution_state.json",
        ],
        runtimeWiring: ["index.html"],
        generatedOutput: ["dist/stage-3-compat-runtime"],
        releaseMetadata: [
          "CHANGELOG.md",
          "architecture/build/package_contract.json",
          "package-lock.json",
          "package.json",
          "refactor_Task.txt",
          "src/config/project_version.js",
        ],
      },
      rollback: {
        atomic: true,
        partialRollbackAllowed: false,
        fromRelease: profile.targetReleaseVersion,
        toRelease: profile.sourceReleaseVersion,
        preserveCompletedBatchIds: [...completedPrefix],
        removeBatchId: profile.batchId,
        restoreTopology: {
          projectModuleCount: runtimeFacts.projectModuleCount,
          activationCount: runtimeFacts.activationCount,
          bridgeRecordCount: bridgeRegistry.bridges.length,
          physicalClassicScriptCount: runtimeFacts.scriptTopology.physicalClassicScriptCount,
          logicalLegacyPositionCount: runtimeFacts.scriptTopology.logicalLegacyPositionCount,
          moduleScriptCount: runtimeFacts.scriptTopology.moduleScriptCount,
        },
        baselineEvidence: rollbackEvidence,
        targetsAbsentBeforeCutover: modules.map((module) => module.targetPath).sort(),
        rule: profile.rollbackRule,
      },
      acceptance: {
        preBuild: [
          "audit-and-plan-fingerprints-current",
          `completed-prefix-001-through-${String(batch.order - 1).padStart(3, "0")}`,
          `active-batch-${profile.batchNumber}-only`,
          `${numberWord(profile.expectedTargetCount)}-targets-${numberWord(profile.expectedActivationCount)}-activations-${numberWord(profile.expectedConsumerCount)}-consumer-bridges`,
          "zero-new-prerequisites",
        ],
        postBuild: [
          "actual-project-module-set-equals-plan",
          "one-module-evaluation-per-source",
          "exact-class-and-state-identity",
          "globals-absent-before-and-exact-after-activation",
          "zero-domain-transport-reads",
          "previous-valid-output-preserved-on-failure",
        ],
        suites: [
          `focused-${profile.focusedStageId.replace(/\.\d+$/u, "")}-behavior-and-identity`,
          "check:architecture",
          "check:quick",
          "check:full",
          "fresh-npm-ci-architecture-quick-full",
          "browser-smoke",
        ],
        releaseCriteria: [
          "zero-gameplay-semantic-delta",
          "zero-new-architecture-guard-failures",
          "manifest-registry-runtime-contract-and-state-reconciled",
          `batch-${profile.batchNumber}-completed-and-active-batch-cleared`,
        ],
      },
      verdict: "eligible-for-focused-test-matrix",
    });
  }

  #operation(order, id, mutationKind, outcome) {
    return { order, id, mutationKind, outcome };
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #require(condition, message) {
    if (!condition) throw new Error(`${this.#profile.executionStageLabel} execution plan failed: ${message}`);
  }
}

class StageThreeBatchExecutionPlanValidator {
  #profile;

  constructor(profile = BATCH_006_EXECUTION_PROFILE) {
    this.#profile = profile;
  }

  validate(plan) {
    const profile = this.#profile;
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(plan?.schemaVersion === 1, "schemaVersion must be 1");
    require(plan?.kind === "cyber-fishing-stage-3-atomic-execution-plan", "kind is invalid");
    require(plan?.status === "execution-plan-verified", "status must be execution-plan-verified");
    require(plan?.batchId === profile.batchId, "batchId is invalid");
    require(plan?.sourceReleaseVersion === profile.sourceReleaseVersion, "source release is invalid");
    require(plan?.targetReleaseVersion === profile.targetReleaseVersion, "target release is invalid");
    require(plan?.runtimeMigrationAllowed === false, `${profile.executionStageLabel} must not unlock runtime migration`);
    require(plan?.runtimeMigrationUnlockCondition === `${profile.focusedStageId}-focused-test-matrix-verified`, "runtime unlock condition is invalid");
    require(plan?.scope?.atomic === true, "scope must be atomic");
    require(plan?.scope?.partialCutoverAllowed === false, "partial cutover must be forbidden");
    require(plan?.scope?.targetCount === profile.expectedTargetCount, "target count differs from profile");
    require(plan?.scope?.exportCount === profile.expectedExportCount, "export count differs from profile");
    require(plan?.scope?.activationCount === profile.expectedActivationCount, "activation count differs from profile");
    require(plan?.scope?.consumerRelationshipCount === profile.expectedConsumerCount, "consumer count differs from profile");
    require(new Set(plan?.scope?.modules?.map((module) => module.currentPath)).size === profile.expectedTargetCount, "source paths must be unique");
    require(new Set(plan?.scope?.modules?.map((module) => module.targetPath)).size === profile.expectedTargetCount, "target paths must be unique");
    require(plan?.scope?.modules?.every((module) =>
      this.#same(module.importsAllowed, []) &&
      module.behaviorChangeAllowed === false &&
      module.directTransportReadAllowed === false &&
      module.representationChange === "classic-class-declaration-to-named-esm-export-only"),
    "module representation/boundary contract differs");
    require(this.#same(
      plan?.scope?.modules?.map(({ currentPath, targetPath, exports }) => ({ currentPath, targetPath, exports })),
      profile.expectedTargets,
    ), "exact target/export scope differs");
    const completedBefore = Number(profile.batchNumber) - 1;
    require(plan?.lifecycle?.preState?.completedBatchIds?.length === completedBefore, "pre-state completed prefix differs");
    require(plan?.lifecycle?.preState?.activeBatchId === null, "pre-state active batch must be null");
    require(plan?.lifecycle?.openState?.activeBatchId === profile.batchId, "open-state must activate the profiled batch");
    require(plan?.lifecycle?.openState?.completedBatchIds?.length === completedBefore, "open-state must not complete the batch early");
    require(plan?.lifecycle?.completedState?.activeBatchId === null, "completed-state active batch must be null");
    require(plan?.lifecycle?.completedState?.completedBatchIds?.at(-1) === profile.batchId, "completed-state must append the profiled batch");
    require(plan?.lifecycle?.completedState?.completedBatchIds?.length === completedBefore + 1, "completed-state prefix differs");
    if (profile.includeRuntimeActiveState) {
      require(plan?.lifecycle?.runtimeActiveState?.activeBatchId === profile.batchId, "runtime-active phase must keep the profiled batch active");
      require(plan?.lifecycle?.runtimeActiveState?.completedBatchIds?.length === completedBefore, "runtime-active phase must not complete the batch early");
      require(plan?.lifecycle?.runtimeActiveState?.persistence === "execution-plan-phase-not-stage-3-execution-state-status", "runtime-active persistence boundary differs");
    } else {
      require(plan?.lifecycle?.runtimeActiveState === undefined, "historical profile must not gain a runtime-active field");
    }
    require(plan?.compatibility?.activations?.length === profile.expectedActivationCount, "activation set is incomplete");
    require(plan?.compatibility?.plannedBridgeRecords?.length === profile.expectedConsumerCount, "bridge set is incomplete");
    require(this.#same(
      plan?.compatibility?.activations?.map((record) => record.id),
      profile.expectedActivationIds,
    ), "activation identity set differs");
    require(this.#same(
      plan?.compatibility?.activations?.map((record) => record.legacyScriptIndex).sort((left, right) => left - right),
      profile.expectedActivationPositions,
    ), "activation position set differs");
    require(this.#same(
      plan?.compatibility?.plannedBridgeRecords?.map((record) => record.id),
      profile.expectedBridgeIds,
    ), "bridge identity set differs");
    require(plan?.compatibility?.registryTransition?.addCount === profile.expectedConsumerCount, "registry transition add count differs");
    require(
      plan?.compatibility?.registryTransition?.afterCount ===
        plan?.compatibility?.registryTransition?.beforeCount + profile.expectedConsumerCount,
      "registry transition count is inconsistent",
    );
    require(plan?.compatibility?.transportOwnsGameState === false, "transport must not own game state");
    require(plan?.compatibility?.domainTransportReadsAllowed === false, "Domain transport reads must be forbidden");
    for (const record of plan?.compatibility?.plannedBridgeRecords || []) {
      require(record.id === CanonicalBridgeIdentity.id(record), `bridge ID is not canonical: ${record.id}`);
      require(record.owner === profile.batchId, `bridge owner differs: ${record.id}`);
      require(record.introducedStage === "stage-3", `bridge introducedStage differs: ${record.id}`);
    }
    require(plan?.cumulativeRuntime?.topology === "single-cumulative-module-graph", "runtime topology is invalid");
    require(plan?.cumulativeRuntime?.isolatedIifeAllowed === false, "isolated IIFE must be forbidden");
    require(plan?.cumulativeRuntime?.addedProjectModuleCount === profile.expectedTargetCount, "runtime module delta differs");
    require(
      plan?.cumulativeRuntime?.afterProjectModuleCount ===
        plan?.cumulativeRuntime?.beforeProjectModuleCount + profile.expectedTargetCount,
      "runtime module count transition is inconsistent",
    );
    require(
      plan?.cumulativeRuntime?.afterActivationCount ===
        plan?.cumulativeRuntime?.beforeActivationCount + profile.expectedActivationCount,
      "runtime activation count transition is inconsistent",
    );
    require(plan?.cumulativeRuntime?.projectModulesAfter?.length === plan?.cumulativeRuntime?.afterProjectModuleCount, "runtime module set is incomplete");
    require(plan?.cumulativeRuntime?.expectedDependencyEdges?.length === profile.expectedDependencyEdgeCount, "runtime dependency-edge count differs");
    require(plan?.cumulativeRuntime?.beforeProjectModuleCount === profile.expectedTopology.beforeProjectModuleCount, "before module anchor differs");
    require(plan?.cumulativeRuntime?.afterProjectModuleCount === profile.expectedTopology.afterProjectModuleCount, "after module anchor differs");
    require(plan?.cumulativeRuntime?.beforeActivationCount === profile.expectedTopology.beforeActivationCount, "before activation anchor differs");
    require(plan?.cumulativeRuntime?.afterActivationCount === profile.expectedTopology.afterActivationCount, "after activation anchor differs");
    require(plan?.compatibility?.registryTransition?.beforeCount === profile.expectedTopology.beforeBridgeCount, "before bridge anchor differs");
    require(plan?.compatibility?.registryTransition?.afterCount === profile.expectedTopology.afterBridgeCount, "after bridge anchor differs");
    require(plan?.cumulativeRuntime?.evaluationCountPerModule === 1, "module evaluation count must be one");
    require(plan?.cumulativeRuntime?.preservePreviousValidatedOutputOnFailure === true, "previous output must survive build failure");
    require(
      plan?.scriptTopology?.after?.physicalClassicScriptCount === plan?.scriptTopology?.before?.physicalClassicScriptCount,
      "physical script count must remain unchanged",
    );
    require(
      plan?.scriptTopology?.after?.logicalLegacyPositionCount === plan?.scriptTopology?.before?.logicalLegacyPositionCount,
      "logical legacy positions must remain unchanged",
    );
    require(plan?.scriptTopology?.after?.moduleScriptCount === 0, "module scripts must remain zero");
    require(
      this.#same(plan?.operations?.map((operation) => operation.id), profile.operationIds),
      "operation order differs from contract",
    );
    require(plan?.operations?.every((operation, index) => operation.order === index + 1), "operation numbers must be contiguous");
    require(plan?.rollback?.atomic === true, "rollback must be atomic");
    require(plan?.rollback?.partialRollbackAllowed === false, "partial rollback must be forbidden");
    require(plan?.rollback?.preserveCompletedBatchIds?.length === completedBefore, "rollback completed prefix differs");
    require(plan?.rollback?.removeBatchId === profile.batchId, "rollback must remove only the profiled batch");
    require(plan?.rollback?.rule === profile.rollbackRule, "rollback rule differs from profile");
    require(plan?.rollback?.targetsAbsentBeforeCutover?.length === profile.expectedTargetCount, "rollback target absence set is incomplete");
    require(plan?.stateAndBehaviorInvariants?.every((record) =>
      record.authoritativeOwnerPreserved === true &&
      record.duplicateStateCopies === "forbidden" &&
      record.formulasApiDefaultsAndResultShapes === "unchanged"), "state/behavior invariant is incomplete");
    if (profile.includeDetailedStatePerformanceGates) {
      require(plan?.stateAndBehaviorInvariants?.every((record) =>
        record.authoritativeOwnerBefore?.module === record.module &&
        record.authoritativeOwnerAfter?.module !== record.module &&
        Array.isArray(record.publicStateShape) &&
        Array.isArray(record.snapshotShape) &&
        typeof record.stableResultIdentity === "boolean" &&
        typeof record.mutatesCallerInputs === "boolean" &&
        /^[a-f0-9]{64}$/u.test(record.behaviorFingerprint) &&
        record.allocationBaseline &&
        record.additionalMigrationAllocationsAllowed === 0 &&
        record.transportLookupsAllowed === 0 &&
        record.representationComparison === "target-ast-after-removing-export-must-equal-frozen-source-ast"),
      "detailed state/performance invariant is incomplete");
    }
    require(plan?.verdict === "eligible-for-focused-test-matrix", "verdict is invalid");
    for (const [key, evidence] of Object.entries(plan?.sourceEvidence || {})) {
      if (key === "scmCheckpoint") continue;
      require(/^[a-f0-9]{64}$/.test(evidence.sha256), `evidence fingerprint is invalid: ${evidence.path}`);
    }
    if (profile.scmCheckpointRequired) {
      require(plan?.sourceEvidence?.scmCheckpoint?.tag === profile.sourceReleaseTag, "SCM tag evidence differs");
      require(/^[a-f0-9]{40}$/u.test(plan?.sourceEvidence?.scmCheckpoint?.commitSha), "SCM commit evidence is invalid");
      require(plan?.sourceEvidence?.scmCheckpoint?.tagType === "tag", "SCM tag must be annotated");
    } else {
      require(plan?.sourceEvidence?.scmCheckpoint === undefined, "historical plan must remain byte-stable without SCM field");
    }
    if (errors.length > 0) {
      throw new Error(`${profile.executionStageLabel} execution-plan contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(plan);
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = {
  BRIDGE_REASON,
  OPERATION_IDS,
  SOURCE_RELEASE_VERSION,
  TARGET_RELEASE_VERSION,
  StageThreeBatchExecutionPlanBuilder,
  StageThreeBatchExecutionPlanValidator,
};
