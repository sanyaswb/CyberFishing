/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.38";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "player-tension-ceilings",
  updatedAt: "2026-06-11",
  notes: Object.freeze([
    "Rod Hold and Rod Control have independent tension ceilings",
    "Player overload reserve scales from the rod load limit",
    "Rod Control reads current-frame tension after Rod Hold",
    "Ceilings do not stack above the active action limit",
    "Debug overlays report configured multipliers and kilogram ceilings",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
