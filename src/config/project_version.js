/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.39";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-hold-style-force",
  updatedAt: "2026-07-07",
  notes: Object.freeze([
    "Changed Rod Control X force to use hold-style available tension budget",
    "Removed fixed Rod Control max force and fish-weight force divisor from active force calculation",
    "Made 20 degrees the single configured full-force Rod Control angle",
    "Changed HUD Rod Control bar to show input ratio with delivered tension in the label",
    "Cleaned legacy Rod Control weight input and direct drag reserve cutting from the control channel",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
