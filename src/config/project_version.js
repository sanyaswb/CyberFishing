/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.7";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stamina-endurance-phase-split",
  updatedAt: "2026-06-27",
  notes: Object.freeze([
    "Split STAMINA and ENDURANCE into separate control and exhaustion phases",
    "STAMINA now drains only from applied player pressure and passively regenerates through angle-scaled recovery",
    "ENDURANCE now drains from active player pressure and resisted fish effort in the exhaustion phase",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
