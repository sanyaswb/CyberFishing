/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.37";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-axis-tension-mode",
  updatedAt: "2026-06-11",
  notes: Object.freeze([
    "Rod Control tension mode uses normalized control-axis alignment",
    "Same, side, and opposite direction thresholds are configurable",
    "Near-stationary fish movement resolves to neutral side tension",
    "Legacy fishVelocityX calls retain their previous classification",
    "Rod Control overlay reports alignment and signed projection speed",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
