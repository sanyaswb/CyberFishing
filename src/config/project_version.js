/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.56";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-bait-grade-decay-quality-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate three Items modules with three named game-domain ESM exports",
    "Preserve one cumulative graph with seventy-three project modules and seventy-seven activations",
    "Complete frozen batch 019 with one hundred thirty exact classic-consumer bridge relationships",
    "Preserve bait grade, freshness decay and item quality grade behavior",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
