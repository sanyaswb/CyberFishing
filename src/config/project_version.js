/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.10";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "endurance-movement-debug-accuracy",
  updatedAt: "2026-06-28",
  notes: Object.freeze([
    "Exposed actual state-specific radial ranges in endurance movement debug",
    "Added last selected movement behavior and sampled radial intent diagnostics",
    "Kept dynamic endurance movement debuff runtime-only without changing lastDash trigger rules",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
