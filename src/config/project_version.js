/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.40";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-input-isolation",
  updatedAt: "2026-06-11",
  notes: Object.freeze([
    "Horizontal pointer Rod Control no longer activates Rod Hold",
    "A fresh pointer press starts Rod Hold after control release",
    "Landing uses authoritative lift tension instead of the smoothed HUD value",
    "Zero line distance is valid inside the landing zone",
    "The 0.05 kg catch scenario must finish with victory",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
