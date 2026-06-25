/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.6";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stamina-passive-resisted-effort",
  updatedAt: "2026-06-26",
  notes: Object.freeze([
    "Added optional passive stamina drain from resisted fish effort against a taut line",
    "Stamina balance now combines active drain, passive drain and angle recovery into one frame",
    "Debug output exposes passive effort, resistance, behavior multiplier and total drain diagnostics",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
