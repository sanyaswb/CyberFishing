/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.67";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-sector-angle-stamina-phase-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the pole fight sector angle constraint and the stamina phase machine",
    "Import their owner-created collaborators, two of them from batch 025",
    "Move the guarded window exposure of StaminaPhaseMachine to the exact activation shim",
    "Retire the stamina drain, pressure, transition and regeneration activations as inert classic placeholders",
    "Preserve ninety-five project modules, ninety-six activations and one hundred thirty-eight bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
