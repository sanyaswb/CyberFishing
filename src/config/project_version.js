/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.42";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "tackle-aware-rod-stroke",
  updatedAt: "2026-07-31",
  notes: Object.freeze([
    "Resolved pole rod stroke capacity from equipped line length",
    "Resolved reel rod stroke capacity from physical rod length",
    "Passed the active line-system length and reel state into RodPullSystem",
    "Centralized tackle-aware capacity selection in RodStrokeCapacityResolver",
    "Added regression checks for 10m pole and 3m reel-rod stroke capacities",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
