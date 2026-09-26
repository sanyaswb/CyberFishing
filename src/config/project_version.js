/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.63";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-sector-pressure-retrieve-domain",
  updatedAt: "2026-09-26",
  notes: Object.freeze([
    "Migrate the pole fight sector constraint, stamina pressure resolver and fish retrieve system",
    "Import their five owner-created collaborators from completed ESM owners",
    "Move the guarded window exposure of StaminaPressureResolver to the exact activation shim",
    "Retire StaminaLateralPositionResolver and FishRetrieveResult activations as inert classic placeholders",
    "Preserve eighty-six project modules, ninety-four activations and one hundred forty-one bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
