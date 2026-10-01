"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const casting = "src/core/casting_distance.js";
const direction = "src/core/fishing/fish_fight_direction_resolver.js";
const rodPull = "src/core/fishing/rod_pull_calculator.js";
const stacking = "src/core/inventory/inventory_item_stacking_policy.js";
const playerForce = "src/systems/player_force_system.js";
const stress = "src/systems/tackle_stress_system.js";
const fishForce = "src/systems/fish_force_system.js";
const fight = "src/systems/fight_physics_system.js";
const domain = "src/game/domain/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const imported = (consumer, from, exportName, viaShim, activationId) =>
  ({ consumer, from, exportName, legacySymbol: exportName, viaShim, activationId });

// Batch 043 migrates six casting, fishing and inventory sources. Five own collaborators created from
// completed-prefix imports (DistanceUnitConverter, FloatTackleLineBudgetPolicy, Vector2,
// RodStrokeCapacityResolver and the three tackle-stress collaborators): reviewed composition
// identities. The stacking policy keeps one reviewed private static literal Set. Three sources run
// every fight frame (direction, player force, tackle stress; risk level A); their ESM targets are
// representation-only, so every class body, allocation site and call is byte-identical, and the
// post-cutover game-cycle output is compared with the pre-cutover run. Five imported activations
// lose their last classic readers and retire.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-043-casting-fishing-inventory-604ba059",
  batchNumber: "043",
  executionStageLabel: "Stage 3.44.1",
  auditStageLabel: "Stage 3.44.0",
  focusedStageId: "stage-3.44.2",
  prebuildStageId: "stage-3.44.3",
  sourceReleaseVersion: "0.24.80",
  targetReleaseVersion: "0.24.81",
  auditPath: "architecture/migration/stage_3_batch_043_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_043_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_043_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 6,
  expectedActivationCount: 6,
  expectedConsumerCount: 9,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: casting, targetPath: `${domain}casting/cast_distance_calculator.js`, exports: ["CastDistanceCalculator"] },
    { currentPath: direction, targetPath: `${domain}fishing/fish_fight_direction_resolver.js`,
      exports: ["FishFightDirectionResolver"] },
    { currentPath: rodPull, targetPath: `${domain}fishing/rod_pull_calculator.js`, exports: ["RodPullCalculator"] },
    { currentPath: stacking, targetPath: `${domain}inventory/inventory_item_stacking_policy.js`,
      exports: ["InventoryItemStackingPolicy"] },
    { currentPath: playerForce, targetPath: `${domain}fishing/player_force_system.js`, exports: ["PlayerForceSystem"] },
    { currentPath: stress, targetPath: `${domain}fishing/tackle_stress_system.js`, exports: ["TackleStressSystem"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [
    imported(casting, `${domain}casting/distance_unit_converter.js`, "DistanceUnitConverter",
      "src/core/distance_unit_converter.js", "activation-27de2804d152"),
    imported(casting, `${domain}fishing/float_tackle_line_budget_policy.js`, "FloatTackleLineBudgetPolicy",
      "src/core/float_tackle_line_budget_policy.js", "activation-7678742c83cf"),
    imported(direction, "src/engine/math/vector2.js", "Vector2", "src/core/math/vector2.js", "activation-28138de81e82"),
    imported(rodPull, `${domain}fishing/rod_stroke_capacity_resolver.js`, "RodStrokeCapacityResolver",
      "src/core/fishing/rod_stroke_capacity_resolver.js", "activation-57b99d3aaf82"),
    imported(playerForce, "src/engine/math/vector2.js", "Vector2", "src/core/math/vector2.js", "activation-28138de81e82"),
    imported(stress, `${domain}fishing/tackle_failure_selector.js`, "TackleFailureSelector",
      "src/core/fishing/tackle_failure_selector.js", "activation-8110687cd3e1"),
    imported(stress, `${domain}fishing/tackle_stress_accumulator.js`, "TackleStressAccumulator",
      "src/core/fishing/tackle_stress_accumulator.js", "activation-9f3fc146aed0"),
    imported(stress, `${domain}fishing/weakest_tackle_limit_resolver.js`, "WeakestTackleLimitResolver",
      "src/services/weakest_tackle_limit_resolver.js", "activation-3b06bb1eb5b8"),
  ],
  expectedActivationIds: ["activation-1b753bf02256", "activation-38802c3efbfc", "activation-42a10e628147",
    "activation-544317b07a23", "activation-552c2d2ba80f", "activation-aa0a15e8a3fa"],
  expectedActivationPositions: [87, 89, 119, 125, 210, 219],
  expectedBridgeIds: ["bridge-2d85d5d54f3b", "bridge-359a15f20087", "bridge-3fa564e45db2",
    "bridge-46f9d5f6a60c", "bridge-4f2541c77311", "bridge-58b9bf61ab47", "bridge-9c1b33e1f755",
    "bridge-ae5067513523", "bridge-e1f35280f471"],
  expectedRetiredActivationIds: ["activation-3b06bb1eb5b8", "activation-57b99d3aaf82", "activation-7678742c83cf",
    "activation-8110687cd3e1", "activation-9f3fc146aed0"],
  expectedRetiredBridgeIds: ["bridge-1ef925dd2ea8", "bridge-225041916b22", "bridge-262c43042ef7",
    "bridge-537204637b4c", "bridge-54ef64d12545", "bridge-550eed84bb7c", "bridge-60d3aa8afcca",
    "bridge-a2b9c6ef214b"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 125, afterProjectModuleCount: 131,
    beforeActivationCount: 123, afterActivationCount: 124,
    beforeBridgeCount: 196, afterBridgeCount: 197 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.80",
  bridgeReason: "Preserve the exact casting, fight-force, rod-pull, stacking and tackle-stress consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-043-delta-and-keep-batches-001-through-042",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-043",
    "create-six-named-esm-targets-with-six-exports", "render-six-candidate-activation-shims",
    "project-nine-consumer-bridges-and-retire-eight", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.81"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.44.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_043_side_effect_review.json",
    sha256: "cf8cba5fc99f9b1803289a7816963a6cb8fef9dc33e2798ad4636476571bfa05" },
  reviewedContracts: {
    [casting]: contract({
      instanceFields: ["#config", "#converter", "#floatLineBudgetPolicy", "#lineConfig", "#physicsConfig"],
      publicStateShape: ["pixelsPerMeter"],
      semanticRisk: "cast-distance-line-reach-and-float-budget-over-owned-converter-and-budget-policy",
      performanceClassification: "existing-cast-distance-calculator",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new CastDistanceCalculator(" },
        { path: "src/app/fishing.js", marker: "new CastDistanceCalculator(" },
        { path: "src/systems/inventory_system.js", marker: "new CastDistanceCalculator(" },
        { path: "src/systems/line_system.js", marker: "new CastDistanceCalculator(" }],
      allocationBaseline: allocation(13, 0, 2, 0),
      compositionIdentityReview: true,
    }),
    [direction]: contract({
      instanceFields: ["#away", "#lateral", "#result"],
      stableResultIdentity: true,
      semanticRisk: "per-frame-fish-direction-reusing-owned-vectors",
      performanceClassification: "existing-hot-loop-fish-fight-direction",
      hotLoopCallSites: [`${fishForce}#calculate`],
      callSiteEvidence: [{ path: fishForce, marker: "new FishFightDirectionResolver()" }],
      allocationBaseline: allocation(1, 0, 3, 0),
      compositionIdentityReview: true,
    }),
    [rodPull]: contract({
      instanceFields: ["#config", "#strokeCapacityResolver"],
      semanticRisk: "rod-pull-stroke-capacity-force-limit-and-next-state",
      performanceClassification: "existing-hot-loop-rod-pull-calculator",
      hotLoopCallSites: ["src/systems/rod_pull_system.js#update"],
      callSiteEvidence: [{ path: "src/systems/rod_pull_system.js", marker: "new RodPullCalculator(" }],
      allocationBaseline: allocation(22, 0, 1, 0),
      compositionIdentityReview: true,
    }),
    [stacking]: contract({
      instanceFields: ["#ignoredKeys"],
      semanticRisk: "inventory-stack-compatibility-ignoring-reviewed-runtime-keys",
      performanceClassification: "existing-inventory-item-stacking-policy",
      callSiteEvidence: [{ path: "src/systems/inventory_system.js", marker: "new InventoryItemStackingPolicy(" }],
      allocationBaseline: allocation(0, 2, 2, 0),
      stateIdentityReview: { className: "InventoryItemStackingPolicy", collections: [
        { owner: "InventoryItemStackingPolicy.ignoredKeys", field: "#ignoredKeys", scope: "static",
          collection: "Set", allowedOperations: ["has"] },
      ] },
      privateStaticSets: { className: "InventoryItemStackingPolicy", bindings: {
        "#ignoredKeys": { location: "2:25", values: ["instanceId", "quantity", "buildId", "progression",
          "ratingPercent", "progressionLevel", "ratingTier", "normalizedRating", "ratingColor", "ratingGradient",
          "powerPercent", "powerLevel", "normalizedPower", "powerColor", "powerGradient", "qualityMax",
          "freshness", "freshnessPercent"] },
      } },
    }),
    [playerForce]: contract({
      instanceFields: ["#lineDir", "#physicsConfig", "#playerPullDir", "#playerVector"],
      semanticRisk: "per-frame-player-force-angle-penalty-and-drag-limit-reusing-owned-vectors",
      performanceClassification: "existing-hot-loop-player-force",
      hotLoopCallSites: [`${fishForce}#calculatePlayerForce`],
      callSiteEvidence: [{ path: fishForce, marker: "new PlayerForceSystem({" }],
      allocationBaseline: allocation(7, 1, 3, 0),
      compositionIdentityReview: true,
    }),
    [stress]: contract({
      instanceFields: ["#accumulator", "#breakInfo", "#breakReason", "#config", "#currentColor", "#currentStatusColor",
        "#currentStatusLabel", "#currentTensionKg", "#debug", "#devFlags", "#effectiveTensionKg", "#failureSelector",
        "#hook", "#isBroken", "#lastBreakProgress", "#leader", "#lineSystem", "#preventedBreakReason", "#pulsePhase",
        "#reel", "#rng", "#rod", "#selectedFailureComponent", "#stressDebug", "#targetTensionKg", "#tensionPercent",
        "#tensionRatio", "#tensionStressSource", "#weakestLimitResolver"],
      semanticRisk: "per-frame-tension-smoothing-stress-accumulation-and-tackle-failure-with-owned-collaborators",
      performanceClassification: "existing-hot-loop-tackle-stress-system",
      hotLoopCallSites: [`${fight}#updateTension`],
      callSiteEvidence: [{ path: "src/app/fishing.js", marker: "new TackleStressSystem({" }],
      allocationBaseline: allocation(33, 10, 3, 2, 0, 3),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["six-exact-sources-and-method-shapes", "six-export-identities-and-activations",
    "eight-exact-completed-prefix-imports", "five-owner-created-composition-identities",
    "one-reviewed-private-static-literal-set", "nine-exact-consumer-relationships-and-eight-retired-bridges",
    "five-retired-activations", "representation-only-hot-loop-targets-and-equal-game-cycle-output",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Casting Fishing And Inventory Domain",
  codename: "casting-fishing-inventory-domain",
  summary: "Batch 043 migrated the cast distance, fight direction, rod pull, player force, tackle stress and stacking sources to the Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the cast distance calculator, fight direction resolver, rod pull calculator, player force and tackle stress systems and the inventory stacking policy",
    "Import eight completed-prefix collaborators and retire five activations without classic readers",
    "Keep the per-frame targets representation-only and the game-cycle output equal",
    "Preserve one hundred thirty-one project modules, one hundred twenty-four active activations and one hundred ninety-seven bridges",
  ],
  changelog: [
    "- Migrated six casting, fishing and inventory sources with six named ESM exports and eight completed-prefix imports.",
    "- Retired the FloatTackleLineBudgetPolicy, RodStrokeCapacityResolver, TackleFailureSelector, TackleStressAccumulator and WeakestTackleLimitResolver activations; their readers now import them.",
    "- Extended the cumulative runtime from 125 to 131 project modules; 124 active activations and 197 exact bridge relationships.",
    "- The next task is batch 044 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
