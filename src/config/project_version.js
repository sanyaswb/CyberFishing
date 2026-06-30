/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.14";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "overlay-balance-cleanup",
  updatedAt: "2026-06-28",
  notes: Object.freeze([
    "Simplified Fish Balance overlay to show State Force Preview as the primary section",
    "Moved Fish Summary, Current Fish Force and Fish Debuffs into optional overlay modules",
    "Added state force detail toggles for active force, force multiplier, speed multiplier and behavior weight",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
