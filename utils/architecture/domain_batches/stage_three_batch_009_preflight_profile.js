"use strict";
const { BATCH_009_EXECUTION_PROFILE } = require("./stage_three_batch_009_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const BATCH_009_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1, stageLabel: "Stage 3.9.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_009_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_009_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_009_EXECUTION_PROFILE,
  reviewedContracts: {
    "src/core/fish/fish_anomaly_variant_resolver.js": {
      classification: "instance-owned-config-and-frozen-none-result-cache",
      instanceFields: ["#noneAnomalyId", "#noneResult"], publicStateShape: [],
      resultShape: ["anomalyId", "hasAnomaly"],
      stableResultIdentity: true, mutatesCallerInputs: false,
      performanceClassification: "per-instance-none-cache-and-per-success-result-allocation",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new FishAnomalyVariantResolver({" }],
      allocationBaseline: { objectExpressions: 4, arrayExpressions: 1, newExpressions: 0, objectFreezeCalls: 2, objectAssignCalls: 0, roundingCalls: 0 },
      semanticRisk: "none-cache-instance-isolation-chance-roll-boundaries-location-and-id-normalization",
    },
    "src/core/fish/fish_rarity_resolver.js": {
      classification: "instance-owned-normalized-config-and-none-id-set",
      instanceFields: ["#maxHalfSteps", "#maxStars", "#noneAnomalyIds", "#unitsPerStar", "#weightBandsPerLevel", "#weightUnitsPerKg"],
      publicStateShape: [], resultShape: ["anomaly", "hasAnomaly", "isUnique", "level", "maxLevel", "rarity"],
      stableResultIdentity: false, mutatesCallerInputs: false,
      performanceClassification: "constructor-set-and-per-call-frozen-result-range-allocation",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new FishRarityResolver(" }],
      allocationBaseline: { objectExpressions: 15, arrayExpressions: 3, newExpressions: 1, objectFreezeCalls: 2, objectAssignCalls: 0, roundingCalls: 12 },
      semanticRisk: "weight-unit-rounding-inclusive-bands-range-gap-tie-break-level-clamp-config-snapshot-and-frozen-shape",
    },
  },
  migrationGates: [
    "representation-only-source-equivalence", "same-instance-owner-before-and-after",
    "no-new-config-imports-or-global-config-reads", "cached-none-result-is-per-instance-not-singleton",
    "whole-cumulative-closure-safe-for-earlier-evaluation", "exact-legacy-exposure-positions",
    "zero-added-allocations-and-transport-lookups",
  ],
}).value;
module.exports = { BATCH_009_PREFLIGHT_PROFILE };
