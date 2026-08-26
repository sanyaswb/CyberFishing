"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_ID,
} = require("./stage_three_batch_dependency_state_audit");

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
  build({ executionPlan, executionPlanSha256 }) {
    this.#require(executionPlan.status === "execution-plan-verified", "Execution plan is not verified");
    this.#require(executionPlan.batchId === BATCH_ID, "Execution plan batch differs");
    this.#require(executionPlan.verdict === "eligible-for-focused-test-matrix", "Execution plan does not allow test-matrix creation");
    const moduleByExport = new Map(executionPlan.scope.modules.flatMap((module) =>
      module.exports.map((exportName) => [exportName, module])));
    const behaviorCases = Object.entries(BEHAVIOR_CASES).flatMap(([exportName, cases]) => {
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
        phases: ["classic-baseline", "post-cutover-esm"],
        requiredOutcome: "observable-result-equivalent",
      }));
    }).sort((left, right) => left.id.localeCompare(right.id));
    const compatibilityCases = COMPATIBILITY_CASES.map((caseName) => ({
      id: `compatibility/${caseName}`,
      kind: "compatibility-invariant",
      caseName,
      phases: ["pre-build-fixture", "post-build-runtime"],
      requiredOutcome: "exact-contract-pass",
    }));
    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-focused-test-matrix",
      status: "verified",
      batchId: BATCH_ID,
      sourceReleaseVersion: executionPlan.sourceReleaseVersion,
      targetReleaseVersion: executionPlan.targetReleaseVersion,
      sourceExecutionPlan: {
        path: "architecture/migration/stage_3_batch_006_execution_plan.json",
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
      coverage: Object.entries(BEHAVIOR_CASES).map(([exportName, cases]) => ({
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
        consumerSetSource: "stage-3.6.2-planned-canonical-bridge-records",
      },
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
      runtimeCutoverUnlockCondition: "stage-3.6.4-prebuild-contract-opened",
      verdict: "eligible-for-prebuild-open",
    });
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.6.3 focused matrix failed: ${message}`);
  }
}

class StageThreeBatchFocusedTestMatrixValidator {
  validate(matrix) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    const expectedBehaviorIds = Object.entries(BEHAVIOR_CASES)
      .flatMap(([exportName, cases]) => cases.map((caseName) =>
        `behavior/${exportName}/${caseName}`))
      .sort();
    const expectedCompatibilityIds = COMPATIBILITY_CASES.map((caseName) =>
      `compatibility/${caseName}`);
    require(matrix?.schemaVersion === 1, "schemaVersion must be 1");
    require(matrix?.kind === "cyber-fishing-stage-3-focused-test-matrix", "kind is invalid");
    require(matrix?.status === "verified", "status must be verified");
    require(matrix?.batchId === BATCH_ID, "batchId is invalid");
    require(/^[a-f0-9]{64}$/.test(matrix?.sourceExecutionPlan?.sha256), "execution-plan fingerprint is invalid");
    require(matrix?.scope?.moduleCount === 6, "module coverage must be six");
    require(matrix?.scope?.exportCount === 6, "export coverage must be six");
    require(matrix?.scope?.activationCount === 6, "activation coverage must be six");
    require(matrix?.scope?.consumerRelationshipCount === 7, "consumer coverage must be seven");
    require(
      this.#same(matrix?.behaviorCases?.map((record) => record.id).sort(), expectedBehaviorIds),
      "behavior case set is incomplete or changed",
    );
    require(
      this.#same(matrix?.compatibilityCases?.map((record) => record.id), expectedCompatibilityIds),
      "compatibility case set is incomplete or changed",
    );
    require(matrix?.behaviorCases?.every((record) =>
      this.#same(record.phases, ["classic-baseline", "post-cutover-esm"]) &&
      record.requiredOutcome === "observable-result-equivalent"), "behavior phase contract differs");
    require(matrix?.compatibilityCases?.every((record) =>
      this.#same(record.phases, ["pre-build-fixture", "post-build-runtime"]) &&
      record.requiredOutcome === "exact-contract-pass"), "compatibility phase contract differs");
    require(matrix?.coverage?.length === 6, "coverage records must include six exports");
    require(matrix?.identityContract?.moduleEvaluationCount === 1, "evaluation count must be one");
    require(matrix?.identityContract?.exactExportReference === true, "exact export reference is required");
    require(matrix?.identityContract?.globalAbsentBeforeActivation === true, "pre-activation absence is required");
    require(matrix?.identityContract?.globalExactAfterActivation === true, "post-activation identity is required");
    require(matrix?.identityContract?.duplicateClassOrStateIdentity === "forbidden", "duplicate identity must be forbidden");
    require(matrix?.consumerContract?.exactRelationshipCount === 7, "consumer relationship count differs");
    require(matrix?.consumerContract?.directTransportReadsAllowed === false, "transport reads must be forbidden");
    require(matrix?.prebuildOpenAllowed === true, "verified matrix must allow pre-build open");
    require(matrix?.runtimeCutoverAllowed === false, "matrix must not directly allow runtime cutover");
    require(matrix?.runtimeCutoverUnlockCondition === "stage-3.6.4-prebuild-contract-opened", "cutover unlock condition differs");
    require(matrix?.verdict === "eligible-for-prebuild-open", "verdict differs");
    if (errors.length > 0) {
      throw new Error(`Stage 3.6.3 focused-matrix contract failed:\n- ${errors.join("\n- ")}`);
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
