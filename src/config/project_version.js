/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.8";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stamina-frame-recovery-punishment-fix",
  updatedAt: "2026-06-27",
  notes: Object.freeze([
    "Removed legacy recovery punishment from the frame-based STAMINA phase",
    "Aligned exhaustion debug/mastery duration with configured endurance drain rates",
    "Synchronized frame-based power debuff progression from actual endurance loss",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
