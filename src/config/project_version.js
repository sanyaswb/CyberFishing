/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.27";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "simultaneous-touch-hold-control-tension-build-rate",
  updatedAt: "2026-07-05",
  notes: Object.freeze([
    "Fixed touch fight input so lateral control no longer cancels rod hold",
    "Allowed touch Rod Hold and Rod Control to be active simultaneously",
    "Added explicit TENSION build-rate resolver for hold/control combinations",
    "Made hold + control fill TENSION faster without increasing tension caps or final load",
    "Added debug and overlay fields for tension build mode, build multiplier, cap blocking and reserve",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
