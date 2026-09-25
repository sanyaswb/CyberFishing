/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.50";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate six Fishing modules with eight named game-domain ESM exports",
    "Preserve one cumulative graph with fifty project modules and fifty-three activations",
    "Complete frozen batch 013 with eighty-three exact classic-consumer bridge relationships",
    "Preserve cast, fish direction, rod control, fatigue and stamina behavior and identity",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
