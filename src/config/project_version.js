/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.87";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "equipment-loadout-repository-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Adopt the Stage 3.50.0 repeated review",
    "Migrate the equipment loadout repository with its reviewed loadout map and global exposure",
    "Preserve one hundred forty-three project modules, one hundred thirty-three active activations and one hundred ninety-eight bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
