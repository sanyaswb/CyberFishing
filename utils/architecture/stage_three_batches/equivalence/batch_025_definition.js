"use strict";

const { StageThreeBatchDefinition } = require("../core/batch_definition");
const { BATCH_025_PREFLIGHT_PROFILE } = require("../../domain_batches/stage_three_batch_025_preflight_profile");
const { BATCH_025_EXECUTABLE_CASES } = require("../../domain_batches/stage_three_batch_025_behavior_cases");
const { BATCH_025_MATRIX_DEPENDENCIES } = require("../../domain_batches/stage_three_batch_025_focused_test_catalog");

// Batch 025 expressed as a shared definition from its accepted, unchanged tooling. It exists only
// to prove the shared lifecycle reproduces the accepted batch-025 artifacts byte-for-byte; it is
// deliberately outside the definitions registry, so it never joins the shared history chain.
const BATCH_025_DEFINITION = new StageThreeBatchDefinition({
  number: "025",
  profile: {
    PREFLIGHT_PROFILE: BATCH_025_PREFLIGHT_PROFILE,
    RESOLVED_DEBT_IDS: ["debt-browser-capability-af15d3daf1d0"],
    RELEASE: {
      title: "Fishing Sector Pressure and Retrieve Domain",
      codename: "fishing-sector-pressure-retrieve-domain",
      summary: "Batch 025 migrated PoleFightSectorConstraint, StaminaPressureResolver and FishRetrieveSystem.",
      smokeContext: "Response to the Stage 3.26.8 Fishing checklist: casting, fight sector limits of the rod, lateral stamina pressure, reeling/retrieve of the fish, landing and zero console errors/warnings.",
      notes: [
        "Migrate the pole fight sector constraint, stamina pressure resolver and fish retrieve system",
        "Import their five owner-created collaborators from completed ESM owners",
        "Move the guarded window exposure of StaminaPressureResolver to the exact activation shim",
        "Retire StaminaLateralPositionResolver and FishRetrieveResult activations as inert classic placeholders",
        "Preserve eighty-six project modules, ninety-four activations and one hundred forty-one bridges",
      ],
      changelog: [
        "- Completed batch 025 of the Stage 3.22 approved prefix: PoleFightSectorConstraint, StaminaPressureResolver and FishRetrieveSystem as named ESM exports.",
        "- Their owner-created collaborators (PoleFightSectorGeometry, StaminaLateralPositionResolver, DragForceCalculator, FishRetrieveResult, SimpleFightForceCalculator) are reviewed imports; a composition-identity review proves each new X at its audited location, and Domain-internal self-composition resolves the constructor-injection review. The guarded window exposure moved to the activation shim.",
        "- Extended the cumulative graph from 83 to 86 project modules and from 93 to 94 activation contracts (3 added, 2 consumer-less activations retired as inert classic placeholders), with 141 exact bridge relationships (4 added, 5 retired).",
        "- The next task is batch 026 preflight.",
      ],
    },
  },
  behavior: {
    EXECUTABLE_CASES: BATCH_025_EXECUTABLE_CASES,
    MATRIX: {
      behaviorCases: BATCH_025_MATRIX_DEPENDENCIES.behaviorCases,
      compatibilityCases: BATCH_025_MATRIX_DEPENDENCIES.compatibilityCases,
    },
  },
});

module.exports = { BATCH_025_DEFINITION };
