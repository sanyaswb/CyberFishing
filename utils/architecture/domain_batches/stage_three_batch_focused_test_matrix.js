"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_006_EXECUTION_PROFILE,
} = require("./stage_three_batch_execution_profile");

const BEHAVIOR_CASES = Object.freeze({
  FloatTackleLineBudgetPolicy: Object.freeze([
    "float-and-pole-applicability",
    "selected-depth-clamp",
    "surface-depth-tolerance",
    "line-and-rod-budget",
    "non-float-fallback",
    "constructor-injected-config",
  ]),
  HoldOppositionResolver: Object.freeze([
    "positive-and-negative-opposition",
    "zero-force-input",
    "ratio-boundaries",
    "invalid-numeric-inputs",
  ]),
  RodControlTensionModeResolver: Object.freeze([
    "same-opposite-and-side-modes",
    "minimum-fish-speed",
    "alignment-thresholds",
    "normalized-control-axis",
    "frozen-result-semantics",
  ]),
  LineConstraintStateResolver: Object.freeze([
    "taut-and-slack-line",
    "line-reserve",
    "drag-payout",
    "hard-spool-limit",
    "blocked-reasons",
    "epsilon-boundaries",
  ]),
  PoleFightSectorGeometry: Object.freeze([
    "sector-construction",
    "angle-and-radius-calculations",
    "contains-violation-and-point-at",
    "invalid-points",
    "per-instance-reusable-frame-identity",
    "no-module-global-frame",
  ]),
  LandingLiftTensionCalculator: Object.freeze([
    "lift-gain-and-release",
    "landing-zone-gate",
    "tackle-load-slowdown",
    "clamp-and-fallback-semantics",
    "frozen-result",
    "delta-time-behavior",
  ]),
});

const COMPATIBILITY_CASES = Object.freeze([
  "globals-absent-before-activation",
  "globals-equal-exact-export-after-activation",
  "module-evaluation-count-equals-one",
  "class-identity-preserved",
  "seven-classic-consumers-retain-api",
  "domain-does-not-read-transport-global",
]);

class StageThreeBatchFocusedTestMatrixBuilder {
  #profile;
  #behaviorCases;
  #compatibilityCases;

  constructor({
    profile = BATCH_006_EXECUTION_PROFILE,
    behaviorCases = BEHAVIOR_CASES,
    compatibilityCases = COMPATIBILITY_CASES,
  } = {}) {
    this.#profile = profile;
    this.#behaviorCases = behaviorCases;
    this.#compatibilityCases = compatibilityCases;
  }

