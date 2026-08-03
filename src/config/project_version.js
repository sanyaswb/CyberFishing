/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.50";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "anomaly-driven-unique-fish",
  updatedAt: "2026-07-31",
  notes: Object.freeze([
    "Roll anomalous fish independently from weight-based rarity",
    "Restrict anomaly variants by species-configured locations and chance",
    "Route every anomalous crucian level to its matching unique skin",
    "Keep fixed catches and DevTools on the same anomaly and visual model",
    "Remove the obsolete maximum-rarity unique-fish policy",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
