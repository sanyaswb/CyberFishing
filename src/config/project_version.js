/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.9";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-v2-stabilized",
  updatedAt: "2026-08-10",
  notes: Object.freeze([
    "Finalize Inventory V2 equipment, assemblies and saved loadout behavior",
    "Keep item parameters and finite-resource meters consistent across views",
    "Reuse one compatibility path for equipment, assembly and inventory filters",
    "Validate inventory behavior through the consolidated automated check runner",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
