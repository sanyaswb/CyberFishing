/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.51";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-stamina-tackle-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate six Fishing modules with six named game-domain ESM exports",
    "Preserve one cumulative graph with fifty-six project modules and fifty-nine activations",
    "Complete frozen batch 014 with eighty-nine exact classic-consumer bridge relationships",
    "Preserve landing lift, pressure fatigue, tension build, stamina and tackle failure behavior",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
