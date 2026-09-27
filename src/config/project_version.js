/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.69";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-stamina-balance-frame-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the stamina balance frame",
    "Import the stamina phase machine from batch 029 and the endurance drain calculators",
    "Move the guarded window exposure of StaminaBalanceFrame to the exact activation shim",
    "Retire the stamina phase machine and endurance drain activations as inert classic placeholders",
    "Preserve ninety-eight project modules, ninety-five activations and one hundred thirty-eight bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
