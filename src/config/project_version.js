/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.21.1";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-ux-stabilization",
  updatedAt: "2026-06-02",
  notes: Object.freeze([
    "Rod Control now works in parallel with Rod Hold",
    "Rod Control HUD shows delivered lateral force instead of alignment progress",
    "Rod Control separates input power, angle efficiency, direction factor and load reserve",
    "Rod Control uses stable target rod X and blocks force when load reserve is gone",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
