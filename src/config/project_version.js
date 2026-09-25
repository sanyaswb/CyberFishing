/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.53";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-pressure-fatigue-source-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate one Fishing module with one named game-domain ESM export",
    "Preserve one cumulative graph with sixty-three project modules and sixty-six activations",
    "Complete frozen batch 016 with ninety-six exact classic-consumer bridge relationships",
    "Preserve pressure fatigue source modes, reasons and configuration precedence",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
