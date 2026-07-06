/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.35";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "reel-hold-debug-speed",
  updatedAt: "2026-07-06",
  notes: Object.freeze([
    "Made reel hold applied speed use the real frame dt in debug snapshots",
    "Added debug fields that explain previous-frame movement state handoff",
    "Exposed reel hold movement dt and previous/current engagement states in console diagnostics",
    "Added regression coverage for reel hold applied speed",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