  build({ executionPlan, executionPlanSha256 }) {
    const profile = this.#profile;
    this.#require(executionPlan.status === "execution-plan-verified", "Execution plan is not verified");
    this.#require(executionPlan.batchId === profile.batchId, "Execution plan batch differs");
    this.#require(executionPlan.verdict === "eligible-for-focused-test-matrix", "Execution plan does not allow test-matrix creation");
    const moduleByExport = new Map(executionPlan.scope.modules.flatMap((module) =>
      module.exports.map((exportName) => [exportName, module])));
    const behaviorCases = Object.entries(this.#behaviorCases).flatMap(([exportName, cases]) => {
      const module = moduleByExport.get(exportName);
      this.#require(module, `Execution-plan export is missing: ${exportName}`);
      return cases.map((caseName) => ({
        id: `behavior/${exportName}/${caseName}`,
        kind: "behavior-equivalence",
        exportName,
        currentPath: module.currentPath,
        targetPath: module.targetPath,
        baselineSourceSha256: module.sourceSha256,
        caseName,
        phases: [...profile.behaviorPhases],
        requiredOutcome: "observable-result-equivalent",
      }));
    }).sort((left, right) => left.id.localeCompare(right.id));
    const compatibilityCases = this.#compatibilityCases.map((caseName) => ({
      id: `compatibility/${caseName}`,
      kind: "compatibility-invariant",
      caseName,
      phases: [...profile.compatibilityPhases],
      requiredOutcome: "exact-contract-pass",
    }));
    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-focused-test-matrix",
      status: "verified",
      batchId: profile.batchId,
      sourceReleaseVersion: executionPlan.sourceReleaseVersion,
      targetReleaseVersion: executionPlan.targetReleaseVersion,
      sourceExecutionPlan: {
        path: profile.executionPlanPath,
        sha256: executionPlanSha256,
      },
      scope: {
        moduleCount: executionPlan.scope.targetCount,
        exportCount: executionPlan.scope.exportCount,
        activationCount: executionPlan.scope.activationCount,
        consumerRelationshipCount: executionPlan.scope.consumerRelationshipCount,
      },
      behaviorCases,
      compatibilityCases,
      coverage: Object.entries(this.#behaviorCases).map(([exportName, cases]) => ({
        exportName,
        caseCount: cases.length,
        cases: [...cases],
      })).sort((left, right) => left.exportName.localeCompare(right.exportName)),
      identityContract: {
        moduleEvaluationCount: 1,
        exactExportReference: true,
        globalAbsentBeforeActivation: true,
        globalExactAfterActivation: true,
        duplicateClassOrStateIdentity: "forbidden",
      },
      consumerContract: {
        exactRelationshipCount: executionPlan.scope.consumerRelationshipCount,
        directTransportReadsAllowed: false,
        consumerSetSource: profile.consumerSetSource,
      },
      ...(profile.includeDetailedStatePerformanceGates ? {
        statePerformanceContract: {
          source: profile.executionPlanPath,
          modules: executionPlan.stateAndBehaviorInvariants,
          additionalMigrationAllocationsAllowed: 0,
          transportLookupsAllowed: 0,
          representationComparison: "target-ast-after-removing-export-must-equal-frozen-source-ast",
          transportSurfaceSource: "architecture/migration/stage_3_compatibility_runtime.json#transport",
        },
      } : {}),
      gates: {
        baselineBehaviorRequired: true,
        postCutoverBehaviorRequired: true,
        activationTimingRequired: true,
        identityRequired: true,
        fullConsumerSetRequired: true,
        transportIsolationRequired: true,
      },
      prebuildOpenAllowed: true,
      runtimeCutoverAllowed: false,
      runtimeCutoverUnlockCondition: `${profile.prebuildStageId}-prebuild-contract-opened`,
      verdict: "eligible-for-prebuild-open",
    });
  }

  #require(condition, message) {
    if (!condition) throw new Error(`${this.#profile.focusedStageId} focused matrix failed: ${message}`);
  }
}

class StageThreeBatchFocusedTestMatrixValidator {
  #profile;
  #behaviorCases;
  #compatibilityCases;

  constructor({
    profile = BATCH_006_EXECUTION_PROFILE,
    behaviorCases = BEHAVIOR_CASES,
    compatibilityCases = COMPATIBILITY_CASES,
  } = {}) {
    this.#profile = profile;
    this.#behaviorCases = behaviorCases;
    this.#compatibilityCases = compatibilityCases;
  }

