"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const visibility = "src/core/equipment/equipment_slot_visibility_policy.js";
const manual = "src/core/equipment/equipment_transition_planner.js";
const readiness = "src/core/equipment/fishing_readiness_policy.js";
const terminal = "src/core/equipment/terminal_line_slot_resolver.js";
const loadout = "src/core/loadouts/loadout_equipment_transition_planner.js";
const line = "src/systems/line_system.js";
const domain = "src/game/domain/";
const catalog = `${domain}equipment/equipment_slot_catalog.js`;
const catalogShim = "src/config/inventory/equipment_slot_config.js";
const rodCapability = `${domain}equipment/rod_capability_resolver.js`;
const capacity = `${domain}inventory/inventory_capacity_policy.js`;
const composition = "src/application/inventory/inventory_v2_composition_root.js";
const fight = "src/systems/fight_physics_system.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const imported = (consumer, from, exportName, viaShim, activationId) =>
  ({ consumer, from, exportName, legacySymbol: exportName, viaShim, activationId });
const slot = (consumer, exportName, activationId) => imported(consumer, catalog, exportName, catalogShim, activationId);
const rodResolver = consumer => imported(consumer, rodCapability, "RodCapabilityResolver",
  "src/core/equipment/rod_capability_resolver.js", "activation-59bd96059da6");
const unlimited = consumer => imported(consumer, capacity, "UnlimitedInventoryCapacityPolicy",
  "src/core/equipment/inventory_capacity_policy.js", "activation-fae9ef46057a");

