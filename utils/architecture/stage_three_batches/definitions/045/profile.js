"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const state = "src/core/equipment/equipment_state.js";
const loadout = "src/core/loadouts/equipment_loadout.js";
const catalog = "src/game/domain/equipment/equipment_slot_catalog.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const slotImport = (consumer, exportName, activationId) => ({ consumer, from: catalog, exportName,
  legacySymbol: exportName, viaShim: "src/config/inventory/equipment_slot_config.js", activationId });

// Batch 045 migrates the equipment root state and the equipment loadout. Both import the main and
// auxiliary slot ids of the batch 042 catalog (one earlier-batch import record per symbol). The
// loadout's persisted default name LOADOUT_DISPLAY_NAME ("Комплект", save format; owner decision
// 2026-09-29) is a reviewed top-level literal constant exported beside the class. Risk level B
// (state owners whose persisted shape is unchanged: representation-only targets, snapshot/restore
// cases). The auxiliary slot id activation loses its last classic readers and retires as a shared-source
// line removal: the slot catalog's other four activations keep its shim and legacy slot 30.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-045-equipment-loadouts-f4fab38e",
  batchNumber: "045",
  executionStageLabel: "Stage 3.46.1",
  auditStageLabel: "Stage 3.46.0",
  focusedStageId: "stage-3.46.2",
  prebuildStageId: "stage-3.46.3",
  sourceReleaseVersion: "0.24.82",
  targetReleaseVersion: "0.24.83",
  auditPath: "architecture/migration/stage_3_batch_045_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_045_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_045_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 3,
  expectedActivationCount: 2,
  expectedConsumerCount: 5,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: state, targetPath: "src/game/domain/equipment/equipment_state.js", exports: ["EquipmentState"] },
    { currentPath: loadout, targetPath: "src/game/domain/loadouts/equipment_loadout.js",
      exports: ["EquipmentLoadout", "LOADOUT_DISPLAY_NAME"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [
    slotImport(state, "EQUIPMENT_AUXILIARY_SLOT_IDS", "activation-0c061ffb07d6"),
    slotImport(state, "EQUIPMENT_MAIN_SLOT_IDS", "activation-58caa603fdd9"),
    slotImport(loadout, "EQUIPMENT_AUXILIARY_SLOT_IDS", "activation-0c061ffb07d6"),
    slotImport(loadout, "EQUIPMENT_MAIN_SLOT_IDS", "activation-58caa603fdd9"),
  ],
  expectedActivationIds: ["activation-07d23f1fe2ec", "activation-6088d7e23f95"],
  expectedActivationPositions: [160, 168],
  expectedBridgeIds: ["bridge-4f68e27e6b7b", "bridge-551355d4d947", "bridge-636ce7883f6f",
    "bridge-64632d0e888b", "bridge-85ff03affd96"],
  expectedRetiredActivationIds: ["activation-0c061ffb07d6"],
  expectedRetiredBridgeIds: ["bridge-1299ad9a2b2d", "bridge-ddd9f08863d4"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 132, afterProjectModuleCount: 134,
    beforeActivationCount: 125, afterActivationCount: 126,
    beforeBridgeCount: 198, afterBridgeCount: 201 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.82",
  bridgeReason: "Preserve the exact equipment state and loadout consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-045-delta-and-keep-batches-001-through-044",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-045",
    "create-two-named-esm-targets-with-three-exports", "render-two-candidate-activation-shims",
    "project-five-consumer-bridges-and-retire-two", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.83"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.46.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_045_side_effect_review.json",
    sha256: "2fbd2c6a38cb9a6eba9d535e5d295bde70c102bbdd48570e9ac4b6839c91f0f7" },
  reviewedContracts: {
    [state]: contract({
      instanceFields: ["#auxiliarySlotIds", "#mainSlotIds", "#roots", "#slotIds"],
      semanticRisk: "single-source-of-active-equipment-roots-with-frozen-slot-sets-and-snapshot-restore",
      performanceClassification: "existing-equipment-state",
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new EquipmentState(" },
        { path: "src/infrastructure/storage/inventory_v2_legacy_migration.js", marker: "new EquipmentState(" }],
      allocationBaseline: allocation(6, 7, 2, 5),
    }),
    [loadout]: contract({
      instanceFields: ["#mainSlotIds", "#rootInstanceIds"],
      literalConstants: ["LOADOUT_DISPLAY_NAME"],
      semanticRisk: "persisted-equipment-loadout-roots-name-and-display-type-save-format",
      performanceClassification: "existing-equipment-loadout",
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_command_service.js", marker: "new EquipmentLoadout({" },
        { path: "src/core/loadouts/equipment_loadout_repository.js", marker: "new EquipmentLoadout(" }],
      allocationBaseline: allocation(4, 3, 4, 3),
    }),
  },
  migrationGates: ["two-exact-sources-and-method-shapes", "three-export-identities-and-two-activations",
    "four-exact-earlier-batch-imports", "one-reviewed-persisted-literal-constant",
    "five-exact-consumer-relationships-and-two-retired-bridges", "one-shared-source-activation-retirement",
    "persisted-loadout-and-equipment-snapshots-unchanged", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Equipment State And Loadout Domain",
  codename: "equipment-state-loadout-domain",
  summary: "Batch 045 migrated the equipment root state and the equipment loadout to the Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the equipment root state and the equipment loadout with its persisted default name",
    "Import the main and auxiliary slot ids from the equipment slot catalog and retire the auxiliary activation from the shared catalog shim",
    "Preserve one hundred thirty-four project modules, one hundred twenty-six active activations and two hundred one bridges",
  ],
  changelog: [
    "- Migrated EquipmentState and EquipmentLoadout with LOADOUT_DISPLAY_NAME as named ESM exports; persisted snapshots are unchanged.",
    "- Retired the EQUIPMENT_AUXILIARY_SLOT_IDS activation as a shared-source line removal (new in the shared tooling): the catalog shim keeps its other four activations.",
    "- Extended the cumulative runtime from 132 to 134 project modules; 126 active activations and 201 exact bridge relationships.",
    "- The next task is batch 046 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