  validate(matrix) {
    const profile = this.#profile;
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    const expectedBehaviorIds = Object.entries(this.#behaviorCases)
      .flatMap(([exportName, cases]) => cases.map((caseName) =>
        `behavior/${exportName}/${caseName}`))
      .sort();
    const expectedCompatibilityIds = this.#compatibilityCases.map((caseName) =>
      `compatibility/${caseName}`);
    require(matrix?.schemaVersion === 1, "schemaVersion must be 1");
    require(matrix?.kind === "cyber-fishing-stage-3-focused-test-matrix", "kind is invalid");
    require(matrix?.status === "verified", "status must be verified");
    require(matrix?.batchId === profile.batchId, "batchId is invalid");
    require(/^[a-f0-9]{64}$/.test(matrix?.sourceExecutionPlan?.sha256), "execution-plan fingerprint is invalid");
    require(matrix?.scope?.moduleCount === profile.expectedTargetCount, "module coverage differs from profile");
    require(matrix?.scope?.exportCount === profile.expectedExportCount, "export coverage differs from profile");
    require(matrix?.scope?.activationCount === profile.expectedActivationCount, "activation coverage differs from profile");
    require(matrix?.scope?.consumerRelationshipCount === profile.expectedConsumerCount, "consumer coverage differs from profile");
    require(
      this.#same(matrix?.behaviorCases?.map((record) => record.id).sort(), expectedBehaviorIds),
      "behavior case set is incomplete or changed",
    );
    require(
      this.#same(matrix?.compatibilityCases?.map((record) => record.id), expectedCompatibilityIds),
      "compatibility case set is incomplete or changed",
    );
    require(matrix?.behaviorCases?.every((record) =>
      this.#same(record.phases, profile.behaviorPhases) &&
      record.requiredOutcome === "observable-result-equivalent"), "behavior phase contract differs");
    require(matrix?.compatibilityCases?.every((record) =>
      this.#same(record.phases, profile.compatibilityPhases) &&
      record.requiredOutcome === "exact-contract-pass"), "compatibility phase contract differs");
    require(matrix?.coverage?.length === profile.expectedExportCount, "coverage records must include every export");
    require(matrix?.identityContract?.moduleEvaluationCount === 1, "evaluation count must be one");
    require(matrix?.identityContract?.exactExportReference === true, "exact export reference is required");
    require(matrix?.identityContract?.globalAbsentBeforeActivation === true, "pre-activation absence is required");
    require(matrix?.identityContract?.globalExactAfterActivation === true, "post-activation identity is required");
    require(matrix?.identityContract?.duplicateClassOrStateIdentity === "forbidden", "duplicate identity must be forbidden");
    require(matrix?.consumerContract?.exactRelationshipCount === profile.expectedConsumerCount, "consumer relationship count differs");
    require(matrix?.consumerContract?.consumerSetSource === profile.consumerSetSource, "consumer set source differs");
    require(matrix?.consumerContract?.directTransportReadsAllowed === false, "transport reads must be forbidden");
    if (profile.includeDetailedStatePerformanceGates) {
      require(matrix?.statePerformanceContract?.modules?.length === profile.expectedTargetCount,
        "state/performance module coverage differs");
      require(matrix?.statePerformanceContract?.additionalMigrationAllocationsAllowed === 0,
        "additional allocation budget must be zero");
      require(matrix?.statePerformanceContract?.transportLookupsAllowed === 0,
        "transport lookup budget must be zero");
      require(matrix?.statePerformanceContract?.representationComparison ===
        "target-ast-after-removing-export-must-equal-frozen-source-ast",
      "representation comparison differs");
      require(matrix?.statePerformanceContract?.transportSurfaceSource ===
        "architecture/migration/stage_3_compatibility_runtime.json#transport",
      "transport surface source differs");
    } else {
      require(matrix?.statePerformanceContract === undefined,
        "historical matrix must remain byte-stable without detailed state/performance field");
    }
    require(matrix?.prebuildOpenAllowed === true, "verified matrix must allow pre-build open");
    require(matrix?.runtimeCutoverAllowed === false, "matrix must not directly allow runtime cutover");
    require(matrix?.runtimeCutoverUnlockCondition === `${profile.prebuildStageId}-prebuild-contract-opened`, "cutover unlock condition differs");
    require(matrix?.verdict === "eligible-for-prebuild-open", "verdict differs");
    if (errors.length > 0) {
      const stageLabel = profile.focusedStageId.startsWith("stage-")
        ? `Stage ${profile.focusedStageId.slice("stage-".length)}`
        : profile.focusedStageId;
      throw new Error(`${stageLabel} focused-matrix contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(matrix);
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = {
  BEHAVIOR_CASES,
  COMPATIBILITY_CASES,
  StageThreeBatchFocusedTestMatrixBuilder,
  StageThreeBatchFocusedTestMatrixValidator,
};
