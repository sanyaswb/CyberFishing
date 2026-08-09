/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.0";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-v2-assemblies",
  updatedAt: "2026-08-09",
  notes: Object.freeze([
    "Rebuild the inventory around equipment slots and assembled items",
    "Add reusable craft editors for reels, rigs, hooks and bait boats",
    "Show only compatible components while an assembly editor is open",
    "Preserve complete equipment loadouts and auto-refill preferences",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
