"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const items = "src/core/items/";
const domain = "src/game/domain/items/";
const target = (suffix, exports) => ({ currentPath: items + suffix, targetPath: domain + suffix, exports });
const globalExposure = (symbol, location) => ({ symbol, location, mechanism: "global-this-property" });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

const BATCH_019_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-019-items-b0af5033",
  batchNumber: "019",
  executionStageLabel: "Stage 3.19.1",
  auditStageLabel: "Stage 3.19.0",
  focusedStageId: "stage-3.19.2",
  prebuildStageId: "stage-3.19.3",
  sourceReleaseVersion: "0.24.55",
  targetReleaseVersion: "0.24.56",
  auditPath: "architecture/migration/stage_3_batch_019_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_019_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_019_test_matrix.json",
  expectedTargetCount: 3,
  expectedExportCount: 3,
  expectedActivationCount: 3,
  expectedConsumerCount: 7,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    target("bait/bait_effectiveness_grade_policy.js", ["BaitEffectivenessGradePolicy"]),
    target("freshness/bait_freshness_decay_policy.js", ["BaitFreshnessDecayPolicy"]),
    target("quality/item_quality_grade_policy.js", ["ItemQualityGradePolicy"]),
  ],
  expectedActivationIds: ["activation-b7cb0e61096d", "activation-e5ee66b391d6",
    "activation-f247ec6b1d17"],
  expectedActivationPositions: [58, 63, 68],
  expectedBridgeIds: ["bridge-17302d0ad53c", "bridge-92ff45540824", "bridge-9760dcaad25d",
    "bridge-ad3945ed8801", "bridge-d1e27da200fa", "bridge-e50e375b68f8", "bridge-e5c478e6e2ec"],
  expectedTopology: { beforeProjectModuleCount: 70, afterProjectModuleCount: 73,
    beforeActivationCount: 74, afterActivationCount: 77,
    beforeBridgeCount: 123, afterBridgeCount: 130 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.55",
  bridgeReason: "Preserve the exact Items domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-019-delta-and-keep-batches-001-through-018",
  consumerSetSource: "stage-3.19.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-019", "create-three-named-esm-targets",
    "render-three-candidate-activation-shims", "project-seven-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.56"],
}).value;

const BATCH_019_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.19.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_019_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_019_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_019_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_019_side_effect_review.json",
    sha256: "aea1f43ac14bf3f50b97021700135539bca43a2c50f4456c83b00167d767d9f4" },
  reviewedContracts: {
    [items + "bait/bait_effectiveness_grade_policy.js"]: contract({
      instanceFields: ["#maximumStars", "DEFAULT_MAXIMUM_STARS"],
      semanticRisk: "bait-effectiveness-star-grades-rounding-static-default-and-global-exposure",
      performanceClassification: "existing-bait-effectiveness-grade",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new BaitEffectivenessGradePolicy()" }],
      allocationBaseline: allocation(4, 0, 0, 2, 0, 3),
      legacyExposure: globalExposure("BaitEffectivenessGradePolicy", "55:1"),
    }),
    [items + "freshness/bait_freshness_decay_policy.js"]: contract({
      classification: "stateless",
      semanticRisk: "bait-freshness-decay-per-exposure-and-global-exposure",
      performanceClassification: "existing-bait-freshness-decay",
      callSiteEvidence: [{ path: "src/application/inventory/apply_bait_exposure_service.js",
        marker: "decayPolicy = new BaitFreshnessDecayPolicy()" }],
      allocationBaseline: allocation(1, 0, 1, 0),
      legacyExposure: globalExposure("BaitFreshnessDecayPolicy", "13:1"),
    }),
    [items + "quality/item_quality_grade_policy.js"]: contract({
      instanceFields: ["MAXIMUM", "MINIMUM"],
      semanticRisk: "item-quality-grade-bounds-static-limits-and-global-exposure",
      performanceClassification: "existing-item-quality-grade",
      callSiteEvidence: [{ path: "src/core/items/quality/hook_quality_modifier.js",
        marker: "gradePolicy = new ItemQualityGradePolicy()" }],
      allocationBaseline: allocation(1, 0, 0, 0),
      legacyExposure: globalExposure("ItemQualityGradePolicy", "28:1"),
    }),
  },
  migrationGates: ["three-exact-source-and-method-shapes", "three-export-identities-and-activations",
    "three-primitive-literal-static-fields", "three-reviewed-global-this-class-exposures",
    "seven-exact-consumer-relationships", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_019_PREFLIGHT_PROFILE, BATCH_019_EXECUTION_PROFILE };
