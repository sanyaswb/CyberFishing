"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const slots = "src/config/inventory/equipment_slot_config.js";
const composition = "src/application/inventory/inventory_v2_composition_root.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Reviewed slot identifiers and tables of the classic source, in source order.
const MAIN = ["rod", "reel", "terminalLine", "tackle", "float"];
const AUXILIARY = ["handChum", "net", "delivery", "gasMask"];
const slot = (id, group, visibility, acceptTypes, extra = {}) => ({ id, group, visibility, acceptTypes, ...extra });

// Batch 042 migrates the equipment slot catalog: a data source of five top-level deeply frozen tables
// (23 Object.freeze calls over literals and earlier bindings of the same source). The frozen
// side-effect review is resolved by the reviewed frozenDataConstants shape, added to the shared
// tooling for this source (the frozenConstants shape requires a class and flat literal tables).
// Persisted slot ids are save format and stay byte-identical; fifteen classic consumers read the
// five exports through their activations.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-042-equipment-6f782961",
  batchNumber: "042",
  executionStageLabel: "Stage 3.43.1",
  auditStageLabel: "Stage 3.43.0",
  focusedStageId: "stage-3.43.2",
  prebuildStageId: "stage-3.43.3",
  sourceReleaseVersion: "0.24.79",
  targetReleaseVersion: "0.24.80",
  auditPath: "architecture/migration/stage_3_batch_042_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_042_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_042_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 5,
  expectedActivationCount: 5,
  expectedConsumerCount: 15,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: slots, targetPath: "src/game/domain/equipment/equipment_slot_catalog.js",
      exports: ["EQUIPMENT_ALL_SLOT_IDS", "EQUIPMENT_AUXILIARY_SLOT_IDS", "EQUIPMENT_MAIN_SLOT_IDS",
        "EQUIPMENT_SLOT_CONFIG", "EquipmentSlotId"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [],
  expectedActivationIds: ["activation-0c061ffb07d6", "activation-177bcf26ae86", "activation-3c14e876e15d",
    "activation-58caa603fdd9", "activation-bc66e23232d8"],
  expectedActivationPositions: [30, 30, 30, 30, 30],
  expectedBridgeIds: ["bridge-1299ad9a2b2d", "bridge-147d6cace9f9", "bridge-24a053ebadb8",
    "bridge-4c14b57df8d8", "bridge-4e3ebadf8b3a", "bridge-4e502cbad3d4", "bridge-691e8a5b2dc1",
    "bridge-71b223bc178a", "bridge-84f91b03422f", "bridge-8f5ad06b2f6f", "bridge-9bbb538cc1b6",
    "bridge-ddd9f08863d4", "bridge-e6bc462714e6", "bridge-eb5bcad15dea", "bridge-f3446ce3cb4c"],
  expectedRetiredActivationIds: [],
  expectedRetiredBridgeIds: [],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 124, afterProjectModuleCount: 125,
    beforeActivationCount: 118, afterActivationCount: 123,
    beforeBridgeCount: 181, afterBridgeCount: 196 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.79",
  bridgeReason: "Preserve the exact equipment slot catalog readers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-042-delta-and-keep-batches-001-through-041",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-042",
    "create-one-named-esm-target-with-five-exports", "render-five-candidate-activation-shims",
    "project-fifteen-consumer-bridges", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.80"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.43.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_042_side_effect_review.json",
    sha256: "54ed3b5b1be3bd7e0fe57e31dd62789dd67e6ec2c13e38cb50554375842c379d" },
  reviewedContracts: {
    [slots]: contract({
      frozenDataConstants: { bindings: {
        EquipmentSlotId: { location: "7:25", values: { ROD: "rod", REEL: "reel", TERMINAL_LINE: "terminalLine",
          TACKLE: "tackle", FLOAT: "float", HAND_CHUM: "handChum", NET: "net", DELIVERY: "delivery",
          GAS_MASK: "gasMask" } },
        EQUIPMENT_MAIN_SLOT_IDS: { location: "19:33", values: MAIN },
        EQUIPMENT_AUXILIARY_SLOT_IDS: { location: "27:38", values: AUXILIARY },
        EQUIPMENT_ALL_SLOT_IDS: { location: "34:32", values: [...MAIN, ...AUXILIARY] },
        EQUIPMENT_SLOT_CONFIG: { location: "39:31", values: {
          rod: slot("rod", "main", "always", ["rod"]),
          reel: slot("reel", "main", "supportsReel", ["reel"]),
          terminalLine: slot("terminalLine", "main", "rodSelected", ["fishing_line", "leader_line"]),
          tackle: slot("tackle", "main", "rodSelected", ["hook", "feeder_rig", "lure"]),
          float: slot("float", "main", "supportsFloat", ["float"]),
          handChum: slot("handChum", "auxiliary", "always", ["chum_mix"]),
          net: slot("net", "auxiliary", "always", ["net"]),
          delivery: slot("delivery", "auxiliary", "always", ["boat", "chum_delivery"]),
          gasMask: slot("gasMask", "auxiliary", "always", ["gas_mask"], { locked: true }),
        } },
      } },
      semanticRisk: "persisted-equipment-slot-ids-and-frozen-slot-table-identity-shared-by-fifteen-readers",
      performanceClassification: "existing-frozen-slot-catalog",
      callSiteEvidence: [{ path: composition, marker: "slotConfig: EQUIPMENT_SLOT_CONFIG" },
        { path: composition, marker: "slotIds: EQUIPMENT_ALL_SLOT_IDS" }],
      allocationBaseline: allocation(0, 0, 0, 0),
    }),
  },
  migrationGates: ["one-exact-source-of-five-frozen-data-tables", "five-export-identities-and-five-activations",
    "reviewed-frozen-data-constants-evaluation", "fifteen-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "persisted-slot-ids-byte-identical",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Equipment Slot Catalog Domain",
  codename: "equipment-slot-catalog-domain",
  summary: "Batch 042 migrated the frozen equipment slot catalog to the equipment Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-09-30 authorization: game-cycle re-executed without seals, game loaded in the browser, and console errors and warnings counted.",
  notes: [
    "Migrate the frozen equipment slot ids, slot groups and slot table to the equipment Domain",
    "Review the five deeply frozen data tables with the new frozenDataConstants shape",
    "Preserve one hundred twenty-five project modules, one hundred twenty-three active activations and one hundred ninety-six bridges",
  ],
  changelog: [
    "- Migrated the equipment slot catalog source with five named ESM exports; the persisted slot ids and frozen tables are unchanged.",
    "- Added the reviewed frozenDataConstants shape to the shared Stage 3 batch tooling for data sources made only of deeply frozen tables.",
    "- Added fifteen exact classic consumer bridges and five activations at legacy slot 30.",
    "- Extended the cumulative runtime from 124 to 125 project modules and the active activation set from 118 to 123 contracts, with 196 exact bridge relationships.",
    "- Correction: batch 039 browser acceptance was the automated substitute, not the owner; the browser-acceptance step now requires an explicit --performed-by basis.",
    "- The next task is batch 043 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
