/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.46";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fish-rarity-stars",
  updatedAt: "2026-07-31",
  notes: Object.freeze([
    "Added twelve fish rarity steps rendered as six half-fillable stars",
    "Calculated rarity from the fish level and its seven weight bands",
    "Added a crown and animated gold Victory theme for the rarest anomaly",
    "Raised the Victory canvas above all DOM interface elements",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
