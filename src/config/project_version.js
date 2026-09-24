/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.48";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-progression-and-rarity-domain",
  updatedAt: "2026-09-24",
  notes: Object.freeze([
    "Migrate five Items progression and rarity classes to named game-domain ESM exports",
    "Preserve one cumulative graph with forty-two project modules and forty-three activations",
    "Complete frozen batch 011 with seventy-four exact classic-consumer bridge relationships",
    "Preserve descriptor and registry state identity, rarity resolution and metric behavior",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
