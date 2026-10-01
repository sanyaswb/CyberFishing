/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.80";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "equipment-slot-catalog-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Migrate the frozen equipment slot ids, slot groups and slot table to the equipment Domain",
    "Review the five deeply frozen data tables with the new frozenDataConstants shape",
    "Preserve one hundred twenty-five project modules, one hundred twenty-three active activations and one hundred ninety-six bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
