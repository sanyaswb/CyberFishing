/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.45";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "utility-role-cleanup",
  updatedAt: "2026-06-11",
  notes: Object.freeze([
    "Separated diagnostics, compatibility checks and lifecycle audits",
    "Renamed the fish speed diagnostic around radial movement",
    "Added radial speed and direction-ratio debug fields",
    "Split legacy Y rod-stroke checks from core Rod Pull regressions",
    "Kept legacy debug aliases and npm check commands compatible",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
