/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.61";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-metric-strategies-domain",
  updatedAt: "2026-09-26",
  notes: Object.freeze([
    "Migrate three item metric strategies as named game-domain ESM exports",
    "Import the shared ItemMetricStrategy superclass from its completed ESM owner",
    "Complete batch 023 of the Stage 3.22 approved prefix",
    "Preserve eighty-two project modules, ninety-two activations and one hundred forty-two bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
