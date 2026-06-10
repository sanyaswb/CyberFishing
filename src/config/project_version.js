/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.34";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fixed-length-line-constraint",
  updatedAt: "2026-06-10",
  notes: Object.freeze([
    "Line payout capability is resolved separately from physical spool limits",
    "Taut locked-line Rod Control movement follows the fixed line radius",
    "Fish movement uses already released free line before drag engages",
    "Slack-to-taut transitions are resolved inside the movement frame",
    "Drag holding and empty spool release blocks have distinct diagnostics",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
