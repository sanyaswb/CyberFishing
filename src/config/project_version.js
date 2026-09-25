/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.52";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-endurance-pressure-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate six Fishing modules with six named game-domain ESM exports",
    "Preserve one cumulative graph with sixty-two project modules and sixty-five activations",
    "Complete frozen batch 015 with ninety-five exact classic-consumer bridge relationships",
    "Preserve endurance debuff, pressure gain, endurance drain, lateral position and tackle limit behavior",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
