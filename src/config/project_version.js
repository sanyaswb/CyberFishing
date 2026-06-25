/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.5";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stamina-active-force-balance",
  updatedAt: "2026-06-26",
  notes: Object.freeze([
    "Stamina now drains from applied Rod Hold and weighted Rod Control force instead of raw tension",
    "Line angle recovery uses the 0-15 / 15-75 / 75+ degree recovery zones",
    "Debug output exposes stamina balance drain, regen, net change and budget overflow diagnostics",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
