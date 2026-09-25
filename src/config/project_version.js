/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.54";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-item-location-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate one Inventory module with two named game-domain ESM exports",
    "Preserve one cumulative graph with sixty-four project modules and sixty-eight activations",
    "Complete frozen batch 017 with one hundred eleven exact classic-consumer bridge relationships",
    "Preserve inventory item location kinds, factories, normalization and validation errors",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