// Batch 047 migrates five equipment and loadout rules (slot visibility, manual rod change planner with
// its frozen plan, fishing readiness, terminal-line slot, loadout transition planner) and the line
// system. Each owns a default collaborator created from a completed-prefix import (RodCapabilityResolver,
// UnlimitedInventoryCapacityPolicy, CastDistanceCalculator, LineSpoolState): reviewed composition
// identities; slot ids come from the batch 042 catalog. The line system runs every fight frame (risk
// level A; the frozen plan has no performance gate): its ESM target is representation-only, its release
// and constraint results keep their owned identities, and the game-cycle output is compared before and
// after the cutover. The LineSpoolState activation loses its last classic reader and retires.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-047-equipment-fishing-loadouts-c5fdf727",
  batchNumber: "047",
  executionStageLabel: "Stage 3.48.1",
  auditStageLabel: "Stage 3.48.0",
  focusedStageId: "stage-3.48.2",
  prebuildStageId: "stage-3.48.3",
  sourceReleaseVersion: "0.24.84",
  targetReleaseVersion: "0.24.85",
  auditPath: "architecture/migration/stage_3_batch_047_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_047_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_047_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 7,
  expectedActivationCount: 6,
  expectedConsumerCount: 11,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: visibility, targetPath: `${domain}equipment/equipment_slot_visibility_policy.js`,
      exports: ["EquipmentSlotVisibilityPolicy"] },
    { currentPath: manual, targetPath: `${domain}equipment/equipment_transition_planner.js`,
      exports: ["EquipmentTransitionPlan", "ManualRodChangePlanner"] },
    { currentPath: readiness, targetPath: `${domain}equipment/fishing_readiness_policy.js`, exports: ["FishingReadinessPolicy"] },
    { currentPath: terminal, targetPath: `${domain}equipment/terminal_line_slot_resolver.js`,
      exports: ["TerminalLineSlotResolver"] },
    { currentPath: loadout, targetPath: `${domain}loadouts/loadout_equipment_transition_planner.js`,
      exports: ["LoadoutEquipmentTransitionPlanner"] },
    { currentPath: line, targetPath: `${domain}fishing/line_system.js`, exports: ["LineSystem"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [
    slot(visibility, "EQUIPMENT_ALL_SLOT_IDS", "activation-bc66e23232d8"),
    slot(visibility, "EQUIPMENT_SLOT_CONFIG", "activation-177bcf26ae86"),
    rodResolver(visibility),
    slot(manual, "EQUIPMENT_MAIN_SLOT_IDS", "activation-58caa603fdd9"),
    unlimited(manual),
    slot(readiness, "EquipmentSlotId", "activation-3c14e876e15d"),
    rodResolver(readiness),
    slot(terminal, "EquipmentSlotId", "activation-3c14e876e15d"),
    rodResolver(terminal),
    slot(loadout, "EQUIPMENT_MAIN_SLOT_IDS", "activation-58caa603fdd9"),
    unlimited(loadout),
    imported(line, `${domain}casting/cast_distance_calculator.js`, "CastDistanceCalculator", "src/core/casting_distance.js",
      "activation-544317b07a23"),
    imported(line, `${domain}fishing/line_spool_state.js`, "LineSpoolState", "src/core/line/line_spool_state.js",
      "activation-7f67db779ead"),
  ],
  expectedActivationIds: ["activation-176b4b50794d", "activation-82fd44d25663", "activation-b850bad23769",
    "activation-dbb6e36a8919", "activation-e2c3aa9d15c2", "activation-f06b98f0ba90"],
  expectedActivationPositions: [158, 159, 163, 166, 170, 209],
  expectedBridgeIds: ["bridge-34f7b899327d", "bridge-375b256d362a", "bridge-5c47196deed2", "bridge-5cc2dfa4d9d2",
    "bridge-7f8f28fe4260", "bridge-809ee5af4f2e", "bridge-8552e9702fef", "bridge-967a0fdf87ae", "bridge-aa4b6227399a",
    "bridge-b26ba8739153", "bridge-f71c63330b1b"],
  expectedRetiredActivationIds: ["activation-7f67db779ead"],
  expectedRetiredBridgeIds: ["bridge-147d6cace9f9", "bridge-289f736e1af7", "bridge-299e2a323f55", "bridge-3d9abab097f9",
    "bridge-4c14b57df8d8", "bridge-691e8a5b2dc1", "bridge-7b4507b87811", "bridge-84f91b03422f", "bridge-9c1b33e1f755",
    "bridge-c38c025ddc66", "bridge-eb5bcad15dea", "bridge-fd866aee9c88"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 135, afterProjectModuleCount: 141,
    beforeActivationCount: 126, afterActivationCount: 131,
    beforeBridgeCount: 201, afterBridgeCount: 200 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.84",
  bridgeReason: "Preserve the exact equipment rule, loadout planner and line system consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-047-delta-and-keep-batches-001-through-046",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-047",
    "create-six-named-esm-targets-with-seven-exports", "render-six-candidate-activation-shims",
    "project-eleven-consumer-bridges-and-retire-twelve", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.85"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.48.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_047_side_effect_review.json",
    sha256: "9fd60e5bfdc2ec1f8374b27a81afa3f5c811c694168a74be5ddc47ba0b242363" },
  reviewedContracts: {
    [visibility]: contract({
      instanceFields: ["#capabilityResolver", "#slotConfig"],
      semanticRisk: "slot-visibility-by-slot-group-and-rod-capabilities-over-owned-capability-resolver",
      performanceClassification: "existing-equipment-slot-visibility-policy",
      callSiteEvidence: [{ path: composition, marker: "new EquipmentSlotVisibilityPolicy({" },
        { path: "src/core/equipment/equipment_compatibility_policy.js", marker: "new EquipmentSlotVisibilityPolicy({" },
        { path: "src/core/equipment/equipment_slot_availability_policy.js", marker: "new EquipmentSlotVisibilityPolicy({ " }],
      allocationBaseline: allocation(6, 0, 1, 0),
      compositionIdentityReview: true,
    }),
    [manual]: contract({
      instanceFields: ["#capacityPolicy", "#mainSlotIds", "#messages"],
      publicStateShape: ["isNoop"],
      semanticRisk: "manual-rod-change-movements-capacity-and-frozen-transition-plan-with-injected-text",
      performanceClassification: "existing-manual-rod-change-planner",
      callSiteEvidence: [{ path: composition, marker: "new ManualRodChangePlanner({" }],
      allocationBaseline: allocation(21, 7, 4, 7),
      compositionIdentityReview: true,
    }),
    [readiness]: contract({
      instanceFields: ["#assemblyReader", "#capabilityResolver", "#itemReader", "#messages"],
      semanticRisk: "cast-bite-chum-and-leader-readiness-over-injected-readers-and-text",
      performanceClassification: "existing-fishing-readiness-policy",
      callSiteEvidence: [{ path: composition, marker: "new FishingReadinessPolicy({" }],
      allocationBaseline: allocation(10, 4, 1, 5),
      compositionIdentityReview: true,
    }),
    [terminal]: contract({
      instanceFields: ["#capabilityResolver"],
      semanticRisk: "terminal-line-slot-accept-types-by-rod-reel-support",
      performanceClassification: "existing-terminal-line-slot-resolver",
      callSiteEvidence: [{ path: composition, marker: "new TerminalLineSlotResolver({" },
        { path: "src/core/equipment/equipment_compatibility_policy.js", marker: "new TerminalLineSlotResolver({" },
        { path: "src/core/equipment/equipment_slot_availability_policy.js", marker: "new TerminalLineSlotResolver()" }],
      allocationBaseline: allocation(3, 3, 1, 4),
      compositionIdentityReview: true,
    }),
    [loadout]: contract({
      instanceFields: ["#capacityPolicy", "#mainSlotIds", "#messages", "#ownershipReader"],
      semanticRisk: "loadout-activation-movements-root-owners-and-capacity-with-injected-text",
      performanceClassification: "existing-loadout-equipment-transition-planner",
      callSiteEvidence: [{ path: composition, marker: "new LoadoutEquipmentTransitionPlanner({" },
        { path: "src/application/inventory/loadout_application_service.js", marker: "new LoadoutEquipmentTransitionPlanner({" }],
      allocationBaseline: allocation(16, 6, 2, 6),
      compositionIdentityReview: true,
    }),
    [line]: contract({
      instanceFields: ["#baseReachMeters", "#config", "#distanceCalculator", "#distanceMeters",
        "#durabilityLossPerPercent", "#hasReel", "#initialized", "#isFullyExtended", "#lastConstraintResult",
        "#lastRecoveredMeters", "#lastReleasedMeters", "#lastReleaseResult", "#lineDurability", "#lineExtensionRatio",
        "#lineMaxLoadKg", "#maxRemainingMeters", "#pixelsPerMeter", "#reelLineMeters", "#releasedMeters",
        "#remainingMeters", "#spoolState", "#totalLengthMeters"],
      stableResultIdentity: true,
      semanticRisk: "per-frame-line-release-recovery-and-constraint-with-owned-spool-and-reused-result-objects",
      performanceClassification: "existing-hot-loop-line-system",
      hotLoopCallSites: [`${fight}#inspectPoleFightSector`, `${fight}#resolveLineLimit`, `${fight}#updateFishMotion`,
        `${fight}#updateRodControl`, `${fight}#updateRodPull`, "src/systems/reel_system.js#recoverLineCredit",
        "src/systems/reel_system.js#recoverRodStrokeCredit"],
      callSiteEvidence: [{ path: "src/app/fishing.js", marker: "new LineSystem({" }],
      allocationBaseline: allocation(17, 0, 2, 0),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["six-exact-sources-and-method-shapes", "seven-export-identities-and-six-activations",
    "thirteen-exact-earlier-batch-and-completed-prefix-imports", "seven-owner-created-composition-identities",
    "eleven-exact-consumer-relationships-and-twelve-retired-bridges", "one-retired-activation",
    "representation-only-hot-loop-target-and-equal-game-cycle-output",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Equipment Rules Loadout Planner And Line System Domain",
  codename: "equipment-rules-loadout-planner-line-system-domain",
  summary: "Batch 047 migrated the equipment slot, readiness and transition rules, the loadout transition planner and the line system to the Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the slot visibility policy, manual rod change planner with its transition plan, fishing readiness policy, terminal-line slot resolver, loadout transition planner and line system",
    "Import thirteen slot catalog and completed-prefix collaborators and retire the LineSpoolState activation without classic readers",
    "Keep the per-frame line system representation-only and the game-cycle output equal",
    "Preserve one hundred forty-one project modules, one hundred thirty-one active activations and two hundred bridges",
  ],
  // Short format from this release on (owner decision 2026-10-01): 1-3 lines; details live in the commit and tag.
  changelog: [
    "- Migrated the equipment slot, readiness and transition rules, the loadout transition planner and the per-frame LineSystem to the Domain (representation-only, game-cycle output unchanged).",
    "- Changelog trimmed to v0.24.70 and newer; older entries live in git history and the stage3-evidence-archive tag.",
  ],
  // Reviewed trim (owner decision 2026-10-01): entries from v0.24.69 down leave the changelog in this release.
  changelogTrimFrom: "0.24.69",
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
