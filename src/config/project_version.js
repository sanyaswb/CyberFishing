/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.4";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-center-start-session",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Separated Rod Control center-start sessions from center-arrival alignment",
    "Allowed center_start only when the active control session begins centered",
    "Kept side-start Rod Control anchored when the fish reaches center",
    "Defaulted Rod Control targetAnchorMode to cast_base for gameplay testing",
    "Added debug output for Rod Control started-centered state",
    "Added regression coverage for side-start center crossing",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
