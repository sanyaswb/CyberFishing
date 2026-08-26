"use strict";

const {
  CanonicalBridgeIdentity,
} = require("../../build/legacy_bridge_build_config");
const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_ID,
  EXPECTED_TARGET_COUNT,
} = require("./stage_three_batch_dependency_state_audit");

const SOURCE_RELEASE_VERSION = "0.24.42";
const TARGET_RELEASE_VERSION = "0.24.43";
const BRIDGE_REASON =
  "Preserve the exact synchronous Fishing Domain Primitives II consumer set until its approved migration stage removes the legacy symbols.";

const OPERATION_IDS = Object.freeze([
  "verify-frozen-evidence",
  "open-batch-006",
  "create-six-named-esm-targets",
  "render-six-activation-shims",
  "register-seven-consumer-bridges",
  "project-preliminary-manifest-metadata",
  "build-single-cumulative-runtime",
  "validate-identity-timing-and-behavior",
  "persist-and-reconcile-observations",
  "run-full-acceptance",
  "close-release-0.24.43",
]);

class StageThreeBatchExecutionPlanBuilder {
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
    runtimeFacts,
    rollbackEvidence,
  }) {
    const batch = approvedPlan.batches.find((record) => record.id === BATCH_ID);
    this.#require(batch, `Approved batch is missing: ${BATCH_ID}`);
    this.#require(batch.status === "approved-frozen", "Batch 006 is not approved-frozen");
    this.#require(audit.status === "verified", "Stage 3.6.1 audit is not verified");
    this.#require(
      audit.verdict === "eligible-for-execution-plan",
      "Stage 3.6.1 audit does not allow execution planning",
    );
    this.#require(audit.batchId === BATCH_ID, "Audit batch identity differs");
    this.#require(audit.sourceReleaseVersion === SOURCE_RELEASE_VERSION, "Audit source release differs");
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
    this.#require(audit.scope.targetCount === EXPECTED_TARGET_COUNT, "Audit scope is not six targets");
    this.#require(audit.closure.unexpectedDependencies.length === 0, "Audit contains unexpected dependencies");
    this.#require(audit.prerequisites.newlyDiscovered.length === 0, "Audit discovered new prerequisites");

    const completedPrefix = approvedPlan.batches
      .slice(0, batch.order - 1)
      .map((record) => record.id);
    this.#require(
      this.#same(executionState.completedBatchIds, completedPrefix),
      "Execution state is not the exact completed prefix 001-005",
    );
    this.#require(executionState.activeBatchId === null, "Execution plan requires no active batch");
    this.#require(executionState.compatibilityRuntimeActivated === true, "Cumulative runtime must already be active");
    this.#require(executionState.releaseVersion === SOURCE_RELEASE_VERSION, "Execution-state release differs");
    this.#require(
      runtimeContract.activationPositions.every((activation) => activation.owner !== BATCH_ID),
      "Runtime contract already contains batch 006 activation",
    );
    this.#require(
      bridgeRegistry.bridges.every((record) => record.owner !== BATCH_ID),
      "Bridge registry already contains batch 006 record",
    );
    this.#require(runtimeFacts.projectModuleCount === audit.closure.existingCumulativeModuleCount, "Current cumulative module count differs from audit");
    this.#require(runtimeFacts.activationCount === runtimeContract.activationPositions.length, "Current activation count differs from runtime contract");

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

    const activations = batch.compatibility.newActivations
      .map((activation) => ({
        ...activation.contract,
        mechanism: activation.mechanism,
        consumers: [...activation.legacyConsumers].sort(),
        removalCondition: activation.removalCondition,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    this.#require(activations.length === EXPECTED_TARGET_COUNT, "Batch 006 must add six activations");

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
        reason: BRIDGE_REASON,
        owner: BATCH_ID,
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
    this.#require(plannedBridges.length === 7, "Batch 006 must add seven consumer bridge records");
    this.#require(new Set(plannedBridges.map((record) => record.id)).size === 7, "Planned bridge IDs must be unique");

    const completedState = {
      releaseVersion: TARGET_RELEASE_VERSION,
      status: "migration-active",
      completedBatchIds: [...completedPrefix, BATCH_ID],
      activeBatchId: null,
      compatibilityRuntimeActivated: true,
    };
    const openState = {
      releaseVersion: SOURCE_RELEASE_VERSION,
      status: "migration-active",
      completedBatchIds: [...completedPrefix],
      activeBatchId: BATCH_ID,
      compatibilityRuntimeActivated: true,
    };
    const afterModuleCount = new Set([
      ...audit.closure.existingCumulativeModules,
      ...audit.closure.newProjectModules,
    ]).size;
    const afterActivationCount = runtimeFacts.activationCount + activations.length;
    const afterBridgeCount = bridgeRegistry.bridges.length + plannedBridges.length;

    const operations = [
      this.#operation(1, OPERATION_IDS[0], "read-only", "Verify audit fingerprints, frozen scope, current topology and completed prefix."),
      this.#operation(2, OPERATION_IDS[1], "metadata", "Set activeBatchId to batch 006 without changing completedBatchIds."),
      this.#operation(3, OPERATION_IDS[2], "source", "Create all six named ESM targets as representation-only copies."),
      this.#operation(4, OPERATION_IDS[3], "source", "Replace all six classic providers with exact generated activation shims."),
      this.#operation(5, OPERATION_IDS[4], "metadata", "Add the seven canonical consumer-specific bridge records as one set."),
      this.#operation(6, OPERATION_IDS[5], "metadata", "Project target and compatibility-bridge metadata before build validation."),
      this.#operation(7, OPERATION_IDS[6], "generated-output", "Build and atomically validate one cumulative 25-module runtime."),
      this.#operation(8, OPERATION_IDS[7], "read-only", "Prove exact export identity, activation timing, one evaluation and behavior equivalence."),
      this.#operation(9, OPERATION_IDS[8], "metadata", "Persist mechanical observations and reconcile Manifest facts after source/shim creation."),
      this.#operation(10, OPERATION_IDS[9], "read-only", "Run focused, Architecture, Quick, Full, fresh-install and browser acceptance."),
      this.#operation(11, OPERATION_IDS[10], "metadata", "Mark batch 006 completed, clear activeBatchId and publish v0.24.43 metadata."),
    ];

    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-atomic-execution-plan",
      status: "execution-plan-verified",
      batchId: BATCH_ID,
      sourceReleaseVersion: SOURCE_RELEASE_VERSION,
      targetReleaseVersion: TARGET_RELEASE_VERSION,
      runtimeMigrationAllowed: false,
      runtimeMigrationUnlockCondition: "stage-3.6.3-focused-test-matrix-verified",
      sourceEvidence: {
        audit: {
          path: "architecture/migration/stage_3_batch_006_audit.json",
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
      lifecycle: {
        preState: {
          releaseVersion: executionState.releaseVersion,
          status: executionState.status,
          completedBatchIds: [...executionState.completedBatchIds],
          activeBatchId: executionState.activeBatchId,
          compatibilityRuntimeActivated: executionState.compatibilityRuntimeActivated,
        },
        openState,
        completedState,
        runtimeTargetSelection: "completed-batches-plus-active-batch-plus-promoted-stage-2-closure",
      },
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
      stateAndBehaviorInvariants: modules.map((module) => ({
        module: module.currentPath,
        stateClassification: module.stateClassification,
        authoritativeOwnerPreserved: true,
        duplicateStateCopies: "forbidden",
        formulasApiDefaultsAndResultShapes: "unchanged",
      })),
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
        fromRelease: TARGET_RELEASE_VERSION,
        toRelease: SOURCE_RELEASE_VERSION,
        preserveCompletedBatchIds: [...completedPrefix],
        removeBatchId: BATCH_ID,
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
        rule: "restore-only-batch-006-delta-and-keep-batches-001-through-005",
      },
      acceptance: {
        preBuild: [
          "audit-and-plan-fingerprints-current",
          "completed-prefix-001-through-005",
          "active-batch-006-only",
          "six-targets-six-activations-seven-consumer-bridges",
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
          "focused-stage-3.6-behavior-and-identity",
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
          "batch-006-completed-and-active-batch-cleared",
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
    if (!condition) throw new Error(`Stage 3.6.2 execution plan failed: ${message}`);
  }
}

class StageThreeBatchExecutionPlanValidator {
  validate(plan) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(plan?.schemaVersion === 1, "schemaVersion must be 1");
    require(plan?.kind === "cyber-fishing-stage-3-atomic-execution-plan", "kind is invalid");
    require(plan?.status === "execution-plan-verified", "status must be execution-plan-verified");
    require(plan?.batchId === BATCH_ID, "batchId is invalid");
    require(plan?.sourceReleaseVersion === SOURCE_RELEASE_VERSION, "source release is invalid");
    require(plan?.targetReleaseVersion === TARGET_RELEASE_VERSION, "target release is invalid");
    require(plan?.runtimeMigrationAllowed === false, "Stage 3.6.2 must not unlock runtime migration");
    require(plan?.runtimeMigrationUnlockCondition === "stage-3.6.3-focused-test-matrix-verified", "runtime unlock condition is invalid");
    require(plan?.scope?.atomic === true, "scope must be atomic");
    require(plan?.scope?.partialCutoverAllowed === false, "partial cutover must be forbidden");
    require(plan?.scope?.targetCount === EXPECTED_TARGET_COUNT, "target count must be six");
    require(plan?.scope?.exportCount === EXPECTED_TARGET_COUNT, "export count must be six");
    require(plan?.scope?.activationCount === EXPECTED_TARGET_COUNT, "activation count must be six");
    require(plan?.scope?.consumerRelationshipCount === 7, "consumer relationship count must be seven");
    require(new Set(plan?.scope?.modules?.map((module) => module.currentPath)).size === EXPECTED_TARGET_COUNT, "source paths must be unique");
    require(new Set(plan?.scope?.modules?.map((module) => module.targetPath)).size === EXPECTED_TARGET_COUNT, "target paths must be unique");
    require(plan?.lifecycle?.preState?.completedBatchIds?.length === 5, "pre-state must preserve five completed batches");
    require(plan?.lifecycle?.preState?.activeBatchId === null, "pre-state active batch must be null");
    require(plan?.lifecycle?.openState?.activeBatchId === BATCH_ID, "open-state must activate batch 006");
    require(plan?.lifecycle?.openState?.completedBatchIds?.length === 5, "open-state must not complete batch 006 early");
    require(plan?.lifecycle?.completedState?.activeBatchId === null, "completed-state active batch must be null");
    require(plan?.lifecycle?.completedState?.completedBatchIds?.at(-1) === BATCH_ID, "completed-state must append batch 006");
    require(plan?.lifecycle?.completedState?.completedBatchIds?.length === 6, "completed-state must contain six completed batches");
    require(plan?.compatibility?.activations?.length === EXPECTED_TARGET_COUNT, "activation set is incomplete");
    require(plan?.compatibility?.plannedBridgeRecords?.length === 7, "bridge set is incomplete");
    require(plan?.compatibility?.registryTransition?.addCount === 7, "registry transition must add seven records");
    require(
      plan?.compatibility?.registryTransition?.afterCount ===
        plan?.compatibility?.registryTransition?.beforeCount + 7,
      "registry transition count is inconsistent",
    );
    require(plan?.compatibility?.transportOwnsGameState === false, "transport must not own game state");
    require(plan?.compatibility?.domainTransportReadsAllowed === false, "Domain transport reads must be forbidden");
    for (const record of plan?.compatibility?.plannedBridgeRecords || []) {
      require(record.id === CanonicalBridgeIdentity.id(record), `bridge ID is not canonical: ${record.id}`);
      require(record.owner === BATCH_ID, `bridge owner differs: ${record.id}`);
      require(record.introducedStage === "stage-3", `bridge introducedStage differs: ${record.id}`);
    }
    require(plan?.cumulativeRuntime?.topology === "single-cumulative-module-graph", "runtime topology is invalid");
    require(plan?.cumulativeRuntime?.isolatedIifeAllowed === false, "isolated IIFE must be forbidden");
    require(plan?.cumulativeRuntime?.addedProjectModuleCount === EXPECTED_TARGET_COUNT, "runtime must add six modules");
    require(
      plan?.cumulativeRuntime?.afterProjectModuleCount ===
        plan?.cumulativeRuntime?.beforeProjectModuleCount + EXPECTED_TARGET_COUNT,
      "runtime module count transition is inconsistent",
    );
    require(
      plan?.cumulativeRuntime?.afterActivationCount ===
        plan?.cumulativeRuntime?.beforeActivationCount + EXPECTED_TARGET_COUNT,
      "runtime activation count transition is inconsistent",
    );
    require(plan?.cumulativeRuntime?.projectModulesAfter?.length === plan?.cumulativeRuntime?.afterProjectModuleCount, "runtime module set is incomplete");
    require(plan?.cumulativeRuntime?.expectedDependencyEdges?.length === 0, "batch 006 runtime must not add dependency edges");
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
      this.#same(plan?.operations?.map((operation) => operation.id), OPERATION_IDS),
      "operation order differs from contract",
    );
    require(plan?.operations?.every((operation, index) => operation.order === index + 1), "operation numbers must be contiguous");
    require(plan?.rollback?.atomic === true, "rollback must be atomic");
    require(plan?.rollback?.partialRollbackAllowed === false, "partial rollback must be forbidden");
    require(plan?.rollback?.preserveCompletedBatchIds?.length === 5, "rollback must preserve batches 001-005");
    require(plan?.rollback?.removeBatchId === BATCH_ID, "rollback must remove only batch 006");
    require(plan?.rollback?.targetsAbsentBeforeCutover?.length === EXPECTED_TARGET_COUNT, "rollback target absence set is incomplete");
    require(plan?.stateAndBehaviorInvariants?.every((record) =>
      record.authoritativeOwnerPreserved === true &&
      record.duplicateStateCopies === "forbidden" &&
      record.formulasApiDefaultsAndResultShapes === "unchanged"), "state/behavior invariant is incomplete");
    require(plan?.verdict === "eligible-for-focused-test-matrix", "verdict is invalid");
    for (const evidence of Object.values(plan?.sourceEvidence || {})) {
      require(/^[a-f0-9]{64}$/.test(evidence.sha256), `evidence fingerprint is invalid: ${evidence.path}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.6.2 execution-plan contract failed:\n- ${errors.join("\n- ")}`);
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
