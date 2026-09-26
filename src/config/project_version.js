/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.60";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "assemblies-item-reader-domain",
  updatedAt: "2026-09-26",
  notes: Object.freeze([
    "Migrate the Assemblies read model with two named game-domain ESM exports",
    "Import InventoryItemLocation from its completed ESM owner instead of the legacy global",
    "Adopt the Stage 3.22 approved prefix and complete its first batch 022",
    "Preserve seventy-nine project modules, eighty-nine activations and one hundred forty-two bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
