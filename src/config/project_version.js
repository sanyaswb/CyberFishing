/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.9";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "dynamic-endurance-movement-debuff",
  updatedAt: "2026-06-28",
  notes: Object.freeze([
    "Added a runtime endurance movement debuff for EXHAUSTION phase behavior",
    "Reduced exhausted fish away movement through radial intent overrides",
    "Shifted exhausted behavior selection toward idle/rest without mutating fish config",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
