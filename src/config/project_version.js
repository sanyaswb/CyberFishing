/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.20";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-x",
  updatedAt: "2026-06-02",
  notes: Object.freeze([
    "Rod Control X adds a separate horizontal fight action with gesture lock",
    "Rod Control uses an independent lateral stroke meter and recovery path",
    "Lateral control contributes movement, tension and debug overlay data",
    "Rod visual X offset now follows control input with smoothing and bounds clamping",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
