/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.55";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-bait-freshness-metrics-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate six Items modules with seven named game-domain ESM exports",
    "Preserve one cumulative graph with seventy project modules and seventy-four activations",
    "Complete frozen batch 018 with one hundred twenty-three exact classic-consumer bridge relationships",
    "Preserve bait knowledge, match, freshness, bounded metric and rating tier behavior",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
