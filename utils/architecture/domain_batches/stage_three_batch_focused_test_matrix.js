"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  StageThreeBatchExecutionProfile,
} = require("./stage_three_batch_execution_profile");

class StageThreeBatchFocusedInputs {
  constructor(input) {
    if (!input || typeof input !== "object") {
      throw new Error("Stage 3 focused matrix requires profile, behaviorCases and compatibilityCases");
    }
    const profile = StageThreeBatchExecutionProfile.validateImmutable(input.profile);
    this.#requireImmutable(input.behaviorCases, "behaviorCases");
    this.#requireImmutable(input.compatibilityCases, "compatibilityCases");
    if (Array.isArray(input.behaviorCases) || typeof input.behaviorCases !== "object") {
      throw new Error("Stage 3 focused matrix behaviorCases must be an immutable record");
    }
    if (!Array.isArray(input.compatibilityCases)) {
      throw new Error("Stage 3 focused matrix compatibilityCases must be an immutable array");
    }
    const expectedExports = profile.expectedTargets
      .flatMap((target) => target.exports)
      .sort();
    const behaviorExports = Object.keys(input.behaviorCases).sort();
    if (JSON.stringify(behaviorExports) !== JSON.stringify(expectedExports)) {
      throw new Error("Stage 3 focused matrix behaviorCases must cover the exact profile exports");
    }
    for (const [exportName, cases] of Object.entries(input.behaviorCases)) {
      if (!Array.isArray(cases) || cases.length === 0 ||
        cases.some((item) => typeof item !== "string" || item.length === 0) ||
        new Set(cases).size !== cases.length) {
        throw new Error(`Stage 3 focused matrix behaviorCases are invalid: ${exportName}`);
      }
    }
    if (input.compatibilityCases.length === 0 ||
      input.compatibilityCases.some((item) => typeof item !== "string" || item.length === 0) ||
      new Set(input.compatibilityCases).size !== input.compatibilityCases.length) {
      throw new Error("Stage 3 focused matrix compatibilityCases are invalid");
    }
    this.value = Object.freeze({
      profile,
      behaviorCases: input.behaviorCases,
      compatibilityCases: input.compatibilityCases,
    });
  }

  #requireImmutable(value, label, seen = new Set()) {
    if (!value || typeof value !== "object" || !Object.isFrozen(value)) {
      throw new Error(`Stage 3 focused matrix ${label} is required and must be deeply immutable`);
    }
    if (seen.has(value)) return;
    seen.add(value);
    for (const item of Object.values(value)) this.#requireNestedImmutable(item, label, seen);
  }

  #requireNestedImmutable(value, label, seen) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    if (!Object.isFrozen(value)) {
      throw new Error(`Stage 3 focused matrix ${label} must be deeply immutable`);
    }
    seen.add(value);
    for (const item of Object.values(value)) this.#requireNestedImmutable(item, label, seen);
  }
}

class StageThreeBatchFocusedTestMatrixBuilder {
  #profile;
  #behaviorCases;
  #compatibilityCases;

  constructor(input) {
    const resolved = new StageThreeBatchFocusedInputs(input).value;
    this.#profile = resolved.profile;
    this.#behaviorCases = resolved.behaviorCases;
    this.#compatibilityCases = resolved.compatibilityCases;
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

  constructor(input) {
    const resolved = new StageThreeBatchFocusedInputs(input).value;
    this.#profile = resolved.profile;
    this.#behaviorCases = resolved.behaviorCases;
    this.#compatibilityCases = resolved.compatibilityCases;
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
    require(matrix?.sourceReleaseVersion === profile.sourceReleaseVersion, "source release differs");
    require(matrix?.targetReleaseVersion === profile.targetReleaseVersion, "target release differs");
    require(matrix?.sourceExecutionPlan?.path === profile.executionPlanPath,
      "execution-plan path differs");
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
      record.requiredOutcome === "observable-result-equivalent" &&
      /^[a-f0-9]{64}$/u.test(record.baselineSourceSha256) &&
      profile.expectedTargets.some((target) =>
        target.currentPath === record.currentPath &&
        target.targetPath === record.targetPath &&
        target.exports.includes(record.exportName))), "behavior phase/source contract differs");
    require(matrix?.compatibilityCases?.every((record) =>
      this.#same(record.phases, profile.compatibilityPhases) &&
      record.requiredOutcome === "exact-contract-pass"), "compatibility phase contract differs");
    const expectedCoverage = Object.entries(this.#behaviorCases).map(([exportName, cases]) => ({
      exportName,
      caseCount: cases.length,
      cases: [...cases],
    })).sort((left, right) => left.exportName.localeCompare(right.exportName));
    require(this.#same(matrix?.coverage, expectedCoverage),
      "coverage records must include every exact export case");
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
      require(matrix?.statePerformanceContract?.modules?.every((record) =>
        record.authoritativeOwnerPreserved === true &&
        record.duplicateStateCopies === "forbidden" &&
        record.formulasApiDefaultsAndResultShapes === "unchanged" &&
        record.authoritativeOwnerBefore?.module === record.module &&
        record.authoritativeOwnerAfter?.module !== record.module &&
        Array.isArray(record.publicStateShape) &&
        (Array.isArray(record.snapshotShape) || Array.isArray(record.resultShape)) &&
        typeof record.stableResultIdentity === "boolean" &&
        typeof record.mutatesCallerInputs === "boolean" &&
        /^[a-f0-9]{64}$/u.test(record.behaviorFingerprint) &&
        record.allocationBaseline &&
        record.additionalMigrationAllocationsAllowed === 0 &&
        record.transportLookupsAllowed === 0 &&
        record.representationComparison ===
          "target-ast-after-removing-export-must-equal-frozen-source-ast"),
      "state/performance module contract differs");
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
  StageThreeBatchFocusedInputs,
  StageThreeBatchFocusedTestMatrixBuilder,
  StageThreeBatchFocusedTestMatrixValidator,
};
