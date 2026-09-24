/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.47";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-assembly-capacity-domain",
  updatedAt: "2026-09-24",
  notes: Object.freeze([
    "Migrate UnlimitedAssemblyCapacityPolicy to a named game-domain ESM export",
    "Preserve one cumulative graph with thirty-seven project modules and thirty-eight activations",
    "Complete frozen batch 010 with sixty-four exact classic-consumer bridge relationships",
    "Preserve assembly capacity behavior, class identity and fresh result allocation",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
